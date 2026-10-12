#!/usr/bin/env python3
"""创建 ai_model_validation and insert stratified sample from xuanwu_camera."""

from __future__ import annotations

import os
import random
import re
from collections import defaultdict
from pathlib import Path

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

SAMPLE_SIZE = int(os.getenv("SAMPLE_SIZE", "200"))
SEED = int(os.getenv("SAMPLE_SEED", "20260924"))

# 稀有优先：先占坑，避免全被「道路」淹没
STRATA_PATTERNS: list[tuple[str, str]] = [
    ("卫生间", r"卫生|厕所|洗手间"),
    ("店招/餐饮", r"店|星巴克|茶|咖啡|奈雪|霸王|麦当劳|肯德基|餐厅|美食|甜品|饮品"),
    ("停车/地库", r"停车|车位|地库|车库"),
    ("通道/电梯", r"过道|通道|电梯|扶梯|走廊"),
    ("广场/商场", r"广场|商场|万达|吾悦|金鹰|新街口|六角|综合体|商业街"),
    ("景区/公园", r"景区|公园|玄武湖|紫金|红山|钟山|索道|游乐"),
    ("小区/住宅", r"苑|府|小区|公寓|住宅|华府|东苑|家园|花园"),
    ("道路/路口", r"路|路口|大道|街道|环岛|岔路口"),
]

# 目标配额（合计 200）；稀有类尽量抽满
QUOTAS: dict[str, int] = {
    "卫生间": 10,
    "店招/餐饮": 15,
    "停车/地库": 25,
    "通道/电梯": 25,
    "广场/商场": 25,
    "景区/公园": 30,
    "小区/住宅": 30,
    "道路/路口": 30,
    "其他": 10,
}


def db_connect():
    return psycopg.connect(
        host=os.getenv("DB_HOST", "140.143.52.213"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "seetime-camera"),
        user=os.getenv("DB_USERNAME", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        connect_timeout=20,
    )


def assign_stratum(name: str) -> str:
    for label, pat in STRATA_PATTERNS:
        if re.search(pat, name or ""):
            return label
    return "其他"


def main() -> None:
    random.seed(SEED)
    sql = (ROOT / "sql" / "001_create_ai_model_validation.sql").read_text(encoding="utf-8")

    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            conn.commit()
            print("table ready: ai_model_validation")

            cur.execute(
                """
                SELECT id, camera_id, camera_name, gcj02_lon, gcj02_lat,
                       image_morning_cos_key, image_noon_cos_key, image_afternoon_cos_key,
                       image_morning_access_url, image_noon_access_url, image_afternoon_access_url
                FROM xuanwu_camera
                WHERE coalesce(
                    image_morning_access_url,
                    image_noon_access_url,
                    image_afternoon_access_url,
                    image_morning_cos_key,
                    image_noon_cos_key,
                    image_afternoon_cos_key
                ) IS NOT NULL
                """
            )
            rows = cur.fetchall()
            cols = [d.name for d in cur.description]

        buckets: dict[str, list[dict]] = defaultdict(list)
        for row in rows:
            item = dict(zip(cols, row))
            stratum = assign_stratum(item["camera_name"])
            item["sample_stratum"] = stratum
            buckets[stratum].append(item)

        print("pool by stratum:")
        for k in list(QUOTAS.keys()):
            print(f"  {k}: {len(buckets.get(k, []))}")

        selected: list[dict] = []
        used_ids: set[str] = set()

        def take(stratum: str, n: int) -> list[dict]:
            pool = [x for x in buckets.get(stratum, []) if x["camera_id"] not in used_ids]
            random.shuffle(pool)
            picked = pool[:n]
            for x in picked:
                used_ids.add(x["camera_id"])
            return picked

        for stratum, quota in QUOTAS.items():
            got = take(stratum, quota)
            selected.extend(got)
            print(f"picked {stratum}: {len(got)} / quota {quota}")

        # 若不足 200，从剩余随机补
        if len(selected) < SAMPLE_SIZE:
            rest = [dict(zip(cols, r)) for r in rows if dict(zip(cols, r))["camera_id"] not in used_ids]
            # re-assign for rest labels
            for item in rest:
                item["sample_stratum"] = assign_stratum(item["camera_name"])
            random.shuffle(rest)
            need = SAMPLE_SIZE - len(selected)
            selected.extend(rest[:need])

        selected = selected[:SAMPLE_SIZE]
        print(f"total selected: {len(selected)}")

        with conn.cursor() as cur:
            cur.execute("DELETE FROM ai_model_validation")
            insert_sql = """
                INSERT INTO ai_model_validation (
                  source_id, camera_id, camera_name, gcj02_lon, gcj02_lat,
                  image_morning_cos_key, image_noon_cos_key, image_afternoon_cos_key,
                  image_morning_access_url, image_noon_access_url, image_afternoon_access_url,
                  sample_stratum, pipeline_step, status
                ) VALUES (
                  %(id)s, %(camera_id)s, %(camera_name)s, %(gcj02_lon)s, %(gcj02_lat)s,
                  %(image_morning_cos_key)s, %(image_noon_cos_key)s, %(image_afternoon_cos_key)s,
                  %(image_morning_access_url)s, %(image_noon_access_url)s, %(image_afternoon_access_url)s,
                  %(sample_stratum)s, 0, 'sampled'
                )
            """
            cur.executemany(insert_sql, selected)
            conn.commit()

            cur.execute(
                """
                SELECT sample_stratum, count(*)
                FROM ai_model_validation
                GROUP BY 1 ORDER BY 2 DESC
                """
            )
            print("\ninserted distribution:")
            for r in cur.fetchall():
                print(f"  {r[0]}: {r[1]}")
            cur.execute("SELECT count(*) FROM ai_model_validation")
            print("total rows:", cur.fetchone()[0])


if __name__ == "__main__":
    main()
