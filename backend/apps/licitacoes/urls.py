from django.urls import path

from .views import CompraDetalheView, OportunidadesView

urlpatterns = [
    path("oportunidades/", OportunidadesView.as_view(), name="licitacoes-oportunidades"),
    path(
        "compras/<str:cnpj>/<int:ano>/<int:sequencial>/detalhe/",
        CompraDetalheView.as_view(),
        name="licitacoes-compra-detalhe",
    ),
]
