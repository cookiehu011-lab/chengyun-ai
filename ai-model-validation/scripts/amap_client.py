"""Amap (高德) Web服务：逆地理 + 周边 POI。"""

from __future__ import annotations

import os
from typing import Any, Optional

import requests

AMAP_BASE_URL = os.getenv("AMAP_BASE_URL", "https://restapi.amap.com/v3").rstrip("/")
AMAP_WEB_KEY = os.getenv("AMAP_WEB_KEY", "") or os.getenv("AMAP_KEY", "")


def has_amap_key() -> bool:
    return bool(AMAP_WEB_KEY)


def _get(path: str, params: dict[str, Any]) -> dict[str, Any]:
    if not AMAP_WEB_KEY:
        raise RuntimeError("AMAP_WEB_KEY missing")
    q = {"key": AMAP_WEB_KEY, "output": "json", **params}
    resp = requests.get(f"{AMAP_BASE_URL}{path}", params=q, timeout=20)
    resp.raise_for_status()
    body = resp.json()
    if str(body.get("status")) != "1":
        raise RuntimeError(f"amap error: {body.get('info')} ({body.get('infocode')})")
    return body


def regeo(lon: float, lat: float, radius: int = 100, extensions: str = "all") -> dict[str, Any]:
    """逆地理编码。返回精简结构 + 原始 regeocode。"""
    body = _get(
        "/geocode/regeo",
        {
            "location": f"{lon},{lat}",
            "radius": radius,
            "extensions": extensions,
            "homeorcorp": 1,
        },
    )
    rg = body.get("regeocode") or {}
    addr_comp = rg.get("addressComponent") or {}
    aois = rg.get("aois") or []
    pois = rg.get("pois") or []
    nearest = None
    if aois:
        nearest = {
            "name": aois[0].get("name"),
            "type": aois[0].get("type"),
            "id": aois[0].get("id"),
            "source": "aoi",
            "distance": aois[0].get("distance"),
        }
    elif pois:
        nearest = {
            "name": pois[0].get("name"),
            "type": pois[0].get("type"),
            "id": pois[0].get("id"),
            "source": "poi",
            "distance": pois[0].get("distance"),
        }
    return {
        "formatted_address": rg.get("formatted_address"),
        "province": addr_comp.get("province"),
        "city": addr_comp.get("city") or addr_comp.get("province"),
        "district": addr_comp.get("district"),
        "township": addr_comp.get("township"),
        "neighborhood": (addr_comp.get("neighborhood") or {}).get("name")
        if isinstance(addr_comp.get("neighborhood"), dict)
        else addr_comp.get("neighborhood"),
        "building": (addr_comp.get("building") or {}).get("name")
        if isinstance(addr_comp.get("building"), dict)
        else addr_comp.get("building"),
        "nearest": nearest,
        "pois": [
            {
                "id": p.get("id"),
                "name": p.get("name"),
                "type": p.get("type"),
                "distance": p.get("distance"),
                "address": p.get("address"),
            }
            for p in (pois[:8] if isinstance(pois, list) else [])
        ],
        "aois": [
            {
                "id": a.get("id"),
                "name": a.get("name"),
                "type": a.get("type"),
                "distance": a.get("distance"),
            }
            for a in (aois[:5] if isinstance(aois, list) else [])
        ],
        "raw": rg,
    }


def around(
    lon: float,
    lat: float,
    keywords: str = "",
    types: str = "",
    radius: int = 200,
    offset: int = 10,
) -> list[dict[str, Any]]:
    """周边搜索。"""
    params: dict[str, Any] = {
        "location": f"{lon},{lat}",
        "radius": radius,
        "offset": offset,
        "sortrule": "distance",
        "extensions": "base",
    }
    if keywords:
        params["keywords"] = keywords
    if types:
        params["types"] = types
    body = _get("/place/around", params)
    pois = body.get("pois") or []
    return [
        {
            "id": p.get("id"),
            "name": p.get("name"),
            "type": p.get("type"),
            "address": p.get("address"),
            "distance": p.get("distance"),
            "location": p.get("location"),
        }
        for p in pois
    ]


def text_search(
    keywords: str,
    city: str = "南京",
    citylimit: bool = True,
    offset: int = 10,
) -> list[dict[str, Any]]:
    """关键词搜 POI（不依赖可能不准的坐标）。"""
    if not keywords:
        return []
    body = _get(
        "/place/text",
        {
            "keywords": keywords,
            "city": city,
            "citylimit": "true" if citylimit else "false",
            "offset": offset,
            "extensions": "base",
        },
    )
    pois = body.get("pois") or []
    return [
        {
            "id": p.get("id"),
            "name": p.get("name"),
            "type": p.get("type"),
            "address": p.get("address"),
            "location": p.get("location"),
            "pname": p.get("pname"),
            "cityname": p.get("cityname"),
            "adname": p.get("adname"),
        }
        for p in pois
    ]


