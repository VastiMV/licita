from django.urls import path

from .views_usuarios import UsuarioView, UsuariosView

urlpatterns = [
    path("", UsuariosView.as_view(), name="usuarios"),
    path("<int:pk>/", UsuarioView.as_view(), name="usuario"),
]
