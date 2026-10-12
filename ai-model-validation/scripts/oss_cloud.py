"""Sign COS object keys to temporary HTTPS URLs via oss-cloud (same as ai-camera-center)."""

from __future__ import annotations

import hashlib
import os
import time
from typing import Iterable

import requests

OSS_CLOUD_URL = os.getenv(
    "OSS_CLOUD_URL", "https://aidata-oss-cloud-prod.zhidaozhixing.com/oss-cloud"
).rstrip("/")
OSS_CLOUD_APPKEY = os.getenv("OSS_CLOUD_APPKEY", "ai-camera-center")
OSS_CLOUD_APP_SECRET = os.getenv("OSS_CLOUD_APP_SECRET", "")
IMAGE_URL_EXPIRE_SECONDS = int(os.getenv("IMAGE_URL_EXPIRE_SECONDS", "43200"))


def _auth_headers() -> dict[str, str]:
    if not OSS_CLOUD_APP_SECRET:
        raise RuntimeError("OSS_CLOUD_APP_SECRET is not set")
    ts = str(int(time.time() * 1000))
    sign = hashlib.md5(f"{OSS_CLOUD_APPKEY}{ts}{OSS_CLOUD_APP_SECRET}".encode()).hexdigest()
    return {"appkey": OSS_CLOUD_APPKEY, "timestamp": ts, "appsign": sign}


def _public_url(uri: str) -> str:
    if not uri:
        return ""
    if uri.startswith("http://") or uri.startswith("https://"):
        return uri
    return f"{OSS_CLOUD_URL}{uri}"


def sign_picture_url(object_name: str, expiry_seconds: int | None = None) -> str:
    if not object_name:
        return ""
    if object_name.startswith("http://") or object_name.startswith("https://"):
        return object_name
    expiry = expiry_seconds or IMAGE_URL_EXPIRE_SECONDS
    resp = requests.get(
        f"{OSS_CLOUD_URL}/open/files/picture",
        params={
            "objectName": object_name,
            "style": 0,
            "watermark": 1,
            "removeWatermark": 0,
            "expirySeconds": expiry,
        },
        headers=_auth_headers(),
        timeout=30,
    )
    resp.raise_for_status()
    body = resp.json()
    if not body.get("success"):
        return ""
    data = body.get("data") or {}
    return _public_url(data.get("uri") or "")


def sign_picture_batch(
    object_names: Iterable[str], expiry_seconds: int | None = None
) -> dict[str, str]:
    keys = []
    passthrough: dict[str, str] = {}
    for name in object_names:
        if not name:
            continue
        if name.startswith("http://") or name.startswith("https://"):
            passthrough[name] = name
        else:
            keys.append(name)
    keys = list(dict.fromkeys(keys))
    if not keys:
        return passthrough

    expiry = expiry_seconds or IMAGE_URL_EXPIRE_SECONDS
    mapping: dict[str, str] = dict(passthrough)
    # batch ~80
    for i in range(0, len(keys), 80):
        chunk = keys[i : i + 80]
        resp = requests.post(
            f"{OSS_CLOUD_URL}/open/files/pictures",
            json={
                "objectNameList": chunk,
                "style": 0,
                "watermark": 1,
                "removeWatermark": 0,
                "expirySeconds": expiry,
            },
            headers={**_auth_headers(), "Content-Type": "application/json"},
            timeout=60,
        )
        resp.raise_for_status()
        body = resp.json()
        if not body.get("success"):
            continue
        for item in body.get("data") or []:
            oname = item.get("objectName")
            uri = item.get("uri") or ""
            if oname and uri:
                mapping[oname] = _public_url(uri)
    return mapping
