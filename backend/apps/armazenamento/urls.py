from django.urls import path

from .views import ConfigView, DownloadLocalView, DriversView, TestarView

urlpatterns = [
    path("drivers/", DriversView.as_view(), name="armazenamento-drivers"),
    path("config/", ConfigView.as_view(), name="armazenamento-config"),
    path("testar/", TestarView.as_view(), name="armazenamento-testar"),
    path("local/<str:token>/", DownloadLocalView.as_view(), name="armazenamento-local-download"),
]
