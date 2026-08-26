import base64
import json

from rest_framework.test import APIClient, APITestCase

from .models import User
from .views import REFRESH_COOKIE_NAME


def _payload(jwt: str) -> dict:
    parte = jwt.split(".")[1]
    parte += "=" * (-len(parte) % 4)
    return json.loads(base64.urlsafe_b64decode(parte))


class LoginViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="user@licita.dev", password="uma-senha-forte")

    def test_login_com_credenciais_certas_devolve_access_e_seta_cookie_refresh(self):
        response = self.client.post(
            "/api/auth/login/", {"email": "user@licita.dev", "password": "uma-senha-forte"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)  # refresh nunca no corpo

        cookie = response.cookies[REFRESH_COOKIE_NAME]
        self.assertTrue(cookie.value)
        self.assertEqual(cookie["httponly"], True)
        self.assertEqual(cookie["samesite"], "Lax")

    def test_login_embarca_email_e_nome_no_payload_do_access(self):
        self.user.nome = "Usuária de Teste"
        self.user.save()

        response = self.client.post(
            "/api/auth/login/", {"email": "user@licita.dev", "password": "uma-senha-forte"}
        )

        payload = _payload(response.data["access"])
        self.assertEqual(payload["email"], "user@licita.dev")
        self.assertEqual(payload["nome"], "Usuária de Teste")

    def test_login_com_senha_errada_devolve_401(self):
        response = self.client.post(
            "/api/auth/login/", {"email": "user@licita.dev", "password": "errada"}
        )

        self.assertEqual(response.status_code, 401)

    def test_login_de_usuario_inativo_devolve_401(self):
        self.user.is_active = False
        self.user.save()

        response = self.client.post(
            "/api/auth/login/", {"email": "user@licita.dev", "password": "uma-senha-forte"}
        )

        self.assertEqual(response.status_code, 401)


class RefreshViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="user@licita.dev", password="uma-senha-forte")

    def _login(self):
        return self.client.post(
            "/api/auth/login/", {"email": "user@licita.dev", "password": "uma-senha-forte"}
        )

    def test_refresh_sem_cookie_devolve_401(self):
        response = self.client.post("/api/auth/refresh/")

        self.assertEqual(response.status_code, 401)

    def test_refresh_com_cookie_valido_devolve_access_novo_e_rotaciona_o_cookie(self):
        login = self._login()
        refresh_antigo = login.cookies[REFRESH_COOKIE_NAME].value

        response = self.client.post("/api/auth/refresh/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        refresh_novo = response.cookies[REFRESH_COOKIE_NAME].value
        self.assertNotEqual(refresh_novo, refresh_antigo)

    def test_refresh_com_cookie_invalido_devolve_401_e_limpa_cookie(self):
        self.client.cookies[REFRESH_COOKIE_NAME] = "token-invalido"

        response = self.client.post("/api/auth/refresh/")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.cookies[REFRESH_COOKIE_NAME].value, "")

    def test_refresh_apos_logout_devolve_401_porque_foi_para_a_blacklist(self):
        login = self._login()
        access = login.data["access"]
        refresh_usado = login.cookies[REFRESH_COOKIE_NAME].value

        self.client.post("/api/auth/logout/", HTTP_AUTHORIZATION=f"Bearer {access}")

        # mesmo reapresentando o refresh que acabou de ser invalidado, ele já está na blacklist.
        self.client.cookies[REFRESH_COOKIE_NAME] = refresh_usado
        response = self.client.post("/api/auth/refresh/")

        self.assertEqual(response.status_code, 401)

    def test_refresh_exige_csrf_de_verdade_apesar_de_ser_apiview(self):
        client = APIClient(enforce_csrf_checks=True)
        client.post("/api/auth/login/", {"email": "user@licita.dev", "password": "uma-senha-forte"})

        # Sem o header X-CSRFToken, o CsrfViewMiddleware barra antes de chegar na view.
        response = client.post("/api/auth/refresh/")

        self.assertEqual(response.status_code, 403)

    def test_refresh_com_csrf_token_certo_funciona(self):
        client = APIClient(enforce_csrf_checks=True)
        client.post("/api/auth/login/", {"email": "user@licita.dev", "password": "uma-senha-forte"})
        csrftoken = client.cookies["csrftoken"].value

        response = client.post("/api/auth/refresh/", HTTP_X_CSRFTOKEN=csrftoken)

        self.assertEqual(response.status_code, 200)


class LogoutViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="user@licita.dev", password="uma-senha-forte")

    def test_logout_sem_token_devolve_401(self):
        response = self.client.post("/api/auth/logout/")

        self.assertEqual(response.status_code, 401)

    def test_logout_com_token_invalida_o_refresh_e_limpa_cookie(self):
        login = self.client.post(
            "/api/auth/login/", {"email": "user@licita.dev", "password": "uma-senha-forte"}
        )
        access = login.data["access"]

        response = self.client.post("/api/auth/logout/", HTTP_AUTHORIZATION=f"Bearer {access}")

        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.cookies[REFRESH_COOKIE_NAME].value, "")

        # o refresh que estava no cookie da sessão já foi para a blacklist
        refresh_response = self.client.post("/api/auth/refresh/")
        self.assertEqual(refresh_response.status_code, 401)
