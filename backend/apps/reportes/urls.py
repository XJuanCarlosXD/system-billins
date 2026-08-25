from django.urls import path

from . import views

urlpatterns = [
    path("reportes/", views.ReportesView.as_view()),
    path("reportes/error-log/", views.ErrorLogView.as_view()),
    path("reportes/agente/lanzar/", views.AgenteLanzarView.as_view()),
    path("reportes/agente/estado/", views.AgenteEstadoView.as_view()),
    path("reportes/agente/pendiente/", views.AgentePendienteView.as_view()),
    path("reportes/agente/resultado/", views.AgenteResultadoView.as_view()),
    path("reportes/<str:reporte_id>/", views.ReporteDetailView.as_view()),
    path(
        "reportes/<str:reporte_id>/imagen/<str:imagen_id>/",
        views.ReporteImagenView.as_view(),
    ),
]
