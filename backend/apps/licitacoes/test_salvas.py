"""Testes dos endpoints de oportunidades salvas (`/api/licitacoes/salvas/`) e
do log que cada uma carrega — ver `models.py` para as duas regras que mais
aparecem aqui: a lista é compartilhada por todos os usuários, e remover é
lógico (o histórico sobrevive).
"""

from __future__ import annotations

import datetime as dt

from rest_framework.test import APITestCase

from apps.accounts.models import User

from .models import EventoOportunidadeSalva, OportunidadeSalva


def item(**overrides) -> dict:
    """Uma linha de `OportunidadeSerializer` — é exatamente o que o frontend
    manda de volta ao salvar (o resultado da busca daquele edital)."""

    base = {
        "numero_item": "1",
        "descricao_resumida": "Café torrado e moído",
        "descricao_detalhada": "Pacote de 500g, embalagem a vácuo",
        "quantidade": 100.0,
        "unidade_medida": "PACOTE",
        "valor_unitario_estimado": 18.5,
        "valor_total": 1850.0,
        "tipo_beneficio": "ME/EPP",
        "criterio_julgamento": "Menor preço",
        "situacao_item": "Divulgada",
        "contratacao_uf": "SP",
        "contratacao_modalidade": "Pregão Eletrônico",
        "contratacao_srp": False,
        "contratacao_situacao": "Divulgada no PNCP",
        "contratacao_data_publicacao": "2026-08-20",
        "contratacao_data_encerramento_proposta": "2026-09-10",
        "contratacao_orgao_nome": "Prefeitura de Campinas",
        "contratacao_municipio": "Campinas",
        "contratacao_uasg": "925997",
        "contratacao_objeto": "Aquisição de café e açúcar para as unidades",
        "contratacao_cnpj_orgao": "12345678000199",
        "contratacao_ano_compra": "2026",
        "contratacao_sequencial_compra": "42",
        "plataforma_id": "compras_gov",
        "link_plataforma": "https://compras.gov.br/compra/1",
        "link_pncp": "https://pncp.gov.br/app/editais/12345678000199/2026/42",
        "capag": None,
    }
    return {**base, **overrides}


def payload(itens=None, **extras) -> dict:
    return {"itens": itens or [item()], **extras}


class OportunidadesSalvasTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="user@licita.dev", password="uma-senha-forte", nome="Gustavo"
        )
        self.colega = User.objects.create_user(email="colega@licita.dev", password="outra-senha")
        self.client.force_authenticate(self.user)

    def test_sem_autenticacao_e_negado(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/licitacoes/salvas/").status_code, 401)
        self.assertEqual(self.client.post("/api/licitacoes/salvas/", payload(), format="json").status_code, 401)

    def test_salvar_deriva_o_resumo_da_lista_a_partir_dos_itens(self):
        response = self.client.post("/api/licitacoes/salvas/", payload(), format="json")

        self.assertEqual(response.status_code, 201)
        salva = OportunidadeSalva.objects.get()
        self.assertEqual(salva.chave, "12345678000199-2026-42")
        self.assertEqual(salva.objeto, "Aquisição de café e açúcar para as unidades")
        self.assertEqual(salva.municipio, "Campinas")
        self.assertEqual(salva.uf, "SP")
        self.assertEqual(salva.modalidade, "Pregão Eletrônico")
        self.assertEqual(salva.data_publicacao, dt.date(2026, 8, 20))
        self.assertEqual(salva.data_encerramento_proposta, dt.date(2026, 9, 10))
        self.assertEqual(float(salva.valor_total_estimado), 1850.0)
        self.assertEqual(salva.salva_por, self.user)
        # Snapshot: o modal de visualização desenha o card com isto, sem
        # voltar na origem.
        self.assertEqual(salva.itens, payload()["itens"])

    def test_valor_estimado_e_a_soma_dos_itens_e_fica_nulo_se_algum_nao_tiver_valor(self):
        self.client.post(
            "/api/licitacoes/salvas/",
            payload([item(), item(numero_item="2", valor_total=150.0)]),
            format="json",
        )
        self.assertEqual(float(OportunidadeSalva.objects.get().valor_total_estimado), 2000.0)

        OportunidadeSalva.objects.all().delete()
        self.client.post(
            "/api/licitacoes/salvas/",
            payload([item(), item(numero_item="2", valor_total=None)]),
            format="json",
        )
        self.assertIsNone(OportunidadeSalva.objects.get().valor_total_estimado)

    def test_plataforma_do_detalhe_tem_prioridade_sobre_o_palpite_da_busca(self):
        self.client.post(
            "/api/licitacoes/salvas/",
            payload(plataforma={"id": "compras_gov", "nome": "Compras.gov.br", "link": "https://x/y"}),
            format="json",
        )

        salva = OportunidadeSalva.objects.get()
        self.assertEqual(salva.plataforma_nome, "Compras.gov.br")
        self.assertEqual(salva.link_plataforma, "https://x/y")

    def test_salvar_sem_identificacao_da_compra_e_400(self):
        response = self.client.post(
            "/api/licitacoes/salvas/",
            payload([item(contratacao_sequencial_compra=None)]),
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(OportunidadeSalva.objects.exists())

    def test_salvar_a_mesma_compra_de_novo_e_idempotente_e_nao_polui_o_log(self):
        primeira = self.client.post("/api/licitacoes/salvas/", payload(), format="json")
        segunda = self.client.post("/api/licitacoes/salvas/", payload(), format="json")

        self.assertEqual(segunda.status_code, 200)
        self.assertEqual(segunda.data["id"], primeira.data["id"])
        self.assertEqual(OportunidadeSalva.objects.count(), 1)
        self.assertEqual(EventoOportunidadeSalva.objects.filter(tipo="salva").count(), 1)

    def test_a_lista_e_de_todos_os_usuarios_nao_de_quem_salvou(self):
        self.client.post("/api/licitacoes/salvas/", payload(), format="json")

        self.client.force_authenticate(self.colega)
        response = self.client.get("/api/licitacoes/salvas/")

        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["salva_por"], "Gustavo")

    def test_lista_traz_expirada_calculada_e_o_total_de_expiradas(self):
        hoje = dt.date.today()
        self.client.post(
            "/api/licitacoes/salvas/",
            payload([item(contratacao_data_encerramento_proposta=str(hoje - dt.timedelta(days=1)))]),
            format="json",
        )
        self.client.post(
            "/api/licitacoes/salvas/",
            payload(
                [
                    item(
                        contratacao_sequencial_compra="43",
                        contratacao_data_encerramento_proposta=str(hoje + dt.timedelta(days=5)),
                    )
                ]
            ),
            format="json",
        )

        response = self.client.get("/api/licitacoes/salvas/")

        self.assertEqual(response.data["count"], 2)
        self.assertEqual(response.data["expiradas"], 1)
        expiradas = [linha["expirada"] for linha in response.data["results"]]
        self.assertEqual(sorted(expiradas), [False, True])

    def test_sem_prazo_publicado_a_oportunidade_nunca_expira(self):
        self.client.post(
            "/api/licitacoes/salvas/",
            payload([item(contratacao_data_encerramento_proposta=None)]),
            format="json",
        )

        response = self.client.get("/api/licitacoes/salvas/")

        self.assertEqual(response.data["expiradas"], 0)
        self.assertFalse(response.data["results"][0]["expirada"])

    def test_busca_casa_no_objeto_e_na_descricao_dos_itens_sem_acento(self):
        self.client.post("/api/licitacoes/salvas/", payload(), format="json")
        self.client.post(
            "/api/licitacoes/salvas/",
            payload(
                [
                    item(
                        contratacao_sequencial_compra="99",
                        contratacao_objeto="Contratação de serviço de limpeza",
                        descricao_resumida="Limpeza predial",
                        descricao_detalhada="Equipe com 4 postos",
                    )
                ]
            ),
            format="json",
        )

        por_objeto = self.client.get("/api/licitacoes/salvas/", {"busca": "limpeza"})
        self.assertEqual(por_objeto.data["count"], 1)
        self.assertEqual(por_objeto.data["results"][0]["sequencial_compra"], "99")

        # "cafe" (sem acento, na descrição do item) acha "Café torrado".
        por_item = self.client.get("/api/licitacoes/salvas/", {"busca": "cafe"})
        self.assertEqual(por_item.data["count"], 1)
        self.assertEqual(por_item.data["results"][0]["sequencial_compra"], "42")

        # A busca não mexe no aviso de expiradas — ele é sempre do total.
        self.assertEqual(por_item.data["expiradas"], 0)

    def test_ordenacao_por_coluna_da_tabela_e_coluna_desconhecida_cai_no_padrao(self):
        self.client.post(
            "/api/licitacoes/salvas/",
            payload([item(contratacao_uasg="925997", contratacao_objeto="Zíper industrial")]),
            format="json",
        )
        self.client.post(
            "/api/licitacoes/salvas/",
            payload(
                [
                    item(
                        contratacao_sequencial_compra="43",
                        contratacao_uasg="110161",
                        contratacao_objeto="Areia lavada",
                    )
                ]
            ),
            format="json",
        )

        crescente = self.client.get("/api/licitacoes/salvas/", {"ordering": "uasg"})
        self.assertEqual(
            [linha["uasg"] for linha in crescente.data["results"]], ["110161", "925997"]
        )

        decrescente = self.client.get("/api/licitacoes/salvas/", {"ordering": "-uasg"})
        self.assertEqual(
            [linha["uasg"] for linha in decrescente.data["results"]], ["925997", "110161"]
        )

        # Padrão: mais recentes primeiro, sem 400 por coluna inventada (nem
        # por uma que deixou de ser coluna da tabela, como "descricao").
        for ordering in ("coluna-que-nao-existe", "descricao"):
            padrao = self.client.get("/api/licitacoes/salvas/", {"ordering": ordering})
            self.assertEqual(padrao.status_code, 200)
            self.assertEqual(padrao.data["results"][0]["objeto"], "Areia lavada")

    def test_paginacao_integra_com_o_paginador_da_tabela(self):
        for sequencial in range(1, 4):
            self.client.post(
                "/api/licitacoes/salvas/",
                payload([item(contratacao_sequencial_compra=str(sequencial))]),
                format="json",
            )

        pagina = self.client.get("/api/licitacoes/salvas/", {"page_size": 2, "page": 2})

        self.assertEqual(pagina.data["count"], 3)
        self.assertEqual(len(pagina.data["results"]), 1)

    def test_chaves_deixa_a_busca_saber_o_que_ja_esta_salvo(self):
        self.client.post("/api/licitacoes/salvas/", payload(), format="json")

        response = self.client.get("/api/licitacoes/salvas/chaves/")

        self.assertEqual(response.data["chaves"], ["12345678000199-2026-42"])

    def test_excluir_tira_da_lista_mas_o_registro_e_o_log_continuam(self):
        salva_id = self.client.post("/api/licitacoes/salvas/", payload(), format="json").data["id"]

        response = self.client.delete(f"/api/licitacoes/salvas/{salva_id}/")

        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.client.get("/api/licitacoes/salvas/").data["count"], 0)
        self.assertEqual(self.client.get("/api/licitacoes/salvas/chaves/").data["chaves"], [])
        salva = OportunidadeSalva.objects.get(pk=salva_id)
        self.assertIsNotNone(salva.removida_em)
        self.assertEqual(salva.removida_por, self.user)

    def test_excluir_duas_vezes_e_404(self):
        salva_id = self.client.post("/api/licitacoes/salvas/", payload(), format="json").data["id"]
        self.client.delete(f"/api/licitacoes/salvas/{salva_id}/")

        self.assertEqual(self.client.delete(f"/api/licitacoes/salvas/{salva_id}/").status_code, 404)

    def test_salvar_de_novo_depois_de_excluir_cria_um_registro_novo_com_log_proprio(self):
        primeira = self.client.post("/api/licitacoes/salvas/", payload(), format="json").data["id"]
        self.client.delete(f"/api/licitacoes/salvas/{primeira}/")

        segunda = self.client.post("/api/licitacoes/salvas/", payload(), format="json")

        self.assertEqual(segunda.status_code, 201)
        self.assertNotEqual(segunda.data["id"], primeira)
        self.assertEqual(OportunidadeSalva.objects.count(), 2)
        self.assertEqual(
            EventoOportunidadeSalva.objects.filter(oportunidade_id=segunda.data["id"]).count(), 1
        )

    def test_excluir_expiradas_de_uma_vez_remove_so_as_vencidas(self):
        hoje = dt.date.today()
        for sequencial, prazo in (("1", hoje - dt.timedelta(days=2)), ("2", hoje + dt.timedelta(days=2))):
            self.client.post(
                "/api/licitacoes/salvas/",
                payload(
                    [
                        item(
                            contratacao_sequencial_compra=sequencial,
                            contratacao_data_encerramento_proposta=str(prazo),
                        )
                    ]
                ),
                format="json",
            )

        response = self.client.delete("/api/licitacoes/salvas/expiradas/")

        self.assertEqual(response.data["removidas"], 1)
        lista = self.client.get("/api/licitacoes/salvas/")
        self.assertEqual(lista.data["count"], 1)
        self.assertEqual(lista.data["expiradas"], 0)
        self.assertEqual(lista.data["results"][0]["sequencial_compra"], "2")


