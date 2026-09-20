"""Serializers do dossiê da empresa.

A situação (`pendente`, `a_vencer`, `vencido`…) é **calculada e só de
leitura**: ela não existe como campo, e aceitar do cliente seria voltar ao
problema do `Fornecedor.situacao`, que envelhecia sozinho.
"""

from __future__ import annotations

from rest_framework import serializers

from .models import Documento, EventoDocumento, TipoDocumento, VersaoDocumento


class TipoDocumentoSerializer(serializers.ModelSerializer):
    bloco_label = serializers.CharField(source="get_bloco_display", read_only=True)

    class Meta:
        model = TipoDocumento
        fields = [
            "id",
            "bloco",
            "bloco_label",
            "nome",
            "orgao_emissor",
            "exige_validade",
            "obrigatorio",
            "link_emissor",
            "ordem",
        ]


class VersaoSerializer(serializers.ModelSerializer):
    enviado_por_nome = serializers.SerializerMethodField()
    extensao = serializers.CharField(read_only=True)

    class Meta:
        model = VersaoDocumento
        fields = [
            "id",
            "versao",
            "numero",
            "emissao",
            "validade",
            "nome_original",
            "extensao",
            "tamanho",
            "nota",
            "enviado_por_nome",
            "enviado_em",
        ]
        # O caminho no bucket nunca sai daqui: o download é por URL assinada
        # (ver `DownloadView`), e expor a chave convidaria a montar link na
        # mão.
        read_only_fields = fields

    def get_enviado_por_nome(self, versao: VersaoDocumento) -> str:
        if not versao.enviado_por:
            return ""
        return versao.enviado_por.nome or versao.enviado_por.email


class DocumentoSerializer(serializers.ModelSerializer):
    """A linha da tabela do dossiê: o tipo, a validade da versão corrente e a
    conta da situação — tudo pronto, para a tela não remontar nada em JS."""

    nome = serializers.CharField(read_only=True)
    tipo_nome = serializers.CharField(source="tipo.nome", read_only=True)
    orgao_emissor = serializers.CharField(source="tipo.orgao_emissor", read_only=True)
    bloco = serializers.CharField(source="tipo.bloco", read_only=True)
    bloco_label = serializers.CharField(source="tipo.get_bloco_display", read_only=True)
    exige_validade = serializers.BooleanField(source="tipo.exige_validade", read_only=True)
    link_emissor = serializers.CharField(source="tipo.link_emissor", read_only=True)

    situacao = serializers.CharField(read_only=True)
    situacao_label = serializers.CharField(read_only=True)
    validade = serializers.DateField(read_only=True)
    dias_para_vencer = serializers.IntegerField(read_only=True)

    versao_atual = VersaoSerializer(read_only=True)
    total_versoes = serializers.SerializerMethodField()

    class Meta:
        model = Documento
        fields = [
            "id",
            "empresa",
            "tipo",
            "tipo_nome",
            "titulo",
            "nome",
            "orgao_emissor",
            "bloco",
            "bloco_label",
            "exige_validade",
            "link_emissor",
            "observacoes",
            "situacao",
            "situacao_label",
            "validade",
            "dias_para_vencer",
            "versao_atual",
            "total_versoes",
            "arquivado_em",
        ]
        read_only_fields = ["id", "arquivado_em"]

    def get_total_versoes(self, documento: Documento) -> int:
        return len(documento.versoes.all())

    def validate(self, dados: dict) -> dict:
        """O tipo livre precisa de título — sem ele, dois "outro documento"
        da mesma empresa seriam indistinguíveis na tela e colidiriam na
        unicidade."""

        tipo = dados.get("tipo") or getattr(self.instance, "tipo", None)
        titulo = (dados.get("titulo") or "").strip()

        if tipo and tipo.bloco == "outros" and not titulo:
            raise serializers.ValidationError(
                {"titulo": "Dê um nome a este documento (ex.: “Alvará sanitário”)."}
            )
        dados["titulo"] = titulo
        return dados


class NovaVersaoSerializer(serializers.Serializer):
    """O `multipart` do upload. O arquivo em si é validado em `upload.py`,
    que é quem conhece limite e extensão."""

    arquivo = serializers.FileField()
    numero = serializers.CharField(required=False, allow_blank=True, max_length=80)
    emissao = serializers.DateField(required=False, allow_null=True)
    validade = serializers.DateField(required=False, allow_null=True)
    nota = serializers.CharField(required=False, allow_blank=True, max_length=200)

    def validate(self, dados: dict) -> dict:
        emissao, validade = dados.get("emissao"), dados.get("validade")
        if emissao and validade and validade < emissao:
            raise serializers.ValidationError(
                {"validade": "A validade não pode ser anterior à emissão."}
            )
        return dados


class EventoSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    autor_nome = serializers.SerializerMethodField()

    class Meta:
        model = EventoDocumento
        fields = ["id", "tipo", "tipo_label", "detalhe", "autor_nome", "quando"]

    def get_autor_nome(self, evento: EventoDocumento) -> str:
        if not evento.autor:
            return ""
        return evento.autor.nome or evento.autor.email
