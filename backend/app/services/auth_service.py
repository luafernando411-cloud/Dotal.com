import hashlib
import hmac
import logging
import re
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.dtos.auth_dto import (
    AccessLogDTO,
    AdminLoginDTO,
    AdminMetricsDTO,
    AdminRegisterDTO,
    AdminResponseDTO,
    AdminUserDTO,
    AdminUserListDTO,
    LoginDTO,
    RegisterDTO,
    TokenResponseDTO,
    UserResponseDTO,
)
from app.models.access_log_model import AccessLog
from app.models.admin_model import Admin
from app.models.user_model import User
from app.repositories.access_log_repository import AccessLogRepository
from app.repositories.admin_repository import AdminRepository
from app.repositories.user_repository import UserRepository


user_repository = UserRepository()
admin_repository = AdminRepository()
access_log_repository = AccessLogRepository()
logger = logging.getLogger(__name__)


def register_user(db: Session, payload: RegisterDTO) -> UserResponseDTO:
    if user_repository.get_by_cpf(db, payload.cpf):
        raise HTTPException(status_code=409, detail="Já existe uma conta para este CPF.")
    user = User(
        cpf=payload.cpf,
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        status="active",
    )
    try:
        user_repository.add(db, user)
        user_repository.commit(db)
        db.refresh(user)
        return UserResponseDTO.model_validate(user)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="CPF ou e-mail já cadastrado.") from error


def authenticate_user(db: Session, payload: LoginDTO) -> User | None:
    user = user_repository.get_by_cpf(db, payload.cpf)
    if user is None or user.status != "active" or not verify_password(payload.password, user.password_hash):
        return None
    return user


def register_admin(db: Session, payload: AdminRegisterDTO) -> AdminResponseDTO:
    configured_key = settings.admin_registration_key
    if not configured_key or not hmac.compare_digest(payload.registration_key, configured_key):
        raise HTTPException(status_code=403, detail="Cadastro administrativo não autorizado.")
    if admin_repository.get_by_email(db, payload.email):
        raise HTTPException(status_code=409, detail="Não foi possível criar a conta administrativa.")
    admin = Admin(email=payload.email, password_hash=hash_password(payload.password), role="admin")
    try:
        admin_repository.add(db, admin)
        admin_repository.commit(db)
        db.refresh(admin)
        return AdminResponseDTO.model_validate(admin)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Não foi possível criar a conta administrativa.") from error


def authenticate_admin(db: Session, payload: AdminLoginDTO) -> Admin | None:
    admin = admin_repository.get_by_email(db, payload.email)
    if admin is None or not verify_password(payload.password, admin.password_hash):
        return None
    return admin


def create_token_response(user: User | Admin) -> TokenResponseDTO:
    account_type = "admin" if isinstance(user, Admin) else "user"
    response_model = AdminResponseDTO if account_type == "admin" else UserResponseDTO
    return TokenResponseDTO(
        access_token=create_access_token(user.id, account_type),
        expires_in=60 * settings.access_token_expire_minutes,
        user=response_model.model_validate(user),
    )


def record_access(
    db: Session,
    *,
    account_type: str,
    identifier: str,
    client_ip: str,
    success: bool,
    event: str = "login",
) -> None:
    entry = AccessLog(
        account_type=account_type,
        identifier_hash=_audit_hash(identifier.strip().lower()),
        ip_hash=_audit_hash(client_ip),
        success=success,
        event=event,
    )
    access_log_repository.add(db, entry)
    if not success:
        logger.warning(
            "auth_event",
            extra={"event": event, "account_type": account_type, "ip_hash": entry.ip_hash},
        )


def list_admin_users(
    db: Session,
    *,
    search: str | None,
    status: str | None,
    limit: int,
    offset: int,
) -> AdminUserListDTO:
    users, total = user_repository.list_users(
        db, search=search, status=status, limit=limit, offset=offset
    )
    items = [
        AdminUserDTO(
            id=user.id,
            full_name=user.full_name,
            cpf=_mask_cpf(user.cpf or ""),
            email=user.email,
            status=user.status,
            created_at=user.created_at,
        )
        for user in users
        if user.cpf
    ]
    return AdminUserListDTO(items=items, total=total, limit=limit, offset=offset)


def update_user_status(db: Session, user_id: str, account_status: str) -> AdminUserDTO:
    if account_status not in {"active", "blocked"}:
        raise HTTPException(status_code=400, detail="Status de conta inválido.")
    user = user_repository.get_by_id(db, user_id)
    if user is None or user.cpf is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    user.status = account_status
    user_repository.commit(db)
    db.refresh(user)
    return AdminUserDTO(
        id=user.id,
        full_name=user.full_name,
        cpf=_mask_cpf(user.cpf),
        email=user.email,
        status=user.status,
        created_at=user.created_at,
    )


def get_admin_metrics(db: Session) -> AdminMetricsDTO:
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    total = user_repository.count_registered_users(db)
    active = user_repository.count_registered_users(db, status="active")
    blocked = user_repository.count_registered_users(db, status="blocked")
    failed = access_log_repository.count_since(db, success=False, since=since)
    succeeded = access_log_repository.count_since(db, success=True, since=since)
    return AdminMetricsDTO(
        total_users=total,
        active_users=active,
        blocked_users=blocked,
        failed_logins_24h=failed,
        successful_logins_24h=succeeded,
    )


def list_access_logs(db: Session, *, limit: int) -> list[AccessLogDTO]:
    records = access_log_repository.list_latest(db, limit=limit)
    return [AccessLogDTO.model_validate(record) for record in records]


def _mask_cpf(cpf: str) -> str:
    digits = re.sub(r"\D", "", cpf)
    return f"***.***.{digits[6:9]}-{digits[9:11]}" if len(digits) == 11 else "***.***.***-**"


def _audit_hash(value: str) -> str:
    return hmac.new(settings.secret_key.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()
