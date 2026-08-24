"""API-key authentication dependency (PRD F-5.4). Reads valid keys from the
SKYMETRICS_API_KEYS environment variable (comma-separated) on every
request -- not a config/*.json file, because every existing config/*.json
in this project is committed, non-secret data, and this holds secrets.
Fails loudly if the environment variable is unset: no default or
hardcoded fallback key.
"""
from __future__ import annotations

import os

from fastapi import Header, HTTPException


def load_valid_keys() -> set[str]:
    raw = os.environ.get("SKYMETRICS_API_KEYS", "")
    keys = {key.strip() for key in raw.split(",") if key.strip()}
    if not keys:
        raise RuntimeError(
            "SKYMETRICS_API_KEYS environment variable is not set. "
            "Set it to a comma-separated list of valid API keys before starting the API."
        )
    return keys


def require_api_key(x_api_key: str | None = Header(None)) -> str:
    if x_api_key not in load_valid_keys():
        raise HTTPException(status_code=401, detail="invalid or missing API key")
    return x_api_key
