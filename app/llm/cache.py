"""
In-process TTL + LRU cache for LLM answers.

Farmers ask the same handful of questions ("PM-KISAN eligibility", "crop
insurance") over and over. When the normalised question, profile and
retrieved evidence are identical, the model's answer would be too, so the
cached raw JSON is reused and no tokens are spent. Keyed on the full prompt,
so any change in evidence (e.g. after re-ingestion) is a natural miss.
"""
from __future__ import annotations

import hashlib
import threading
import time
from collections import OrderedDict

from app.core.config import get_settings

_lock = threading.Lock()
_entries: OrderedDict[str, tuple[float, str]] = OrderedDict()


def make_key(*parts: str) -> str:
    normalised = "\x1f".join(" ".join(p.lower().split()) for p in parts)
    return hashlib.sha256(normalised.encode("utf-8")).hexdigest()


def get(key: str) -> str | None:
    ttl = get_settings().llm_cache_ttl_seconds
    if ttl <= 0:
        return None
    with _lock:
        item = _entries.get(key)
        if item is None:
            return None
        stored_at, value = item
        if time.monotonic() - stored_at > ttl:
            del _entries[key]
            return None
        _entries.move_to_end(key)
        return value


def put(key: str, value: str) -> None:
    settings = get_settings()
    if settings.llm_cache_ttl_seconds <= 0 or settings.llm_cache_max_entries <= 0:
        return
    with _lock:
        _entries[key] = (time.monotonic(), value)
        _entries.move_to_end(key)
        while len(_entries) > settings.llm_cache_max_entries:
            _entries.popitem(last=False)


def clear() -> None:
    with _lock:
        _entries.clear()
