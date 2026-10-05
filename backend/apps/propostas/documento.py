"""A proposta comercial em Word, a partir do modelo do cliente.

O modelo é um .docx comum com campos marcados no formato do docxtpl (Jinja
dentro do Word). Quem monta o modelo escreve, no lugar do dado:

- ``{{ empresa.nome }}``, ``{{ empresa.cnpj }}``, ``{{ empresa.endereco }}``,
  ``{{ empresa.responsavel_legal }}``, ``{{ empresa.email }}``,
  ``{{ empresa.telefone }}``, ``{{ empresa.inscricao_estadual }}``;
- ``{{ orgao.nome }}``, ``{{ orgao.uasg }}``, ``{{ orgao.cidade }}``,
  ``{{ edital.numero }}``, ``{{ edital.modalidade }}``, ``{{ edital.objeto }}``,
  ``{{ edital.prazo }}``;
- a tabela dos itens, numa linha com ``{%tr for item in itens %}`` …
  ``{%tr endfor %}`` e, nas células, ``{{ item.numero }}``,
  ``{{ item.descricao }}``, ``{{ item.marca }}``, ``{{ item.modelo }}``,
  ``{{ item.fabricante }}``, ``{{ item.unidade }}``, ``{{ item.quantidade }}``,
  ``{{ item.valor_unitario }}``, ``{{ item.valor_total }}``;
- ``{{ empresa.cep }}``, ``{{ empresa.banco }}``, ``{{ empresa.agencia }}``,
  ``{{ empresa.conta }}``, ``{{ empresa.responsavel_cpf }}``,
  ``{{ empresa.responsavel_rg }}``, ``{{ empresa.responsavel_qualificacao }}``;
- ``{{ valor_total }}`` e ``{{ valor_total_extenso }}`` ("cinquenta e três mil
  … reais e oito centavos"), ``{{ validade_dias }}`` e ``{{ validade_extenso }}``,
  ``{{ data }}`` (por extenso) e ``{{ cidade_data }}`` ("São Roque, 4 de
  outubro de 2026").

Os valores já chegam formatados em real; o modelo não faz conta. O preço de
cada item é o preço final do Cotador — a proposta é a formatação, não outra
conta.
"""

from __future__ import annotations

import io
from decimal import Decimal
from pathlib import Path

from django.utils import timezone

from apps.cotador import formulas

from .models import Proposta

MODELO_PADRAO = Path(__file__).with_name("modelo_padrao.docx")

MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]


def brl(valor: Decimal | float | None) -> str:
    if valor is None:
        return "—"
    inteiro, centavos = f"{Decimal(valor):,.2f}".split(".")
    return f"R$ {inteiro.replace(',', '.')},{centavos}"


UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
            "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete",
            "dezoito", "dezenove"]
DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta",
           "oitenta", "noventa"]
CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
            "seiscentos", "setecentos", "oitocentos", "novecentos"]


