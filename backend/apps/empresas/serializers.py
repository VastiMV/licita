"""Serializers do cadastro de empresas.

Um serializer só para leitura e escrita, pelo mesmo motivo de
`apps.fornecedores.serializers`: o formulário da tela é o registro inteiro.

O que ele acrescenta ao `ModelSerializer` são as regras que a tela não pode
garantir sozinha — dígito verificador do CNPJ, unicidade dentro do tenant com
a mensagem certa (e não o texto do banco), e normalização de CEP e telefone
para dígitos.

`tenant` não é campo de entrada: quem decide de quem é o registro é
`apps.tenants.atual`, nunca o payload. Aceitar um tenant vindo da tela seria
o primeiro buraco de multiempresa, num produto que ainda nem tem dois.
"""

from __future__ import annotations

from rest_framework import serializers

from apps.fornecedores.documentos import cnpj_valido, somente_digitos

from .models import Empresa


class EmpresaSerializer(serializers.ModelSerializer):
    # Mesmo motivo do `Fornecedor`: o que chega da tela vem com máscara (18
    # caracteres), e o `max_length=14` herdado do model reprovaria o payload
    # antes de `validate_cnpj` tirar a pontuação.
    cnpj = serializers.CharField(max_length=32)

    cnpj_formatado = serializers.CharField(read_only=True)
    cidade_uf = serializers.CharField(read_only=True)
    porte_label = serializers.CharField(source="get_porte_display", read_only=True)

    class Meta:
        model = Empresa
        fields = [
            "id",
            "nome",
            "fantasia",
            "cnpj",
            "cnpj_formatado",
            "porte",
            "porte_label",
            "inscricao_estadual",
            "inscricao_municipal",
            "cnae_principal",
            "cep",
            "logradouro",
            "numero",
            "complemento",
            "bairro",
            "uf",
            "cidade",
            "cidade_uf",
            "responsavel_legal",
            "email",
            "telefone",
            "observacoes",
            "padrao",
            "ativa",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["id", "criado_em", "atualizado_em"]

    def validate_nome(self, nome: str) -> str:
        nome = (nome or "").strip()
        if not nome:
            raise serializers.ValidationError("A razão social é obrigatória.")
        return nome

    def validate_cnpj(self, cnpj: str) -> str:
        """Só CNPJ, sem a alternativa de CPF que o fornecedor aceita: quem
        disputa licitação é pessoa jurídica — inclusive o MEI, que tem CNPJ."""

        digitos = somente_digitos(cnpj)
        if not digitos:
            raise serializers.ValidationError("O CNPJ é obrigatório.")
        if not cnpj_valido(digitos):
            raise serializers.ValidationError(
                "CNPJ inválido — confira os dígitos verificadores."
            )

        existentes = Empresa.objects.do_tenant(self.context["tenant"]).filter(cnpj=digitos)
        if self.instance:
            existentes = existentes.exclude(pk=self.instance.pk)
        if outra := existentes.first():
            raise serializers.ValidationError(
                f'Já existe uma empresa cadastrada com este CNPJ: "{outra.nome}".'
            )
        return digitos

    def validate_cep(self, cep: str) -> str:
        return somente_digitos(cep)

    def validate_telefone(self, telefone: str) -> str:
        return somente_digitos(telefone)

    def validate_ativa(self, ativa: bool) -> bool:
        """A empresa padrão é a que a proposta já vem preenchida com — se ela
        for inativada sem que outra assuma o lugar, a próxima proposta abre
        sem CNPJ e ninguém entende por quê."""

        if not ativa and self.instance and self.instance.padrao:
            raise serializers.ValidationError(
                "Esta é a empresa padrão. Escolha outra como padrão antes de inativá-la."
            )
        return ativa


class EmpresaOpcaoSerializer(serializers.ModelSerializer):
    """A versão enxuta do seletor de CNPJ da proposta — o equivalente ao
    `FornecedorOpcaoSerializer` do Cotador.

    Com uma empresa só o seletor nem aparece na tela; o endpoint continua
    existindo porque é ele que diz isso para o frontend (uma opção = some)."""

    cnpj_formatado = serializers.CharField(read_only=True)
    porte_label = serializers.CharField(source="get_porte_display", read_only=True)

    class Meta:
        model = Empresa
        fields = ["id", "nome", "fantasia", "cnpj", "cnpj_formatado", "porte", "porte_label", "padrao"]
