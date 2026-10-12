#!/usr/bin/env python3
"""Step 2: worth filter + entity L1/L2 classification via vision API."""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import psycopg
import requests
from dotenv import load_dotenv
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
load_dotenv(ROOT / ".env")

from oss_cloud import sign_picture_url  # noqa: E402

CATEGORIES = json.loads((ROOT / "data" / "entity_categories.json").read_text(encoding="utf-8"))


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


def category_prompt_block() -> str:
    lines = []
    for l1, l2s in CATEGORIES.items():
        lines.append(f"- {l1}：{'、'.join(l2s)}")
    return "\n".join(lines)


def build_prompt(row: dict[str, Any]) -> str:
    return f"""你是 SeeTime 数据中心的相机筛选与实体分类助手。只输出一个 JSON 对象，不要 Markdown，不要解释，不要思考过程。

任务分两步，严格按顺序：
1) 先判断这一路相机对 C 端用户有没有价值（能不能支撑「某个地点现在怎样」这类问法）。
2) 仅当 worth_use=true 时，再判断它属于哪个【实体】一级/二级分类。
   分类是实体分类，不是画面物体分类。
   若 worth_use=false，则 cat_l1、cat_l2 必须为 null。

【场所归属——必须遵守】
A. 楼道/过道/走廊/电梯厅/扶梯：可归到所属父场所（如小区、商场、写字楼），scene_desc 写清拍的是过道/电梯。
B. 地库/地下车库/地面停车场/车位区：是独立实体，必须判「交通出行 / 停车场」。
   - 禁止因为名称里带小区名、或高德是住宅区，就改判「生活服务 / 小区」。
   - 例：名称「紫金华府一期-南地库通道」、画面是地下车位 → cat_l1=交通出行，cat_l2=停车场。
C. 小区大门/沿街全景/楼栋外立面等社区公共界面：才判「生活服务 / 小区」。
D. 相机名里的酒店/饭店/银行等常是路边地标，不等于画面主体。
   画面主内容是马路/斑马线/车流 → 必须判「交通出行 / 道路」或「路口」，不要判成酒店/餐饮。
   （实体正式命名在第3步会做成「龙蟠路（新世纪大酒店段）」这种路名+地标段，第2步只需把类判对。）

【证据优先级——必须遵守】
1. 主证：相机画面（含画面水印文字）+ 相机名称。二者互相印证。
2. 辅证：经纬度 / 高德反查 POI。相机坐标经常不准，高德结果可能完全跑偏。
3. 当「名称/水印/画面」与「高德POI」冲突时：以名称+画面为准，忽略高德，confidence 标「没把握」或在 reason 写明「高德与名称冲突，未采用高德」。
4. 禁止仅因高德 POI 类型就改分类（例如名称和水印都是卫生站，高德却是植物园 → 仍判卫生站）。
5. 【名称 vs 画面主体】水印文字通常就是相机名称叠字，不算独立证据。
   若画面里最醒目的店招/门头文字与 camera_name 明显不是同一家（例如名称是烧烤店，主招牌是水果店）：
   - name_scene_conflict 必须为 true
   - confidence 必须为「没把握」
   - dominant_sign_text 填画面主招牌上读到的文字
   - cat_l1/cat_l2 仍可按「名称意图」给一个候选类，但不得标有把握
   - scene_desc 必须同时写清名称指向谁、画面主体招牌是谁

可用实体分类（闭集，只能从中选）：
{category_prompt_block()}

本路相机信息：
- camera_id: {row.get('camera_id')}
- camera_name: {row.get('camera_name')}
- gcj02_lon: {row.get('gcj02_lon')}
- gcj02_lat: {row.get('gcj02_lat')}
- 高德地址(弱参考): {row.get('amap_formatted_address') or '无'}
- 高德最近POI(弱参考): {row.get('amap_nearest_poi_name') or '无'}
- 高德POI类型(弱参考): {row.get('amap_nearest_poi_type') or '无'}

输出字段（必须完整合法 JSON）：
{{
  "worth_use": true,
  "cat_l1": "生活服务",
  "cat_l2": "卫生站",
  "scene_desc": "一句人话，只写镜头里看得见的（可含读到的水印字）",
  "confidence": "有把握",
  "reason": "简短说明：依据画面/名称/水印；若弃用高德或名称画面冲突请写明",
  "amap_used": false,
  "name_scene_conflict": false,
  "dominant_sign_text": null
}}
"""


