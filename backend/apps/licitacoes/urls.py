from django.urls import path

from .views import OportunidadesView

urlpatterns = [
    path("oportunidades/", OportunidadesView.as_view(), name="licitacoes-oportunidades"),
]
