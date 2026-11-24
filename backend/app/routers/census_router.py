import hashlib
import json
import logging
from json import JSONDecodeError
from typing import Annotated, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, UploadFile, status
from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.redis_client import CacheService
from app.dtos.census_dto import (
    CensusCreateDTO,
    CensusListResponseDTO,
    CensusResponseDTO,
    CensusStatus,
    CensusStatusUpdateDTO,
    CensusUpdateDTO,
    DashboardSummaryDTO,
    DocumentListResponseDTO,
    DocumentResponseDTO,
    EmploymentCategory,
    StepListResponseDTO,
    StepReviewDTO,
    StepResponseDTO,
    StepSaveDTO,
)
from app.core.security import get_current_user, require_admin, require_user
from app.models.census_model import CensusRecord
from app.models.admin_model import Admin
from app.models.user_model import User
from app.services import census_service


router = APIRouter(prefix="/api")
DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(require_user)]
CurrentAccount = Annotated[User | Admin, Depends(get_current_user)]
CACHE_TTL_SECONDS = 300
CACHE_VERSION_KEY = "census:api:cache-version"
ModelT = TypeVar("ModelT", bound=BaseModel)
logger = logging.getLogger(__name__)


def _cache_key(cache: CacheService, suffix: str) -> str:
    version = cache.get(CACHE_VERSION_KEY) or "0"
    return f"census:api:v{version}:{suffix}"