class HistoricoTests(APITestCase):
    """O log — ver docs/DOMINIO.md, "Histórico da oportunidade salva". A tela
    que lê isso ainda não existe; o que se garante aqui é que a história é
    escrita no momento certo e sobrevive à exclusão."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="user@licita.dev", password="uma-senha-forte", nome="Gustavo"
        )
        self.client.force_authenticate(self.user)

    def test_salvar_abre_o_historico_com_quem_salvou(self):
        salva_id = self.client.post("/api/licitacoes/salvas/", payload(), format="json").data["id"]

        historico = self.client.get(f"/api/licitacoes/salvas/{salva_id}/eventos/")

        self.assertEqual(historico.data["chave"], "12345678000199-2026-42")
        self.assertEqual(historico.data["resumo"], "Aquisição de café e açúcar para as unidades")
        self.assertEqual(historico.data["salva_por"], "Gustavo")
        self.assertEqual(len(historico.data["eventos"]), 1)
        evento = historico.data["eventos"][0]
        self.assertEqual(evento["tipo"], "salva")
        self.assertEqual(evento["autor"], "Gustavo")
        self.assertIn("Gustavo", evento["descricao"])

    def test_prazo_vencido_vira_uma_linha_do_historico_uma_vez_so(self):
        ontem = dt.date.today() - dt.timedelta(days=1)
        salva_id = self.client.post(
            "/api/licitacoes/salvas/",
            payload([item(contratacao_data_encerramento_proposta=str(ontem))]),
            format="json",
        ).data["id"]

        # Duas aberturas da lista não podem gerar duas linhas iguais.
        self.client.get("/api/licitacoes/salvas/")
        self.client.get("/api/licitacoes/salvas/")

        eventos = self.client.get(f"/api/licitacoes/salvas/{salva_id}/eventos/").data["eventos"]
        vencidos = [e for e in eventos if e["tipo"] == "prazo_vencido"]
        self.assertEqual(len(vencidos), 1)
        # Evento do sistema: sem autor.
        self.assertIsNone(vencidos[0]["autor"])
        self.assertIn(ontem.strftime("%d/%m/%Y"), vencidos[0]["descricao"])

    def test_remover_fecha_o_historico_dizendo_quem_removeu(self):
        salva_id = self.client.post("/api/licitacoes/salvas/", payload(), format="json").data["id"]
        self.client.delete(f"/api/licitacoes/salvas/{salva_id}/")

        historico = self.client.get(f"/api/licitacoes/salvas/{salva_id}/eventos/")

        self.assertIsNotNone(historico.data["removida_em"])
        tipos = [e["tipo"] for e in historico.data["eventos"]]
        self.assertEqual(tipos, ["salva", "removida"])
        self.assertIn("Gustavo", historico.data["eventos"][-1]["descricao"])

    def test_historico_guarda_espaco_para_o_que_ainda_nao_existe(self):
        """O módulo de propostas não existe, mas o log já sabe registrar uma
        (com o link para abrir) — é o formato que a tela de histórico vai
        ler, sem migração nova quando a funcionalidade chegar."""

        salva_id = self.client.post("/api/licitacoes/salvas/", payload(), format="json").data["id"]
        OportunidadeSalva.objects.get(pk=salva_id).registrar(
            EventoOportunidadeSalva.Tipo.PROPOSTA_GERADA,
            autor=self.user,
            descricao="Proposta gerada por Gustavo.",
            dados={"proposta_id": 7},
        )

        eventos = self.client.get(f"/api/licitacoes/salvas/{salva_id}/eventos/").data["eventos"]

        self.assertEqual(eventos[-1]["tipo"], "proposta_gerada")
        self.assertEqual(eventos[-1]["tipo_label"], "Proposta gerada")
        self.assertEqual(eventos[-1]["dados"], {"proposta_id": 7})
