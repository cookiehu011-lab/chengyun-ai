#!/usr/bin/env python3
"""Enrich validation samples with Amap evidence (live API or sync from xuanwu_camera)."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
load_dotenv(ROOT / ".env")

from amap_client import enrich_for_camera, has_amap_key  # noqa: E402


def db():
    return psycopg.connect(
        host=os.getenv("DB_HOST", "140.143.52.213"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "seetime-camera"),
        user=os.getenv("DB_USERNAME", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        row_factory=dict_row,
        connect_timeout=20,
    )


def ensure_schema(cur) -> None:
    cur.execute((ROOT / "sql" / "003_amap_evidence.sql").read_text(encoding="utf-8"))


def sync_from_xuanwu(cur) -> int:
    cur.execute(
        """
        UPDATE ai_model_validation v SET
          amap_formatted_address = x.formatted_address,
          amap_nearest_poi_name = x.amap_nearest_poi_name,
          amap_nearest_poi_type = x.amap_nearest_poi_type,
          amap_evidence_json = jsonb_build_object(
            'source', 'xuanwu_camera',
            'formatted_address', x.formatted_address,
            'nearest_poi_name', x.amap_nearest_poi_name,
            'nearest_poi_type', x.amap_nearest_poi_type,
            'amap_regeo_json', x.amap_regeo_json
          ),
          amap_enriched_at = COALESCE(x.amap_enriched_at, NOW())
        FROM xuanwu_camera x
        WHERE x.camera_id = v.camera_id
        """
    )
    return cur.rowcount


def live_enrich(cur, limit: int | None, only_missing: bool, sleep_s: float) -> tuple[int, int]:
    if not has_amap_key():
        raise RuntimeError("AMAP_WEB_KEY not set")
    where = "1=1"
    if only_missing:
        where = "amap_evidence_json->>'source' IS DISTINCT FROM 'amap_live'"
    sql = f"""
        SELECT id, camera_id, camera_name, gcj02_lon, gcj02_lat
        FROM ai_model_validation
        WHERE {where}
        ORDER BY id
    """
    if limit:
        sql += f" LIMIT {int(limit)}"
    cur.execute(sql)
    rows = cur.fetchall()
    ok = fail = 0
    for row in rows:
        info = enrich_for_camera(
            row["gcj02_lon"],
            row["gcj02_lat"],
            camera_name=row.get("camera_name") or "",
            city="南京",
        )
        if not info.get("ok"):
            fail += 1
            print(f"FAIL id={row['id']}: {info.get('error') or info}", flush=True)
            time.sleep(sleep_s)
            continue
        nearest = info.get("nearest") or {}
        # 名称未命中时：仍写入逆地理，但页面/建模会当弱参考
        cur.execute(
            """
            UPDATE ai_model_validation SET
              amap_formatted_address = %(addr)s::text,
              amap_nearest_poi_name = %(poi)s::varchar,
              amap_nearest_poi_type = %(ptype)s::varchar,
              amap_nearest_poi_id = %(pid)s::varchar,
              amap_evidence_json = %(ej)s::jsonb,
              amap_enriched_at = NOW(),
              updated_at = NOW()
            WHERE id = %(id)s
            """,
            {
                "addr": info.get("formatted_address"),
                "poi": nearest.get("name"),
                "ptype": nearest.get("type"),
                "pid": nearest.get("id"),
                "ej": json.dumps(info, ensure_ascii=False),
                "id": row["id"],
            },
        )
        ok += 1
        print(
            f"OK id={row['id']} via={info.get('chosen_via')} "
            f"agree={info.get('amap_agrees_with_name')} poi={nearest.get('name')}",
            flush=True,
        )
        time.sleep(sleep_s)
    return ok, fail


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["sync", "live", "sync_then_live"], default="sync")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--only-missing", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.15)
    args = parser.parse_args()

    with db() as conn, conn.cursor() as cur:
        ensure_schema(cur)
        if args.mode in ("sync", "sync_then_live"):
            n = sync_from_xuanwu(cur)
            conn.commit()
            print(f"synced_from_xuanwu={n}")
        if args.mode in ("live", "sync_then_live"):
            ok, fail = live_enrich(cur, args.limit, args.only_missing, args.sleep)
            conn.commit()
            print(f"live_ok={ok} live_fail={fail} key={has_amap_key()}")


if __name__ == "__main__":
    main()
