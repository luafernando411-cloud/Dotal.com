import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.validators import normalize_cpf


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    parts = email.split("@")
    valid = len(parts) == 2 and re.fullmatch(
        r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}",
        email,
    )
    if len(email) > 254 or not valid or ".." in parts[0] or parts[0].startswith(".") or parts[0].endswith("."):
        raise ValueError("Informe um e-mail válido.")
    return email


def validate_password_bytes(value: str) -> str:
    if len(value.encode("utf-8")) > 72:
        raise ValueError("A senha deve ter no máximo 72 bytes.")
    return value


class RegisterDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cpf: str = Field(min_length=11, max_length=14)
    full_name: str = Field(min_length=2, max_length=200, alias="fullName")
    email: str = Field(min_length=6, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, value: str) -> str:
        return normalize_cpf(value)

    @field_validator("full_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        name = " ".join(value.split())
        if len(name) < 2:
            raise ValueError("Informe seu nome completo.")
        return name

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        validate_password_bytes(value)
        if not any(character.isalpha() for character in value) or not any(character.isdigit() for character in value):
            raise ValueError("A senha deve conter letras e números.")
        return value


class LoginDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cpf: str = Field(min_length=11, max_length=14)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, value: str) -> str:
        return normalize_cpf(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_bytes(value)


class AdminRegisterDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=6, max_length=254)
    password: str = Field(min_length=12, max_length=128)
    registration_key: str = Field(min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("password")
    @classmethod
    def validate_strong_password(cls, value: str) -> str:
        validate_password_bytes(value)
        if not (
            re.search(r"[a-z]", value)
            and re.search(r"[A-Z]", value)
            and re.search(r"\d", value)
            and re.search(r"[^A-Za-z0-9]", value)
        ):
            raise ValueError("Use 12+ caracteres com maiúscula, minúscula, número e símbolo.")
        return value


class AdminLoginDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=6, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_bytes(value)


class UserResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    cpf: str | None
    full_name: str | None = Field(serialization_alias="fullName")
    email: str
    role: str = "user"
    status: str
    created_at: datetime


class AdminResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    role: str = "admin"
    created_at: datetime


class TokenResponseDTO(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponseDTO | AdminResponseDTO


class AdminUserDTO(BaseModel):
    id: str
    full_name: str | None
    cpf: str
    email: str
    status: str
    created_at: datetime


class AdminUserListDTO(BaseModel):
    items: list[AdminUserDTO]
    total: int
    limit: int
    offset: int


class UserStatusUpdateDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str


class AccessLogDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_type: str
    success: bool
    event: str
    occurred_at: datetime


class AdminMetricsDTO(BaseModel):
    total_users: int
    active_users: int
    blocked_users: int
    failed_logins_24h: int
    successful_logins_24h: int
