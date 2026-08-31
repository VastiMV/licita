from django.urls import path

from .views import CotacaoPlanilhaView, CotacaoView, CotacoesView, OportunidadeCotacaoView

urlpatterns = [
    path("cotacoes/", CotacoesView.as_view(), name="cotador-cotacoes"),
    path("cotacoes/<int:pk>/", CotacaoView.as_view(), name="cotador-cotacao"),
    path(
        "cotacoes/<int:pk>/planilha/",
        CotacaoPlanilhaView.as_view(),
        name="cotador-cotacao-planilha",
    ),
    path(
        "oportunidades/<int:pk>/cotacao/",
        OportunidadeCotacaoView.as_view(),
        name="cotador-oportunidade-cotacao",
    ),
]
