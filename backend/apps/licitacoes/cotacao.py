"""Formação de preço de uma cotação — a conta da planilha
"Lucro Sobre Custo", em Python.

Existe uma versão desta mesma conta no frontend
(`frontend/src/app/pages/cotador/cotador.model.ts`), que é quem recalcula a
cada tecla enquanto o usuário digita. Aqui ela é refeita no servidor por um
motivo simples: **o total gravado não pode vir do cliente**. Se viesse, uma
requisição adulterada (ou uma versão velha do frontend em cache) gravaria
um lucro que não corresponde aos itens salvos ao lado dele, e a lista de
cotações passaria a mentir.

As duas implementações são ancoradas no mesmo exemplo documentado na
planilha (R$100 + 8% de transporte + 10% de imposto + 35% de lucro =
R$158,89, lucro líquido R$35), em `test_cotacao.py` e em
`cotador.model.spec.ts` — se uma das duas derivar, o teste da outra
continua de pé e a divergência aparece.

Tudo em `Decimal`: é dinheiro, e `float` erra centavo em soma de muitos
itens. Percentuais entram como **fração** (0.08 = 8%), igual ao TS.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

ZERO = Decimal("0")
UM = Decimal("1")

# Duas casas: o que vai pro portal do pregão é centavo.
CENTAVO = Decimal("0.01")


@dataclass(frozen=True)
class ParametrosCotacao:
    """Percentuais que valem para a cotação inteira.

    `transporte`, `garantia`, `lucro_desejado` e `lucro_minimo` incidem
    sobre o **custo** (o valor pago ao fornecedor). Os cinco tributos
    incidem sobre a **venda** — é o que torna o preço uma divisão por
    `(1 - impostos)` em vez de custo + margem.
    """

    transporte: Decimal = ZERO
    garantia: Decimal = ZERO
    icms: Decimal = ZERO
    pis: Decimal = ZERO
    cofins: Decimal = ZERO
    ipi: Decimal = ZERO
    iss: Decimal = ZERO
    lucro_desejado: Decimal = ZERO
    lucro_minimo: Decimal = ZERO

    @property
    def impostos(self) -> Decimal:
        return self.icms + self.pis + self.cofins + self.ipi + self.iss


@dataclass(frozen=True)
class ItemCotacao:
    quantidade: Decimal = ZERO
    valor_unitario_produto: Decimal = ZERO
    frete_fixo_unitario: Decimal = ZERO
    outros_custos_unitarios: Decimal = ZERO


@dataclass(frozen=True)
class ItemCalculado:
    custo_unitario: Decimal
    preco_unitario_final: Decimal
    preco_total_final: Decimal
    lucro_liquido_unitario: Decimal
    lucro_liquido_total: Decimal


@dataclass(frozen=True)
class TotaisCotacao:
    valor_total: Decimal
    lucro_total: Decimal


def _dividir(numerador: Decimal, denominador: Decimal) -> Decimal:
    """Guarda de divisão por zero — é o `IFERROR(...;0)` que a planilha
    repete em toda coluna calculada. Imposto de 100% ou mais não tem preço
    que feche a conta; devolver zero (como a planilha) é melhor que estourar
    ou propagar infinito para os totais."""
    return ZERO if denominador == ZERO else numerador / denominador


def calcular_item(item: ItemCotacao, parametros: ParametrosCotacao) -> ItemCalculado:
    produto = item.valor_unitario_produto
    impostos = parametros.impostos
    sobra = UM - impostos

    custo_unitario = (
        produto
        + produto * parametros.transporte
        + produto * parametros.garantia
        + item.frete_fixo_unitario
        + item.outros_custos_unitarios
    )

    preco_unitario_final = _dividir(custo_unitario + produto * parametros.lucro_desejado, sobra)
    lucro_liquido_unitario = preco_unitario_final - preco_unitario_final * impostos - custo_unitario

    return ItemCalculado(
        custo_unitario=custo_unitario,
        preco_unitario_final=preco_unitario_final,
        preco_total_final=item.quantidade * preco_unitario_final,
        lucro_liquido_unitario=lucro_liquido_unitario,
        lucro_liquido_total=item.quantidade * lucro_liquido_unitario,
    )


def totalizar(
    itens: list[ItemCotacao], parametros: ParametrosCotacao
) -> TotaisCotacao:
    """Valor total cotado e lucro total, arredondados ao centavo só no fim —
    arredondar item a item acumularia erro na soma."""
    calculados = [calcular_item(item, parametros) for item in itens]

    valor_total = sum((c.preco_total_final for c in calculados), ZERO)
    lucro_total = sum((c.lucro_liquido_total for c in calculados), ZERO)

    return TotaisCotacao(
        valor_total=valor_total.quantize(CENTAVO),
        lucro_total=lucro_total.quantize(CENTAVO),
    )


def _decimal(valor: object) -> Decimal:
    """JSON traz número como int/float/str conforme o cliente. Converte pela
    `str` de propósito: `Decimal(0.1)` guarda o erro binário do float, e
    `Decimal("0.1")` não."""
    if isinstance(valor, Decimal):
        return valor
    if valor is None or valor == "":
        return ZERO
    try:
        return Decimal(str(valor))
    except (ArithmeticError, ValueError):
        return ZERO


def parametros_de_dict(dados: dict) -> ParametrosCotacao:
    return ParametrosCotacao(
        transporte=_decimal(dados.get("transporte")),
        garantia=_decimal(dados.get("garantia")),
        icms=_decimal(dados.get("icms")),
        pis=_decimal(dados.get("pis")),
        cofins=_decimal(dados.get("cofins")),
        ipi=_decimal(dados.get("ipi")),
        iss=_decimal(dados.get("iss")),
        lucro_desejado=_decimal(dados.get("lucro_desejado")),
        lucro_minimo=_decimal(dados.get("lucro_minimo")),
    )


def itens_de_lista(dados: list[dict]) -> list[ItemCotacao]:
    return [
        ItemCotacao(
            quantidade=_decimal(item.get("quantidade")),
            valor_unitario_produto=_decimal(item.get("valor_unitario_produto")),
            frete_fixo_unitario=_decimal(item.get("frete_fixo_unitario")),
            outros_custos_unitarios=_decimal(item.get("outros_custos_unitarios")),
        )
        for item in dados
    ]
