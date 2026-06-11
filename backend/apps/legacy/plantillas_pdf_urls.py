from django.urls import path

from .plantillas_pdf_views import (
    plantillas_list, plantilla_detail,
    plantilla_historial, plantilla_rollback,
)

urlpatterns = [
    path('plantillas-pdf/', plantillas_list),
    path('plantillas-pdf/<str:codigo_doc>/', plantilla_detail),
    path('plantillas-pdf/<str:codigo_doc>/historial/', plantilla_historial),
    path('plantillas-pdf/<str:codigo_doc>/rollback/', plantilla_rollback),
]
