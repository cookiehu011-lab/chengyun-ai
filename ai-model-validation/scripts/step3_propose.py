#!/usr/bin/env python3
"""Step 3 cold-start: cluster valuable cameras into entity proposals."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

# 约 120m：同地点不同机位
DIST_M = float(os.getenv("STEP3_CLUSTER_DIST_M", "120"))
# 名称清洗：去掉朝向/编号尾巴
# 注意：不剥离「地库/车库/停车场」——停车场是独立实体，需保留在清洗名里
TAIL_RE = re.compile(
    r"(向[东南西北]+|东南|东北|西南|西北|南向北|北向南|东向西|西向东|"
    r"门口|门前|全景|通道|过道|电梯|扶梯|入口|坡道|"
    r"[\d\.]+$|[-_#]\d+.*$|路灯\d+|号灯).*$"
)
PARKING_NAME_RE = re.compile(r"地库|地下车库|车库|车位区|停车场|停车库|车位")
PUNCT_RE = re.compile(r"[\s\-_/|（）()【】\[\]]+")
# 运维点位编号：玄中0314 / 玄新0166 / 玄板0396 — 不是实体身份
OPS_CODE_RE = re.compile(
    r"^(?:玄中|玄韶|玄门|玄锁|玄红|玄新|玄板|玄武|SJ)[0-9O]{2,8}",
    re.I,
)
# 设备型号/机位词：球机/枪机等绝不能进实体名（可带方位：西球机）
DEVICE_TERM_RE = re.compile(
    r"[东南西北]?(?:球机|枪机|半球机|半球|云台|摄像头|摄像机|IPC)",
    re.I,
)
# 二级类不同时禁止合并（同名小区电梯 ≠ 同名小区地库）
STRICT_CAT_L2 = frozenset(
    {
        "停车场",
        "道路",
        "路口",
        "小区",
        "酒店",
        "餐厅",
        "卫生间",
        "地铁站",
        "公交站",
        "商场",
        "写字楼",
        "学校",
        "医院",
        "公园",
        "广场",
    }
)
ROAD_SUFFIX_RE = re.compile(r"(路|街|巷|大道|公路|环路)")
ROAD_HEAD_NOISE_RE = re.compile(r"广场|公园|车站|机场|酒店|宾馆|饭店|商场|地铁")
# 运维名前缀：SJ / 玄韶0200 / 玄武0122 等
CAM_PREFIX_RE = re.compile(r"^(?:SJ|SJnano|玄门|玄韶|玄武)\d*", re.I)
# 朝向噪声：南南北 / 东西 等（不一定带「向」）
DIR_NOISE_RE = re.compile(r"(?:向[东南西北]+|(?:南|北|东|西){2,4})$")
# 清洗标点但保留门牌连字符 79-17
SOFT_PUNCT_RE = re.compile(r"[\s_/|（）()【】\[\]]+")
# 店招/地标类用词：用于从相机名抽出「段」备注，不能当道路实体主名
LANDMARK_HINT_RE = re.compile(
    r"酒店|宾馆|大酒店|饭店|餐厅|烧烤|超市|商场|银行|医院|学校|广场|公园|"
    r"地铁|车站|华联|如家|全季|7天|便利店|药店|卫生"
)
# 高德类型与道路/路口同族才可写进道路实体名
ROAD_AMAP_TYPE_RE = re.compile(r"道路|路口|交通地名|公交|桥梁|隧道|立交")
BUSINESS_AMAP_TYPE_RE = re.compile(
    r"住宿|宾馆|酒店|餐饮|购物|公司企业|金融|保险|生活服务|风景名胜|科教文化"
)
ROAD_CATS = frozenset({"道路", "路口"})


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


def haversine_m(lon1, lat1, lon2, lat2) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def strip_ops_code(name: str | None) -> str:
    """去掉相机运维编号，避免 0314/0315 这种点位码进实体名。"""
    s = (name or "").strip()
    s = OPS_CODE_RE.sub("", s)
    return s.strip() or (name or "").strip()


def strip_device_terms(name: str | None) -> str:
    """去掉球机/枪机等设备词及「西球机」这类方位+设备。"""
    s = (name or "").strip()
    s = DEVICE_TERM_RE.sub("", s)
    s = re.sub(r"[-_/|]+", "", s)
    return s.strip() or (name or "").strip()


def normalize_name(name: str | None) -> str:
    s = strip_ops_code(name)
    s = strip_device_terms(s)
    s = PUNCT_RE.sub("", s)
    # 反复去尾巴
    for _ in range(3):
        ns = TAIL_RE.sub("", s)
        if ns == s or len(ns) < 2:
            break
        s = ns
    return s or strip_device_terms(strip_ops_code(name)) or (name or "").strip()


def name_sim(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if a in b or b in a:
        return 0.85
    sa, sb = set(a), set(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


class UnionFind:
    def __init__(self, n: int):
        self.p = list(range(n))

    def find(self, x: int) -> int:
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a: int, b: int) -> None:
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[rb] = ra


def same_category(a: dict, b: dict) -> bool:
    if a.get("cat_l2") and b.get("cat_l2") and a["cat_l2"] == b["cat_l2"]:
        return True
    if a.get("cat_l1") and b.get("cat_l1") and a["cat_l1"] == b["cat_l1"]:
        # 同一级但二级不同：仅当名称很像才合
        return name_sim(a["norm_name"], b["norm_name"]) >= 0.75
    return False


def amap_agrees_with_name(norm_name: str, poi_name: str | None) -> bool:
    """高德仅在与相机名明显一致时才可采用。"""
    if not poi_name or not norm_name:
        return False
    if "热点地名" in (poi_name or ""):
        return False
    return name_sim(normalize_name(poi_name), norm_name) >= 0.45 or (
        normalize_name(poi_name) in norm_name or norm_name in normalize_name(poi_name)
    )


def extract_road_token(text: str | None) -> str | None:
    """抽取干净路名。对每个「路/街/…」向前取最短可用中文头，避免吞掉广场前缀。"""
    if not text:
        return None
    best = None
    for m in ROAD_SUFFIX_RE.finditer(text):
        suf = m.group(1)
        start = m.start()
        chosen = None
        for length in range(2, 7):
            i = start - length
            if i < 0:
                break
            head = text[i:start]
            if not re.fullmatch(r"[\u4e00-\u9fff]+", head):
                continue
            if ROAD_HEAD_NOISE_RE.search(head):
                continue
            chosen = head + suf
            break  # 最短干净头
        if chosen:
            best = chosen
    return best


def extract_landmark(camera_name: str | None, road: str | None = None) -> str | None:
    """从运维名抽出地标段（酒店/店名等），去掉路名与朝向尾巴。"""
    if not camera_name:
        return None
    s = CAM_PREFIX_RE.sub("", camera_name.strip())
    # 也去掉「玄锁0004 / 玄红0089」这类非标前缀
    s = re.sub(r"^[\u4e00-\u9fff]{1,4}\d{3,6}", "", s)
    s = SOFT_PUNCT_RE.sub("", s)
    s = re.sub(r"\d+$", "", s)  # 末尾机位编号
    if road:
        s = s.replace(road, "", 1)
    # 朝向：先去「向北」，再去残留单字「南」；「门口」后截断小区尾巴
    s = re.sub(r"向[东南西北]+$", "", s)
    s = DIR_NOISE_RE.sub("", s)
    s = re.sub(r"(酒店|宾馆|大酒店|饭店|餐厅|华联|如家)[东南西北]$", r"\1", s)
    s = re.sub(r"门口.*$", "门口", s)
    s = re.sub(r"(?:门口|门前)$", "", s)
    s = s.strip("-_ ")
    if not s or len(s) < 2:
        return None

    # 门牌必须早退：避免连字符门牌被其它规则拆坏
    m = re.search(r"(\d{1,4}(?:-\d{1,4})?号[\u4e00-\u9fff]{0,12})$", s)
    if m and len(m.group(1)) >= 2:
        return m.group(1)[:20]
    if re.fullmatch(r"\d{1,4}(?:-\d{1,4})?号?", s):
        return s if s.endswith("号") else f"{s}号"

    # 去掉前置广场/站名噪声，保留地标核心
    s2 = re.sub(
        r"^[\u4e00-\u9fff0-9]{0,12}(?:南广场|北广场|东广场|西广场|广场|车站|地铁站)",
        "",
        s,
    )
    s2 = (s2 or s).strip("-_ ")
    if not s2 or len(s2) < 2:
        return None
    # 压缩到「…酒店/宾馆/华联」核心，避免拖进后面的小区名
    core = re.search(
        r"([\u4e00-\u9fff0-9\-·]{2,16}(?:大酒店|酒店|宾馆|饭店|餐厅|华联|如家|超市|商场))",
        s2,
    )
    if core:
        return core.group(1)[:24]
    if LANDMARK_HINT_RE.search(s2):
        return s2[:24]
    if re.fullmatch(r"[\u4e00-\u9fff0-9\-]{2,16}", s2) and not re.fullmatch(r"\d+", s2):
        return s2[:24]
    return None


def poi_type_ok_for_cat(poi_type: str | None, cat_l2: str | None) -> bool:
    """类名一致：高德类型必须与实体二级类同族，否则禁止用 POI 当实体名。"""
    if not cat_l2:
        return True
    t = poi_type or ""
    if cat_l2 in ROAD_CATS:
        if BUSINESS_AMAP_TYPE_RE.search(t) and not ROAD_AMAP_TYPE_RE.search(t):
            return False
        return True
    if cat_l2 == "停车场":
        if re.search(r"住宅|楼宇|商务住宅", t) and not re.search(r"停车", t):
            return False
        return True
    return True


def format_road_entity_name(road: str, landmark: str | None, cat_l2: str | None) -> str:
    """道路/路口正式名：路名为主；地标仅作「段」备注。例：龙蟠路（新世纪大酒店段）"""
    base = road
    if cat_l2 == "路口" and not base.endswith("路口"):
        # 有地标时仍用「路（地标段）」；无地标可加路口
        if not landmark:
            base = f"{base}路口"
    if landmark:
        lm = landmark
        for suf in ("段", "旁", "前", "附近"):
            if lm.endswith(suf) and len(lm) > len(suf) + 1:
                lm = lm[: -len(suf)]
                break
        if not lm.endswith("段"):
            return f"{base}（{lm}段）"
        return f"{base}（{lm}）"
    return base


def cluster_norm_name(camera_name: str | None, cat_l2: str | None) -> str:
    """聚类用名：道路类按「路+地标」键，避免被酒店 POI 洗成店名后乱聚。"""
    if cat_l2 in ROAD_CATS:
        road = extract_road_token(camera_name)
        landmark = extract_landmark(camera_name, road)
        if road and landmark:
            return f"{road}|{landmark}"
        if road:
            return road
    if cat_l2 == "停车场":
        base = normalize_name(camera_name)
        return base
    return normalize_name(camera_name)


def should_merge(a: dict, b: dict, dist_m: float) -> bool:
    """合并主依据：清洗后的相机名 + 分类；坐标只做弱约束；高德不单独强合。"""
    ca, cb = a.get("cat_l2"), b.get("cat_l2")
    # 硬隔离：停车场 vs 小区 等同名也不得合成一个实体
    if ca and cb and ca != cb and (ca in STRICT_CAT_L2 or cb in STRICT_CAT_L2):
        return False

    sim = name_sim(a["norm_name"], b["norm_name"])
    if not same_category(a, b) and sim < 0.85:
        return False

    # 名称足够像：可合并（坐标缺失也允许）
    if sim >= 0.7 and len(a["norm_name"]) >= 4 and len(b["norm_name"]) >= 4:
        if a.get("gcj02_lon") is None or b.get("gcj02_lon") is None:
            return True
        d = haversine_m(a["gcj02_lon"], a["gcj02_lat"], b["gcj02_lon"], b["gcj02_lat"])
        # 坐标只用来挡「同名但相距很远」；阈值放宽，因为坐标常飘
        return d <= max(dist_m * 3, 500)

    if a.get("gcj02_lon") is None or b.get("gcj02_lon") is None:
        return a["norm_name"] == b["norm_name"] and len(a["norm_name"]) >= 4

    d = haversine_m(a["gcj02_lon"], a["gcj02_lat"], b["gcj02_lon"], b["gcj02_lat"])
    if d > dist_m:
        return False
    if sim >= 0.55:
        return True
    if d <= dist_m * 0.4 and sim >= 0.35:
        return True
    return False


def pick_entity_name(members: list[dict], cat_l2: str | None = None) -> str:
    """实体名：主体类优先；地标只作段备注；高德须类名一致才可采用。"""
    # —— 道路 / 路口：路名为实体，地标→「（xx段）」——
    if cat_l2 in ROAD_CATS:
        roads: list[str] = []
        landmarks: list[str] = []
        for m in members:
            cam = m.get("camera_name") or ""
            road = extract_road_token(cam)
            if road:
                roads.append(road)
            lm = extract_landmark(cam, road)
            if lm:
                landmarks.append(lm)
        road = majority(roads)
        landmark = majority(landmarks)
        if not road:
            # 从地址 / 同族道路 POI 救援路名
            for m in members:
                for src in (
                    m.get("amap_formatted_address"),
                    m.get("amap_nearest_poi_name") if poi_type_ok_for_cat(m.get("amap_nearest_poi_type"), cat_l2) else None,
                ):
                    cand = extract_road_token(src)
                    if cand:
                        road = cand
                        break
                if road:
                    break
        if not landmark:
            for m in members:
                lm = extract_landmark(m.get("camera_name"), road)
                if lm:
                    landmark = lm
                    break
        if road:
            return format_road_entity_name(road, landmark, cat_l2)
        # 无路名但有酒店等门前地标：用「地标门前道路」避免实体名=酒店
        if landmark:
            return f"{landmark}门前道路"
        fallback = normalize_name(members[0].get("camera_name"))
        return fallback or f"实体-{members[0]['id']}"

    norms = [m["norm_name"] for m in members if m.get("norm_name")]
    name_from_cam = None
    if norms:
        cnt = Counter(norms)
        # 聚类键可能是「路|地标」，展示名不走这个分支
        name_from_cam = sorted(cnt.items(), key=lambda x: (-x[1], len(x[0])))[0][0]
        if "|" in (name_from_cam or ""):
            name_from_cam = name_from_cam.split("|", 1)[0]

    is_parking = cat_l2 == "停车场" or any(
        PARKING_NAME_RE.search(m.get("camera_name") or "")
        or PARKING_NAME_RE.search(m.get("norm_name") or "")
        for m in members
    )

    if not is_parking:
        agreeing_pois = []
        for m in members:
            poi = m.get("amap_nearest_poi_name")
            ptype = m.get("amap_nearest_poi_type")
            nn = m.get("norm_name") or name_from_cam or ""
            if not poi_type_ok_for_cat(ptype, cat_l2):
                continue
            if amap_agrees_with_name(nn, poi):
                agreeing_pois.append(poi)
        if agreeing_pois:
            return Counter(agreeing_pois).most_common(1)[0][0]

    name = name_from_cam or members[0].get("camera_name") or f"实体-{members[0]['id']}"
    name = strip_device_terms(strip_ops_code(name))
    # 去掉残留入口/朝向
    name = re.sub(r"(入口|门前|门口|坡道)$", "", name).strip() or name
    if is_parking:
        # 单车位编号不升级成实体名：六角广场一期C区018车位 → 六角广场一期地库
        if re.search(r"\d+车位", name):
            base = re.sub(r"[A-Za-z]?区?\d+车位.*$", "", name).strip("-_ ")
            name = base if base else name
        if not PARKING_NAME_RE.search(name):
            for m in members:
                cam = m.get("camera_name") or ""
                if PARKING_NAME_RE.search(cam):
                    kept = normalize_name(cam)
                    if PARKING_NAME_RE.search(kept) and not re.search(r"\d+车位", kept):
                        name = kept
                        break
            if not PARKING_NAME_RE.search(name):
                name = f"{name}地库"
    return name


def majority(vals: list[Any]) -> Any:
    vals = [v for v in vals if v]
    if not vals:
        return None
    return Counter(vals).most_common(1)[0][0]


def build_clusters(rows: list[dict], dist_m: float) -> list[list[dict]]:
    items = []
    for r in rows:
        item = dict(r)
        item["norm_name"] = cluster_norm_name(r.get("camera_name"), r.get("cat_l2"))
        items.append(item)

    n = len(items)
    uf = UnionFind(n)
    for i in range(n):
        for j in range(i + 1, n):
            if should_merge(items[i], items[j], dist_m):
                uf.union(i, j)

    buckets: dict[int, list[dict]] = defaultdict(list)
    for i, item in enumerate(items):
        buckets[uf.find(i)].append(item)
    return list(buckets.values())


def ensure_schema(cur) -> None:
    sql = (ROOT / "sql" / "002_step3_entity_proposal.sql").read_text(encoding="utf-8")
    cur.execute(sql)
    edge_sql = ROOT / "sql" / "004_entity_edges.sql"
    if edge_sql.exists():
        cur.execute(edge_sql.read_text(encoding="utf-8"))


def run(reset: bool = False, dist_m: float = DIST_M) -> dict[str, Any]:
    with db() as conn, conn.cursor() as cur:
        ensure_schema(cur)
        if reset:
            cur.execute("DELETE FROM ai_entity_edge")
            cur.execute("UPDATE ai_model_validation SET entity_proposal_id=NULL, entity_name_proposed=NULL, step3_confidence=NULL, step3_at=NULL, entity_proposal_json=NULL WHERE worth_use=1")
            cur.execute("DELETE FROM ai_entity_proposal")
            # 有价值但未建模的回到 step2 状态
            cur.execute(
                """
                UPDATE ai_model_validation
                SET pipeline_step = 2,
                    status = CASE
                      WHEN worth_use = 0 THEN 'step2_rejected'
                      WHEN ai_confidence = '没把握' THEN 'step2_review'
                      ELSE 'step2_done'
                    END
                WHERE worth_use = 1 AND entity_proposal_id IS NULL
                """
            )

        cur.execute(
            """
            SELECT id, camera_id, camera_name, gcj02_lon, gcj02_lat,
                   cat_l1, cat_l2, scene_desc, sample_stratum,
                   amap_nearest_poi_name, amap_nearest_poi_type, amap_nearest_poi_id,
                   amap_formatted_address
            FROM ai_model_validation
            WHERE worth_use = 1
            ORDER BY id
            """
        )
        rows = cur.fetchall()
        clusters = build_clusters(rows, dist_m)
        print(f"cameras={len(rows)} clusters={len(clusters)} dist_m={dist_m}")

        created = 0
        for members in clusters:
            cat_l1 = majority([m.get("cat_l1") for m in members])
            cat_l2 = majority([m.get("cat_l2") for m in members])
            name = pick_entity_name(members, cat_l2=cat_l2)
            lons = [m["gcj02_lon"] for m in members if m.get("gcj02_lon") is not None]
            lats = [m["gcj02_lat"] for m in members if m.get("gcj02_lat") is not None]
            lon = sum(lons) / len(lons) if lons else None
            lat = sum(lats) / len(lats) if lats else None

            norms = {m["norm_name"] for m in members}
            conf = "有把握" if (len(members) >= 2 or len(name) >= 4) and len(norms) <= 2 else "没把握"
            if len(norms) >= 4:
                conf = "没把握"

            reason_parts = [
                f"{len(members)}路相机",
                f"分类{cat_l1}/{cat_l2}" if cat_l1 else "无分类",
                f"实体名来自相机名:{name}",
            ]
            poi_m = majority([m.get("amap_nearest_poi_name") for m in members])
            if poi_m and amap_agrees_with_name(name, poi_m):
                reason_parts.append(f"高德印证:{poi_m}")
            else:
                reason_parts.append(f"高德未采用:{poi_m or '无'}（与名称不一致或坐标可疑）")
            reason = "；".join(reason_parts)

            raw = {
                "members": [
                    {
                        "id": m["id"],
                        "camera_id": m["camera_id"],
                        "camera_name": m["camera_name"],
                        "norm_name": m["norm_name"],
                        "cat_l1": m.get("cat_l1"),
                        "cat_l2": m.get("cat_l2"),
                    }
                    for m in members
                ],
                "dist_m": dist_m,
            }
            cluster_key = f"{cat_l2 or cat_l1 or 'x'}|{name}|{round(lon or 0, 4)},{round(lat or 0, 4)}"

            cur.execute(
                """
                INSERT INTO ai_entity_proposal (
                  entity_name, cat_l1, cat_l2, gcj02_lon, gcj02_lat,
                  camera_count, camera_ids, sample_ids, name_hint,
                  confidence, reason, cluster_key, raw_json, status
                ) VALUES (
                  %(entity_name)s, %(cat_l1)s, %(cat_l2)s, %(lon)s, %(lat)s,
                  %(camera_count)s, %(camera_ids)s::jsonb, %(sample_ids)s::jsonb, %(name_hint)s,
                  %(confidence)s, %(reason)s, %(cluster_key)s, %(raw)s::jsonb, 'proposed'
                )
                RETURNING id
                """,
                {
                    "entity_name": name[:256],
                    "cat_l1": cat_l1,
                    "cat_l2": cat_l2,
                    "lon": lon,
                    "lat": lat,
                    "camera_count": len(members),
                    "camera_ids": json.dumps([m["camera_id"] for m in members], ensure_ascii=False),
                    "sample_ids": json.dumps([m["id"] for m in members]),
                    "name_hint": members[0]["camera_name"],
                    "confidence": conf,
                    "reason": reason,
                    "cluster_key": cluster_key[:128],
                    "raw": json.dumps(raw, ensure_ascii=False),
                },
            )
            eid = cur.fetchone()["id"]
            created += 1

            for m in members:
                cur.execute(
                    """
                    UPDATE ai_model_validation SET
                      entity_proposal_id = %(eid)s::bigint,
                      entity_name_proposed = %(ename)s::varchar,
                      step3_confidence = %(conf)s::varchar,
                      step3_at = NOW(),
                      entity_proposal_json = %(ej)s::jsonb,
                      pipeline_step = GREATEST(pipeline_step, 3),
                      status = CASE
                        WHEN %(conf)s::varchar = '没把握' THEN 'step3_review'
                        ELSE 'step3_done'
                      END,
                      updated_at = NOW()
                    WHERE id = %(id)s
                    """,
                    {
                        "eid": eid,
                        "ename": name[:256],
                        "conf": conf,
                        "ej": json.dumps(
                            {
                                "entity_proposal_id": eid,
                                "entity_name": name,
                                "cat_l1": cat_l1,
                                "cat_l2": cat_l2,
                                "confidence": conf,
                            },
                            ensure_ascii=False,
                        ),
                        "id": m["id"],
                    },
                )

        conn.commit()

        # 抽构成 / 路段 / 地标边
        from step3_edges import build_edges  # local import avoids cycle at module load

        with db() as conn2, conn2.cursor() as cur2:
            edge_stats = build_edges(cur2)
            conn2.commit()

        return {
            "cameras": len(rows),
            "entities": created,
            "dist_m": dist_m,
            "edges": edge_stats,
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="clear previous step3 proposals")
    parser.add_argument("--dist-m", type=float, default=DIST_M)
    args = parser.parse_args()
    out = run(reset=args.reset, dist_m=args.dist_m)
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
