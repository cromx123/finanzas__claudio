from __future__ import annotations

import json
import logging
from typing import Any

import redis

from app.core.config import settings

logger = logging.getLogger(__name__)

_client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=1, socket_timeout=1)


def cache_get_json(key: str) -> Any | None:
    """Returns the cached value for `key`, or None on a cache miss *or* if
    Redis itself is unreachable — caching is a pure optimization for the
    live Yahoo-hitting endpoints, never a hard dependency, so any Redis
    error just means "fetch live instead" rather than a request failure.
    """
    try:
        raw = _client.get(key)
    except redis.RedisError:
        logger.warning("cache_get_json: redis unavailable for key %s", key, exc_info=True)
        return None
    return json.loads(raw) if raw is not None else None


def cache_set_json(key: str, value: Any, ttl_seconds: int) -> None:
    try:
        _client.setex(key, ttl_seconds, json.dumps(value))
    except redis.RedisError:
        logger.warning("cache_set_json: redis unavailable for key %s", key, exc_info=True)
