"""
Regressão: sem `SECURE_PROXY_SSL_HEADER` (ver config/settings/base.py), o
Django não sabe que o Ingress (Traefik, ver k8s/ingress.yaml) já terminou o
TLS e repassou a requisição em HTTP puro — `request.is_secure()` dá `False`
mesmo em produção, e a verificação de `Origin` do CSRF (a única coisa que
protege `POST /api/auth/refresh/`, ver `views.py`) rejeita todo request
vindo do navegador em `https://` com "Origin checking failed". Era isso,
não o refresh token em si expirando, que derrubava a sessão a cada 15 min
(a cada renovação do `access`).

Testa direto `CsrfViewMiddleware._origin_verified` — é o método que compara
o header `Origin` do navegador contra `request.is_secure()` + `get_host()`
antes mesmo de olhar o token CSRF em si — porque é exatamente esse ponto
que o `SECURE_PROXY_SSL_HEADER` corrige. Passar pelo fluxo HTTP completo
exigiria também um cookie/token CSRF válido de verdade, o que testaria
outra coisa. `SimpleTestCase` de propósito: não precisa de banco.
"""

from __future__ import annotations

from django.middleware.csrf import CsrfViewMiddleware
from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase, override_settings

HOST = "licita.derla.com.br"


def _request_via_proxy_https():
    """Simula o que o Ingress entrega ao backend: HTTP puro, com o cabeçalho
    que o Traefik seta indicando que a origem era HTTPS."""
    return RequestFactory().post(
        "/api/auth/refresh/",
        HTTP_ORIGIN=f"https://{HOST}",
        HTTP_HOST=HOST,
    )


@override_settings(ALLOWED_HOSTS=[HOST])
class SecureProxySslHeaderTests(SimpleTestCase):
    @override_settings(SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"))
    def test_com_secure_proxy_ssl_header_aceita_origin_https_atras_do_proxy(self):
        request = _request_via_proxy_https()
        request.META["HTTP_X_FORWARDED_PROTO"] = "https"
        middleware = CsrfViewMiddleware(get_response=lambda r: HttpResponse())

        self.assertTrue(request.is_secure())
        self.assertTrue(middleware._origin_verified(request))

    @override_settings(SECURE_PROXY_SSL_HEADER=None)
    def test_sem_secure_proxy_ssl_header_rejeita_origin_https_atras_do_proxy(self):
        request = _request_via_proxy_https()
        request.META["HTTP_X_FORWARDED_PROTO"] = "https"
        middleware = CsrfViewMiddleware(get_response=lambda r: HttpResponse())

        self.assertFalse(request.is_secure())
        self.assertFalse(middleware._origin_verified(request))