def _norm_text(s: str | None) -> str:
    if not s:
        return ""
    t = re.sub(r"\s+", "", str(s))
    for junk in ("南京", "玄武", "鼓楼", "建邺", "秦淮", "栖霞", "雨花", "江宁", "浦口", "六合", "溧水", "高淳"):
        t = t.replace(junk, "")
    return t


def texts_overlap(a: str | None, b: str | None) -> bool:
    """Rough Chinese name overlap: shared 2+ char chunk or containment."""
    na, nb = _norm_text(a), _norm_text(b)
    if not na or not nb:
        return False
    if na in nb or nb in na:
        return True
    # strip common suffixes then compare
    for suf in ("餐厅", "饭店", "烧烤店", "烧烤", "水果店", "商店", "超市", "中心", "店"):
        na2 = na[:- len(suf)] if na.endswith(suf) and len(na) > len(suf) + 1 else na
        nb2 = nb[:- len(suf)] if nb.endswith(suf) and len(nb) > len(suf) + 1 else nb
        if na2 and nb2 and (na2 in nb2 or nb2 in na2):
            return True
    for i in range(len(na) - 1):
        chunk = na[i : i + 2]
        if chunk and chunk in nb:
            return True
    return False


def coerce_bool(v: Any) -> bool | None:
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return bool(v)
    if isinstance(v, str):
        s = v.strip().lower()
        if s in ("1", "true", "yes", "是", "冲突", "有冲突"):
            return True
        if s in ("0", "false", "no", "否", "无冲突"):
            return False
    return None


PARKING_HINT_RE = re.compile(r"地库|地下车库|地下停车|车库|车位区|停车场|停车库")
# 纯楼内通行空间：可归父场所；勿与地库混淆
PASSAGE_ONLY_RE = re.compile(r"过道|走廊|电梯|扶梯|电梯厅")


def looks_like_parking(camera_name: str | None, scene_desc: str | None = None) -> bool:
    """名称或画面描述明确指向停车场/地库。"""
    name = camera_name or ""
    scene = scene_desc or ""
    if PARKING_HINT_RE.search(name):
        return True
    # 画面写了停车场景，且名称不是纯楼道电梯
    if PARKING_HINT_RE.search(scene) and not (
        PASSAGE_ONLY_RE.search(name) and not PARKING_HINT_RE.search(name)
    ):
        return True
    return False


def apply_parking_place_rule(
    norm: dict[str, Any], camera_name: str | None
) -> dict[str, Any]:
    """Hard gate: 地库/停车场不得落成小区等父场所类。"""
    if not norm.get("worth_use"):
        return norm
    if not looks_like_parking(camera_name, norm.get("scene_desc")):
        return norm
    if norm.get("cat_l1") == "交通出行" and norm.get("cat_l2") == "停车场":
        return norm
    norm["cat_l1"] = "交通出行"
    norm["cat_l2"] = "停车场"
    note = "规则约束：地库/停车场为独立实体，不得归为小区等父场所"
    reason = norm.get("reason") or ""
    if note not in reason:
        norm["reason"] = f"{reason}；{note}" if reason else note
    return norm


def slot_pairs(row: dict[str, Any]) -> list[tuple[str, str | None, str | None]]:
    out = []
    for slot in ("morning", "noon", "afternoon"):
        out.append(
            (
                slot,
                row.get(f"image_{slot}_cos_key"),
                row.get(f"image_{slot}_access_url"),
            )
        )
    return out


def to_data_url(content: bytes, content_type: str | None) -> str:
    ctype = content_type or "image/jpeg"
    if ";" in ctype:
        ctype = ctype.split(";", 1)[0].strip()
    if ctype not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        ctype = "image/jpeg"
    b64 = base64.b64encode(content).decode("ascii")
    return f"data:{ctype};base64,{b64}"


def fetch_image_data_urls(
    row: dict[str, Any], max_images: int = 3
) -> tuple[list[str], dict[str, str], list[str]]:
    """Download frames locally; vision host cannot fetch our OSS tmp URLs.

    Returns (data_urls, refreshed_urls, used_slots) where used_slots aligns
    1:1 with data_urls (morning/noon/afternoon).
    """
    data_urls: list[str] = []
    used_slots: list[str] = []
    refreshed: dict[str, str] = {}
    for slot, key, url in slot_pairs(row):
        if len(data_urls) >= max_images:
            break
        fetch_url = url
        if key:
            try:
                signed = sign_picture_url(key)
                if signed:
                    fetch_url = signed
                    refreshed[f"image_{slot}_access_url"] = signed
            except Exception:
                pass
        if not fetch_url:
            continue
        try:
            resp = requests.get(fetch_url, timeout=30)
            resp.raise_for_status()
            if len(resp.content) < 1000:
                continue
            data_urls.append(to_data_url(resp.content, resp.headers.get("content-type")))
            used_slots.append(slot)
        except Exception:
            continue
    return data_urls, refreshed, used_slots


