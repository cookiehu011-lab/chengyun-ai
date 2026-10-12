#!/usr/bin/env python3
"""从候选实体抽构成边：part_of（场所↔地库等）+ segment_of（路↔路段）+ landmark_of。"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
load_dotenv(ROOT / ".env")

from step3_propose import ROAD_CATS, extract_road_token  # noqa: E402

PART_CHILD_CATS = frozenset({"停车场", "卫生间"})
PART_PARENT_CATS = frozenset(
    {
        "小区",
        "商场",
        "写字楼",
        "商业综合体",
        "酒店",
        "学校",
        "公园",
        "广场",
        "产业园区",
        "医院",
        "食堂",
        "生活服务",
    }
)
PART_SUFFIX_RE = re.compile(
    r"(地库|地下车库|车库|停车场|停车库|卫生间|洗手间|公厕|厕所)$"
)
SEGMENT_RE = re.compile(r"^(.+?)（(.+?)段）$")


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
    sql = (ROOT / "sql" / "004_entity_edges.sql").read_text(encoding="utf-8")
    cur.execute(sql)


def infer_part_parent_name(entity_name: str, cat_l2: str | None) -> str | None:
    if cat_l2 not in PART_CHILD_CATS:
        return None
    base = PART_SUFFIX_RE.sub("", entity_name or "").strip("-_ ")
    if not base or base == entity_name or len(base) < 2:
        return None
    return base


def infer_segment(entity_name: str, cat_l2: str | None) -> tuple[str, str] | None:
    if cat_l2 not in ROAD_CATS:
        return None
    m = SEGMENT_RE.match(entity_name or "")
    if not m:
        return None
    road, landmark = m.group(1).strip(), m.group(2).strip()
    if not road or not landmark:
        return None
    # 路名应像路
    if not extract_road_token(road) and not re.search(r"(路|街|巷|大道)$", road):
        return None
    return road, landmark


def find_entity_by_name(cur, name: str, cat_l2: str | None = None) -> dict | None:
    if cat_l2:
        cur.execute(
            """
            SELECT * FROM ai_entity_proposal
            WHERE entity_name = %s AND (cat_l2 = %s OR cat_l2 IS NULL)
            ORDER BY camera_count DESC, id
            LIMIT 1
            """,
            (name, cat_l2),
        )
    else:
        cur.execute(
            """
            SELECT * FROM ai_entity_proposal
            WHERE entity_name = %s
            ORDER BY camera_count DESC, id
            LIMIT 1
            """,
            (name,),
        )
    return cur.fetchone()


def ensure_parent_entity(
    cur,
    *,
    name: str,
    cat_l1: str | None,
    cat_l2: str | None,
    lon: float | None,
    lat: float | None,
    reason: str,
) -> int:
    existing = find_entity_by_name(cur, name, cat_l2)
    if existing:
        # 标记角色
        role = existing.get("entity_role") or "leaf"
        if role == "leaf":
            cur.execute(
                "UPDATE ai_entity_proposal SET entity_role='both', updated_at=NOW() WHERE id=%s",
                (existing["id"],),
            )
        elif role == "parent":
            pass
        return int(existing["id"])

    cur.execute(
        """
        INSERT INTO ai_entity_proposal (
          entity_name, cat_l1, cat_l2, gcj02_lon, gcj02_lat,
          camera_count, camera_ids, sample_ids, name_hint,
          confidence, reason, cluster_key, raw_json, status, entity_role
        ) VALUES (
          %(name)s, %(cat_l1)s, %(cat_l2)s, %(lon)s, %(lat)s,
          0, '[]'::jsonb, '[]'::jsonb, %(name)s,
          '有把握', %(reason)s, %(ck)s, %(raw)s::jsonb, 'proposed', 'parent'
        )
        RETURNING id
        """,
        {
            "name": name[:256],
            "cat_l1": cat_l1,
            "cat_l2": cat_l2,
            "lon": lon,
            "lat": lat,
            "reason": reason,
            "ck": f"parent|{cat_l2 or 'x'}|{name}"[:128],
            "raw": json.dumps({"derived": True, "reason": reason}, ensure_ascii=False),
        },
    )
    return int(cur.fetchone()["id"])


def upsert_edge(
    cur,
    *,
    from_id: int,
    to_id: int,
    edge_type: str,
    evidence: str,
    confidence: str = "有把握",
) -> bool:
    if from_id == to_id:
        return False
    cur.execute(
        """
        INSERT INTO ai_entity_edge (
          from_entity_id, to_entity_id, edge_type, confidence, evidence, status
        ) VALUES (%s, %s, %s, %s, %s, 'proposed')
        ON CONFLICT (from_entity_id, to_entity_id, edge_type)
        DO UPDATE SET
          evidence = EXCLUDED.evidence,
          confidence = EXCLUDED.confidence,
          updated_at = NOW()
        """,
        (from_id, to_id, edge_type, confidence, evidence),
    )
    return True


def build_edges(cur) -> dict[str, int]:
    ensure_schema(cur)
    cur.execute("DELETE FROM ai_entity_edge")
    cur.execute(
        "UPDATE ai_entity_proposal SET parent_entity_id=NULL, entity_role=COALESCE(entity_role,'leaf')"
    )
    # 清掉仅由抽边产生、无相机的旧父实体，避免 reset 后堆积
    cur.execute(
        """
        DELETE FROM ai_entity_proposal
        WHERE entity_role = 'parent' AND camera_count = 0
          AND COALESCE(raw_json->>'derived','') = 'true'
        """
    )

    cur.execute(
        """
        SELECT id, entity_name, cat_l1, cat_l2, gcj02_lon, gcj02_lat,
               camera_count, entity_role
        FROM ai_entity_proposal
        ORDER BY id
        """
    )
    entities = cur.fetchall()
    by_name: dict[str, list[dict]] = {}
    for e in entities:
        by_name.setdefault(e["entity_name"], []).append(e)

    stats = {"part_of": 0, "segment_of": 0, "landmark_of": 0, "parents_created": 0}

    for e in entities:
        eid = int(e["id"])
        name = e["entity_name"] or ""
        cat_l2 = e.get("cat_l2")

        # —— segment_of：龙蟠路（新世纪大酒店段）→ 龙蟠路 ——
        seg = infer_segment(name, cat_l2)
        if seg:
            road, landmark = seg
            before = find_entity_by_name(cur, road, "道路") or find_entity_by_name(cur, road)
            parent_id = ensure_parent_entity(
                cur,
                name=road,
                cat_l1="交通出行",
                cat_l2="道路",
                lon=e.get("gcj02_lon"),
                lat=e.get("gcj02_lat"),
                reason=f"由路段实体「{name}」推导的主路",
            )
            if not before:
                stats["parents_created"] += 1
            if upsert_edge(
                cur,
                from_id=eid,
                to_id=parent_id,
                edge_type="segment_of",
                evidence=f"路段名解析：{name} → 主路 {road}",
            ):
                stats["segment_of"] += 1
            cur.execute(
                """
                UPDATE ai_entity_proposal
                SET parent_entity_id=%s, entity_role='leaf', updated_at=NOW()
                WHERE id=%s
                """,
                (parent_id, eid),
            )
            # 地标弱关联（若已有同名实体）
            lm_ent = find_entity_by_name(cur, landmark)
            if not lm_ent:
                # 尝试带「酒店」完整名已在 landmark 中
                for cand in by_name.get(landmark, []):
                    lm_ent = cand
                    break
            if lm_ent and int(lm_ent["id"]) != eid:
                if upsert_edge(
                    cur,
                    from_id=int(lm_ent["id"]),
                    to_id=eid,
                    edge_type="landmark_of",
                    evidence=f"路段备注地标：{landmark}",
                    confidence="没把握",
                ):
                    stats["landmark_of"] += 1
            continue

        # —— part_of：湖景花园地库 → 湖景花园 ——
        parent_name = infer_part_parent_name(name, cat_l2)
        if not parent_name:
            continue

        # 优先已有父类实体
        parent = None
        for cand in by_name.get(parent_name, []):
            if cand.get("cat_l2") in PART_PARENT_CATS or not cand.get("cat_l2"):
                parent = cand
                break
        if not parent:
            # 前缀匹配：六角广场一期地库 → 六角广场
            for pname, cands in by_name.items():
                if parent_name.startswith(pname) and len(pname) >= 2 and pname != name:
                    for cand in cands:
                        if cand.get("cat_l2") in PART_PARENT_CATS:
                            parent = cand
                            parent_name = pname
                            break
                if parent:
                    break

        parent_cat_l2 = (parent or {}).get("cat_l2") or (
            "小区" if cat_l2 == "停车场" else "商场"
        )
        parent_cat_l1 = (parent or {}).get("cat_l1") or (
            "生活服务" if parent_cat_l2 in ("小区", "酒店", "卫生间") else "购物消费"
        )
        if parent_cat_l2 == "商场":
            parent_cat_l1 = "购物消费"
        if parent_cat_l2 == "写字楼":
            parent_cat_l1 = "产业办公"

        before = parent
        parent_id = ensure_parent_entity(
            cur,
            name=parent_name,
            cat_l1=parent_cat_l1 if not parent else parent.get("cat_l1"),
            cat_l2=parent_cat_l2 if not parent else parent.get("cat_l2"),
            lon=e.get("gcj02_lon"),
            lat=e.get("gcj02_lat"),
            reason=f"由子实体「{name}」推导的父场所",
        )
        if not before:
            stats["parents_created"] += 1
            # refresh by_name for later
            by_name.setdefault(parent_name, []).append(
                {"id": parent_id, "entity_name": parent_name, "cat_l2": parent_cat_l2}
            )

        if upsert_edge(
            cur,
            from_id=eid,
            to_id=parent_id,
            edge_type="part_of",
            evidence=f"名称去后缀：{name} → 父场所 {parent_name}（{cat_l2} part_of）",
        ):
            stats["part_of"] += 1
        cur.execute(
            """
            UPDATE ai_entity_proposal
            SET parent_entity_id=%s,
                entity_role = CASE
                  WHEN camera_count > 0 THEN 'leaf'
                  ELSE entity_role
                END,
                updated_at=NOW()
            WHERE id=%s
            """,
            (parent_id, eid),
        )

    # 父实体若既有相机又有子边 → both
    cur.execute(
        """
        UPDATE ai_entity_proposal p
        SET entity_role = 'both', updated_at = NOW()
        WHERE p.camera_count > 0
          AND EXISTS (
            SELECT 1 FROM ai_entity_edge e
            WHERE e.to_entity_id = p.id AND e.edge_type IN ('part_of','segment_of')
          )
        """
    )
    return stats


def run() -> dict[str, Any]:
    with db() as conn, conn.cursor() as cur:
        # 确保父表存在
        cur.execute((ROOT / "sql" / "002_step3_entity_proposal.sql").read_text(encoding="utf-8"))
        stats = build_edges(cur)
        conn.commit()
        cur.execute("SELECT count(*) AS n FROM ai_entity_edge")
        stats["edges_total"] = cur.fetchone()["n"]
        cur.execute("SELECT count(*) AS n FROM ai_entity_proposal")
        stats["entities_total"] = cur.fetchone()["n"]
        return stats


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.parse_args()
    out = run()
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
