from django.urls import path

from .views import (
    DocumentosView,
    DocumentoView,
    DownloadView,
    EventosView,
    RestaurarView,
    TiposView,
    VersoesView,
)

urlpatterns = [
    path("", DocumentosView.as_view(), name="documentos"),
    # Antes de <int:pk> por clareza (não conflitam: não casam com int).
    path("tipos/", TiposView.as_view(), name="documentos-tipos"),
    path("versoes/<int:pk>/download/", DownloadView.as_view(), name="documento-download"),
    path("<int:pk>/", DocumentoView.as_view(), name="documento"),
    path("<int:pk>/restaurar/", RestaurarView.as_view(), name="documento-restaurar"),
    path("<int:pk>/versoes/", VersoesView.as_view(), name="documento-versoes"),
    path("<int:pk>/eventos/", EventosView.as_view(), name="documento-eventos"),
]
