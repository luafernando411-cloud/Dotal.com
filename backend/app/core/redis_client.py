import threading
import time
from typing import Any

from redis import Redis
from redis.exceptions import RedisError


class CacheService:
    """Redis cache with an in-process TTL/hash fallback."""

    def __init__(self, redis_url: str) -> None:
        self._client: Redis | None = None
        self._values: dict[str, tuple[Any, float | None]] = {}
        self._hashes: dict[str, dict[str, Any]] = {}
        self._lock = threading.RLock()
        try:
            client = Redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=0.5,
                socket_timeout=0.5,
            )
            client.ping()
            self._client = client
        except (RedisError, OSError, ValueError):
            self._client = None

    @property
    def redis_connected(self) -> bool:
        return self._client is not None

    def ping(self) -> bool:
        if self._client is None:
            return False
        try:
            return bool(self._client.ping())
        except (RedisError, OSError):
            self._disable_redis()
            return False

    def close(self) -> None:
        client = self._client
        self._disable_redis()
        if client is not None:
            client.close()

    def get(self, key: str) -> Any | None:
        if self._client is not None:
            try:
                return self._client.get(key)
            except (RedisError, OSError):
                self._disable_redis()
                return self._memory_get(key)
        return self._memory_get(key)

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> bool:
        if self._client is not None:
            try:
                return bool(self._client.set(key, value, ex=ttl_seconds))
            except (RedisError, OSError):
                self._disable_redis()
        expires_at = time.monotonic() + ttl_seconds if ttl_seconds is not None else None
        with self._lock:
            self._values[key] = (value, expires_at)
        return True

    def set_if_absent(self, key: str, value: Any, ttl_seconds: int) -> bool:
        if self._client is not None:
            try:
                return bool(self._client.set(key, value, ex=ttl_seconds, nx=True))
            except (RedisError, OSError):
                self._disable_redis()
        with self._lock:
            entry = self._values.get(key)
            if entry is not None and (entry[1] is None or entry[1] > time.monotonic()):
                return False
            self._values[key] = (value, time.monotonic() + ttl_seconds)
            return True

    def increment(self, key: str, ttl_seconds: int) -> int:
        if self._client is not None:
            try:
                count = int(self._client.incr(key))
                if count == 1:
                    self._client.expire(key, ttl_seconds)
                return count
            except (RedisError, OSError):
                self._disable_redis()

        with self._lock:
            entry = self._values.get(key)
            now = time.monotonic()
            if entry is None or (entry[1] is not None and entry[1] <= now):
                count = 1
                expires_at = now + ttl_seconds
            else:
                count = int(entry[0]) + 1
                expires_at = entry[1]
            self._values[key] = (count, expires_at)
            return count

    def delete(self, key: str) -> bool:
        if self._client is not None:
            try:
                return bool(self._client.delete(key))
            except (RedisError, OSError):
                self._disable_redis()
        with self._lock:
            removed = self._values.pop(key, None) is not None
        return removed

    def hset(self, name: str, key: str, value: Any) -> bool:
        if self._client is not None:
            try:
                self._client.hset(name, key, value)
                return True
            except (RedisError, OSError):
                self._disable_redis()
        with self._lock:
            self._hashes.setdefault(name, {})[key] = value
        return True

    def hgetall(self, name: str) -> dict[str, Any]:
        if self._client is not None:
            try:
                return self._client.hgetall(name)
            except (RedisError, OSError):
                self._disable_redis()
        with self._lock:
            return dict(self._hashes.get(name, {}))

    def _memory_get(self, key: str) -> Any | None:
        with self._lock:
            entry = self._values.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if expires_at is not None and expires_at <= time.monotonic():
                self._values.pop(key, None)
                return None
            return value

    def _disable_redis(self) -> None:
        with self._lock:
            self._client = None
