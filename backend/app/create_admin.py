from getpass import getpass

from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal, prepare_database
from app.core.security import hash_password
from app.models import Admin
from app.dtos.auth_dto import normalize_email


def main() -> None:
    try:
        email = normalize_email(input("E-mail do administrador: "))
    except ValueError as error:
        raise SystemExit(str(error)) from error
    password = getpass("Senha (12+ caracteres, maiúscula, minúscula, número e símbolo): ")
    if (
        len(password) < 12
        or len(password.encode("utf-8")) > 72
        or not any(character.islower() for character in password)
        or not any(character.isupper() for character in password)
        or not any(character.isdigit() for character in password)
        or not any(not character.isalnum() for character in password)
    ):
        raise SystemExit("A senha deve conter 12+ caracteres, maiúscula, minúscula, número e símbolo.")

    prepare_database()
    with SessionLocal() as db:
        admin = db.query(Admin).filter_by(email=email).one_or_none()
        if admin is None:
            admin = Admin(email=email, password_hash=hash_password(password), role="admin")
            db.add(admin)
        else:
            admin.password_hash = hash_password(password)
        try:
            db.commit()
        except IntegrityError as error:
            db.rollback()
            raise SystemExit("Não foi possível criar o administrador.") from error
    print("Administrador criado/atualizado.")


if __name__ == "__main__":
    main()
