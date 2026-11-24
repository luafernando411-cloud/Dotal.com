from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.admin_model import Admin


class AdminRepository:
    def get_by_email(self, db: Session, email: str) -> Admin | None:
        return db.scalar(select(Admin).where(Admin.email == email))

    def get_by_id(self, db: Session, admin_id: str) -> Admin | None:
        return db.get(Admin, admin_id)

    def add(self, db: Session, admin: Admin) -> Admin:
        db.add(admin)
        db.flush()
        return admin

    def commit(self, db: Session) -> None:
        db.commit()
