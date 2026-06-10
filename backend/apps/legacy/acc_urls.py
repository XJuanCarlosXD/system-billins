from django.urls import path
from apps.legacy import acc_views

urlpatterns = [
    path('cias/', acc_views.acc_cias),
    path('puntos/', acc_views.acc_puntos),
    path('cajas/', acc_views.acc_cajas),
    path('beneficiarios/', acc_views.acc_beneficiarios),
    path('tipos-bene/', acc_views.acc_tipos_bene),
    path('tipos-gasto/', acc_views.acc_tipos_gasto),
    path('documentos/', acc_views.acc_documentos),
    path('documentos/<str:no_cia>/<str:punto>/<str:no_docu>/', acc_views.acc_documento),
    path('documentos/crear/', acc_views.acc_documento_crear),
    path('documentos/anular/', acc_views.acc_documento_anular),
    path('reposiciones/', acc_views.acc_reposiciones),
    path('rep-resumen/', acc_views.acc_rep_resumen),
    path('rep-gastos-tipo/', acc_views.acc_rep_gastos_tipo),
]
