from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

from app.models.census_model import CensusDocument, CensusRecord, CensusStep


class CensusRepository:
    def get_record(self, db: Session, census_id: str) -> CensusRecord | None:
        return db.get(CensusRecord, census_id)

    def get_record_by_cpf(self, db: Session, cpf: str) -> CensusRecord | None:
        statement = select(CensusRecord).where(CensusRecord.cpf == cpf)
        return db.scalar(statement)

    def get_record_by_protocol(self, db: Session, protocol: str) -> CensusRecord | None:
        statement = select(CensusRecord).where(CensusRecord.protocol == protocol)
        return db.scalar(statement)

    def get_user_records(
        self,
        db: Session,
        owner_id: str,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[CensusRecord], int]:
        statement = (
            select(CensusRecord)
            .where(CensusRecord.owner_id == owner_id)
            .order_by(CensusRecord.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        count_statement = (
            select(func.count())
            .select_from(CensusRecord)
            .where(CensusRecord.owner_id == owner_id)
        )
        return list(db.scalars(statement).all()), int(db.scalar(count_statement) or 0)

    def create_record(self, db: Session, record: CensusRecord) -> CensusRecord:
        db.add(record)
        db.flush()
        return record

    def get_step(self, db: Session, census_id: str, step_name: str) -> CensusStep | None:
        statement = select(CensusStep).where(
            CensusStep.census_id == census_id,
            CensusStep.step_name == step_name,
        )
        return db.scalar(statement)

    def add_step(self, db: Session, step: CensusStep) -> CensusStep:
        db.add(step)
        db.flush()
        return step

    def list_steps(self, db: Session, census_id: str) -> list[CensusStep]:
        statement = (
            select(CensusStep)
            .where(CensusStep.census_id == census_id)
            .order_by(CensusStep.updated_at.asc())
        )
        return list(db.scalars(statement).all())

    def add_document(self, db: Session, document: CensusDocument) -> CensusDocument:
        db.add(document)
        db.flush()
        return document

    def list_documents(self, db: Session, census_id: str) -> list[CensusDocument]:
        statement = (
            select(CensusDocument)
            .where(CensusDocument.census_id == census_id)
            .order_by(CensusDocument.created_at.desc())
        )
        return list(db.scalars(statement).all())

    def list_records(
        self,
        db: Session,
        *,
        search: str | None = None,
        status: str | None = None,
        category: str | None = None,
        region: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[CensusRecord], int]:
        conditions = self._record_conditions(search, status, category, region)
        statement = select(CensusRecord)
        count_statement = select(func.count()).select_from(CensusRecord)
        if conditions:
            statement = statement.where(*conditions)
            count_statement = count_statement.where(*conditions)

        statement = statement.order_by(CensusRecord.updated_at.desc()).limit(limit).offset(offset)
        return list(db.scalars(statement).all()), int(db.scalar(count_statement) or 0)

    def dashboard_summary(
        self,
        db: Session,
        *,
        search: str | None = None,
        status: str | None = None,
        category: str | None = None,
        region: str | None = None,
    ) -> tuple[int, dict[str, int], dict[str, int], dict[str, int]]:
        conditions = self._record_conditions(search, status, category, region)
        total_statement = select(func.count()).select_from(CensusRecord)
        if conditions:
            total_statement = total_statement.where(*conditions)
        total = int(db.scalar(total_statement) or 0)
        return (
            total,
            self._grouped_count(db, CensusRecord.category, conditions),
            self._grouped_count(db, CensusRecord.status, conditions),
            self._grouped_count(db, CensusRecord.region, conditions, exclude_null=True),
        )

    @staticmethod
    def _record_conditions(
        search: str | None,
        status: str | None,
        category: str | None,
        region: str | None,
    ) -> list[ColumnElement[bool]]:
        conditions = []
        if search:
            pattern = f"%{search.strip()}%"
            conditions.append(
                or_(
                    CensusRecord.full_name.ilike(pattern),
                    CensusRecord.cpf.ilike(pattern),
                    CensusRecord.protocol.ilike(pattern),
                    CensusRecord.city.ilike(pattern),
                )
            )
        if status:
            conditions.append(CensusRecord.status == status)
        if category:
            conditions.append(CensusRecord.category == category)
        if region:
            conditions.append(CensusRecord.region == region)
        return conditions

    @staticmethod
    def _grouped_count(
        db: Session,
        field: InstrumentedAttribute[Any],
        conditions: list[ColumnElement[bool]],
        *,
        exclude_null: bool = False,
    ) -> dict[str, int]:
        statement = select(field, func.count()).select_from(CensusRecord)
        if conditions:
            statement = statement.where(*conditions)
        if exclude_null:
            statement = statement.where(field.is_not(None))
        statement = statement.group_by(field)
        return {key: int(count) for key, count in db.execute(statement).all() if key is not None}

    def commit(self, db: Session) -> None:
        db.commit()

    def refresh_record(self, db: Session, record: CensusRecord) -> CensusRecord:
        db.refresh(record)
        return record

    def delete_record(self, db: Session, record: CensusRecord) -> None:
        db.delete(record)
        db.commit()
