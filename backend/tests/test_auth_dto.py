import unittest

from pydantic import ValidationError

from app.core.validators import normalize_cpf
from app.dtos.auth_dto import AdminRegisterDTO, RegisterDTO


class CpfValidationTests(unittest.TestCase):
    def test_valid_formatted_cpf_is_normalized_to_digits(self):
        self.assertEqual(normalize_cpf("529.982.247-25"), "52998224725")

    def test_invalid_or_malformed_cpf_is_rejected(self):
        for value in ("111.111.111-11", "52998224724", "abc52998224725", "5299822472"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                normalize_cpf(value)

    def test_registration_rejects_weak_password_and_invalid_cpf(self):
        base = {
            "cpf": "52998224725",
            "fullName": "Pessoa Teste",
            "email": "pessoa@example.com",
            "password": "onlyletters",
        }
        with self.assertRaises(ValidationError):
            RegisterDTO.model_validate(base)
        with self.assertRaises(ValidationError):
            RegisterDTO.model_validate({**base, "cpf": "12345678901", "password": "senha123"})

    def test_admin_requires_strong_password_and_valid_email(self):
        valid = {
            "email": "ADMIN@example.com",
            "password": "StrongAdminPass1!",
            "registration_key": "provisioning-secret",
        }
        self.assertEqual(AdminRegisterDTO.model_validate(valid).email, "admin@example.com")
        for changes in (
            {"password": "weakpassword1"},
            {"email": "not-an-email"},
        ):
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                AdminRegisterDTO.model_validate({**valid, **changes})


if __name__ == "__main__":
    unittest.main()
