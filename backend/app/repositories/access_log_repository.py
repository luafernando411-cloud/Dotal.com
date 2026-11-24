from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.access_log_model import AccessLog


class AccessLogRepository:
    def add(self, db: Session, entry: AccessLog) -> None:
        db.add(entry)
        db.commit()

    def list_latest(self, db: Session, *, limit: int) -> list[AccessLog]:
        statement = select(AccessLog).order_by(AccessLog.occurred_at.desc()).limit(limit)
        return list(db.scalars(statement).all())

    def count_since(
        self,
        db: Session,
        *,
        success: bool,
        since: datetime,
    ) -> int:
        statement = (
            select(func.count())
            .select_from(AccessLog)
            .where(
                AccessLog.success.is_(success),
                AccessLog.event == "login",
                AccessLog.occurred_at >= since,
            )
        )
        return int(db.scalar(statement) or 0)