def call_vision(
    prompt: str,
    image_data_urls: list[str],
    *,
    temperature: float = 0.2,
    max_tokens: int = 1600,
    extra_messages: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    api_url = os.getenv("VISION_API_URL", "").rstrip("/")
    api_key = os.getenv("VISION_API_KEY", "")
    model = os.getenv("VISION_MODEL", "GLM-5.3-Flash")
    if not api_url or not api_key:
        raise RuntimeError("VISION_API_URL / VISION_API_KEY missing")

    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    for u in image_data_urls:
        content.append({"type": "image_url", "image_url": {"url": u}})

    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": "只输出一个合法 JSON 对象，不要 Markdown，不要分析过程，不要解释。",
        },
        {"role": "user", "content": content},
    ]
    if extra_messages:
        messages.extend(extra_messages)

    resp = requests.post(
        f"{api_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": messages,
        },
        timeout=int(os.getenv("VISION_TIMEOUT_MS", "120000")) / 1000,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"vision {resp.status_code}: {resp.text[:500]}")
    body = resp.json()
    message = body["choices"][0]["message"]
    raw = message.get("content")
    if isinstance(raw, list):
        text = "".join(p.get("text", "") for p in raw if isinstance(p, dict))
    else:
        text = str(raw or "")
    if not text.strip():
        # some providers put the answer in reasoning / refusal fields
        text = str(message.get("reasoning_content") or "")
    parsed = extract_json_obj(text)
    return {"parsed": parsed, "raw_text": text, "api": body.get("model") or model}


def extract_json_obj(text: str) -> dict[str, Any]:
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ValueError(f"no json in model output: {text[:400]}")
    blob = m.group(0)
    try:
        return json.loads(blob)
    except json.JSONDecodeError:
        # truncated JSON: keep fields we can still read
        repaired = blob
        if not repaired.rstrip().endswith("}"):
            repaired = repaired.rstrip().rstrip(",") + "}"
        try:
            return json.loads(repaired)
        except json.JSONDecodeError as e:
            raise ValueError(f"bad json in model output: {blob[:400]}") from e


def normalize(parsed: dict[str, Any], camera_name: str | None = None) -> dict[str, Any]:
    worth = parsed.get("worth_use")
    if isinstance(worth, str):
        worth = worth.lower() in ("1", "true", "yes", "用", "有价值")
    worth = bool(worth)

    cat_l1 = parsed.get("cat_l1") or None
    cat_l2 = parsed.get("cat_l2") or None
    if not worth:
        cat_l1, cat_l2 = None, None
    else:
        if cat_l1 not in CATEGORIES:
            cat_l1, cat_l2 = None, None
        elif cat_l2 not in CATEGORIES.get(cat_l1, []):
            cat_l2 = None

    conf = parsed.get("confidence") or "没把握"
    if conf not in ("有把握", "没把握"):
        conf = "没把握"

    dominant = (parsed.get("dominant_sign_text") or "").strip() or None
    conflict = coerce_bool(parsed.get("name_scene_conflict"))
    reason = (parsed.get("reason") or "").strip() or None

    # Model may omit the flag: infer from dominant sign vs camera name
    if conflict is None and dominant and camera_name:
        conflict = not texts_overlap(camera_name, dominant)
    if conflict is None:
        conflict = False

    # Hard gate: name≠main signboard → never "有把握"
    if conflict:
        conf = "没把握"
        note = "名称与画面主招牌冲突"
        if dominant:
            note += f"（主招牌:{dominant}）"
        if reason and note not in reason:
            reason = f"{reason}；{note}"
        elif not reason:
            reason = note

    out = {
        "worth_use": 1 if worth else 0,
        "cat_l1": cat_l1,
        "cat_l2": cat_l2,
        "scene_desc": (parsed.get("scene_desc") or "").strip() or None,
        "ai_confidence": conf,
        "reason": reason,
        "name_scene_conflict": bool(conflict),
        "dominant_sign_text": dominant,
    }
    return apply_parking_place_rule(out, camera_name)