def _filter_cache_suffix(scope: str, **filters: object) -> str:
    serialized = json.dumps(filters, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    return f"{scope}:{digest}"


def _cached_response(
    cache: CacheService,
    key: str,
    response_model: type[ModelT],
) -> ModelT | None:
    value = cache.get(key)
    if value is None:
        return None
    try:
        return response_model.model_validate_json(value)
    except (ValidationError, TypeError):
        logger.warning("Ignorando entrada inválida de cache para %s.", key)
        cache.delete(key)
        return None


def _store_response(cache: CacheService, key: str, value: BaseModel) -> None:
    cache.set(key, value.model_dump_json(), ttl_seconds=CACHE_TTL_SECONDS)


def _invalidate_census_cache(cache: CacheService) -> None:
    cache.increment(CACHE_VERSION_KEY, ttl_seconds=CACHE_TTL_SECONDS * 2)


def get_accessible_census(
    census_id: str,
    db: DbSession,
    current_user: CurrentAccount,
) -> CensusRecord:
    record = census_service.get_census(db, census_id)
    if current_user.role != "admin" and record.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Recenseado não encontrado.")
    return record


CensusAccess = Annotated[CensusRecord, Depends(get_accessible_census)]


@router.post("/census", response_model=CensusResponseDTO, status_code=status.HTTP_201_CREATED)
def create_census(
    payload: CensusCreateDTO,
    db: DbSession,
    current_user: CurrentUser,
    request: Request,
) -> CensusResponseDTO:
    record = census_service.create_census(db, payload, current_user.id)
    _invalidate_census_cache(request.app.state.cache)
    return record


@router.post("/census/multipart", response_model=CensusResponseDTO, status_code=status.HTTP_201_CREATED)
async def create_census_multipart(
    request: Request,
    db: DbSession,
    current_user: CurrentUser,
) -> CensusResponseDTO:
    form = await request.form()
    census_value = form.get("census")
    if isinstance(census_value, str):
        raw_data = census_value
    elif hasattr(census_value, "read"):
        try:
            raw_data = (await census_value.read()).decode("utf-8")
        except UnicodeDecodeError as error:
            raise HTTPException(status_code=422, detail="O campo 'census' deve conter JSON em UTF-8.") from error
    else:
        raise HTTPException(status_code=400, detail="O campo multipart 'census' é obrigatório.")

    try:
        raw_payload = json.loads(raw_data)
        payload = CensusCreateDTO.model_validate(raw_payload)
    except JSONDecodeError as error:
        raise HTTPException(status_code=422, detail="O campo 'census' deve conter JSON válido.") from error
    except ValidationError as error:
        details = [{"loc": item["loc"], "msg": item["msg"], "type": item["type"]} for item in error.errors()]
        raise HTTPException(status_code=422, detail=details) from error

    uploads: list[tuple[str, UploadFile]] = []
    for field_name, value in form.multi_items():
        if not field_name.startswith("documents[") or not hasattr(value, "read"):
            continue
        document_type = field_name.removeprefix("documents[").split("]", maxsplit=1)[0]
        uploads.append((document_type, value))

    record, _ = await census_service.create_census_with_uploads(
        db,
        payload,
        uploads,
        current_user.id,
    )
    _invalidate_census_cache(request.app.state.cache)
    return CensusResponseDTO.model_validate(record)


@router.get("/census", response_model=CensusListResponseDTO)
def list_my_census(
    db: DbSession,
    current_user: CurrentUser,
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> CensusListResponseDTO:
    cache: CacheService = request.app.state.cache
    key = _cache_key(cache, f"user-list:{current_user.id}:{limit}:{offset}")
    cached = _cached_response(cache, key, CensusListResponseDTO)
    if cached is not None:
        return cached
    records, total = census_service.list_user_census(
        db,
        current_user.id,
        limit=limit,
        offset=offset,
    )
    result = CensusListResponseDTO(items=records, total=total, limit=limit, offset=offset)
    _store_response(cache, key, result)
    return result


@router.get("/census/{census_id}", response_model=CensusResponseDTO)
def get_census(census: CensusAccess, request: Request) -> CensusResponseDTO:
    cache: CacheService = request.app.state.cache
    key = _cache_key(cache, f"record:{census.id}")
    cached = _cached_response(cache, key, CensusResponseDTO)
    if cached is not None:
        return cached
    result = CensusResponseDTO.model_validate(census)
    _store_response(cache, key, result)
    return result


@router.get("/census/{census_id}/steps", response_model=list[StepResponseDTO])
def get_census_steps(
    census_id: str,
    db: DbSession,
    request: Request,
    _: CensusAccess,
) -> list[StepResponseDTO]:
    cache: CacheService = request.app.state.cache
    key = _cache_key(cache, f"steps:{census_id}")
    cached = _cached_response(cache, key, StepListResponseDTO)
    if cached is not None:
        return cached.items
    items = census_service.list_census_steps(db, census_id)
    _store_response(cache, key, StepListResponseDTO(items=items))
    return items


@router.put("/census/{census_id}/steps/{step_name}", response_model=StepResponseDTO)
def save_census_step(
    census_id: str,
    step_name: str,
    payload: StepSaveDTO,
    db: DbSession,
    request: Request,
    _: CensusAccess,
) -> StepResponseDTO:
    if not step_name.strip():
        raise HTTPException(status_code=400, detail="O nome da etapa é obrigatório.")
    step = census_service.save_step(db, census_id, step_name, payload)
    _invalidate_census_cache(request.app.state.cache)
    return step


@router.get("/census/{census_id}/documents", response_model=list[DocumentResponseDTO])
def get_census_documents(
    census_id: str,
    db: DbSession,
    request: Request,
    _: CensusAccess,
) -> list[DocumentResponseDTO]:
    cache: CacheService = request.app.state.cache
    key = _cache_key(cache, f"documents:{census_id}")
    cached = _cached_response(cache, key, DocumentListResponseDTO)
    if cached is not None:
        return cached.items
    items = census_service.list_census_documents(db, census_id)
    _store_response(cache, key, DocumentListResponseDTO(items=items))
    return items


@router.patch("/census/{census_id}", response_model=CensusResponseDTO)
def update_census(
    census_id: str,
    payload: CensusUpdateDTO,
    db: DbSession,
    request: Request,
    _: CensusAccess,
) -> CensusResponseDTO:
    record = census_service.update_census(db, census_id, payload)
    _invalidate_census_cache(request.app.state.cache)
    return record


@router.delete(
    "/census/{census_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_census(
    census_id: str,
    db: DbSession,
    request: Request,
    _: CensusAccess,
) -> Response:
    census_service.delete_census(db, census_id)
    _invalidate_census_cache(request.app.state.cache)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/admin/census",
    response_model=CensusListResponseDTO,
    dependencies=[Depends(require_admin)],
)
def list_admin_census(
    db: DbSession,
    request: Request,
    search: str | None = Query(default=None, max_length=120),
    status_filter: CensusStatus | None = Query(default=None, alias="status"),
    category: EmploymentCategory | None = None,
    region: str | None = Query(default=None, max_length=32),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> CensusListResponseDTO:
    cache: CacheService = request.app.state.cache
    filters = _filter_cache_suffix(
        "admin-list",
        search=search,
        status=status_filter,
        category=category,
        region=region,
        limit=limit,
        offset=offset,
    )
    key = _cache_key(cache, filters)
    cached = _cached_response(cache, key, CensusListResponseDTO)
    if cached is not None:
        return cached
    records, total = census_service.list_census(
        db,
        search=search,
        status=status_filter,
        category=category,
        region=region,
        limit=limit,
        offset=offset,
    )
    result = CensusListResponseDTO(items=records, total=total, limit=limit, offset=offset)
    _store_response(cache, key, result)
    return result


@router.patch(
    "/admin/census/{census_id}/status",
    response_model=CensusResponseDTO,
    dependencies=[Depends(require_admin)],
)
def update_census_status(
    census_id: str,
    payload: CensusStatusUpdateDTO,
    db: DbSession,
    request: Request,
) -> CensusResponseDTO:
    record = census_service.update_census_status(db, census_id, payload.status)
    _invalidate_census_cache(request.app.state.cache)
    return record


@router.patch(
    "/admin/census/{census_id}/steps/{step_name}/review",
    response_model=StepResponseDTO,
    dependencies=[Depends(require_admin)],
)
def review_census_step(
    census_id: str,
    step_name: str,
    payload: StepReviewDTO,
    db: DbSession,
    request: Request,
) -> StepResponseDTO:
    step = census_service.review_step(db, census_id, step_name, payload)
    _invalidate_census_cache(request.app.state.cache)
    return step


@router.get(
    "/admin/dashboard",
    response_model=DashboardSummaryDTO,
    dependencies=[Depends(require_admin)],
)
def get_admin_dashboard(
    db: DbSession,
    request: Request,
    search: str | None = Query(default=None, max_length=120),
    status_filter: CensusStatus | None = Query(default=None, alias="status"),
    category: EmploymentCategory | None = None,
    region: str | None = Query(default=None, max_length=32),
) -> DashboardSummaryDTO:
    cache: CacheService = request.app.state.cache
    filters = _filter_cache_suffix(
        "admin-dashboard",
        search=search,
        status=status_filter,
        category=category,
        region=region,
    )
    key = _cache_key(cache, filters)
    cached = _cached_response(cache, key, DashboardSummaryDTO)
    if cached is not None:
        return cached
    total, categories, statuses, regions = census_service.get_dashboard_summary(
        db,
        search=search,
        status=status_filter,
        category=category,
        region=region,
    )
    result = DashboardSummaryDTO(total=total, categories=categories, statuses=statuses, regions=regions)
    _store_response(cache, key, result)
    return result
