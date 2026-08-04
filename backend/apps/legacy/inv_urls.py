from django.urls import path
from apps.legacy import inv_views
from apps.legacy.inv_views_print_data import (
    inv_documento_print_data, inv_existencia_print_data,
    inv_movimientos_print_data, inv_kardex_print_data,
    inv_valorizacion_print_data, inv_cierre_entrada_print_data,
)

urlpatterns = [
    # Existing
    path('productos/', inv_views.inv_productos),
    path('productos/next-codigo/', inv_views.inv_producto_next_codigo),
    path('productos/<str:no_produ>/asignaciones/', inv_views.inv_producto_asignaciones),
    path('asignar-producto-almacen/', inv_views.inv_asignar_producto_almacen),
    path('productos/<str:no_produ>/empaques-mant/', inv_views.inv_producto_empaques),
    path('productos/<str:no_produ>/', inv_views.inv_producto),
    path('grupos/', inv_views.inv_grupos),
    path('grupos/<str:no_grupo>/', inv_views.inv_grupo_detail),
    path('lineas/', inv_views.inv_lineas),
    path('lineas/<str:linea>/', inv_views.inv_linea_detail),
    path('existencia/', inv_views.inv_existencias),
    path('movimientos/', inv_views.inv_movimientos),
    # Compatibilidad con la primera UI de Entrada de Compras.
    path('entradas/', inv_views.inv_movimientos),
    path('movimientos/reversar/', inv_views.inv_reversar_documento),
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
    path('documentos/<str:tipo_docu>/<str:no_docu>/print-data/', inv_documento_print_data),

    # Kardex & Valorización
    path('kardex/', inv_views.inv_kardex),
    path('valorizacion/', inv_views.inv_valorizacion),

    # print-data (frontend Puck templates) — reemplazan los renderers ReportLab
    path('reportes/existencia/print-data/', inv_existencia_print_data),
    path('reportes/movimientos/print-data/', inv_movimientos_print_data),
    path('reportes/kardex/print-data/', inv_kardex_print_data),
    path('reportes/valorizacion/print-data/', inv_valorizacion_print_data),
    path('cierre/entrada-diario/print-data/', inv_cierre_entrada_print_data),

    # Cierre Mensual (Finv402 + Finv403)
    path('cierres/', inv_views.inv_cierres),
    path('cierre/generar-asiento/', inv_views.inv_cierre_generar_asiento),
    path('cierre/mensual/', inv_views.inv_cierre_mensual),

    # Conteo Físico (FINV705)
    path('conteo-fisico/pendiente/',  inv_views.inv_conteo_fisico_pendiente),
    path('conteo-fisico/cargar/',     inv_views.inv_conteo_fisico_cargar),
    path('conteo-fisico/aplicar/',    inv_views.inv_conteo_fisico_aplicar),
    path('conteo-fisico/descartar/',  inv_views.inv_conteo_fisico_descartar),
    path('conteo-fisico/historico/',  inv_views.inv_conteo_fisico_historico),
]
