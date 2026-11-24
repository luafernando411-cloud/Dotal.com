from datetime import datetime
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

from app.core.validators import normalize_cpf

EmploymentCategory = Literal["Ativo", "Aposentado", "Pensionista"]
StepReviewStatus = Literal["Aprovada", "Reprovada / Ajuste Solicitado"]
CensusStatus = Literal["Pendente", "Em Revisão", "Concluído"]


class CensusCreateDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    full_name: str = Field(
        min_length=2,
        max_length=200,
        validation_alias=AliasChoices("fullName", "full_name"),
    )
    cpf: str = Field(min_length=11, max_length=14)
    employment_status: EmploymentCategory = Field(
        validation_alias=AliasChoices("employmentStatus", "employment_status", "category"),
    )
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=24)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, min_length=2, max_length=2)
    region: str | None = Field(default=None, max_length=32)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Informe o nome completo.")
        return normalized

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, value: str) -> str:
        return normalize_cpf(value)


class CensusUpdateDTO(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    full_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=200,
        validation_alias=AliasChoices("fullName", "full_name"),
    )
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=24)
    employment_status: EmploymentCategory | None = Field(
        default=None,
        validation_alias=AliasChoices("employmentStatus", "employment_status", "category"),
    )
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, min_length=2, max_length=2)
    region: str | None = Field(default=None, max_length=32)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Informe o nome completo.")
        return normalized


class StepSaveDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    data: dict[str, Any]


class StepReviewDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: StepReviewStatus
    feedback: str | None = Field(default=None, max_length=4000)


class CensusStatusUpdateDTO(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: CensusStatus


class CensusResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    protocol: str
    full_name: str = Field(serialization_alias="fullName")
    cpf: str
    email: str | None
    phone: str | None
    employment_status: EmploymentCategory = Field(
        validation_alias=AliasChoices("category", "employment_status"),
        serialization_alias="employmentStatus",
    )
    status: CensusStatus
    city: str | None
    state: str | None
    region: str | None
    payload: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class StepResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    census_id: str
    step_name: str
    data: dict[str, Any]
    status: str
    feedback: str | None
    reviewed_at: datetime | None
    updated_at: datetime


class DocumentResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    census_id: str
    document_type: str
    original_name: str
    content_type: str | None
    size_bytes: int
    created_at: datetime


class StepListResponseDTO(BaseModel):
    items: list[StepResponseDTO]


class DocumentListResponseDTO(BaseModel):
    items: list[DocumentResponseDTO]


class CensusListResponseDTO(BaseModel):
    items: list[CensusResponseDTO]
    total: int
    limit: int
    offset: int


class DashboardSummaryDTO(BaseModel):
    total: int
    categories: dict[str, int]
    statuses: dict[str, int]
    regions: dict[str, int]


class HealthResponseDTO(BaseModel):
    status: str
    redis_connected: bool
    timestamp: datetime
