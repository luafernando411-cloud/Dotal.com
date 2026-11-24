import re


def normalize_cpf(value: str) -> str:
    if re.fullmatch(r"\d{11}", value):
        cpf = value
    elif re.fullmatch(r"\d{3}\.\d{3}\.\d{3}-\d{2}", value):
        cpf = re.sub(r"\D", "", value)
    else:
        raise ValueError("Informe um CPF válido.")

    if len(set(cpf)) == 1:
        raise ValueError("Informe um CPF válido.")
    for position in (9, 10):
        total = sum(
            int(digit) * (position + 1 - index)
            for index, digit in enumerate(cpf[:position])
        )
        remainder = (total * 10) % 11
        expected = 0 if remainder == 10 else remainder
        if expected != int(cpf[position]):
            raise ValueError("Informe um CPF válido.")
    return cpf
