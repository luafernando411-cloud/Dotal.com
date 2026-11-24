from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="CENSUS_",
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Censo Digital API"
    database_url: str = "postgresql+psycopg://census:census@localhost:5432/census"
    redis_url: str = "redis://localhost:6379/0"
    uploads_dir: Path = BACKEND_ROOT / "uploads"
    cors_origins: str = "http://localhost:5173"
    secret_key: str = ""
    environment: Literal["development", "production"] = "development"
    access_token_expire_minutes: int = Field(default=30, ge=1, le=1440)
    login_max_attempts: int = Field(default=5, ge=1, le=100)
    login_window_seconds: int = Field(default=900, ge=1, le=86400)
    admin_registration_key: str = ""
    request_rate_limit: int = Field(default=120, ge=10, le=10000)
    incident_threshold: int = Field(default=10, ge=3, le=1000)
    scale_hook: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
