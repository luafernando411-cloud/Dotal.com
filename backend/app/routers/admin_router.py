import hashlib
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.auth_throttle import (
    check_login_attempts,
    clear_login_attempts,
    record_failed_login,
)
from app.core.database import get_db
from app.core.redis_client import CacheService
from app.core.security import require_admin
from app.dtos.auth_dto import (
    AdminLoginDTO,
    AdminMetricsDTO,
    AdminRegisterDTO,
    AdminResponseDTO,
    AdminUserDTO,
    AdminUserListDTO,
    AccessLogDTO,
    TokenResponseDTO,
    UserStatusUpdateDTO,
)
from app.models.admin_model import Admin
from app.services import auth_service


router = APIRouter(prefix="/api/admin", tags=["Administração"])
DbSession = Annotated[Session, Depends(get_db)]
CurrentAdmin = Annotated[Admin, Depends(require_admin)]
USER_CACHE_TTL = 60


@router.post("/auth/register", response_model=AdminResponseDTO, status_code=status.HTTP_201_CREATED)
def register_admin(payload: AdminRegisterDTO, db: DbSession) -> AdminResponseDTO:
    return auth_service.register_admin(db, payload)


@router.post("/auth/login", response_model=TokenResponseDTO)
def login_admin(payload: AdminLoginDTO, request: Request, db: DbSession) -> TokenResponseDTO:
    check_login_attempts(request, payload.email, "admin")
    admin = auth_service.authenticate_admin(db, payload)
    client_ip = request.client.host if request.client else "unknown"
    auth_service.record_access(
        db,
        account_type="admin",
        identifier=payload.email,
        client_ip=client_ip,
        success=admin is not None,
    )
    if admin is None:
        record_failed_login(request, payload.email, "admin")
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos.")
    clear_login_attempts(request, payload.email, "admin")
    return auth_service.create_token_response(admin)


@router.get("/users", response_model=AdminUserListDTO)
def list_users(
    db: DbSession,
    request: Request,
    _: CurrentAdmin,
    search: str | None = Query(default=None, max_length=120),
    account_status: str | None = Query(default=None, alias="status", pattern="^(active|blocked)$"),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AdminUserListDTO:
    cache: CacheService = request.app.state.cache
    version = cache.get("admin:users:version") or "0"
    query = hashlib.sha256(f"{search}:{account_status}:{limit}:{offset}".encode()).hexdigest()
    key = f"admin:users:v{version}:{query}"
    cached = cache.get(key)
    if cached:
        return AdminUserListDTO.model_validate_json(cached)
    result = auth_service.list_admin_users(
        db, search=search, status=account_status, limit=limit, offset=offset
    )
    cache.set(key, result.model_dump_json(), ttl_seconds=USER_CACHE_TTL)
    return result


@router.patch("/users/{user_id}/status", response_model=AdminUserDTO)
def change_user_status(
    user_id: str,
    payload: UserStatusUpdateDTO,
    db: DbSession,
    request: Request,
    _: CurrentAdmin,
) -> AdminUserDTO:
    if payload.status not in {"active", "blocked"}:
        raise HTTPException(status_code=400, detail="Informe um status válido: active ou blocked.")
    updated = auth_service.update_user_status(db, user_id, payload.status)
    client_ip = request.client.host if request.client else "unknown"
    auth_service.record_access(
        db,
        account_type="user",
        identifier=user_id,
        client_ip=client_ip,
        success=True,
        event="account_blocked" if payload.status == "blocked" else "account_activated",
    )
    request.app.state.cache.increment("admin:users:version", ttl_seconds=3600)
    return updated


@router.get("/metrics", response_model=AdminMetricsDTO)
def get_metrics(db: DbSession, request: Request, _: CurrentAdmin) -> AdminMetricsDTO:
    cache: CacheService = request.app.state.cache
    version = cache.get("admin:users:version") or "0"
    key = f"admin:metrics:v{version}"
    cached = cache.get(key)
    if cached:
        return AdminMetricsDTO.model_validate_json(cached)
    result = auth_service.get_admin_metrics(db)
    cache.set(key, result.model_dump_json(), ttl_seconds=USER_CACHE_TTL)
    return result


@router.get("/access-logs", response_model=list[AccessLogDTO])
def get_access_logs(
    db: DbSession,
    _: CurrentAdmin,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[AccessLogDTO]:
    return auth_service.list_access_logs(db, limit=limit)


