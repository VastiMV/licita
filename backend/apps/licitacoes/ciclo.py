"""O Ciclo de Licitação — o quadro com uma coluna por etapa.

**A etapa é calculada, nunca gravada.** Ninguém escolhe etapa num select nem
arrasta cartão: ela sai do que existe. Hoje só existem as duas primeiras
etapas —

- **Oportunidade** — salva e ainda sem cotação;
- **Cotação** — com cotação salva no Cotador;

— e as outras três colunas (Proposta, Disputa, Empenho) ficam vazias até as
telas delas existirem. Quando existirem, a regra cresce aqui, num lugar só.

**Prazo de proposta vencido sem proposta enviada sai do quadro.** É o
"prazo perdido": a licitação vai para Encerradas. Como ainda não há
proposta no sistema, toda salva com prazo vencido cai aí.

O limite de "salva há muito tempo sem cotação" é parâmetro da empresa na
proposta do fluxo; enquanto a tela de Parâmetros não existe, o padrão mora
em `DIAS_SEM_COTACAO`.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

from django.utils import timezone

from .models import OportunidadeSalva

# Padrão até existir Configurações › Parâmetros (ver docstring do módulo).
DIAS_SEM_COTACAO = 2

ETAPAS = [
    ("oportunidade", "Oportunidade"),
    ("cotacao", "Cotação"),
    ("proposta", "Proposta"),
    ("disputa", "Disputa"),
    ("empenho", "Empenho"),
]

# As etapas cuja tela ainda não existe — a coluna aparece, vazia.
ETAPAS_A_CONSTRUIR = {"proposta", "disputa", "empenho"}


@dataclass(frozen=True)
class Alerta:
    nivel: str  # "ok" | "neutro" | "aviso" | "alerta"
    texto: str


def _cotacao_de(salva: OportunidadeSalva):
    """A cotação do Cotador, ou `None` — o acesso reverso de um-para-um
    levanta exceção quando não existe."""

    try:
        return salva.cotacao
    except OportunidadeSalva.cotacao.RelatedObjectDoesNotExist:
        return None


def etapa_de(salva: OportunidadeSalva, hoje: dt.date) -> str:
    """"encerrada" ou uma das chaves de `ETAPAS`."""

    if salva.expirada(hoje):
        return "encerrada"
    return "cotacao" if _cotacao_de(salva) else "oportunidade"


def _dias(de: dt.date, ate: dt.date) -> int:
    return (ate - de).days


def _cartao(salva: OportunidadeSalva, etapa: str, hoje: dt.date) -> dict:
    prazo = salva.data_encerramento_proposta
    cotacao = _cotacao_de(salva)

    if etapa == "oportunidade":
        dias_salva = _dias(timezone.localtime(salva.criada_em).date(), hoje)
        if dias_salva > DIAS_SEM_COTACAO:
            alerta = Alerta("aviso", f"salva há {dias_salva} dias, sem cotação")
        elif dias_salva == 0:
            alerta = Alerta("neutro", "salva hoje")
        else:
            alerta = Alerta("neutro", f"salva há {dias_salva} dia{'s' if dias_salva > 1 else ''}")
        falta = "cotar para saber se dá"
        valor_cotado = None
        pendencias = None
    else:
        totais = cotacao.totais()
        pendencias = totais.pendencias
        valor_cotado = float(cotacao.valor_cotado)
        if pendencias:
            plural = "ns" if pendencias > 1 else "m"
            alerta = Alerta("aviso", f"{pendencias} ite{plural} sem preço de fornecedor")
            falta = "preço de fornecedor nos itens pendentes"
        else:
            alerta = Alerta("ok", "cotação completa")
            falta = "gerar a proposta"

    if prazo and etapa != "encerrada":
        restantes = _dias(hoje, prazo)
        if restantes <= 1 and alerta.nivel != "alerta":
            quando = "hoje" if restantes == 0 else "amanhã"
            alerta = Alerta("alerta", f"propostas até {quando}")

    return {
        "id": salva.pk,
        "etapa": etapa,
        "uasg": salva.uasg,
        "municipio": salva.municipio,
        "uf": salva.uf,
        "objeto": salva.objeto,
        "data_encerramento_proposta": prazo,
        "valor_total_estimado": (
            float(salva.valor_total_estimado) if salva.valor_total_estimado is not None else None
        ),
        "cotacao_id": cotacao.pk if cotacao else None,
        # O snapshot do edital só vai quando ainda não há cotação: é com ele
        # que o Cotador abre preenchido. Com cotação, o Cotador carrega a dela.
        "itens": salva.itens if etapa == "oportunidade" else [],
        "valor_cotado": valor_cotado,
        "pendencias": pendencias,
        "alerta": {"nivel": alerta.nivel, "texto": alerta.texto},
        "falta": falta,
    }


def montar_quadro(hoje: dt.date | None = None) -> dict:
    """O quadro inteiro: as cinco colunas, o resumo do dia e quantas
    encerradas ficaram de fora."""

    hoje = hoje or timezone.localdate()
    salvas = (
        OportunidadeSalva.objects.ativas()
        .select_related("cotacao")
        .prefetch_related("cotacao__itens__ofertas")
    )

    por_etapa: dict[str, list[dict]] = {chave: [] for chave, _ in ETAPAS}
    encerradas = 0
    for salva in salvas:
        etapa = etapa_de(salva, hoje)
        if etapa == "encerrada":
            encerradas += 1
            continue
        por_etapa[etapa].append(_cartao(salva, etapa, hoje))

    # Quem vence primeiro vem primeiro — é por onde a manhã começa. Sem
    # prazo vai para o fim.
    for cartoes in por_etapa.values():
        cartoes.sort(key=lambda c: (c["data_encerramento_proposta"] or dt.date.max, c["id"]))

    todos = [c for cartoes in por_etapa.values() for c in cartoes]
    fim_da_semana = hoje + dt.timedelta(days=6 - hoje.weekday())

    return {
        "hoje": hoje,
        "resumo": {
            "prazo_ate_amanha": sum(1 for c in todos if c["alerta"]["nivel"] == "alerta"),
            "prazo_nesta_semana": sum(
                1
                for c in todos
                if c["data_encerramento_proposta"]
                and hoje <= c["data_encerramento_proposta"] <= fim_da_semana
            ),
            "salvas_sem_cotacao": sum(
                1 for c in por_etapa["oportunidade"] if c["alerta"]["nivel"] == "aviso"
            ),
            "cotacoes_com_pendencia": sum(1 for c in por_etapa["cotacao"] if c["pendencias"]),
        },
        "colunas": [
            {
                "etapa": chave,
                "rotulo": rotulo,
                "disponivel": chave not in ETAPAS_A_CONSTRUIR,
                "total_estimado": sum(c["valor_total_estimado"] or 0 for c in por_etapa[chave]),
                "cartoes": por_etapa[chave],
            }
            for chave, rotulo in ETAPAS
        ],
        "encerradas": encerradas,
        "dias_sem_cotacao": DIAS_SEM_COTACAO,
    }
