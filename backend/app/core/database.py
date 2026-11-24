from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def prepare_database() -> None:
    inspector = inspect(engine)
    if "users" in inspector.get_table_names():
        existing = {column["name"] for column in inspector.get_columns("users")}
        additions = {
            "cpf": "VARCHAR(11)",
            "full_name": "VARCHAR(200)",
            "status": "VARCHAR(16) NOT NULL DEFAULT 'active'",
        }
        with engine.begin() as connection:
            for name, definition in additions.items():
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE users ADD COLUMN {name} {definition}"))

    from app.models import Base

    Base.metadata.create_all(bind=engine)
    if "role" not in {column["name"] for column in inspect(engine).get_columns("users")}:
        return
    with engine.begin() as connection:
        legacy_admins = connection.execute(
            text("SELECT id, email, password_hash FROM users WHERE role = 'admin'")
        ).mappings()
        for row in legacy_admins:
            connection.execute(
                text(
                    "INSERT INTO admins (id, email, password_hash, role) "
                    "VALUES (:id, :email, :password_hash, 'admin') "
                    "ON CONFLICT (email) DO NOTHING"
                ),
                dict(row),
            )
        connection.execute(text("UPDATE users SET role = 'user' WHERE role = 'admin'"))
