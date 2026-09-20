"""O registro de drivers — a peça que faz o armazenamento ser plugin.

Sem banco: é dicionário e classe.
"""

from __future__ import annotations

from django.test import SimpleTestCase

from .base import CampoConfig, ErroArmazenamento
from .registro import driver, drivers, registrar


class DriverFalso:
    CHAVE = "falso-de-teste"
    ROTULO = "Driver de teste"
    CAMPOS = (CampoConfig(nome="bucket", rotulo="Bucket"),)


class RegistroTests(SimpleTestCase):
    def setUp(self):
        registrar(DriverFalso)
        self.addCleanup(lambda: drivers().pop(DriverFalso.CHAVE, None))

    def test_registrar_torna_o_driver_recuperavel_pela_chave(self):
        self.assertIs(driver("falso-de-teste"), DriverFalso)

    def test_driver_desconhecido_diz_o_que_existe(self):
        with self.assertRaises(ErroArmazenamento) as erro:
            driver("dropbox")

        self.assertIn("não está instalado", str(erro.exception))
        self.assertIn("r2", str(erro.exception))

    def test_os_drivers_da_caixa_vem_registrados(self):
        # O `ready()` do app registra os dois que acompanham o produto —
        # é o que faz o seletor da tela ter o que mostrar sem configuração.
        self.assertIn("r2", drivers())
        self.assertIn("s3", drivers())
        self.assertIn("local", drivers())

    def test_todo_driver_declara_os_campos_que_precisa(self):
        # É o contrato que permite à tela desenhar o formulário sozinha.
        for chave, classe in drivers().items():
            with self.subTest(driver=chave):
                self.assertTrue(classe.ROTULO, "driver sem rótulo não aparece direito no seletor")
                self.assertTrue(
                    all(isinstance(campo, CampoConfig) for campo in classe.CAMPOS),
                    "CAMPOS tem que ser uma tupla de CampoConfig",
                )
