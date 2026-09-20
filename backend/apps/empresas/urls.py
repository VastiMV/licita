from django.urls import path

from .views import EmpresasOpcoesView, EmpresasView, EmpresaView

urlpatterns = [
    path("", EmpresasView.as_view(), name="empresas"),
    # Antes de <int:pk> por clareza (não conflitam: "opcoes" não casa com int).
    path("opcoes/", EmpresasOpcoesView.as_view(), name="empresas-opcoes"),
    path("<int:pk>/", EmpresaView.as_view(), name="empresa"),
]
