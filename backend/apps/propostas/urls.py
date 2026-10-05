from django.urls import path

from . import views

urlpatterns = [
    path("", views.PropostasView.as_view(), name="propostas"),
]
