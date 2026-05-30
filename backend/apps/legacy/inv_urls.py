from django.urls import path
from apps.legacy import inv_views

urlpatterns = [
    # Existing
    path('productos/', inv_views.inv_productos),
    path('productos/<str:no_produ>/', inv_views.inv_producto),
    path('grupos/', inv_views.inv_grupos),
    path('grupos/<str:no_grupo>/', inv_views.inv_grupo_detail),
    path('lineas/', inv_views.inv_lineas),
    path('lineas/<str:linea>/', inv_views.inv_linea_detail),
    path('existencia/', inv_views.inv_existencias),
    path('movimientos/', inv_views.inv_movimientos),
    path('almacenes/', inv_views.inv_almacenes),
    path('almacenes/<str:almacen>/', inv_views.inv_almacen_detail),
    path('tipos-docu/', inv_views.inv_tipos_docu),
    path('tipos-docu/<str:tipo_docu>/', inv_views.inv_tdocu_detail),

    # New catalogues
    path('companias/', inv_views.inv_companias),
    path('companias/<str:no_cia>/', inv_views.inv_compania_detail),
    path('puntos/', inv_views.inv_puntos),
    path('puntos/<str:punto>/', inv_views.inv_punto_detail),
    path('unidades/', inv_views.inv_unidades),
    path('unidades/<str:unidad>/', inv_views.inv_unidad_detail),
    path('sublineas/', inv_views.inv_sublineas),
    path('sublineas/<str:sub_linea>/', inv_views.inv_sublinea_detail),
    path('referencias-empaque/', inv_views.inv_referencias),
    path('referencias-empaque/<str:referencia>/', inv_views.inv_referencia_detail),
    path('grupos-contables/', inv_views.inv_grupos_contables),
    path('grupos-contables/<str:grupo_contable>/', inv_views.inv_grupo_contable_detail),

    # Existencia por producto
    path('existencia/<str:no_produ>/', inv_views.inv_existencia_producto),

    # Movimientos por producto (Rinv304-style, con balance corrido)
    path('movimientos/<str:no_produ>/', inv_views.inv_movimientos_producto, name='inv_movimientos_producto'),

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

    # Cierre - Entrada de Diario
    path('cierre/entrada-diario/pdf/', inv_views.inv_cierre_entrada_diario_pdf),

    # Conteo Físico (FINV705)
    path('conteo-fisico/pendiente/',  inv_views.inv_conteo_fisico_pendiente),
    path('conteo-fisico/cargar/',     inv_views.inv_conteo_fisico_cargar),
    path('conteo-fisico/aplicar/',    inv_views.inv_conteo_fisico_aplicar),
    path('conteo-fisico/descartar/',  inv_views.inv_conteo_fisico_descartar),
    path('conteo-fisico/historico/',  inv_views.inv_conteo_fisico_historico),
]
