"""CPF e CNPJ — normalização e dígito verificador.

Fica isolado do model porque a regra é de documento, não de fornecedor: o
mesmo `validar_documento` serve qualquer cadastro que venha depois (o
cliente do módulo de propostas, por exemplo).

**O documento é gravado só com dígitos.** Máscara é assunto de tela: quem
digita "12.345.678/0001-99" e quem digita "12345678000199" tem que colidir
na mesma restrição de unicidade — o que só acontece se a comparação for
sobre a forma normalizada.
"""

from __future__ import annotations

import re

CNPJ_DIGITOS = 14
CPF_DIGITOS = 11


def somente_digitos(valor: str) -> str:
    return re.sub(r"\D", "", valor or "")


def formatar_documento(digitos: str) -> str:
    """Volta a máscara para exibição (relatório, planilha exportada). Um
    documento com tamanho inesperado sai como veio — melhor mostrar o dado
    cru do que uma máscara mentirosa."""

    if len(digitos) == CNPJ_DIGITOS:
        return f"{digitos[:2]}.{digitos[2:5]}.{digitos[5:8]}/{digitos[8:12]}-{digitos[12:]}"
    if len(digitos) == CPF_DIGITOS:
        return f"{digitos[:3]}.{digitos[3:6]}.{digitos[6:9]}-{digitos[9:]}"
    return digitos


def _digito(digitos: str, pesos: list[int]) -> int:
    soma = sum(int(d) * p for d, p in zip(digitos, pesos))
    resto = soma % 11
    return 0 if resto < 2 else 11 - resto


def cnpj_valido(digitos: str) -> bool:
    if len(digitos) != CNPJ_DIGITOS or len(set(digitos)) == 1:
        return False
    pesos = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    primeiro = _digito(digitos[:12], pesos)
    segundo = _digito(digitos[:12] + str(primeiro), [6] + pesos)
    return digitos[12:] == f"{primeiro}{segundo}"


def cpf_valido(digitos: str) -> bool:
    if len(digitos) != CPF_DIGITOS or len(set(digitos)) == 1:
        return False
    primeiro = _digito(digitos[:9], list(range(10, 1, -1)))
    segundo = _digito(digitos[:9] + str(primeiro), list(range(11, 1, -1)))
    return digitos[9:] == f"{primeiro}{segundo}"


def documento_valido(digitos: str) -> bool:
    """Aceita os dois: o cadastro admite pessoa física (MEI de fachada,
    prestador autônomo) tanto quanto empresa."""

    return cnpj_valido(digitos) or cpf_valido(digitos)
