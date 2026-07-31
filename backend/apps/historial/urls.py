from django.urls import path

from . import views

urlpatterns = [
    path("historial/mio/", views.MiActividadView.as_view()),
    path("historial/documento/", views.HistorialDocumentoView.as_view()),
    path("historial/", views.HistorialAdminView.as_view()),
]
