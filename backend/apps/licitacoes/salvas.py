"""Salvar uma oportunidade na lista da equipe — a regra, num lugar só.

Existem dois caminhos até aqui e eles precisam se comportar igual:

1. o botão "Salvar oportunidade" do card (`OportunidadesSalvasView.post`);
2. salvar uma cotação no Cotador, que salva a oportunidade junto — é o
   único jeito de a equipe voltar a ela depois (ver
   `apps.cotador.views.CotacoesView`).

O que os dois compartilham é a idempotência: salvar de novo o que já está
na lista devolve o registro existente e **não** cria evento no histórico —
um clique repetido (ou um segundo salvamento de cotação) não pode virar
ruído no log.
"""

from __future__ import annotations

from .models import EventoOportunidadeSalva, OportunidadeSalva, nome_de_usuario
from .serializers import OportunidadeSalvaCriacaoSerializer


def garantir_salva(dados: dict, *, request) -> tuple[OportunidadeSalva, bool]:
    """Salva a oportunidade descrita por `dados` (o payload de
    `OportunidadeSalvaCriacaoSerializer`: os itens da busca + capag +
    plataforma) e devolve `(registro, criada)`.

    Levanta `ValidationError` do DRF quando o payload não identifica a
    compra no PNCP — sem a tripla não há como impedir duplicata.
    """

    serializer = OportunidadeSalvaCriacaoSerializer(data=dados, context={"request": request})
    serializer.is_valid(raise_exception=True)

    contratacao = serializer.validated_data["itens"][0]
    existente = (
        OportunidadeSalva.objects.ativas()
        .filter(
            cnpj_orgao=contratacao["contratacao_cnpj_orgao"],
            ano_compra=contratacao["contratacao_ano_compra"],
            sequencial_compra=contratacao["contratacao_sequencial_compra"],
        )
        .first()
    )
    if existente:
        return existente, False

    salva = serializer.save()
    salva.registrar(
        EventoOportunidadeSalva.Tipo.SALVA,
        autor=request.user,
        descricao=f"Oportunidade salva por {nome_de_usuario(request.user)}.",
    )
    return salva, True
