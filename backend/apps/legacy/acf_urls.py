from django.urls import path
from apps.legacy import acf_views
from apps.legacy.docs_print_data import acf_acta_print_data

urlpatterns = [
    path('activos/<str:no_activo>/print-data/', acf_acta_print_data),
    path('cias/', acf_views.acf_cias),
    path('puntos/', acf_views.acf_puntos),
    path('categorias/', acf_views.acf_categorias),
    path('grupos/', acf_views.acf_grupos),
    path('subgrupos/', acf_views.acf_subgrupos),
    path('marcas/', acf_views.acf_marcas),
    path('responsables/', acf_views.acf_responsables),
    path('departamentos/', acf_views.acf_departamentos),
    path('activos/', acf_views.acf_activos),
    path('activos/<str:no_cia>/<str:punto>/<str:no_activo>/', acf_views.acf_activo),
    path('rep-resumen/', acf_views.acf_rep_resumen),
    path('rep-por-grupo/', acf_views.acf_rep_por_grupo),
    path('rep-por-departamento/', acf_views.acf_rep_por_departamento),
    path('rep-valuacion/', acf_views.acf_rep_valuacion),
    path('compra/', acf_views.acf_compra),
    path('retiro/', acf_views.acf_retiro),
    path('depreciacion/preview/', acf_views.acf_depreciacion_preview),
    path('depreciacion/', acf_views.acf_depreciacion),
    path('cierre/status/', acf_views.acf_cierre_status),
    path('cierres/', acf_views.acf_cierres),
    path('cierre/', acf_views.acf_aplicar_cierre),
]
