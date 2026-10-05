from django.urls import path

from . import views

urlpatterns = [
    path("", views.PropostasView.as_view(), name="propostas"),
    path("modelo/", views.ModeloView.as_view(), name="propostas-modelo"),
    path("modelo/download/", views.ModeloDownloadView.as_view(), name="propostas-modelo-download"),
    path("arquivos/<int:pk>/", views.ArquivoView.as_view(), name="propostas-arquivo"),
    path(
        "arquivos/<int:pk>/download/",
        views.ArquivoDownloadView.as_view(),
        name="propostas-arquivo-download",
    ),
    path("<int:pk>/", views.PropostaView.as_view(), name="proposta"),
    path("<int:pk>/documento/", views.DocumentoView.as_view(), name="proposta-documento"),
    path("<int:pk>/arquivos/", views.ArquivosView.as_view(), name="proposta-arquivos"),
]
