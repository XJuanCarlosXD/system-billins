from django.urls import path

from . import views

urlpatterns = [
    path("reportes/", views.ReportesView.as_view()),
    path("reportes/<str:reporte_id>/", views.ReporteDetailView.as_view()),
    path(
        "reportes/<str:reporte_id>/imagen/<str:imagen_id>/",
        views.ReporteImagenView.as_view(),
    ),
]
