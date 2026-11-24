from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.auth_throttle import (
    check_login_attempts,
    clear_login_attempts,
    record_failed_login,
)
from app.core.database import get_db
from app.core.redis_client import CacheService
from app.core.security import get_current_user
from app.dtos.auth_dto import AdminResponseDTO, LoginDTO, RegisterDTO, TokenResponseDTO, UserResponseDTO
from app.models.admin_model import Admin
from app.models.user_model import User
from app.services import auth_service


router = APIRouter(prefix="/api/auth", tags=["Autenticação de usuário"])
DbSession = Annotated[Session, Depends(get_db)]
CurrentAccount = Annotated[User | Admin, Depends(get_current_user)]


@router.post("/register", response_model=UserResponseDTO, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterDTO, db: DbSession, request: Request) -> UserResponseDTO:
    user = auth_service.register_user(db, payload)
    cache: CacheService = request.app.state.cache
    cache.increment("admin:users:version", ttl_seconds=3600)
    return user


@router.get("/me", response_model=UserResponseDTO | AdminResponseDTO)
def get_me(current_account: CurrentAccount) -> UserResponseDTO | AdminResponseDTO:
    if isinstance(current_account, Admin):
        return AdminResponseDTO.model_validate(current_account)
    return UserResponseDTO.model_validate(current_account)


@router.post("/login", response_model=TokenResponseDTO)
def login(payload: LoginDTO, request: Request, db: DbSession) -> TokenResponseDTO:
    check_login_attempts(request, payload.cpf, "user")
    user = auth_service.authenticate_user(db, payload)
    client_ip = request.client.host if request.client else "unknown"
    auth_service.record_access(
        db, account_type="user", identifier=payload.cpf, client_ip=client_ip, success=user is not None
    )
    if user is None:
        record_failed_login(request, payload.cpf, "user")
        raise HTTPException(status_code=401, detail="CPF ou senha inválidos.")

    clear_login_attempts(request, payload.cpf, "user")
    return auth_service.create_token_response(user)
