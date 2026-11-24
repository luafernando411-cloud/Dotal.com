from datetime import datetime, timezone
import logging
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.dtos.census_dto import (
    CensusCreateDTO,
    CensusStatus,
    CensusUpdateDTO,
    StepReviewDTO,
    StepSaveDTO,
)
from app.models.census_model import CensusDocument, CensusRecord, CensusStep
from app.repositories.census_repository import CensusRepository


MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
repository = CensusRepository()
logger = logging.getLogger(__name__)


def create_census(db: Session, payload: CensusCreateDTO, owner_id: str) -> CensusRecord:
    if repository.get_record_by_cpf(db, payload.cpf):
        raise HTTPException(status_code=409, detail="Já existe um cadastro para este CPF.")
    record = _new_record(payload, owner_id)
    try:
        repository.create_record(db, record)
        repository.commit(db)
        return repository.refresh_record(db, record)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="O CPF já está cadastrado.") from error


async def create_census_with_uploads(
    db: Session,
    payload: CensusCreateDTO,
    uploads: list[tuple[str, UploadFile]],
    owner_id: str,
) -> tuple[CensusRecord, list[CensusDocument]]:
    if repository.get_record_by_cpf(db, payload.cpf):
        raise HTTPException(status_code=409, detail="Já existe um cadastro para este CPF.")

    record = _new_record(payload, owner_id)
    staged_uploads: list[tuple[str, UploadFile, str, bytes]] = []
    written_paths: list[Path] = []
    try:
        repository.create_record(db, record)
        for document_type, upload in uploads:
            extension = Path(upload.filename or "").suffix.lower()
            if extension not in ALLOWED_EXTENSIONS:
                raise HTTPException(status_code=400, detail="Formato de documento não permitido.")
            if not document_type or len(document_type) > 60:
                raise HTTPException(status_code=400, detail="Tipo de documento inválido.")
            contents = await upload.read(MAX_DOCUMENT_SIZE + 1)
            if not contents:
                raise HTTPException(status_code=400, detail="O arquivo enviado está vazio.")
            if len(contents) > MAX_DOCUMENT_SIZE:
                raise HTTPException(status_code=413, detail="Cada documento deve ter no máximo 10 MB.")
            stored_name = f"{record.id}_{uuid4().hex}{extension}"
            staged_uploads.append((document_type, upload, stored_name, contents))

        saved_documents = []
        for document_type, upload, stored_name, contents in staged_uploads:
            destination = settings.uploads_dir / stored_name
            destination.write_bytes(contents)
            written_paths.append(destination)
            document = CensusDocument(
                census_id=record.id,
                document_type=document_type,
                original_name=Path(upload.filename or "documento").name[:255],
                stored_name=stored_name,
                content_type=upload.content_type,
                size_bytes=len(contents),
            )
            repository.add_document(db, document)
            saved_documents.append(document)

        repository.commit(db)
        repository.refresh_record(db, record)
        return record, saved_documents
    except HTTPException:
        db.rollback()
        _remove_files(written_paths)
        raise
    except IntegrityError as error:
        db.rollback()
        _remove_files(written_paths)
        raise HTTPException(status_code=409, detail="O CPF já está cadastrado.") from error
    except (OSError, SQLAlchemyError) as error:
        db.rollback()
        _remove_files(written_paths)
        raise HTTPException(status_code=500, detail="Não foi possível salvar o cadastro e seus documentos.") from error


def get_census(db: Session, census_id: str) -> CensusRecord:
    record = repository.get_record(db, census_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Recenseado não encontrado.")
    return record


def list_user_census(
    db: Session,
    owner_id: str,
    *,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[CensusRecord], int]:
    return repository.get_user_records(db, owner_id, limit=limit, offset=offset)


def update_census(
    db: Session,
    census_id: str,
    payload: CensusUpdateDTO,
) -> CensusRecord:
    record = get_census(db, census_id)
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in changes.items():
        target_field = "category" if field == "employment_status" else field
        if field == "full_name":
            value = value.strip()
        elif field == "state":
            value = value.upper()
        setattr(record, target_field, value)
    repository.commit(db)
    return repository.refresh_record(db, record)


def delete_census(db: Session, census_id: str) -> None:
    record = get_census(db, census_id)
    documents = repository.list_documents(db, census_id)
    repository.delete_record(db, record)
    _remove_files([settings.uploads_dir / document.stored_name for document in documents])


def save_step(db: Session, census_id: str, step_name: str, payload: StepSaveDTO) -> CensusStep:
    get_census(db, census_id)
    step = repository.get_step(db, census_id, step_name)
    if step is None:
        step = CensusStep(census_id=census_id, step_name=step_name, data=payload.data)
        repository.add_step(db, step)
    else:
        step.data = payload.data
        step.status = "Pendente"
        step.feedback = None
        step.reviewed_at = None
    repository.commit(db)
    db.refresh(step)
    return step


def review_step(db: Session, census_id: str, step_name: str, payload: StepReviewDTO) -> CensusStep:
    get_census(db, census_id)
    step = repository.get_step(db, census_id, step_name)
    if step is None:
        raise HTTPException(status_code=404, detail="Etapa do recenseamento não encontrada.")
    if payload.status == "Reprovada / Ajuste Solicitado" and not (payload.feedback or "").strip():
        raise HTTPException(status_code=400, detail="Informe um feedback ao solicitar ajustes na etapa.")
    step.status = payload.status
    step.feedback = payload.feedback.strip() if payload.feedback else None
    step.reviewed_at = datetime.now(timezone.utc)
    repository.commit(db)
    db.refresh(step)
    return step


def update_census_status(db: Session, census_id: str, status: CensusStatus) -> CensusRecord:
    record = get_census(db, census_id)
    record.status = status
    repository.commit(db)
    return repository.refresh_record(db, record)


def list_census_steps(db: Session, census_id: str) -> list[CensusStep]:
    get_census(db, census_id)
    return repository.list_steps(db, census_id)


def list_census_documents(db: Session, census_id: str) -> list[CensusDocument]:
    get_census(db, census_id)
    return repository.list_documents(db, census_id)


def list_census(
    db: Session,
    *,
    search: str | None = None,
    status: str | None = None,
    category: str | None = None,
    region: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[CensusRecord], int]:
    return repository.list_records(
        db,
        search=search,
        status=status,
        category=category,
        region=region,
        limit=limit,
        offset=offset,
    )


def get_dashboard_summary(
    db: Session,
    *,
    search: str | None = None,
    status: str | None = None,
    category: str | None = None,
    region: str | None = None,
) -> tuple[int, dict[str, int], dict[str, int], dict[str, int]]:
    return repository.dashboard_summary(
        db,
        search=search,
        status=status,
        category=category,
        region=region,
    )


def _new_record(payload: CensusCreateDTO, owner_id: str) -> CensusRecord:
    timestamp = datetime.now(timezone.utc)
    record_data = payload.model_dump(mode="json", by_alias=True)
    return CensusRecord(
        protocol=f"CEN-{timestamp.year}-{uuid4().hex[:8].upper()}",
        owner_id=owner_id,
        full_name=payload.full_name.strip(),
        cpf=payload.cpf,
        email=payload.email,
        phone=payload.phone,
        category=payload.employment_status,
        region=payload.region,
        city=payload.city,
        state=payload.state.upper() if payload.state else None,
        payload=record_data,
    )


def _remove_files(paths: list[Path]) -> None:
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError as error:
            logger.warning("Não foi possível remover um arquivo do cadastro: %s", error)
