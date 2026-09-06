from django.urls import path

from .views import FornecedoresOpcoesView, FornecedoresView, FornecedorView

urlpatterns = [
    path("", FornecedoresView.as_view(), name="fornecedores"),
    # Antes de <int:pk> por clareza (não conflitam: "opcoes" não casa com int).
    path("opcoes/", FornecedoresOpcoesView.as_view(), name="fornecedores-opcoes"),
    path("<int:pk>/", FornecedorView.as_view(), name="fornecedor"),
]
