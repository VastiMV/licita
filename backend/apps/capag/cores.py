"""Tradução da nota CAPAG (escala do Tesouro Nacional) pra cor do selo.

Confirmado contra os arquivos reais em 26/08/2026 (municípios e estados
usam a mesma escala): `A+ A B+ B C D`, além de `#N/A`/`n.d.`/`n.e.` para
ente não avaliado — esses últimos não entram no dict, e ficam sem selo
(ver `apps/capag/lookup.py`).
"""

from __future__ import annotations

NOTA_PARA_COR: dict[str, str] = {
    "A+": "verde",
    "A": "verde",
    "B+": "amarelo",
    "B": "amarelo",
    "C": "vermelho",
    "D": "vermelho",
}