def _name_hit(query: str, poi_name: str) -> bool:
    if not query or not poi_name:
        return False
    q = query.replace(" ", "")
    n = poi_name.replace(" ", "")
    if q in n or n in q:
        return True
    # 共享前缀
    for k in range(min(6, len(q)), 3, -1):
        if q[:k] in n:
            return True
    return False


def enrich_for_camera(
    lon: Optional[float],
    lat: Optional[float],
    camera_name: str = "",
    city: str = "南京",
) -> dict[str, Any]:
    """
    高德证据策略（坐标可能不准）：
    1) 用相机名做关键词检索（主）
    2) 逆地理 / 周边仅作旁证
    3) 名称命中的 POI 优先；与名称无关的逆地理结果标为 weak
    """
    out: dict[str, Any] = {"ok": False, "source": "amap_live"}
    # 清洗名称尾巴，提高命中
    import re

    kw = re.sub(
        r"(向[东南西北]+|门口|通道|过道|电梯|扶梯|地库|[\d\.]+$|[-_#].*$)",
        "",
        camera_name or "",
    ).strip() or (camera_name or "").strip()

    text_hits = []
    try:
        if kw:
            text_hits = text_search(kw, city=city, offset=8)
    except Exception as e:
        out["text_error"] = str(e)

    regeo_info = None
    around_hits = []
    try:
        if lon is not None and lat is not None:
            regeo_info = regeo(float(lon), float(lat))
            around_hits = around(float(lon), float(lat), keywords=kw or "", radius=300, offset=8)
    except Exception as e:
        out["regeo_error"] = str(e)

    chosen = None
    chosen_via = None
    for p in text_hits:
        if _name_hit(kw, p.get("name") or ""):
            chosen = p
            chosen_via = "text_search"
            break
    if not chosen and text_hits:
        # 取文本检索第一条，但仍标为候选
        chosen = text_hits[0]
        chosen_via = "text_search_top"

    # 周边命中名称时也可采用
    if (not chosen or chosen_via == "text_search_top") and around_hits:
        for p in around_hits:
            if _name_hit(kw, p.get("name") or ""):
                chosen = p
                chosen_via = "around_name_hit"
                break

    nearest_regeo = (regeo_info or {}).get("nearest") if regeo_info else None
    amap_agrees = False
    if chosen and kw:
        amap_agrees = _name_hit(kw, chosen.get("name") or "")

    out.update(
        {
            "ok": True,
            "query_name": kw,
            "chosen_via": chosen_via,
            "amap_agrees_with_name": amap_agrees,
            "formatted_address": (regeo_info or {}).get("formatted_address"),
            "nearest": {
                "name": (chosen or {}).get("name") or (nearest_regeo or {}).get("name"),
                "type": (chosen or {}).get("type") or (nearest_regeo or {}).get("type"),
                "id": (chosen or {}).get("id") or (nearest_regeo or {}).get("id"),
                "source": chosen_via or (nearest_regeo or {}).get("source"),
                "address": (chosen or {}).get("address"),
            }
            if (chosen or nearest_regeo)
            else None,
            "text_pois": text_hits[:5],
            "around_pois": around_hits[:5],
            "regeo_nearest": nearest_regeo,
            "regeo_weak": bool(nearest_regeo)
            and not (nearest_regeo and _name_hit(kw, nearest_regeo.get("name") or "")),
        }
    )
    # 若名称检索命中，覆盖 formatted 用候选地址
    if chosen and chosen.get("address"):
        out["formatted_address"] = (
            f"{chosen.get('cityname') or ''}{chosen.get('adname') or ''}{chosen.get('address')}"
        )
    return out


def enrich_lonlat(lon: Optional[float], lat: Optional[float]) -> dict[str, Any]:
    if lon is None or lat is None:
        return {"ok": False, "error": "missing lon/lat"}
    try:
        info = regeo(float(lon), float(lat))
        nearby = around(float(lon), float(lat), radius=150, offset=8)
        info["around"] = nearby
        if not info.get("nearest") and nearby:
            info["nearest"] = {
                "name": nearby[0].get("name"),
                "type": nearby[0].get("type"),
                "id": nearby[0].get("id"),
                "source": "around",
                "distance": nearby[0].get("distance"),
            }
        info["ok"] = True
        return info
    except Exception as e:
        return {"ok": False, "error": str(e)}
