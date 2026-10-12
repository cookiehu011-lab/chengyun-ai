#!/usr/bin/env python3
"""Step 5: scene + static/dynamic tags from morning/noon/afternoon frames."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
load_dotenv(ROOT / ".env")

from step2_classify import (  # noqa: E402
    call_vision,
    extract_json_obj,
    fetch_image_data_urls,
)
import re

VOCAB = json.loads((ROOT / "data" / "scene_tag_vocab.json").read_text(encoding="utf-8"))
SCENE_TYPES = set(VOCAB["scene_types"])
VIEWPOINTS = set(VOCAB["viewpoints"])
STATIC_KEYS = set(VOCAB["static_tags"])
DYNAMIC_KEYS = set(VOCAB["dynamic_tags"])
DYNAMIC_LEVELS = set(VOCAB["dynamic_levels"])
SLOTS = set(VOCAB["slots"])
SLOT_LABEL = {"morning": "早", "noon": "中", "afternoon": "晚"}
OMIT_DEFAULTS: dict[str, set[str]] = {
    k: set(v) for k, v in (VOCAB.get("dynamic_omit_defaults") or {}).items()
}


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
    sql = (ROOT / "sql" / "005_scene_tags.sql").read_text(encoding="utf-8")
    cur.execute(sql)


def _fmt_value_hints() -> str:
    hints = VOCAB.get("dynamic_value_hints") or {}
    lines = []
    for k in VOCAB["dynamic_tags"]:
        vals = hints.get(k) or []
        if vals:
            lines.append(f"  - {k} → value 优先用：{' / '.join(vals)}")
        else:
            lines.append(f"  - {k}")
    return "\n".join(lines)


def _fmt_scene_questions() -> str:
    m = VOCAB.get("scene_question_map") or {}
    lines = []
    for scene, qs in m.items():
        lines.append(f"  - {scene}：{'、'.join(qs)}")
    return "\n".join(lines)


def build_prompt(row: dict[str, Any], available_slots: list[str] | None = None) -> str:
    static_list = "、".join(VOCAB["static_tags"])
    dynamic_list = "、".join(VOCAB["dynamic_tags"])
    scene_list = "、".join(VOCAB["scene_types"])
    view_list = "、".join(VOCAB["viewpoints"])
    ban_list = "、".join(VOCAB.get("do_not_tag") or [])
    slots = available_slots or ["morning", "noon", "afternoon"]
    slot_zh = "、".join(f"{s}({SLOT_LABEL.get(s, s)})" for s in slots)
    return f"""你是 SeeTime 的 C 端画面问答助手。用户会问：堵不堵、有没有空位、店开没开、人多不多、能不能看清。
本次实际输入抽帧 slots（按顺序对应图片）：{slot_zh}
只输出一个 JSON 对象，不要 Markdown，不要解释。

核心原则：
1. 标签必须能回答 C 端问题，禁止做物体盘点。
2. 禁止打这些：{ban_list}。
3. key 必须从闭集选择，不许自造 key。
4. 只打与当前场景相关的标签；不相关就省略。
5. 动态标签只描述这些抽帧里看见的；每个相关动态 key 必须覆盖本次全部可用 slots（可用多条拆分不同 value/level）。
6. slots 只能用本次给出的帧位名；即使画面是夜里也写 morning/noon/afternoon，禁止 night/白天。
7. 默认负向不要输出：施工挡路=无、排队观感=无、画面可看性=清晰、外摆=无外摆 —— 这些省略即可；有异常或说不清再打。
8. scene_summary 一句人话写「能帮用户看什么」；summary 提到的点必须在 tags 里有对应项（禁止 summary 写夜间偏暗但 tags 只有清晰）。
9. 定位锚点尽量打满可见项，有可读字或明确地标时 static_tags 至少 1 个，禁止无故空锚点。
10. 锚点用法：主店招=可读店名；路名/指示牌=路牌导向；出入口标识=卫生间/地铁口/电梯功能指示；地标锚点=城墙/标志建筑；停车出入口=道闸岗亭；场所名=画面可读场所名（含清晰场所水印）。禁止把运维编码（Camera 09、玄板0122、固枪外治）当锚点。
11. 道路：优先路名/临街店招/地标；店招门脸：必须有主店招；停车场/地库：优先停车出入口或场所名；卫生间走廊：优先出入口标识。
12. 卫生站/服务大厅、电梯厅/楼道：优先人气+场所名/出入口；不要对空走廊硬打营业观感。
13. 卫生间外走廊应选「电梯厅/楼道」或「商场内部」。
14. 相机名与画面主店招冲突时：主店招以画面为准，并在 reason 里点明冲突。

