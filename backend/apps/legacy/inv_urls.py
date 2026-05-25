from django.urls import path
from apps.legacy import inv_views

urlpatterns = [
    # Existing
    path('productos/', inv_views.inv_productos),
    path('productos/<str:no_produ>/', inv_views.inv_producto),
    path('grupos/', inv_views.inv_grupos),
    path('lineas/', inv_views.inv_lineas),
    path('existencia/', inv_views.inv_existencias),
    path('movimientos/', inv_views.inv_movimientos),
    path('almacenes/', inv_views.inv_almacenes),
    path('tipos-docu/', inv_views.inv_tipos_docu),

    # New catalogues
    path('companias/', inv_views.inv_companias),
    path('puntos/', inv_views.inv_puntos),
    path('unidades/', inv_views.inv_unidades),
    path('sublineas/', inv_views.inv_sublineas),

    # Existencia por producto
    path('existencia/<str:no_produ>/', inv_views.inv_existencia_producto),

    # Documentos
    path('documentos/', inv_views.inv_consulta_documentos),
    path('documentos/<str:tipo_docu>/<str:no_docu>/', inv_views.inv_documento_detalle),
    path('documentos/<str:tipo_docu>/<str:no_docu>/pdf/', inv_views.inv_documento_pdf),

    # Kardex & Valorización
    path('kardex/', inv_views.inv_kardex),
    path('valorizacion/', inv_views.inv_valorizacion),

    # PDF Reports
    path('reportes/existencia/pdf/', inv_views.inv_reporte_existencia_pdf),
    path('reportes/movimientos/pdf/', inv_views.inv_reporte_movimientos_pdf),
    path('reportes/kardex/pdf/', inv_views.inv_reporte_kardex_pdf),
    path('reportes/valorizacion/pdf/', inv_views.inv_reporte_valorizacion_pdf),
]
