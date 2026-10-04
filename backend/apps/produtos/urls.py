from django.urls import path

from . import views

urlpatterns = [
    path("fabricantes/", views.FabricantesView.as_view(), name="produtos-fabricantes"),
    path(
        "fabricantes/opcoes/",
        views.FabricantesOpcoesView.as_view(),
        name="produtos-fabricantes-opcoes",
    ),
    path("fabricantes/<int:pk>/", views.FabricanteView.as_view(), name="produtos-fabricante"),
    path("marcas/", views.MarcasView.as_view(), name="produtos-marcas"),
    path("marcas/opcoes/", views.MarcasOpcoesView.as_view(), name="produtos-marcas-opcoes"),
    path("marcas/<int:pk>/", views.MarcaView.as_view(), name="produtos-marca"),
    path("modelos/", views.ModelosView.as_view(), name="produtos-modelos"),
    path("modelos/opcoes/", views.ModelosOpcoesView.as_view(), name="produtos-modelos-opcoes"),
    path("modelos/<int:pk>/", views.ModeloView.as_view(), name="produtos-modelo"),
    path("precos/sugerido/", views.PrecoSugeridoView.as_view(), name="produtos-preco-sugerido"),
]
