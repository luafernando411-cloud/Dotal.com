import re

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.user_model import User


class UserRepository:
    def get_by_email(self, db: Session, email: str) -> User | None:
        return db.scalar(select(User).where(User.email == email))

    def get_by_cpf(self, db: Session, cpf: str) -> User | None:
        return db.scalar(select(User).where(User.cpf == cpf))

    def get_by_id(self, db: Session, user_id: str) -> User | None:
        return db.get(User, user_id)

    def add(self, db: Session, user: User) -> User:
        db.add(user)
        db.flush()
        return user

    def commit(self, db: Session) -> None:
        db.commit()

    def list_users(
        self,
        db: Session,
        *,
        search: str | None,
        status: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[User], int]:
        conditions = [User.cpf.is_not(None)]
        if search:
            term = f"%{search.strip()}%"
            cpf_term = re.sub(r"\D", "", search)
            search_conditions = [User.full_name.ilike(term)]
            if cpf_term:
                search_conditions.append(User.cpf.ilike(f"%{cpf_term}%"))
            conditions.append(or_(*search_conditions))
        if status:
            conditions.append(User.status == status)
        statement = select(User).where(*conditions)
        count_statement = select(func.count()).select_from(User).where(*conditions)
        statement = statement.order_by(User.created_at.desc()).limit(limit).offset(offset)
        return list(db.scalars(statement).all()), int(db.scalar(count_statement) or 0)

    def count_registered_users(self, db: Session, *, status: str | None = None) -> int:
        statement = select(func.count()).select_from(User).where(User.cpf.is_not(None))
        if status:
            statement = statement.where(User.status == status)
        return int(db.scalar(statement) or 0)
