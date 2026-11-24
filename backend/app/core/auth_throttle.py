import hashlib
import hmac

from fastapi import HTTPException, Request

from app.core.config import settings
from app.core.redis_client import CacheService


def check_login_attempts(request: Request, identifier: str, account_type: str) -> None:
    cache: CacheService = request.app.state.cache
    for value in _scopes(request, identifier):
        key = _key(account_type, value)
        if cache.get(f"{key}:blocked"):
            raise HTTPException(status_code=429, detail="Muitas tentativas. Tente novamente mais tarde.")


def record_failed_login(request: Request, identifier: str, account_type: str) -> None:
    cache: CacheService = request.app.state.cache
    for value in _scopes(request, identifier):
        key = _key(account_type, value)
        attempts = cache.increment(key, settings.login_window_seconds)
        if attempts >= settings.login_max_attempts:
            strike_key = f"{key}:strikes"
            strikes = cache.increment(strike_key, 86400)
            ttl = min(settings.login_window_seconds * (2 ** min(strikes - 1, 6)), 86400)
            cache.set(f"{key}:blocked", "1", ttl_seconds=ttl)


def clear_login_attempts(request: Request, identifier: str, account_type: str) -> None:
    cache: CacheService = request.app.state.cache
    for value in _scopes(request, identifier):
        key = _key(account_type, value)
        cache.delete(key)
        cache.delete(f"{key}:blocked")


def _scopes(request: Request, identifier: str) -> tuple[str, str]:
    client_ip = request.client.host if request.client else "unknown"
    return client_ip, identifier.strip().lower()


def _key(account_type: str, value: str) -> str:
    digest = hmac.new(
        settings.secret_key.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"auth:{account_type}:{digest}"