可用场景类型（闭集，只能选一个）：{scene_list}
可用视角（闭集）：{view_list}
定位锚点 static_tags（闭集，尽量 ≥1）：{static_list}
当下状态 dynamic_tags（闭集）：{dynamic_list}
动态 value 建议：
{_fmt_value_hints()}
车流密度 / 人气 也可用 level：无/少/中/多/密（与 value 二选一）。

按场景优先回答（只选相关项；负向默认省略）：
{_fmt_scene_questions()}

本路信息：
- camera_id: {row.get("camera_id")}
- camera_name: {row.get("camera_name")}
- 已有实体分类(参考): {(row.get("cat_l1") or "—")}/{(row.get("cat_l2") or "—")}
- 已有画面一句(参考): {row.get("scene_desc") or "无"}

输出字段（合法 JSON）：
{{
  "scene_type": "店招门脸",
  "scene_viewpoint": "斜视",
  "scene_summary": "街边餐饮门脸，可看店招亮没亮、门口人气",
  "static_tags": [
    {{"key": "主店招", "value": "有鱼", "confidence": "有把握"}}
  ],
  "dynamic_tags": [
    {{"key": "营业观感", "value": "像在营业", "slots": ["noon", "afternoon"], "confidence": "有把握"}},
    {{"key": "店招亮灯", "value": "灭", "slots": ["morning"], "confidence": "有把握"}},
    {{"key": "店招亮灯", "value": "亮", "slots": ["afternoon"], "confidence": "有把握"}},
    {{"key": "人气", "level": "少", "slots": ["morning", "noon", "afternoon"], "confidence": "有把握"}},
    {{"key": "画面可看性", "value": "偏暗", "slots": ["morning"], "confidence": "有把握"}}
  ],
  "confidence": "有把握",
  "reason": "简短说明；若名称与店招冲突请写明"
}}
"""


def _norm_conf(v: Any) -> str:
    if v in ("有把握", "没把握"):
        return v
    return "没把握"


def _norm_slots(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out = []
    for s in raw:
        s = str(s).strip().lower()
        # allow 早中晚
        mapping = {"早": "morning", "中": "noon", "晚": "afternoon", "午": "noon"}
        s = mapping.get(s, s)
        if s in SLOTS and s not in out:
            out.append(s)
    return out


def _is_default_negative(key: str, level: Any, value: str) -> bool:
    omit_vals = OMIT_DEFAULTS.get(key) or set()
    if not omit_vals:
        return False
    if value and value in omit_vals:
        return True
    if level and str(level) in omit_vals:
        return True
    return False


def normalize_tags(
    parsed: dict[str, Any],
    *,
    available_slots: list[str] | None = None,
) -> dict[str, Any]:
    scene_type = parsed.get("scene_type") or "其他"
    if scene_type not in SCENE_TYPES:
        scene_type = "其他"
    viewpoint = parsed.get("scene_viewpoint") or "其他"
    if viewpoint not in VIEWPOINTS:
        viewpoint = "其他"
    summary = (parsed.get("scene_summary") or "").strip() or None

    static_tags: list[dict[str, Any]] = []
    for item in parsed.get("static_tags") or []:
        if not isinstance(item, dict):
            continue
        key = (item.get("key") or "").strip()
        if not key or key not in STATIC_KEYS:
            continue
        conf = _norm_conf(item.get("confidence"))
        entry: dict[str, Any] = {"key": key, "confidence": conf}
        val = (item.get("value") or "").strip()
        if val:
            entry["value"] = val[:64]
        static_tags.append(entry)
    seen = set()
    uniq_static = []
    for t in static_tags:
        if t["key"] in seen:
            continue
        seen.add(t["key"])
        uniq_static.append(t)

    dynamic_tags: list[dict[str, Any]] = []
    for item in parsed.get("dynamic_tags") or []:
        if not isinstance(item, dict):
            continue
        key = (item.get("key") or "").strip()
        if not key or key not in DYNAMIC_KEYS:
            continue
        slots = _norm_slots(item.get("slots"))
        if available_slots:
            slots = [s for s in slots if s in available_slots]
        if not slots:
            continue
        conf = _norm_conf(item.get("confidence"))
        level = item.get("level")
        if level not in DYNAMIC_LEVELS:
            level = None
        val = (item.get("value") or "").strip()
        if _is_default_negative(key, level, val):
            continue
        entry: dict[str, Any] = {"key": key, "slots": slots, "confidence": conf}
        if level:
            entry["level"] = level
        if val:
            entry["value"] = val[:64]
        if key in ("车流密度", "人气") and not level and not val:
            continue
        if key not in ("车流密度", "人气") and not val and not level:
            continue
        dynamic_tags.append(entry)

    seen_d = set()
    uniq_dynamic = []
    for t in dynamic_tags:
        k = (t["key"], tuple(t["slots"]), t.get("value"), t.get("level"))
        if k in seen_d:
            continue
        seen_d.add(k)
        uniq_dynamic.append(t)

    conf = _norm_conf(parsed.get("confidence"))
    if scene_type == "其他" and not uniq_static:
        conf = "没把握"
    # 本应有锚点的场景却空锚点 → 降把握
    if not uniq_static and scene_type in (
        "店招门脸",
        "道路",
        "路口",
        "停车场",
        "地库通道",
        "卫生间",
        "卫生站/服务大厅",
        "公交/交通场站",
    ):
        conf = "没把握"

    # 多时段塌缩：有 ≥2 帧可用，但任一关键动态 key 只覆盖 1 个 slot → 降把握
    avail = list(available_slots or [])
    if len(avail) >= 2 and uniq_dynamic:
        by_key: dict[str, set[str]] = {}
        for t in uniq_dynamic:
            by_key.setdefault(t["key"], set()).update(t["slots"])
        primary = [
            k
            for k in ("拥堵观感", "车流密度", "人气", "空闲车位", "营业观感", "画面可看性")
            if k in by_key
        ]
        for k in primary:
            if len(by_key[k]) < min(2, len(avail)):
                conf = "没把握"
                break

    # summary 提到偏暗/夜间但无画面可看性 → 降把握
    if summary and re.search(r"偏暗|看不清|夜间|凌晨", summary):
        if not any(t["key"] == "画面可看性" for t in uniq_dynamic):
            conf = "没把握"

    return {
        "scene_type": scene_type,
        "scene_viewpoint": viewpoint,
        "scene_summary": summary,
        "static_tags": uniq_static,
        "dynamic_tags": uniq_dynamic,
        "step5_confidence": conf,
        "reason": (parsed.get("reason") or "").strip() or None,
    }


def repair_truncated_json(text: str) -> dict[str, Any]:
    """Best-effort recover truncated tag JSON."""
    try:
        return extract_json_obj(text)
    except ValueError:
        pass
    m = re.search(r"\{[\s\S]*", text)
    if not m:
        raise ValueError(f"no json in model output: {text[:400]}")
    blob = m.group(0)
    # drop trailing incomplete key/object/string
    blob = re.sub(r",\s*\{[^{}]*$", "", blob)
    blob = re.sub(r",\s*\"[^\"]*$", "", blob)
    # unclosed string value → close it
    if blob.count('"') % 2 == 1:
        blob += '"'
    # close open arrays/objects
    opens = blob.count("[") - blob.count("]")
    blob += "]" * max(0, opens)
    opens = blob.count("{") - blob.count("}")
    blob += "}" * max(0, opens)
    # trailing comma before } or ]
    blob = re.sub(r",\s*([}\]])", r"\1", blob)
    try:
        return json.loads(blob)
    except json.JSONDecodeError as e:
        raise ValueError(f"bad json in model output: {blob[:400]}") from e


def process_one(cur, row: dict[str, Any], dry_run: bool = False) -> dict[str, Any]:
    data_urls, refreshed, used_slots = fetch_image_data_urls(row, max_images=3)
    if not data_urls:
        raise ValueError("no usable images")
    prompt = build_prompt(row, available_slots=used_slots)
    def _parse_vision(res: dict[str, Any]) -> dict[str, Any]:
        try:
            return res["parsed"]
        except Exception:
            return repair_truncated_json(res.get("raw_text") or "")

    try:
        result = call_vision(prompt, data_urls, temperature=0.1, max_tokens=4000)
        parsed = _parse_vision(result)
    except Exception as first_err:
        retry_slots = used_slots[:2]
        result = call_vision(
            build_prompt(row, available_slots=retry_slots)
            + "\n\n请精简：定位锚点≤3、当下状态≤6，必须覆盖全部可用 slots，负向默认省略。",
            data_urls[:2],
            temperature=0.0,
            max_tokens=3200,
            extra_messages=[
                {
                    "role": "user",
                    "content": "只输出完整合法 JSON。字段：scene_type,scene_viewpoint,scene_summary,static_tags,dynamic_tags,confidence,reason。禁止水印/绿化/立柱；禁止只答一帧。",
                }
            ],
        )
        try:
            parsed = _parse_vision(result)
        except Exception:
            # 第三刀：极短强制 JSON（防模型写分析长文）
            tiny_slots = used_slots[:2] or retry_slots
            tiny = (
                "只输出JSON，禁止分析文字。"
                "字段:scene_type,scene_viewpoint,scene_summary,static_tags,dynamic_tags,confidence,reason。"
                f"scene_type从这些选：{'、'.join(VOCAB['scene_types'])}。"
                f"static key只能：{'、'.join(VOCAB['static_tags'])}。"
                f"dynamic key只能：{'、'.join(VOCAB['dynamic_tags'])}。"
                f"slots只能{tiny_slots}，相关动态尽量覆盖这些slots。"
                "负向默认（无施工/无排队/清晰/无外摆）不要输出。"
            )
            result = call_vision(
                tiny,
                data_urls[:2] or data_urls[:1],
                temperature=0.0,
                max_tokens=2500,
            )
            parsed = _parse_vision(result)
            retry_slots = tiny_slots
        result = {**result, "parsed": parsed, "retried_after": str(first_err)[:200]}
        used_slots = retry_slots

    try:
        norm = normalize_tags(parsed, available_slots=used_slots)
    except Exception:
        parsed = repair_truncated_json(result.get("raw_text") or "")
        norm = normalize_tags(parsed, available_slots=used_slots)
    raw = {
        "parsed": result["parsed"],
        "normalized": norm,
        "raw_text": result["raw_text"],
        "model": result["api"],
        "image_count": len(data_urls),
        "used_slots": used_slots,
    }
    if dry_run:
        return {"id": row["id"], **norm, "raw": raw}

    params: dict[str, Any] = {
        "id": row["id"],
        "scene_type": norm["scene_type"],
        "scene_viewpoint": norm["scene_viewpoint"],
        "scene_summary": norm["scene_summary"],
        "static_tags": json.dumps(norm["static_tags"], ensure_ascii=False),
        "dynamic_tags": json.dumps(norm["dynamic_tags"], ensure_ascii=False),
        "step5_confidence": norm["step5_confidence"],
        "raw": json.dumps(raw, ensure_ascii=False),
    }
    set_urls = ""
    for k, v in refreshed.items():
        set_urls += f", {k} = %({k})s::text"
        params[k] = v

    cur.execute(
        f"""
        UPDATE ai_model_validation SET
          scene_type = %(scene_type)s::varchar,
          scene_viewpoint = %(scene_viewpoint)s::varchar,
          scene_summary = %(scene_summary)s::text,
          static_tags = %(static_tags)s::jsonb,
          dynamic_tags = %(dynamic_tags)s::jsonb,
          step5_confidence = %(step5_confidence)s::varchar,
          step5_raw_json = %(raw)s::jsonb,
          step5_at = NOW(),
          pipeline_step = GREATEST(pipeline_step, 5),
          updated_at = NOW()
          {set_urls}
        WHERE id = %(id)s
        """,
        params,
    )
    return {"id": row["id"], **norm}


def process_row_standalone(row: dict[str, Any], dry_run: bool = False) -> dict[str, Any]:
    with db() as conn, conn.cursor() as cur:
        ensure_schema(cur)
        out = process_one(cur, row, dry_run=dry_run)
        if not dry_run:
            conn.commit()
        return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=25)
    parser.add_argument("--id", type=int, default=None)
    parser.add_argument("--all", action="store_true", help="include already tagged")
    parser.add_argument(
        "--retag",
        action="store_true",
        help="only re-run samples that already have step5_at",
    )
    parser.add_argument("--worth-only", action="store_true", default=True)
    parser.add_argument("--include-rejected", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--sleep", type=float, default=0.15)
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()

    with db() as conn, conn.cursor() as cur:
        ensure_schema(cur)
        conn.commit()
        if args.id:
            cur.execute("SELECT * FROM ai_model_validation WHERE id=%s", (args.id,))
            rows = cur.fetchall()
        else:
            clauses = ["1=1"]
            if not args.include_rejected:
                clauses.append("(worth_use IS DISTINCT FROM 0)")
            if args.retag:
                clauses.append("step5_at IS NOT NULL")
            elif not args.all:
                clauses.append("step5_at IS NULL")
            where = " AND ".join(clauses)
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

    print(f"step5 tagging {len(rows)} samples workers={args.workers}…", flush=True)
    ok = fail = 0

    if args.workers <= 1:
        with db() as conn, conn.cursor() as cur:
            ensure_schema(cur)
            for row in rows:
                try:
                    out = process_one(cur, row, dry_run=args.dry_run)
                    if not args.dry_run:
                        conn.commit()
                    ok += 1
                    print(
                        f"OK id={out['id']} scene={out.get('scene_type')} "
                        f"static={len(out.get('static_tags') or [])} "
                        f"dynamic={len(out.get('dynamic_tags') or [])} "
                        f"conf={out.get('step5_confidence')}",
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
                        f"OK id={out['id']} scene={out.get('scene_type')} "
                        f"static={len(out.get('static_tags') or [])} "
                        f"dynamic={len(out.get('dynamic_tags') or [])} "
                        f"conf={out.get('step5_confidence')}",
                        flush=True,
                    )
                except Exception as e:
                    fail += 1
                    print(f"FAIL id={rid}: {e}", flush=True)

    print(f"done ok={ok} fail={fail}", flush=True)


if __name__ == "__main__":
    main()
