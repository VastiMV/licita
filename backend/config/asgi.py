"""
ASGI config do projeto Licita — servido por Daphne (ver INSTALLED_APPS em
settings/base.py e docs/ARQUITETURA.md).

`http` roteia para a aplicação Django normal (views síncronas e `async def`
convivem sem problema). `websocket` está vazio por enquanto — nenhum
consumer existe ainda; o roteador fica pronto para quando o primeiro
precisar (ex.: status de sincronização do catálogo em tempo real).
"""

import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AuthMiddlewareStack(URLRouter([])),
    }
)