def _ate_mil(n: int) -> str:
    if n == 100:
        return "cem"
    partes = []
    if n >= 100:
        partes.append(CENTENAS[n // 100])
        n %= 100
    if n >= 20:
        partes.append(DEZENAS[n // 10])
        n %= 10
    if n:
        partes.append(UNIDADES[n])
    return " e ".join(partes)


def extenso(n: int) -> str:
    """Inteiro por extenso, até centenas de milhões: "cinquenta e três mil,
    trezentos e doze", "mil e cem", "dois milhões"."""

    if n == 0:
        return "zero"
    grupos = []
    for divisor, singular, plural in [(1_000_000, "milhão", "milhões"), (1000, "mil", "mil"), (1, "", "")]:
        g, n = divmod(n, divisor)
        if g:
            nome = singular if g == 1 else plural
            texto = "mil" if divisor == 1000 and g == 1 else f"{_ate_mil(g)} {nome}".strip()
            grupos.append((g, texto))
    if len(grupos) == 1:
        return grupos[0][1]
    *primeiros, (ultimo_valor, ultimo) = grupos
    # O último grupo leva "e" quando é menor que cem ou uma centena redonda.
    ligacao = " e " if ultimo_valor < 100 or ultimo_valor % 100 == 0 else ", "
    return ", ".join(t for _, t in primeiros) + ligacao + ultimo


def valor_por_extenso(valor: Decimal) -> str:
    valor = Decimal(valor).quantize(Decimal("0.01"))
    reais, centavos = int(valor), int((valor % 1) * 100)
    partes = []
    if reais:
        sufixo = "real" if reais == 1 else "reais"
        de = " de" if reais % 1_000_000 == 0 else ""
        partes.append(f"{extenso(reais)}{de} {sufixo}")
    if centavos:
        partes.append(f"{extenso(centavos)} {'centavo' if centavos == 1 else 'centavos'}")
    texto = " e ".join(partes) or "zero reais"
    return texto[0].upper() + texto[1:]


def _quantidade(valor: Decimal) -> str:
    texto = f"{valor.normalize():f}" if valor == valor.to_integral() else f"{valor:f}".rstrip("0")
    return texto.replace(".", ",")


def _cnpj(digitos: str) -> str:
    if len(digitos) != 14:
        return digitos
    return f"{digitos[:2]}.{digitos[2:5]}.{digitos[5:8]}/{digitos[8:12]}-{digitos[12:]}"


def _cep(digitos: str) -> str:
    return f"{digitos[:2]}.{digitos[2:5]}-{digitos[5:]}" if len(digitos) == 8 else digitos


def _numero_da_compra(salva) -> str:
    """O número do pregão como o órgão publica ("112"), do snapshot da busca;
    sem ele, o sequencial do PNCP."""

    for item in salva.itens or []:
        if numero := item.get("contratacao_numero_compra") or item.get("numero_compra"):
            return str(numero)
    return salva.sequencial_compra


def _endereco(empresa) -> str:
    rua = ", ".join(p for p in [empresa.logradouro, empresa.numero, empresa.complemento] if p)
    cidade = " / ".join(p for p in [empresa.cidade, empresa.uf] if p)
    return " — ".join(p for p in [rua, empresa.bairro, cidade] if p)


def contexto(proposta: Proposta) -> dict:
    salva = proposta.oportunidade
    empresa = proposta.empresa
    cotacao = getattr(salva, "cotacao", None)

    itens = []
    total = Decimal(0)
    if cotacao is not None:
        linhas = list(cotacao.itens.prefetch_related("ofertas").all())
        calculados = [formulas.calcular_item(i, cotacao.padroes) for i in cotacao.para_calculo()]
        for posicao, (item, calc) in enumerate(zip(linhas, calculados), start=1):
            oferta = next((o for o in item.ofertas.all() if o.escolhida), None)
            valor_total = calc.preco_final_unitario * item.quantidade
            total += valor_total
            itens.append(
                {
                    "numero": item.numero_item or str(posicao),
                    "descricao": item.descricao,
                    "fabricante": oferta.fabricante_nome if oferta else "",
                    "marca": oferta.marca_nome if oferta else "",
                    "modelo": oferta.modelo_nome if oferta else "",
                    "unidade": item.unidade,
                    "quantidade": _quantidade(item.quantidade),
                    "valor_unitario": brl(calc.preco_final_unitario),
                    "valor_total": brl(valor_total),
                }
            )

    hoje = timezone.localdate()
    data = f"{hoje.day} de {MESES[hoje.month - 1]} de {hoje.year}"
    cidade = empresa.cidade if empresa else ""
    return {
        "empresa": {
            "nome": empresa.nome if empresa else "",
            "fantasia": empresa.fantasia if empresa else "",
            "cnpj": _cnpj(empresa.cnpj) if empresa else "",
            "endereco": _endereco(empresa) if empresa else "",
            "responsavel_legal": empresa.responsavel_legal if empresa else "",
            "email": empresa.email if empresa else "",
            "telefone": empresa.telefone if empresa else "",
            "inscricao_estadual": empresa.inscricao_estadual if empresa else "",
            "cep": _cep(empresa.cep) if empresa else "",
            "banco": empresa.banco if empresa else "",
            "agencia": empresa.agencia if empresa else "",
            "conta": empresa.conta if empresa else "",
            "responsavel_cpf": empresa.responsavel_cpf if empresa else "",
            "responsavel_rg": empresa.responsavel_rg if empresa else "",
            "responsavel_qualificacao": empresa.responsavel_qualificacao if empresa else "",
        },
        "orgao": {
            "nome": salva.orgao_nome,
            "uasg": salva.uasg,
            "cidade": " / ".join(p for p in [salva.municipio, salva.uf] if p),
        },
        "edital": {
            "numero": f"{_numero_da_compra(salva)}/{salva.ano_compra}",
            "modalidade": salva.modalidade,
            "objeto": " ".join((salva.objeto or "").split()),
            "prazo": f"{salva.data_encerramento_proposta:%d/%m/%Y}"
            if salva.data_encerramento_proposta
            else "",
        },
        "itens": itens,
        "valor_total": brl(total if itens else proposta.valor),
        "valor_total_extenso": valor_por_extenso(total if itens else proposta.valor),
        "validade_dias": proposta.validade_dias,
        "validade_extenso": extenso(proposta.validade_dias),
        "data": data,
        "cidade_data": f"{cidade}, {data}" if cidade else data,
    }


def gerar_docx(proposta: Proposta, modelo: io.BytesIO | Path | None = None) -> bytes:
    """O .docx preenchido. `modelo` é o Word do cliente; sem ele, o padrão."""

    from docxtpl import DocxTemplate

    documento = DocxTemplate(modelo or MODELO_PADRAO)
    documento.render(contexto(proposta), autoescape=True)
    saida = io.BytesIO()
    documento.save(saida)
    return saida.getvalue()


def nome_do_arquivo(proposta: Proposta) -> str:
    salva = proposta.oportunidade
    uasg = f"UASG {salva.uasg} " if salva.uasg else ""
    return f"Proposta {uasg}{salva.sequencial_compra}-{salva.ano_compra}.docx"
