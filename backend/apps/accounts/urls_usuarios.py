from django.urls import path

from .views_usuarios import PerfilView, UsuarioView, UsuariosView

urlpatterns = [
    path("", UsuariosView.as_view(), name="usuarios"),
    path("eu/", PerfilView.as_view(), name="perfil"),
    path("<int:pk>/", UsuarioView.as_view(), name="usuario"),
]
