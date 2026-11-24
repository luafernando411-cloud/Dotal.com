import asyncio
import hashlib
import hmac
import logging
import os
import subprocess
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.database import prepare_database
from app.core.redis_client import CacheService
from app.core.security import validate_secret_key
from app.dtos.census_dto import HealthResponseDTO
from app.routers.admin_router import router as admin_router
from app.routers.auth_router import router as auth_router
from app.routers.census_router import router as census_router


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    validate_secret_key()
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    prepare_database()
    cache = CacheService(settings.redis_url)
    application.state.cache = cache
    try:
        yield
    finally:
        cache.close()


app = FastAPI(
    title=settings.app_name,
    description="API REST para cadastro, etapas, documentos e administração do Censo Digital.",
    version="1.0.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url="/redoc" if settings.environment == "development" else None,
    openapi_url="/openapi.json" if settings.environment == "development" else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, error: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        headers=error.headers,
        content={
            "error": {
                "code": error.status_code,
                "message": jsonable_encoder(error.detail),
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(
    _: Request,
    error: RequestValidationError,
) -> JSONResponse:
    details = [
        {"loc": item["loc"], "msg": item["msg"], "type": item["type"]}
        for item in error.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": 422,
                "message": "A solicitação contém dados inválidos.",
                "details": details,
            }
        },
    )


@app.get("/api/health", response_model=HealthResponseDTO, tags=["Observabilidade"])
def health_check(request: Request) -> HealthResponseDTO:
    cache: CacheService = request.app.state.cache
    cache.ping()
    return HealthResponseDTO(
        status="operational",
        redis_connected=cache.redis_connected,
        timestamp=datetime.now(timezone.utc),
    )


app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(census_router)


@app.middleware("http")
async def detect_suspicious_traffic(request: Request, call_next):
    if not request.url.path.startswith("/api/"):
        return await call_next(request)

    cache: CacheService = request.app.state.cache
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = _audit_hash(client_ip)
    request_key = f"traffic:minute:{ip_hash}:{int(time.time() // 60)}"
    request_count = cache.increment(request_key, ttl_seconds=120)
    if request_count > settings.request_rate_limit:
        await asyncio.to_thread(_trigger_scale_hook, cache, ip_hash, "request_burst")
        logger.warning(
            "api_request_burst",
            extra={"ip_hash": ip_hash, "requests_per_minute": request_count},
        )
        return JSONResponse(
            status_code=429,
            content={"error": {"code": 429, "message": "Limite de requisições excedido."}},
        )

    response = await call_next(request)
    if response.status_code in {401, 403, 422}:
        signal_key = f"traffic:suspicious:{ip_hash}"
        signals = cache.increment(signal_key, ttl_seconds=60)
        if signals >= settings.incident_threshold:
            await asyncio.to_thread(_trigger_scale_hook, cache, ip_hash, "repeated_rejected_requests")
            logger.warning(
                "api_suspicious_activity",
                extra={"ip_hash": ip_hash, "rejected_requests_per_minute": signals},
            )
    return response


def _trigger_scale_hook(cache: CacheService, ip_hash: str, reason: str) -> None:
    if not cache.set_if_absent("incident:scale:global", reason, ttl_seconds=60):
        return
    hook = settings.scale_hook
    if not hook:
        logger.error("scale_hook_unconfigured", extra={"reason": reason, "ip_hash": ip_hash})
        return
    executable = Path(hook)
    if not executable.is_absolute() or not executable.is_file() or not os.access(executable, os.X_OK):
        logger.error("scale_hook_invalid", extra={"reason": reason, "ip_hash": ip_hash})
        return
    try:
        result = subprocess.run(
            [str(executable), reason],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode:
            logger.error(
                "scale_hook_failed",
                extra={"reason": reason, "ip_hash": ip_hash, "exit_code": result.returncode},
            )
        else:
            logger.warning("scale_hook_executed", extra={"reason": reason, "ip_hash": ip_hash})
    except (OSError, subprocess.SubprocessError) as error:
        logger.error(
            "scale_hook_failed",
            extra={"reason": reason, "ip_hash": ip_hash, "error": str(error)},
        )


def _audit_hash(value: str) -> str:
    return hmac.new(settings.secret_key.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()
