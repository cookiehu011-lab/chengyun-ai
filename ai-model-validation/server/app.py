"""AI 建模全链路验证 API + 静态页。"""

from __future__ import annotations

import json
import os
import sys
import threading
from pathlib import Path
from typing import Any, Optional

import psycopg
from dotenv import load_dotenv
import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from psycopg.rows import dict_row

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
load_dotenv(ROOT / ".env")

from oss_cloud import sign_picture_batch, sign_picture_url  # noqa: E402
from step2_classify import process_row_standalone  # noqa: E402
from step3_propose import run as run_step3  # noqa: E402
from step5_scene_tags import (  # noqa: E402
    ensure_schema as ensure_step5_schema,
    process_row_standalone as process_step5_standalone,
)

IMAGE_SLOTS = ("morning", "noon", "afternoon")
IMAGE_LABELS = {"morning": "早", "noon": "中", "afternoon": "晚"}

WEB_DIR = ROOT / "web"

app = FastAPI(title="AI Model Validation", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_batch_lock = threading.Lock()
_batch_state: dict[str, Any] = {
    "running": False,
    "ok": 0,
    "fail": 0,
    "total": 0,
    "current_id": None,
    "last_error": None,
    "message": "idle",
}

_step3_lock = threading.Lock()
_step3_state: dict[str, Any] = {
    "running": False,
    "message": "idle",
    "result": None,
    "last_error": None,
}

_step5_lock = threading.Lock()
_step5_state: dict[str, Any] = {
    "running": False,
    "ok": 0,
    "fail": 0,
    "total": 0,
    "current_id": None,
    "last_error": None,
    "message": "idle",
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


PIPELINE_STEPS = [
    {"step": 1, "key": "ingest", "title": "相机接入", "desc": "截帧、名称、位置"},
    {"step": 2, "key": "screen", "title": "价值筛选与分类", "desc": "先判价值，再综合分类"},
    {"step": 3, "key": "model", "title": "实体建模", "desc": "冷启动聚成候选实体"},
    {"step": 4, "key": "publish", "title": "实体发布", "desc": "质检门禁后发布"},
    {"step": 5, "key": "apply", "title": "画面理解", "desc": "场景 + 静态/动态标签"},
]


def serialize(row: dict[str, Any], *, refresh_images: bool = False) -> dict[str, Any]:
    out = dict(row)
    for k, v in list(out.items()):
        if hasattr(v, "isoformat"):
            out[k] = v.isoformat()

    if refresh_images:
        keys = [
            out.get(f"image_{slot}_cos_key")
            for slot in IMAGE_SLOTS
            if out.get(f"image_{slot}_cos_key")
        ]
        if keys:
            try:
                signed = sign_picture_batch(keys, expiry_seconds=3600)
                for slot in IMAGE_SLOTS:
                    key = out.get(f"image_{slot}_cos_key")
                    if key and signed.get(key):
                        out[f"image_{slot}_access_url"] = signed[key]
            except Exception:
                pass

    sample_id = out.get("id")
    images = []
    for slot in IMAGE_SLOTS:
        url = out.get(f"image_{slot}_access_url")
        key = out.get(f"image_{slot}_cos_key")
        if url or key:
            # Same-origin proxy avoids OSS tmp-URL expiry / referrer blocks in browser
            proxy = f"/api/samples/{sample_id}/images/{slot}" if sample_id and key else url
            images.append(
                {
                    "slot": slot,
                    "label": IMAGE_LABELS[slot],
                    "url": proxy,
                    "direct_url": url,
                    "key": key,
                }
            )
    out["images"] = images
    out["effective_worth_use"] = (
        out["human_worth_use"] if out.get("human_worth_use") is not None else out.get("worth_use")
    )
    out["effective_cat_l1"] = out.get("human_cat_l1") or out.get("cat_l1")
    out["effective_cat_l2"] = out.get("human_cat_l2") or out.get("cat_l2")
    out["effective_scene_desc"] = out.get("human_scene_desc") or out.get("scene_desc")

    raw = out.get("step2_raw_json")
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = None
    if isinstance(raw, dict):
        norm = raw.get("normalized") if isinstance(raw.get("normalized"), dict) else {}
        conflict = raw.get("name_scene_conflict")
        if conflict is None:
            conflict = norm.get("name_scene_conflict")
        sign = raw.get("dominant_sign_text") or norm.get("dominant_sign_text")
        reason = norm.get("reason") or (raw.get("parsed") or {}).get("reason")
        out["name_scene_conflict"] = bool(conflict)
        out["dominant_sign_text"] = sign
        out["step2_reason"] = reason
    else:
        out.setdefault("name_scene_conflict", False)
        out.setdefault("dominant_sign_text", None)
        out.setdefault("step2_reason", None)
    return out


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/pipeline")
def pipeline():
    return {"steps": PIPELINE_STEPS}


@app.get("/api/stats")
def stats():
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT count(*) AS total FROM ai_model_validation")
        total = cur.fetchone()["total"]

        cur.execute(
            """
            SELECT sample_stratum AS stratum, count(*) AS n
            FROM ai_model_validation
            GROUP BY 1 ORDER BY n DESC
            """
        )
        by_stratum = cur.fetchall()

        cur.execute(
            """
            SELECT
              count(*) FILTER (WHERE worth_use IS NULL) AS step2_pending,
              count(*) FILTER (WHERE worth_use = 1) AS worth_yes,
              count(*) FILTER (WHERE worth_use = 0) AS worth_no,
              count(*) FILTER (WHERE reviewed_at IS NOT NULL) AS reviewed,
              count(*) FILTER (WHERE pipeline_step >= 2) AS step2_done,
              count(*) FILTER (WHERE pipeline_step >= 3) AS step3_done,
              count(*) FILTER (WHERE worth_use = 1 AND entity_proposal_id IS NULL) AS step3_pending
            FROM ai_model_validation
            """
        )
        progress = dict(cur.fetchone() or {})
        try:
            cur.execute(
                """
                SELECT
                  count(*) FILTER (WHERE step5_at IS NOT NULL) AS step5_done,
                  count(*) FILTER (
                    WHERE worth_use = 1 AND step5_at IS NULL
                  ) AS step5_pending
                FROM ai_model_validation
                """
            )
            progress.update(dict(cur.fetchone() or {}))
        except Exception:
            progress.setdefault("step5_done", 0)
            progress.setdefault("step5_pending", 0)

        entity_count = 0
        edge_stats = {
            "part_of": 0,
            "segment_of": 0,
            "edge_pending": 0,
            "edge_approved": 0,
            "edge_rejected": 0,
        }
        try:
            cur.execute("SELECT count(*) AS n FROM ai_entity_proposal")
            entity_count = cur.fetchone()["n"]
        except Exception:
            pass
        try:
            cur.execute(
                """
                SELECT
                  count(*) FILTER (WHERE edge_type = 'part_of') AS part_of,
                  count(*) FILTER (WHERE edge_type = 'segment_of') AS segment_of,
                  count(*) FILTER (
                    WHERE edge_type IN ('part_of','segment_of') AND status = 'proposed'
                  ) AS edge_pending,
                  count(*) FILTER (
                    WHERE edge_type IN ('part_of','segment_of') AND status = 'approved'
                  ) AS edge_approved,
                  count(*) FILTER (
                    WHERE edge_type IN ('part_of','segment_of') AND status = 'rejected'
                  ) AS edge_rejected
                FROM ai_entity_edge
                """
            )
            row = cur.fetchone() or {}
            edge_stats.update({k: row.get(k) or 0 for k in edge_stats})
        except Exception:
            pass

    focus = 3 if progress and progress.get("step2_pending", 1) == 0 else 2
    return {
        "total": total,
        "by_stratum": by_stratum,
        "progress": progress,
        "entity_count": entity_count,
        "edge_stats": edge_stats,
        "current_focus_step": focus,
    }


@app.get("/api/samples")
def list_samples(
    stratum: Optional[str] = None,
    status: Optional[str] = None,
    worth: Optional[str] = Query(None, description="yes|no|pending"),
    edge: Optional[str] = Query(
        None, description="part_pending|segment_pending|edge_pending|edge_approved|no_edge"
    ),
    step5: Optional[str] = Query(None, description="pending|done"),
    q: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    clauses = ["1=1"]
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    if stratum:
        clauses.append("sample_stratum = %(stratum)s")
        params["stratum"] = stratum
    if status:
        clauses.append("status = %(status)s")
        params["status"] = status
    if worth == "yes":
        clauses.append("worth_use = 1")
    elif worth == "no":
        clauses.append("worth_use = 0")
    elif worth == "pending":
        clauses.append("worth_use IS NULL")
    if q:
        clauses.append(
            "(camera_name ILIKE %(q)s OR camera_id ILIKE %(q)s OR entity_name_proposed ILIKE %(q)s)"
        )
        params["q"] = f"%{q}%"

    # 构成边校验筛选：挂在样本所属实体上的 part_of / segment_of
    edge_exists = """
        EXISTS (
          SELECT 1 FROM ai_entity_edge e
          WHERE e.edge_type IN ('part_of','segment_of')
            AND (e.from_entity_id = ai_model_validation.entity_proposal_id
                 OR e.to_entity_id = ai_model_validation.entity_proposal_id)
            {extra}
        )
    """
    if edge == "part_pending":
        clauses.append(
            edge_exists.format(
                extra="AND e.edge_type = 'part_of' AND e.status = 'proposed'"
            )
        )
    elif edge == "segment_pending":
        clauses.append(
            edge_exists.format(
                extra="AND e.edge_type = 'segment_of' AND e.status = 'proposed'"
            )
        )
    elif edge == "edge_pending":
        clauses.append(edge_exists.format(extra="AND e.status = 'proposed'"))
    elif edge == "edge_approved":
        clauses.append(edge_exists.format(extra="AND e.status = 'approved'"))
    elif edge == "no_edge":
        clauses.append("entity_proposal_id IS NOT NULL")
        clauses.append("NOT " + edge_exists.format(extra=""))

    if step5 == "pending":
        clauses.append("step5_at IS NULL")
        clauses.append("worth_use IS DISTINCT FROM 0")
    elif step5 == "done":
        clauses.append("step5_at IS NOT NULL")

    where = " AND ".join(clauses)
    sql = f"""
        SELECT id, source_id, camera_id, camera_name, gcj02_lon, gcj02_lat,
               sample_stratum, worth_use, cat_l1, cat_l2, scene_desc, ai_confidence,
               human_worth_use, human_cat_l1, human_cat_l2, reviewed_at,
               entity_proposal_id, entity_name_proposed, step3_confidence,
               amap_formatted_address, amap_nearest_poi_name, amap_nearest_poi_type,
               pipeline_step, status, step2_raw_json,
               scene_type, scene_viewpoint, step5_confidence, step5_at,
               image_morning_access_url, image_noon_access_url, image_afternoon_access_url,
               updated_at
        FROM ai_model_validation
        WHERE {where}
        ORDER BY id
        LIMIT %(limit)s OFFSET %(offset)s
    """
    count_sql = f"SELECT count(*) AS n FROM ai_model_validation WHERE {where}"

    with db() as conn, conn.cursor() as cur:
        cur.execute(count_sql, params)
        total = cur.fetchone()["n"]
        cur.execute(sql, params)
        rows = [serialize(r) for r in cur.fetchall()]

    return {"total": total, "items": rows}


def _entity_relation_payload(cur, entity_id: int) -> dict[str, Any]:
    """父实体 + 子实体/路段 + 关联边，供详情构成树使用。"""
    cur.execute("SELECT * FROM ai_entity_proposal WHERE id = %s", (entity_id,))
    entity = cur.fetchone()
    if not entity:
        return {}

    parent = None
    if entity.get("parent_entity_id"):
        cur.execute(
            "SELECT * FROM ai_entity_proposal WHERE id = %s",
            (entity["parent_entity_id"],),
        )
        parent = cur.fetchone()

    children: list[dict[str, Any]] = []
    related: list[dict[str, Any]] = []
    try:
        cur.execute(
            """
            SELECT e.id AS edge_id, e.edge_type, e.confidence, e.evidence, e.status AS edge_status,
                   p.id, p.entity_name, p.cat_l1, p.cat_l2,
                   p.camera_count, p.entity_role, p.parent_entity_id
            FROM ai_entity_edge e
            JOIN ai_entity_proposal p ON p.id = e.from_entity_id
            WHERE e.to_entity_id = %s
            ORDER BY e.edge_type, p.entity_name
            """,
            (entity_id,),
        )
        for r in cur.fetchall():
            item = {
                "edge_id": r["edge_id"],
                "edge_type": r["edge_type"],
                "edge_status": r["edge_status"] or "proposed",
                "confidence": r["confidence"],
                "evidence": r["evidence"],
                "id": r["id"],
                "entity_name": r["entity_name"],
                "cat_l1": r["cat_l1"],
                "cat_l2": r["cat_l2"],
                "camera_count": r["camera_count"],
                "entity_role": r["entity_role"],
            }
            if r["edge_type"] in ("part_of", "segment_of"):
                children.append(item)
            else:
                related.append(item)

        # 当前实体作为子：指向父的边证据
        cur.execute(
            """
            SELECT e.id AS edge_id, e.edge_type, e.confidence, e.evidence, e.status AS edge_status,
                   p.id, p.entity_name, p.cat_l1, p.cat_l2, p.camera_count
            FROM ai_entity_edge e
            JOIN ai_entity_proposal p ON p.id = e.to_entity_id
            WHERE e.from_entity_id = %s
            ORDER BY e.edge_type
            """,
            (entity_id,),
        )
        as_child = [dict(r) for r in cur.fetchall()]
    except Exception:
        children, related, as_child = [], [], []

    return {
        "entity": serialize(entity),
        "parent": serialize(parent) if parent else None,
        "children": children,
        "related": related,
        "as_child_of": as_child,
    }


@app.get("/api/samples/{sample_id}")
def get_sample(sample_id: int):
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM ai_model_validation WHERE id = %s", (sample_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "sample not found")
        relation = {}
        if row.get("entity_proposal_id"):
            relation = _entity_relation_payload(cur, int(row["entity_proposal_id"]))
    out = serialize(row, refresh_images=True)
    if relation.get("entity"):
        out["entity"] = relation["entity"]
        out["entity_parent"] = relation.get("parent")
        out["entity_children"] = relation.get("children") or []
        out["entity_related"] = relation.get("related") or []
        out["entity_as_child_of"] = relation.get("as_child_of") or []
    return out


@app.get("/api/samples/{sample_id}/images/{slot}")
def proxy_sample_image(sample_id: int, slot: str):
    """Stream camera frame via same-origin proxy (fresh sign each request)."""
    if slot not in IMAGE_SLOTS:
        raise HTTPException(400, "invalid slot")
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT image_{slot}_cos_key AS cos_key, image_{slot}_access_url AS access_url
            FROM ai_model_validation WHERE id = %s
            """,
            (sample_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "sample not found")
    key = row.get("cos_key")
    url = ""
    if key:
        try:
            url = sign_picture_url(key, expiry_seconds=3600)
        except Exception as exc:
            raise HTTPException(502, f"sign failed: {exc}") from exc
    if not url:
        url = row.get("access_url") or ""
    if not url:
        raise HTTPException(404, "image not found")
    try:
        upstream = requests.get(
            url,
            timeout=30,
            headers={"Referer": "", "User-Agent": "ai-model-validation/1.0"},
        )
    except requests.RequestException as exc:
        raise HTTPException(502, f"fetch failed: {exc}") from exc
    if upstream.status_code != 200:
        raise HTTPException(502, f"upstream {upstream.status_code}")
    ctype = upstream.headers.get("content-type") or "image/jpeg"
    return Response(
        content=upstream.content,
        media_type=ctype,
        headers={
            "Cache-Control": "private, max-age=300",
            "Referrer-Policy": "no-referrer",
        },
    )


class ReviewBody(BaseModel):
    human_worth_use: Optional[int] = Field(None, description="1|0")
    human_cat_l1: Optional[str] = None
    human_cat_l2: Optional[str] = None
    human_scene_desc: Optional[str] = None
    reviewed_by: Optional[str] = "reviewer"


@app.patch("/api/samples/{sample_id}/review")
def patch_review(sample_id: int, body: ReviewBody):
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(400, "no fields")
    sets = []
    params: dict[str, Any] = {"id": sample_id}
    for k, v in fields.items():
        sets.append(f"{k} = %({k})s")
        params[k] = v
    sets.append("reviewed_at = NOW()")
    sets.append("updated_at = NOW()")
    sql = f"UPDATE ai_model_validation SET {', '.join(sets)} WHERE id = %(id)s RETURNING *"
    with db() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        conn.commit()
    if not row:
        raise HTTPException(404, "sample not found")
    return serialize(row)


@app.post("/api/samples/{sample_id}/step2")
def run_step2(sample_id: int):
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM ai_model_validation WHERE id = %s", (sample_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "sample not found")
    try:
        process_row_standalone(row, dry_run=False)
    except Exception as e:
        raise HTTPException(500, f"step2 failed: {e}") from e
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM ai_model_validation WHERE id = %s", (sample_id,))
        updated = cur.fetchone()
    return serialize(updated)


@app.post("/api/samples/{sample_id}/step5")
def run_step5(sample_id: int):
    with db() as conn, conn.cursor() as cur:
        ensure_step5_schema(cur)
        conn.commit()
        cur.execute("SELECT * FROM ai_model_validation WHERE id = %s", (sample_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "sample not found")
    try:
        process_step5_standalone(row, dry_run=False)
    except Exception as e:
        raise HTTPException(500, f"step5 failed: {e}") from e
    with db() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM ai_model_validation WHERE id = %s", (sample_id,))
        updated = cur.fetchone()
    return serialize(updated, refresh_images=True)


def _run_step5_batch(limit: int, workers: int) -> None:
    global _step5_state
    try:
        with db() as conn, conn.cursor() as cur:
            ensure_step5_schema(cur)
            conn.commit()
            cur.execute(
                """
                SELECT * FROM ai_model_validation
                WHERE worth_use IS DISTINCT FROM 0 AND step5_at IS NULL
                ORDER BY id
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
        _step5_state.update(
            {
                "running": True,
                "ok": 0,
                "fail": 0,
                "total": len(rows),
                "message": "tagging…",
                "last_error": None,
            }
        )
        from concurrent.futures import ThreadPoolExecutor, as_completed

        with ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
            futs = {ex.submit(process_step5_standalone, row, False): row["id"] for row in rows}
            for fut in as_completed(futs):
                rid = futs[fut]
                _step5_state["current_id"] = rid
                try:
                    fut.result()
                    _step5_state["ok"] += 1
                except Exception as e:
                    _step5_state["fail"] += 1
                    _step5_state["last_error"] = str(e)
        _step5_state["message"] = (
            f"done ok={_step5_state['ok']} fail={_step5_state['fail']}"
        )
    except Exception as e:
        _step5_state["last_error"] = str(e)
        _step5_state["message"] = f"aborted: {e}"
    finally:
        _step5_state["running"] = False
        _step5_state["current_id"] = None


@app.get("/api/step5/batch")
def step5_batch_status():
    return dict(_step5_state)


@app.post("/api/step5/batch")
def start_step5(limit: int = Query(30, ge=1, le=200), workers: int = Query(2, ge=1, le=4)):
    with _step5_lock:
        if _step5_state["running"]:
            return {"started": False, "state": dict(_step5_state)}
        t = threading.Thread(
            target=_run_step5_batch, args=(limit, workers), daemon=True
        )
        t.start()
    return {"started": True, "state": dict(_step5_state)}


class BatchBody(BaseModel):
    limit: int = Field(200, ge=1, le=500)
    workers: int = Field(2, ge=1, le=4)


def _run_batch(limit: int, workers: int) -> None:
    global _batch_state
    try:
        with db() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM ai_model_validation
                WHERE worth_use IS NULL
                ORDER BY id
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()

        _batch_state.update(
            {
                "running": True,
                "ok": 0,
                "fail": 0,
                "total": len(rows),
                "current_id": None,
                "last_error": None,
                "message": f"running {len(rows)}",
            }
        )

        from concurrent.futures import ThreadPoolExecutor, as_completed

        with ThreadPoolExecutor(max_workers=workers) as ex:
            futs = {ex.submit(process_row_standalone, row, False): row["id"] for row in rows}
            for fut in as_completed(futs):
                rid = futs[fut]
                _batch_state["current_id"] = rid
                try:
                    fut.result()
                    _batch_state["ok"] += 1
                except Exception as e:
                    _batch_state["fail"] += 1
                    _batch_state["last_error"] = f"id={rid}: {e}"
        _batch_state["message"] = f"done ok={_batch_state['ok']} fail={_batch_state['fail']}"
    except Exception as e:
        _batch_state["last_error"] = str(e)
        _batch_state["message"] = f"aborted: {e}"
    finally:
        _batch_state["running"] = False
        _batch_state["current_id"] = None


@app.get("/api/step2/batch")
def batch_status():
    return dict(_batch_state)


@app.post("/api/step2/batch")
def start_batch(body: BatchBody = BatchBody()):
    with _batch_lock:
        if _batch_state["running"]:
            return {"started": False, "state": dict(_batch_state)}
        t = threading.Thread(target=_run_batch, args=(body.limit, body.workers), daemon=True)
        t.start()
    return {"started": True, "state": dict(_batch_state)}


def _run_step3_job(reset: bool) -> None:
    global _step3_state
    _step3_state.update({"running": True, "message": "clustering…", "last_error": None})
    try:
        result = run_step3(reset=reset)
        _step3_state["result"] = result
        _step3_state["message"] = (
            f"done entities={result.get('entities')} cameras={result.get('cameras')}"
        )
    except Exception as e:
        _step3_state["last_error"] = str(e)
        _step3_state["message"] = f"aborted: {e}"
    finally:
        _step3_state["running"] = False


@app.get("/api/step3/batch")
def step3_batch_status():
    return dict(_step3_state)


@app.post("/api/step3/batch")
def start_step3(reset: bool = True):
    with _step3_lock:
        if _step3_state["running"]:
            return {"started": False, "state": dict(_step3_state)}
        t = threading.Thread(target=_run_step3_job, args=(reset,), daemon=True)
        t.start()
    return {"started": True, "state": dict(_step3_state)}


@app.get("/api/entities")
def list_entities(
    q: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
):
    clauses = ["1=1"]
    params: dict[str, Any] = {"limit": limit}
    if q:
        clauses.append("entity_name ILIKE %(q)s")
        params["q"] = f"%{q}%"
    where = " AND ".join(clauses)
    with db() as conn, conn.cursor() as cur:
        try:
            cur.execute(
                f"""
                SELECT id, entity_name, cat_l1, cat_l2, gcj02_lon, gcj02_lat,
                       camera_count, confidence, reason, status, updated_at
                FROM ai_entity_proposal
                WHERE {where}
                ORDER BY camera_count DESC, id
                LIMIT %(limit)s
                """,
                params,
            )
            items = [serialize(r) for r in cur.fetchall()]
            cur.execute(f"SELECT count(*) AS n FROM ai_entity_proposal WHERE {where}", params)
            total = cur.fetchone()["n"]
        except Exception as e:
            raise HTTPException(404, f"entity table missing: {e}") from e
    return {"total": total, "items": items}


class EdgeReviewBody(BaseModel):
    status: str = Field(..., description="proposed|approved|rejected")
    reviewed_by: Optional[str] = "web"


@app.patch("/api/edges/{edge_id}/review")
def patch_edge_review(edge_id: int, body: EdgeReviewBody):
    if body.status not in ("proposed", "approved", "rejected"):
        raise HTTPException(400, "status must be proposed|approved|rejected")
    with db() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE ai_entity_edge SET
              status = %(status)s,
              reviewed_at = CASE
                WHEN %(status)s = 'proposed' THEN NULL
                ELSE NOW()
              END,
              reviewed_by = CASE
                WHEN %(status)s = 'proposed' THEN NULL
                ELSE %(by)s
              END,
              updated_at = NOW()
            WHERE id = %(id)s
            RETURNING *
            """,
            {"id": edge_id, "status": body.status, "by": body.reviewed_by or "web"},
        )
        row = cur.fetchone()
        conn.commit()
    if not row:
        raise HTTPException(404, "edge not found")
    return serialize(row)


@app.get("/api/entities/{entity_id}")
def get_entity(entity_id: int):
    with db() as conn, conn.cursor() as cur:
        relation = _entity_relation_payload(cur, entity_id)
        if not relation.get("entity"):
            raise HTTPException(404, "entity not found")
        cur.execute(
            """
            SELECT id, camera_id, camera_name, cat_l1, cat_l2, worth_use,
                   scene_desc, step3_confidence, status,
                   image_morning_access_url, image_noon_access_url, image_afternoon_access_url
            FROM ai_model_validation
            WHERE entity_proposal_id = %s
            ORDER BY id
            """,
            (entity_id,),
        )
        cams = [serialize(r) for r in cur.fetchall()]
    out = relation["entity"]
    out["parent"] = relation.get("parent")
    out["children"] = relation.get("children") or []
    out["related"] = relation.get("related") or []
    out["as_child_of"] = relation.get("as_child_of") or []
    out["cameras"] = cams
    return out


@app.get("/")
def index():
    index_path = WEB_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(500, "web/index.html missing")
    return FileResponse(index_path)


if WEB_DIR.exists():
    app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")
