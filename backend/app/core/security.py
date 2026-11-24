from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.admin_model import Admin
from app.models.user_model import User
from app.repositories.admin_repository import AdminRepository
from app.repositories.user_repository import UserRepository


bearer_scheme = HTTPBearer(auto_error=False)
DbSession = Annotated[Session, Depends(get_db)]
BearerCredentials = Annotated[
    HTTPAuthorizationCredentials | None,
    Depends(bearer_scheme),
]
user_repository = UserRepository()
admin_repository = AdminRepository()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: str, account_type: str = "user") -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": user_id, "type": account_type, "exp": expires_at},
        _secret_key(),
        algorithm="HS256",
    )


def validate_secret_key() -> None:
    _secret_key()


def get_current_user(
    credentials: BearerCredentials,
    db: DbSession,
) -> User | Admin:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()
    try:
        claims: dict[str, Any] = jwt.decode(
            credentials.credentials,
            _secret_key(),
            algorithms=["HS256"],
        )
    except InvalidTokenError as error:
        raise _unauthorized() from error

    user_id = claims.get("sub")
    account_type = claims.get("type")
    if isinstance(user_id, str) and account_type == "admin":
        user = admin_repository.get_by_id(db, user_id)
    elif isinstance(user_id, str) and account_type == "user":
        user = user_repository.get_by_id(db, user_id)
    else:
        user = None
    if user is None:
        raise _unauthorized()
    if isinstance(user, User) and user.status != "active":
        raise _unauthorized()
    return user


def require_admin(user: Annotated[User | Admin, Depends(get_current_user)]) -> Admin:
    if not isinstance(user, Admin):
        raise HTTPException(status_code=403, detail="Acesso negado.")
    return user


def require_user(user: Annotated[User | Admin, Depends(get_current_user)]) -> User:
    if not isinstance(user, User):
        raise HTTPException(status_code=403, detail="Acesso restrito a usuários.")
    return user


def _secret_key() -> str:
    if len(settings.secret_key.encode("utf-8")) < 32:
        raise RuntimeError("Configure CENSUS_SECRET_KEY com pelo menos 32 bytes.")
    return settings.secret_key


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="Credenciais inválidas ou expiradas.",
        headers={"WWW-Authenticate": "Bearer"},
    )
