"""Resolve o selo CAPAG de uma compra.

De propósito: casado pela esfera + localização que o PNCP devolve para a
compra (`apps/integracoes/clients/pncp.py::detalhar_compra` —
`orgaoEntidade.esferaId` e `unidadeOrgao.codigoIbge`), nunca por nome de
órgão. Confirmado contra a API real em 26/08/2026 (ver docs/DOMINIO.md):
um órgão estadual pode ter nome de faculdade/fundação sem "estado" em
lugar nenhum — só a esfera do PNCP diz com confiança de quem é a nota.
"""

from __future__ import annotations

from .cores import NOTA_PARA_COR
from .models import EstadoCapag, MunicipioCapag

ESFERA_MUNICIPAL = "M"
ESFERA_ESTADUAL = "E"
# Esfera "F" (federal) e qualquer outra não têm CAPAG — o indicador é só
# para entes subnacionais que tomam empréstimo com garantia da União.


def nota_para(*, esfera_id: str | None, codigo_ibge: int | str | None, uf: str | None) -> dict[str, str] | None:
    """`{"nota": "A", "cor": "verde"}`, ou `None` quando não há CAPAG pra essa
    compra (esfera federal, ente não avaliado, ou ainda não sincronizado)."""

    nota: str | None = None

    if esfera_id == ESFERA_MUNICIPAL and codigo_ibge:
        registro = MunicipioCapag.objects.filter(codigo_ibge=codigo_ibge).first()
        nota = registro.nota if registro else None
    elif esfera_id == ESFERA_ESTADUAL and uf:
        registro = EstadoCapag.objects.filter(uf=uf.upper()).first()
        nota = registro.nota if registro else None

    if nota not in NOTA_PARA_COR:
        return None
    return {"nota": nota, "cor": NOTA_PARA_COR[nota]}
