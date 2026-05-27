import { useEffect, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import {
  ArchiveX,
  ArrowLeft,
  BarChart2,
  BookOpenCheck,
  Box,
  Building2,
  Calculator,
  ClipboardList,
  FileBarChart,
  FileSpreadsheet,
  Layers,
  Package,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Printer,
  RefreshCcw,
  RotateCcw,
  Scale,
  Search,
  Settings2,
  ShoppingCart,
  Tag,
  Truck,
  Wrench,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useCompany } from '@/context/company-context'
import { Almacenes } from './almacenes'
import { AsignarProductoAlmacen } from './asignar-producto-almacen'
import { EstantesTramos } from './estantes-tramos'
import { GrupoContable } from './grupo-contable'
import { MinimosMaximos } from './minimos-maximos'
import { ModificarCosto } from './modificar-costo'
import { ReferenciaEmpaque } from './referencia-empaque'
import { CatalogoProductos } from './catalogo-productos'
import { CompaniasInv } from './companias'
import { ConsultaDocumentos } from './consulta-documentos'
import { EntradaMercancia } from './entrada-mercancia'
import { ExistenciaProducto } from './existencia-producto'
import { GruposProductos } from './grupos'
import { ImpresionDocumentos } from './impresion-documentos'
import { LineasProductos } from './lineas'
import { PuntosTrabajoInv } from './puntos-trabajo'
import { ReportesParametros } from './reportes-parametros'
import { ReverarDocumento } from './reversar-documento'
import { SalidaMercancia } from './salida-mercancia'
import { SubLineasProductos } from './sublineas'
import { TiposDocumento } from './tipos-documento'
import { UnidadesMedida } from './unidades'
// Procesos
import { EntradaCompras } from './entrada-compras'
import { TransferenciaMercancia } from './transferencia-mercancia'
import { DevolucionSuplidores } from './devolucion-suplidores'
import { DevolucionVentas } from './devolucion-ventas'
// Consultas
import { ExistenciaGrupo } from './existencia-grupo'
// Conteo Físico
import { ConteoFisicoReportes } from './cf-reportes'
import { CargarConteoExcel } from './cf-cargar-excel'
import { ConteoFisicoManual } from './cf-entrada-manual'
import { ComparativoFisico } from './cf-comparativo'
import { AjusteConteoFisico } from './cf-ajuste'
// Cierre
import { CierreEntradaDiario } from './cierre-entrada-diario'
import { CierreAsiento } from './cierre-asiento'
import { CierreMensual } from './cierre-mensual'

type SectionKey = 'configuracion' | 'procesos' | 'consultas' | 'reportes' | 'conteo-fisico' | 'cierre'

type ViewKey =
  | 'companias'
  | 'puntos-trabajo'
  | 'acceso-usuarios'
  | 'almacenes'
  | 'tipos-documentos'
  | 'grupo-productos'
  | 'linea-productos'
  | 'sublinea-productos'
  | 'grupo-contable'
  | 'unidades-empaque'
  | 'referencia-empaque'
  | 'marca-producto'
  | 'productos'
  | 'crear-excel'
  | 'asignar-prod-cia'
  | 'activar-prod-almacen'
  | 'modificar-costo'
  | 'ensamblar-productos'
  | 'minimo-maximo'
  | 'estantes-tramos'
  | 'envases-retornables'
  | 'entrada-compras'
  | 'entrada-mercancia'
  | 'salida-mercancia'
  | 'transferencia-mercancia'
  | 'entrada-produccion'
  | 'despacho-cotizacion'
  | 'salida-ensamblados'
  | 'devolucion-suplidores'
  | 'devolucion-ventas'
  | 'reversar-documento'
  | 'impresion-documentos'
  | 'listado-recepcion-resumen'
  | 'listado-recepcion-detalle'
  | 'listado-doc-asiento'
  | 'asignar-series'
  | 'consulta-documentos'
  | 'existencia-producto'
  | 'existencia-grupo'
  | 'costo-rango-fecha'
  | 'reporte-existencia'
  | 'reporte-movimientos'
  | 'productos-ensamblados'
  | 'productos-empaque'
  | 'lineas-sublineas'
  | 'etiquetas-intermec'
  | 'etiquetas-monarch'
  | 'devoluciones-vendedor'
  | 'auxiliar-inventario'
  | 'consumo-proyecto'
  | 'etiquetas-barras-linea'
  | 'barras-documentos'
  | 'imprimir-etiquetas'
  | 'cantidad-reservada'
  | 'reportes-cf'
  | 'cargar-cf-excel'
  | 'entrada-cf-manual'
  | 'comparativo-fisico'
  | 'ajuste-inventario-cf'
  | 'consulta-historico-cf'
  | 'entrada-diario'
  | 'generar-asiento'
  | 'cierre-mensual'

type Action = {
  key: ViewKey
  label: string
  legacy: string
  status: 'ready' | 'planned'
  summary: string
  icon: typeof Package
  tables: string[]
  apis: string[]
}

const route = getRouteApi('/_authenticated/inv')

const sectionMeta: Record<SectionKey, { label: string; icon: typeof Package }> = {
  configuracion: { label: 'Configuración', icon: Settings2 },
  procesos: { label: 'Procesos', icon: Wrench },
  consultas: { label: 'Consultas', icon: Search },
  reportes: { label: 'Reportes', icon: FileBarChart },
  'conteo-fisico': { label: 'Conteo Físico', icon: ClipboardList },
  cierre: { label: 'Cierre', icon: BookOpenCheck },
}

const actionsBySection: Record<SectionKey, Action[]> = {
  configuracion: [
    {
      key: 'companias',
      label: 'Compañías',
      legacy: 'Compañías',
      status: 'ready',
      summary: 'Mantenimiento de compañías para el módulo de inventario.',
      icon: Building2,
      tables: ['INV.TINV_CIA'],
      apis: ['GET /api/inv/companias/'],
    },
    {
      key: 'puntos-trabajo',
      label: 'Puntos de Trabajo',
      legacy: 'Puntos de Trabajo',
      status: 'ready',
      summary: 'Configuración de puntos de trabajo / sucursales.',
      icon: Building2,
      tables: ['INV.TINV_PUNTO'],
      apis: ['GET /api/inv/puntos/'],
    },
    {
      key: 'acceso-usuarios',
      label: 'Acceso de Usuarios',
      legacy: 'Acceso de Usuarios',
      status: 'planned',
      summary: 'Control de acceso de usuarios al módulo INV.',
      icon: Settings2,
      tables: ['INV.TINV_USUARIO'],
      apis: ['GET /api/inv/usuarios/'],
    },
    {
      key: 'almacenes',
      label: 'Almacenes',
      legacy: 'Almacenes',
      status: 'ready',
      summary: 'Catálogo y mantenimiento de almacenes por compañía.',
      icon: Box,
      tables: ['INV.TINV_ALMACEN'],
      apis: ['GET /api/inv/almacenes/'],
    },
    {
      key: 'tipos-documentos',
      label: 'Tipos de Documentos',
      legacy: 'Tipos de Documentos',
      status: 'ready',
      summary: 'Configuración de tipos de documentos del sistema.',
      icon: FileSpreadsheet,
      tables: ['INV.TINV_TIPO_DOC'],
      apis: ['GET /api/inv/tipos-documentos/'],
    },
    {
      key: 'grupo-productos',
      label: 'Grupo de Productos',
      legacy: 'Grupo de Productos',
      status: 'ready',
      summary: 'Catálogo de grupos para clasificación de productos.',
      icon: Layers,
      tables: ['INV.TINV_GRUPO'],
      apis: ['GET /api/inv/grupos/'],
    },
    {
      key: 'linea-productos',
      label: 'Línea de Productos',
      legacy: 'Línea de Productos',
      status: 'ready',
      summary: 'Catálogo de líneas de productos.',
      icon: Layers,
      tables: ['INV.TINV_LINEA'],
      apis: ['GET /api/inv/lineas/'],
    },
    {
      key: 'sublinea-productos',
      label: 'Sub Línea de Productos',
      legacy: 'Sub Línea de Productos',
      status: 'ready',
      summary: 'Catálogo de sub-líneas de productos.',
      icon: Layers,
      tables: ['INV.TINV_SUBLINEA'],
      apis: ['GET /api/inv/sublineas/'],
    },
    {
      key: 'grupo-contable',
      label: 'Grupo Contable',
      legacy: 'Grupo Contable',
      status: 'ready',
      summary: 'Grupos contables para integración con contabilidad.',
      icon: Calculator,
      tables: ['INV.TINV_GRUPO_CONT'],
      apis: ['GET /api/inv/grupos-contables/'],
    },
    {
      key: 'unidades-empaque',
      label: 'Unidades de Empaque',
      legacy: 'Unidades de Empaque',
      status: 'ready',
      summary: 'Catálogo de unidades de medida y empaque.',
      icon: Package,
      tables: ['INV.TINV_UNIDAD'],
      apis: ['GET /api/inv/unidades/'],
    },
    {
      key: 'referencia-empaque',
      label: 'Referencia de Empaque',
      legacy: 'Referencia de Empaque',
      status: 'ready',
      summary: 'Referencias de empaque por producto.',
      icon: Package,
      tables: ['INV.TINV_REF_EMPAQUE'],
      apis: ['GET /api/inv/referencias-empaque/'],
    },
    {
      key: 'marca-producto',
      label: 'Marca de Producto',
      legacy: 'Marca de Producto',
      status: 'planned',
      summary: 'Catálogo de marcas comerciales de productos.',
      icon: Tag,
      tables: ['INV.TINV_MARCA'],
      apis: ['GET /api/inv/marcas/'],
    },
    {
      key: 'productos',
      label: 'Productos',
      legacy: 'Productos',
      status: 'ready',
      summary: 'Catálogo maestro de productos: alta, edición y búsqueda.',
      icon: Package,
      tables: ['INV.TINV_PRODUCTO'],
      apis: ['GET/POST/PATCH /api/inv/productos/'],
    },
    {
      key: 'crear-excel',
      label: 'Crear desde Excel',
      legacy: 'Crear desde Excel',
      status: 'planned',
      summary: 'Carga masiva de productos desde archivo Excel.',
      icon: FileSpreadsheet,
      tables: ['INV.TINV_PRODUCTO'],
      apis: ['POST /api/inv/productos/excel/'],
    },
    {
      key: 'asignar-prod-cia',
      label: 'Asignar Prod. a Cia./Almacén',
      legacy: 'Asignar Prod. a Cia./Almacén',
      status: 'ready',
      summary: 'Asignación de productos a compañías y almacenes.',
      icon: PackageCheck,
      tables: ['INV.TINV_PROD_CIA'],
      apis: ['POST /api/inv/productos/asignar-cia/'],
    },
    {
      key: 'activar-prod-almacen',
      label: 'Activar/Desactivar Prod. Almacén',
      legacy: 'Activar/Desactivar Prod. Almacén',
      status: 'planned',
      summary: 'Control de estado activo/inactivo de productos por almacén.',
      icon: PackageCheck,
      tables: ['INV.TINV_PROD_ALMACEN'],
      apis: ['PATCH /api/inv/productos/activar/'],
    },
    {
      key: 'modificar-costo',
      label: 'Modificar Costo',
      legacy: 'Modificar Costo',
      status: 'ready',
      summary: 'Ajuste manual del costo de productos.',
      icon: Calculator,
      tables: ['INV.TINV_PRODUCTO', 'INV.TINV_HIST_COSTO'],
      apis: ['PATCH /api/inv/productos/costo/'],
    },
    {
      key: 'ensamblar-productos',
      label: 'Ensamblar Productos',
      legacy: 'Ensamblar Productos',
      status: 'planned',
      summary: 'Definición de fórmulas de ensamble de productos.',
      icon: Wrench,
      tables: ['INV.TINV_ENSAMBLE'],
      apis: ['GET/POST /api/inv/ensambles/'],
    },
    {
      key: 'minimo-maximo',
      label: 'Mínimo y Máximo',
      legacy: 'Mínimo y Máximo',
      status: 'ready',
      summary: 'Control de niveles mínimos y máximos de inventario.',
      icon: BarChart2,
      tables: ['INV.TINV_PROD_ALMACEN'],
      apis: ['PATCH /api/inv/productos/minmax/'],
    },
    {
      key: 'estantes-tramos',
      label: 'Estantes y Tramos',
      legacy: 'Estantes y Tramos',
      status: 'ready',
      summary: 'Configuración de ubicaciones físicas en almacén.',
      icon: Box,
      tables: ['INV.TINV_ESTANTE'],
      apis: ['GET/POST /api/inv/estantes/'],
    },
    {
      key: 'envases-retornables',
      label: 'Envases Retornables',
      legacy: 'Envases Retornables',
      status: 'planned',
      summary: 'Gestión de envases retornables asociados a productos.',
      icon: RotateCcw,
      tables: ['INV.TINV_ENVASE'],
      apis: ['GET/POST /api/inv/envases/'],
    },
  ],
  procesos: [
    {
      key: 'entrada-compras',
      label: 'Entrada de Compras',
      legacy: 'Entrada de Compras',
      status: 'ready',
      summary: 'Registro de entradas de mercancía por compras.',
      icon: ShoppingCart,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['POST /api/inv/documentos/entrada-compras/'],
    },
    {
      key: 'entrada-mercancia',
      label: 'Entrada Mercancía Almacén',
      legacy: 'FINV210',
      status: 'ready',
      summary: 'Entrada directa de mercancía a almacén con grilla de productos y totales.',
      icon: PackagePlus,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['POST /api/inv/movimientos/'],
    },
    {
      key: 'salida-mercancia',
      label: 'Salida de Mercancía',
      legacy: 'FINV211',
      status: 'ready',
      summary: 'Registro de salidas de mercancía del almacén con grilla de productos y totales.',
      icon: PackageMinus,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['POST /api/inv/movimientos/'],
    },
    {
      key: 'transferencia-mercancia',
      label: 'Transferencia de Mercancía',
      legacy: 'Transferencia de Mercancía',
      status: 'ready',
      summary: 'Traslado de mercancía entre almacenes.',
      icon: RefreshCcw,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['POST /api/inv/documentos/transferencia/'],
    },
    {
      key: 'entrada-produccion',
      label: 'Entrada de Producción',
      legacy: 'Entrada de Producción',
      status: 'planned',
      summary: 'Registro de entradas por producción interna.',
      icon: PackagePlus,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['POST /api/inv/documentos/produccion/'],
    },
    {
      key: 'despacho-cotizacion',
      label: 'Despacho Cotización/Orden',
      legacy: 'Despacho Cotización/Orden',
      status: 'planned',
      summary: 'Despacho vinculado a cotizaciones u órdenes de venta.',
      icon: Truck,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['POST /api/inv/documentos/despacho/'],
    },
    {
      key: 'salida-ensamblados',
      label: 'Salida Ensamblados/Reproceso',
      legacy: 'Salida Ensamblados/Reproceso',
      status: 'planned',
      summary: 'Salidas de productos ensamblados o para reproceso.',
      icon: PackageMinus,
      tables: ['INV.TINV_DOC', 'INV.TINV_ENSAMBLE'],
      apis: ['POST /api/inv/documentos/ensamblados/'],
    },
    {
      key: 'devolucion-suplidores',
      label: 'Devolución a Suplidores',
      legacy: 'Devolución a Suplidores',
      status: 'ready',
      summary: 'Registro de devoluciones de mercancía a proveedores.',
      icon: RotateCcw,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['POST /api/inv/documentos/dev-suplidor/'],
    },
    {
      key: 'devolucion-ventas',
      label: 'Devolución de Ventas',
      legacy: 'Devolución de Ventas',
      status: 'ready',
      summary: 'Registro de devoluciones de clientes al almacén.',
      icon: RotateCcw,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['POST /api/inv/documentos/dev-ventas/'],
    },
    {
      key: 'reversar-documento',
      label: 'Reversar Documento',
      legacy: 'FINV214',
      status: 'ready',
      summary: 'Reversión de documentos de movimiento interno con confirmación y motivo.',
      icon: ArchiveX,
      tables: ['INV.TINV_DOC'],
      apis: ['POST /api/inv/reversar/'],
    },
    {
      key: 'impresion-documentos',
      label: 'Impresión de Documentos',
      legacy: 'FINV206',
      status: 'ready',
      summary: 'Genera reportes Rinv206/Rinv207 en PDF con parámetros de mes, tipo documento y rango.',
      icon: Printer,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['GET /api/inv/reportes/documentos/pdf/'],
    },
    {
      key: 'listado-recepcion-resumen',
      label: 'Listado Recepción Resumen',
      legacy: 'Listado Recepción Resumen',
      status: 'planned',
      summary: 'Reporte resumen de recepciones de mercancía.',
      icon: FileBarChart,
      tables: ['INV.TINV_DOC'],
      apis: ['GET /api/inv/reportes/recepcion-resumen/'],
    },
    {
      key: 'listado-recepcion-detalle',
      label: 'Listado Recepción Detalle',
      legacy: 'Listado Recepción Detalle',
      status: 'planned',
      summary: 'Reporte detallado de recepciones de mercancía.',
      icon: FileBarChart,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['GET /api/inv/reportes/recepcion-detalle/'],
    },
    {
      key: 'listado-doc-asiento',
      label: 'Listado Doc. con Asiento',
      legacy: 'Listado Doc. con Asiento',
      status: 'planned',
      summary: 'Listado de documentos con asiento contable generado.',
      icon: FileBarChart,
      tables: ['INV.TINV_DOC', 'CNT.TCNT_ASIENTO'],
      apis: ['GET /api/inv/reportes/doc-asiento/'],
    },
    {
      key: 'asignar-series',
      label: 'Asignar Series',
      legacy: 'Asignar Series',
      status: 'planned',
      summary: 'Asignación de series numéricas a tipos de documentos.',
      icon: Settings2,
      tables: ['INV.TINV_SERIE'],
      apis: ['GET/POST /api/inv/series/'],
    },
  ],
  consultas: [
    {
      key: 'consulta-documentos',
      label: 'Consulta de Documentos',
      legacy: 'Consulta de Documentos',
      status: 'ready',
      summary: 'Consulta global de documentos y movimientos de inventario.',
      icon: Search,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['GET /api/inv/documentos/'],
    },
    {
      key: 'existencia-producto',
      label: 'Existencia de Producto',
      legacy: 'Existencia de Producto',
      status: 'ready',
      summary: 'Consulta de existencias por producto y almacén.',
      icon: PackageCheck,
      tables: ['INV.TINV_EXIST'],
      apis: ['GET /api/inv/existencias/'],
    },
    {
      key: 'existencia-grupo',
      label: 'Existencia en Grupo',
      legacy: 'Existencia en Grupo',
      status: 'ready',
      summary: 'Consulta de existencias agrupadas por grupo de productos.',
      icon: Layers,
      tables: ['INV.TINV_EXIST', 'INV.TINV_GRUPO'],
      apis: ['GET /api/inv/existencias/grupo/'],
    },
    {
      key: 'costo-rango-fecha',
      label: 'Costo en Rango Fecha',
      legacy: 'Costo en Rango Fecha',
      status: 'planned',
      summary: 'Consulta del historial de costos en un rango de fechas.',
      icon: Calculator,
      tables: ['INV.TINV_HIST_COSTO'],
      apis: ['GET /api/inv/costos/rango/'],
    },
  ],
  reportes: [
    {
      key: 'reporte-existencia',
      label: 'Existencia',
      legacy: 'Existencia (multi-reporte PDF)',
      status: 'ready',
      summary: 'Reporte multi-formato de existencias en inventario.',
      icon: FileBarChart,
      tables: ['INV.TINV_EXIST'],
      apis: ['GET /api/inv/reportes/existencia/pdf/'],
    },
    {
      key: 'reporte-movimientos',
      label: 'Movimientos',
      legacy: 'Movimientos',
      status: 'ready',
      summary: 'Reporte de movimientos de inventario por período.',
      icon: BarChart2,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['GET /api/inv/reportes/movimientos/'],
    },
    {
      key: 'productos-ensamblados',
      label: 'Productos Ensamblados',
      legacy: 'Productos Ensamblados',
      status: 'planned',
      summary: 'Reporte de productos generados por ensamble.',
      icon: Wrench,
      tables: ['INV.TINV_ENSAMBLE'],
      apis: ['GET /api/inv/reportes/ensamblados/'],
    },
    {
      key: 'productos-empaque',
      label: 'Productos con Empaque',
      legacy: 'Productos con Empaque',
      status: 'planned',
      summary: 'Listado de productos con su configuración de empaque.',
      icon: Package,
      tables: ['INV.TINV_PRODUCTO', 'INV.TINV_REF_EMPAQUE'],
      apis: ['GET /api/inv/reportes/empaque/'],
    },
    {
      key: 'lineas-sublineas',
      label: 'Líneas y Sublíneas',
      legacy: 'Líneas y Sublíneas',
      status: 'ready',
      summary: 'Reporte de clasificación por líneas y sublíneas de productos.',
      icon: Layers,
      tables: ['INV.TINV_LINEA', 'INV.TINV_SUBLINEA'],
      apis: ['GET /api/inv/reportes/lineas/'],
    },
    {
      key: 'etiquetas-intermec',
      label: 'Etiquetas Intermec',
      legacy: 'Etiquetas Intermec',
      status: 'planned',
      summary: 'Impresión de etiquetas en formato Intermec.',
      icon: Printer,
      tables: ['INV.TINV_PRODUCTO'],
      apis: ['GET /api/inv/etiquetas/intermec/'],
    },
    {
      key: 'etiquetas-monarch',
      label: 'Etiquetas Monarch 9416',
      legacy: 'Etiquetas Monarch 9416',
      status: 'planned',
      summary: 'Impresión de etiquetas en formato Monarch 9416.',
      icon: Printer,
      tables: ['INV.TINV_PRODUCTO'],
      apis: ['GET /api/inv/etiquetas/monarch/'],
    },
    {
      key: 'devoluciones-vendedor',
      label: 'Devoluciones por Vendedor',
      legacy: 'Devoluciones por Vendedor',
      status: 'planned',
      summary: 'Reporte de devoluciones agrupadas por vendedor.',
      icon: RotateCcw,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['GET /api/inv/reportes/devoluciones-vendedor/'],
    },
    {
      key: 'auxiliar-inventario',
      label: 'Auxiliar de Inventario',
      legacy: 'Auxiliar de Inventario',
      status: 'planned',
      summary: 'Reporte auxiliar contable de movimientos de inventario.',
      icon: FileBarChart,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['GET /api/inv/reportes/auxiliar/'],
    },
    {
      key: 'consumo-proyecto',
      label: 'Consumo por Proyecto',
      legacy: 'Consumo por Proyecto',
      status: 'planned',
      summary: 'Reporte de consumo de materiales por proyecto.',
      icon: BarChart2,
      tables: ['INV.TINV_DOC', 'INV.TINV_DOCL'],
      apis: ['GET /api/inv/reportes/consumo-proyecto/'],
    },
    {
      key: 'etiquetas-barras-linea',
      label: 'Etiquetas y Barras por Línea',
      legacy: 'Etiquetas y Barras por Línea',
      status: 'planned',
      summary: 'Impresión de etiquetas con código de barras por línea de productos.',
      icon: Printer,
      tables: ['INV.TINV_PRODUCTO', 'INV.TINV_LINEA'],
      apis: ['GET /api/inv/etiquetas/barras-linea/'],
    },
    {
      key: 'barras-documentos',
      label: 'Barras por Documentos',
      legacy: 'Barras por Documentos',
      status: 'planned',
      summary: 'Impresión de códigos de barras en documentos.',
      icon: Printer,
      tables: ['INV.TINV_DOC'],
      apis: ['GET /api/inv/etiquetas/barras-doc/'],
    },
    {
      key: 'imprimir-etiquetas',
      label: 'Imprimir Etiquetas',
      legacy: 'Imprimir Etiquetas',
      status: 'planned',
      summary: 'Generación e impresión de etiquetas de productos.',
      icon: Printer,
      tables: ['INV.TINV_PRODUCTO'],
      apis: ['GET /api/inv/etiquetas/imprimir/'],
    },
    {
      key: 'cantidad-reservada',
      label: 'Cantidad Reservada',
      legacy: 'Cantidad Reservada',
      status: 'planned',
      summary: 'Reporte de cantidades reservadas por producto.',
      icon: PackageCheck,
      tables: ['INV.TINV_RESERVA'],
      apis: ['GET /api/inv/reportes/reservadas/'],
    },
  ],
  'conteo-fisico': [
    {
      key: 'reportes-cf',
      label: 'Reportes CF',
      legacy: 'Reportes CF',
      status: 'ready',
      summary: 'Reportes del proceso de conteo físico.',
      icon: FileBarChart,
      tables: ['INV.TINV_CONTEO'],
      apis: ['GET /api/inv/conteo/reportes/'],
    },
    {
      key: 'cargar-cf-excel',
      label: 'Cargar CF desde Excel',
      legacy: 'Cargar CF desde Excel',
      status: 'ready',
      summary: 'Carga de conteo físico desde archivo Excel.',
      icon: FileSpreadsheet,
      tables: ['INV.TINV_CONTEO'],
      apis: ['POST /api/inv/conteo/excel/'],
    },
    {
      key: 'entrada-cf-manual',
      label: 'Entrada CF Manual',
      legacy: 'Entrada CF Manual',
      status: 'ready',
      summary: 'Captura manual del conteo físico de inventario.',
      icon: ClipboardList,
      tables: ['INV.TINV_CONTEO'],
      apis: ['POST /api/inv/conteo/manual/'],
    },
    {
      key: 'comparativo-fisico',
      label: 'Comparativo Físico vs Teórico',
      legacy: 'Comparativo Físico vs Teórico',
      status: 'ready',
      summary: 'Comparación entre el conteo físico y el saldo teórico del sistema.',
      icon: Scale,
      tables: ['INV.TINV_CONTEO', 'INV.TINV_EXIST'],
      apis: ['GET /api/inv/conteo/comparativo/'],
    },
    {
      key: 'ajuste-inventario-cf',
      label: 'Ajuste de Inventario por CF',
      legacy: 'Ajuste de Inventario por CF',
      status: 'ready',
      summary: 'Generación de ajustes de inventario basados en el conteo físico.',
      icon: Wrench,
      tables: ['INV.TINV_CONTEO', 'INV.TINV_DOC'],
      apis: ['POST /api/inv/conteo/ajuste/'],
    },
    {
      key: 'consulta-historico-cf',
      label: 'Consulta Histórico CF',
      legacy: 'Consulta Histórico CF',
      status: 'planned',
      summary: 'Historial de conteos físicos realizados.',
      icon: Search,
      tables: ['INV.TINV_CONTEO_HIST'],
      apis: ['GET /api/inv/conteo/historico/'],
    },
  ],
  cierre: [
    {
      key: 'entrada-diario',
      label: 'Entrada de Diario',
      legacy: 'Entrada de Diario',
      status: 'ready',
      summary: 'Captura de asientos de diario para cierre de inventario.',
      icon: FileSpreadsheet,
      tables: ['INV.TINV_DIARIO'],
      apis: ['POST /api/inv/cierre/diario/'],
    },
    {
      key: 'generar-asiento',
      label: 'Generar Asiento a Contabilidad',
      legacy: 'Generar Asiento a Contabilidad',
      status: 'ready',
      summary: 'Generación automática de asientos contables desde inventario.',
      icon: Calculator,
      tables: ['INV.TINV_DIARIO', 'CNT.TCNT_ASIENTO'],
      apis: ['POST /api/inv/cierre/asiento/'],
    },
    {
      key: 'cierre-mensual',
      label: 'Cierre Mensual',
      legacy: 'Cierre Mensual',
      status: 'ready',
      summary: 'Proceso de cierre mensual del módulo de inventario.',
      icon: BookOpenCheck,
      tables: ['INV.TINV_CIERRE'],
      apis: ['POST /api/inv/cierre/mensual/'],
    },
  ],
}

function getAction(section: SectionKey, key: ViewKey): Action {
  return actionsBySection[section].find((action) => action.key === key) ?? actionsBySection[section][0]
}

function sectionFromAction(key: ViewKey): SectionKey {
  const match = (Object.keys(actionsBySection) as SectionKey[]).find((section) =>
    actionsBySection[section].some((action) => action.key === key),
  )
  return match ?? 'configuracion'
}

export function InvPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { selectedCompany, selectedPoint } = useCompany()
  const activeSection = search.section as SectionKey
  const [activeView, setActiveView] = useState<ViewKey>(
    (search.view as ViewKey) || actionsBySection[activeSection][0].key,
  )
  const [showWorkspace, setShowWorkspace] = useState(false)

  // Deep-link from the sidebar: ?view= selects the tab and, when the view is
  // implemented, opens its workspace directly (planned ones keep the grid).
  useEffect(() => {
    if (!search.view) return
    const action = actionsBySection[activeSection]?.find((a) => a.key === search.view)
    if (!action) return
    setActiveView(action.key)
    setShowWorkspace(action.status === 'ready')
  }, [search.view, activeSection])

  const currentAction = getAction(activeSection, activeView)
  const SectionIcon = sectionMeta[activeSection].icon

  const openSection = (section: SectionKey) => {
    navigate({
      search: (prev) => ({ ...prev, section, view: actionsBySection[section][0].key }),
      replace: true,
    })
    setActiveView(actionsBySection[section][0].key)
    setShowWorkspace(false)
  }

  const openView = (action: Action) => {
    if (action.status !== 'ready') return
    const nextSection = sectionFromAction(action.key)
    navigate({
      search: (prev) => ({ ...prev, section: nextSection, view: action.key }),
      replace: true,
    })
    setActiveView(action.key)
    setShowWorkspace(true)
  }

  return (
    <>
      <Header>
        <div className='me-auto flex min-w-0 flex-wrap items-center gap-3'>
          <div>
            <h2 className='flex items-center gap-2 text-lg font-semibold'>
              <Package className='h-5 w-5' />
              Inventario (INV)
            </h2>
            <p className='text-sm text-muted-foreground'>
              Paridad funcional con el legado Oracle Forms.
            </p>
          </div>
        </div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main fluid className='px-4 py-4'>
        <section className='space-y-4'>
          {/* Section tabs */}
          <div className='rounded-xl border bg-card p-4'>
            <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
              <div className='flex items-center gap-2'>
                <SectionIcon className='h-4 w-4 text-muted-foreground' />
                <span className='text-sm font-medium text-muted-foreground'>
                  {sectionMeta[activeSection].label}
                </span>
                <Badge variant='outline'>{selectedPoint}</Badge>
              </div>
              {showWorkspace && (
                <div className='flex items-center gap-2'>
                  <Badge variant='outline'>{currentAction.legacy}</Badge>
                  <Badge variant={currentAction.status === 'ready' ? 'outline' : 'secondary'}>
                    {currentAction.status === 'ready' ? 'Operativo' : 'Planificado'}
                  </Badge>
                </div>
              )}
            </div>
            <ScrollArea>
              <div className='flex gap-2 pb-1'>
                {(Object.keys(sectionMeta) as SectionKey[]).map((sec) => {
                  const Icon = sectionMeta[sec].icon
                  return (
                    <Button
                      key={sec}
                      variant={activeSection === sec ? 'default' : 'outline'}
                      size='sm'
                      className='justify-start gap-1.5'
                      onClick={() => openSection(sec)}
                    >
                      <Icon className='h-3.5 w-3.5' />
                      {sectionMeta[sec].label}
                    </Button>
                  )
                })}
              </div>
              <ScrollBar orientation='horizontal' />
            </ScrollArea>
          </div>

          {/* Workspace or card grid */}
          {showWorkspace ? (
            <div
              key={`${activeView}-${selectedCompany}-${selectedPoint}`}
              className='rounded-xl border bg-card p-6'
            >
              <div className='mb-4 flex items-center gap-2'>
                <Button variant='ghost' size='sm' onClick={() => setShowWorkspace(false)}>
                  <ArrowLeft className='mr-1 h-4 w-4' />
                  Volver
                </Button>
                <span className='text-sm font-medium'>{currentAction.label}</span>
              </div>
              {renderWorkspace(activeView, selectedCompany, selectedPoint)}
            </div>
          ) : (
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
              {actionsBySection[activeSection].map((action) => {
                const Icon = action.icon
                return (
                  <Card
                    key={action.key}
                    className={
                      action.status === 'ready'
                        ? 'cursor-pointer transition-shadow hover:shadow-md'
                        : 'opacity-60'
                    }
                    onClick={() => openView(action)}
                  >
                    <CardHeader className='pb-2'>
                      <div className='flex items-start justify-between gap-2'>
                        <Icon className='mt-0.5 h-5 w-5 shrink-0 text-muted-foreground' />
                        <Badge
                          variant={action.status === 'ready' ? 'outline' : 'secondary'}
                          className='shrink-0 text-xs'
                        >
                          {action.status === 'ready' ? 'Operativo' : 'Planificado'}
                        </Badge>
                      </div>
                      <CardTitle className='text-sm'>{action.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className='text-xs'>{action.summary}</CardDescription>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      </Main>
    </>
  )
}

function renderWorkspace(view: ViewKey, noCia: string, punto: string) {
  switch (view) {
    // Configuración
    case 'companias':
      return <CompaniasInv noCia={noCia} punto={punto} />
    case 'puntos-trabajo':
      return <PuntosTrabajoInv noCia={noCia} punto={punto} />
    case 'almacenes':
      return <Almacenes noCia={noCia} punto={punto} />
    case 'tipos-documentos':
      return <TiposDocumento noCia={noCia} punto={punto} />
    case 'grupo-productos':
      return <GruposProductos noCia={noCia} punto={punto} />
    case 'linea-productos':
      return <LineasProductos noCia={noCia} punto={punto} />
    case 'sublinea-productos':
      return <SubLineasProductos noCia={noCia} punto={punto} />
    case 'unidades-empaque':
      return <UnidadesMedida noCia={noCia} punto={punto} />
    case 'grupo-contable':
      return <GrupoContable noCia={noCia} punto={punto} />
    case 'referencia-empaque':
      return <ReferenciaEmpaque noCia={noCia} punto={punto} />
    case 'modificar-costo':
      return <ModificarCosto noCia={noCia} punto={punto} />
    case 'minimo-maximo':
      return <MinimosMaximos noCia={noCia} punto={punto} />
    case 'estantes-tramos':
      return <EstantesTramos noCia={noCia} punto={punto} />
    case 'asignar-prod-cia':
      return <AsignarProductoAlmacen noCia={noCia} punto={punto} />
    case 'productos':
      return <CatalogoProductos />
    // Procesos
    case 'entrada-compras':
      return <EntradaCompras noCia={noCia} punto={punto} />
    case 'impresion-documentos':
      return <ImpresionDocumentos noCia={noCia} punto={punto} />
    case 'entrada-mercancia':
      return <EntradaMercancia noCia={noCia} punto={punto} tipoMov='entrada' />
    case 'salida-mercancia':
      return <SalidaMercancia noCia={noCia} punto={punto} />
    case 'transferencia-mercancia':
      return <TransferenciaMercancia noCia={noCia} punto={punto} />
    case 'devolucion-suplidores':
      return <DevolucionSuplidores noCia={noCia} punto={punto} />
    case 'devolucion-ventas':
      return <DevolucionVentas noCia={noCia} punto={punto} />
    case 'reversar-documento':
      return <ReverarDocumento noCia={noCia} punto={punto} />
    // Consultas
    case 'consulta-documentos':
      return <ConsultaDocumentos />
    case 'existencia-producto':
      return <ExistenciaProducto />
    case 'existencia-grupo':
      return <ExistenciaGrupo noCia={noCia} punto={punto} />
    // Reportes
    case 'reporte-existencia':
      return <ReportesParametros reportType='existencia' noCia={noCia} punto={punto} />
    case 'reporte-movimientos':
      return <ReportesParametros reportType='movimientos' noCia={noCia} punto={punto} />
    case 'lineas-sublineas':
      return <ReportesParametros reportType='lineas-sublineas' noCia={noCia} punto={punto} />
    // Conteo Físico
    case 'reportes-cf':
      return <ConteoFisicoReportes noCia={noCia} punto={punto} />
    case 'cargar-cf-excel':
      return <CargarConteoExcel noCia={noCia} punto={punto} />
    case 'entrada-cf-manual':
      return <ConteoFisicoManual noCia={noCia} punto={punto} />
    case 'comparativo-fisico':
      return <ComparativoFisico noCia={noCia} punto={punto} />
    case 'ajuste-inventario-cf':
      return <AjusteConteoFisico noCia={noCia} punto={punto} />
    // Cierre
    case 'entrada-diario':
      return <CierreEntradaDiario noCia={noCia} punto={punto} />
    case 'generar-asiento':
      return <CierreAsiento noCia={noCia} punto={punto} />
    case 'cierre-mensual':
      return <CierreMensual noCia={noCia} punto={punto} />
    default:
      return <PlannedWorkspace />
  }
}

function PlannedWorkspace() {
  return (
    <div className='rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground'>
      Esta capacidad queda inventariada y pendiente del siguiente tramo, pero ya usa el mismo
      contexto global de empresa y punto de trabajo.
    </div>
  )
}

export const InvModule = InvPage
