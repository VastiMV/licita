from django.urls import path

from .views import (
    CompraDetalheView,
    OportunidadeSalvaEventosView,
    OportunidadeSalvaView,
    OportunidadesSalvasChavesView,
    OportunidadesSalvasExpiradasView,
    OportunidadesSalvasView,
    OportunidadesView,
)

urlpatterns = [
    path("oportunidades/", OportunidadesView.as_view(), name="licitacoes-oportunidades"),
    path(
        "compras/<str:cnpj>/<int:ano>/<int:sequencial>/detalhe/",
        CompraDetalheView.as_view(),
        name="licitacoes-compra-detalhe",
    ),
    # Salvas — as rotas de nome fixo vêm antes da de <int:pk> por clareza
    # (não conflitam: "chaves"/"expiradas" não casam com <int:pk>).
    path("salvas/", OportunidadesSalvasView.as_view(), name="licitacoes-salvas"),
    path("salvas/chaves/", OportunidadesSalvasChavesView.as_view(), name="licitacoes-salvas-chaves"),
    path(
        "salvas/expiradas/",
        OportunidadesSalvasExpiradasView.as_view(),
        name="licitacoes-salvas-expiradas",
    ),
    path("salvas/<int:pk>/", OportunidadeSalvaView.as_view(), name="licitacoes-salva"),
    path(
        "salvas/<int:pk>/eventos/",
        OportunidadeSalvaEventosView.as_view(),
        name="licitacoes-salva-eventos",
    ),
]