def process_one(cur, row: dict[str, Any], dry_run: bool = False) -> dict[str, Any]:
    prompt = build_prompt(row)
    # 2 帧足够分类，过大 payload 易导致输出截断
    data_urls, refreshed, _slots = fetch_image_data_urls(row, max_images=2)
    if not data_urls:
        raise ValueError("no usable images")
    try:
        result = call_vision(prompt, data_urls)
    except ValueError as first_err:
        # Model sometimes narrates instead of JSON — one strict retry
        result = call_vision(
            prompt,
            data_urls,
            temperature=0.0,
            extra_messages=[
                {
                    "role": "user",
                    "content": "上一次没有输出合法 JSON。请重新只输出一个 JSON 对象，字段含 worth_use,cat_l1,cat_l2,scene_desc,confidence,reason,amap_used,name_scene_conflict,dominant_sign_text。",
                }
            ],
        )
        result = {**result, "retried_after": str(first_err)[:200]}
    norm = normalize(result["parsed"], camera_name=row.get("camera_name"))
    raw = {
        "parsed": result["parsed"],
        "normalized": norm,
        "raw_text": result["raw_text"],
        "model": result["api"],
        "image_count": len(data_urls),
        "name_scene_conflict": norm.get("name_scene_conflict"),
        "dominant_sign_text": norm.get("dominant_sign_text"),
    }
    if dry_run:
        return {"id": row["id"], **norm, "raw": raw}

    params: dict[str, Any] = {
        **norm,
        "raw": json.dumps(raw, ensure_ascii=False),
        "id": row["id"],
    }
    set_urls = ""
    for k, v in refreshed.items():
        set_urls += f", {k} = %({k})s::text"
        params[k] = v

    cur.execute(
        f"""
        UPDATE ai_model_validation SET
          worth_use = %(worth_use)s::smallint,
          cat_l1 = %(cat_l1)s::varchar,
          cat_l2 = %(cat_l2)s::varchar,
          scene_desc = %(scene_desc)s::text,
          ai_confidence = %(ai_confidence)s::varchar,
          step2_raw_json = %(raw)s::jsonb,
          step2_at = NOW(),
          pipeline_step = GREATEST(pipeline_step, 2),
          status = CASE
            WHEN %(worth_use)s::smallint = 0 THEN 'step2_rejected'
            WHEN %(ai_confidence)s::varchar = '没把握' THEN 'step2_review'
            ELSE 'step2_done'
          END,
          updated_at = NOW()
          {set_urls}
        WHERE id = %(id)s
        """,
        params,
    )
    return {"id": row["id"], **norm}


def process_row_standalone(row: dict[str, Any], dry_run: bool = False) -> dict[str, Any]:
    """Each worker uses its own DB connection."""
    with db() as conn, conn.cursor() as cur:
        out = process_one(cur, row, dry_run=dry_run)
        if not dry_run:
            conn.commit()
        return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--id", type=int, default=None)
    parser.add_argument("--all", action="store_true", help="include already processed")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()

    with db() as conn, conn.cursor() as cur:
        if args.id:
            cur.execute("SELECT * FROM ai_model_validation WHERE id=%s", (args.id,))
            rows = cur.fetchall()
        else:
            where = "1=1" if args.all else "worth_use IS NULL"
            cur.execute(
                f"""
                SELECT * FROM ai_model_validation
                WHERE {where}
                ORDER BY id
                LIMIT %s
                """,
                (args.limit,),
            )
            rows = cur.fetchall()

    print(f"processing {len(rows)} samples with workers={args.workers}…", flush=True)
    ok = fail = 0

    if args.workers <= 1:
        with db() as conn, conn.cursor() as cur:
            for row in rows:
                try:
                    out = process_one(cur, row, dry_run=args.dry_run)
                    if not args.dry_run:
                        conn.commit()
                    ok += 1
                    print(
                        f"OK id={out['id']} worth={out['worth_use']} "
                        f"{out.get('cat_l1')}/{out.get('cat_l2')} conf={out.get('ai_confidence')}",
                        flush=True,
                    )
                except Exception as e:
                    fail += 1
                    conn.rollback()
                    print(f"FAIL id={row['id']}: {e}", flush=True)
                time.sleep(args.sleep)
    else:
        from concurrent.futures import ThreadPoolExecutor, as_completed

        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futs = {
                ex.submit(process_row_standalone, row, args.dry_run): row["id"]
                for row in rows
            }
            for fut in as_completed(futs):
                rid = futs[fut]
                try:
                    out = fut.result()
                    ok += 1
                    print(
                        f"OK id={out['id']} worth={out['worth_use']} "
                        f"{out.get('cat_l1')}/{out.get('cat_l2')} conf={out.get('ai_confidence')}",
                        flush=True,
                    )
                except Exception as e:
                    fail += 1
                    print(f"FAIL id={rid}: {e}", flush=True)

    print(f"done ok={ok} fail={fail}", flush=True)


if __name__ == "__main__":
    main()
