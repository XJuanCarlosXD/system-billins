import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronRight, Laptop, Moon, Sun } from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { sidebarData } from './layout/data/sidebar-data'
import { ScrollArea } from './ui/scroll-area'
import type { NavGroup, NavSubItem } from './layout/types'

// Per-view keywords/descriptions for intelligent search
const VIEW_KEYWORDS: Record<string, string> = {
  // FAT
  '/fat/facturas': 'consulta listado facturas emitidas ventas documentos',
  '/fat/nueva-factura': 'crear emitir nueva factura venta cliente NCF',
  '/fat/anular-factura': 'anular cancelar reversar factura NCF',
  '/fat/nuevo-conduce': 'conduce cotizacion presupuesto orden entrega',
  '/fat/conduces': 'listado consulta conduces cotizaciones ordenes',
  '/fat/cuadre-caja': 'cuadre cierre caja cobros efectivo tarjeta dia',
  '/fat/companias': 'empresas companias configuracion datos generales',
  '/fat/puntos': 'puntos trabajo sucursales tiendas locales',
  '/fat/tdocu': 'tipos documentos facturas notas debito credito NCF',
  '/fat/condiciones': 'condiciones pago credito contado dias plazo',
  '/fat/ncf': 'NCF comprobantes fiscales secuencias rangos control DGII',
  '/fat/tipos-pago': 'tipos pago caja efectivo tarjeta cheque transferencia',
  '/fat/listas-precio': 'listas precios tarifas productos articulos',
  '/fat/transportistas': 'transportistas conductores vehiculos despacho',
  '/fat/notas': 'notas pie factura texto leyenda impresion',
  '/fat/rep-ventas': 'reporte ventas producto articulo inventario',
  '/fat/rep-607': 'reporte 607 NCF DGII declaracion fiscal',
  '/fat/rep-ncf-nulos': 'NCF nulos anulados cancelados reporte',
  '/fat/rep-ventas-vendedor': 'ventas vendedor comision rendimiento',
  '/fat/rep-ventas-cliente': 'ventas cliente cuenta historico',
  '/fat/rep-analitica': 'analitica ventas grafico tendencia estadistica',
  '/fat/generar-asientos': 'generar asientos contabilidad mayor CNT',
  '/fat/cierre-mensual': 'cierre mensual periodo facturacion',
  // CXC
  '/cxc/cias': 'companias empresas configuracion CXC cobrar',
  '/cxc/puntos': 'sucursales puntos trabajo CXC',
  '/cxc/tdocu': 'tipos documentos CXC cobrar facturas recibos',
  '/cxc/tcli': 'tipos clientes clasificacion categorias',
  '/cxc/supervisores': 'supervisores vendedores jerarquia equipo ventas',
  '/cxc/vendedores': 'vendedores agentes comision cuota flota',
  '/cxc/rutas': 'rutas grupos sectores distribucion visitas',
  '/cxc/tcontable': 'tipo contable clasificacion contabilidad',
  '/cxc/ciudades': 'ciudades municipios provincias geografico',
  '/cxc/barrios': 'barrios sectores zonas direccion cliente',
  '/cxc/zonas': 'zonas territorios regiones cobertura',
  '/cxc/cadenas': 'cadenas negocios supermercado retail grupo empresarial',
  '/cxc/clientes': 'clientes maestro alta modificar RNC cedula credito',
  '/cxc/cliente-ruta': 'asignar cliente ruta sector agrupacion distribucion',
  '/cxc/transacciones': 'transacciones entrada debito credito CXC documento',
  '/cxc/documentos': 'consulta documentos transacciones CXC historial',
  '/cxc/reversar': 'reversar anular cancelar transaccion documento CXC',
  '/cxc/pagos-masivos': 'pagos masivos lote aplicar cobros multiples',
  '/cxc/liberar-credito': 'liberar credito aplicar pago nota debito cliente',
  '/cxc/corregir-ncf': 'corregir NCF comprobante fiscal liberar',
  '/cxc/estado-cuenta': 'estado cuenta corriente cliente saldo deuda',
  '/cxc/balance': 'balance clientes aging envejecimiento cartera 30 60 90 dias',
  '/cxc/historico': 'historico pagos cobros cliente transacciones anteriores',
  '/cxc/libro-ventas': 'libro ventas registro DGII NCF facturacion',
  '/cxc/rep-envejecimiento': 'envejecimiento cartera aging vencimiento deuda dias cobrar',
  '/cxc/rep-cobros-vendedor': 'cobros vendedor recaudacion efectividad',
  '/cxc/rep-comisiones': 'comisiones vendedores calculo porciento incentivo',
  '/cxc/rep-ncf': 'NCF emitidos comprobantes fiscales reporte DGII',
  '/cxc/asiento-contable': 'asiento contable CXC soporte diario imprimir',
  '/cxc/generar-asiento': 'generar asiento mayor CXC contabilidad cierre',
  '/cxc/cierre': 'cierre CXC cuentas cobrar periodo mensual avanzar',
  // CNT (via search params)
  'cnt-companias': 'companias empresas contabilidad CNT',
  'cnt-sucursales': 'sucursales localidades contabilidad',
  'cnt-tipos-cuenta': 'tipos cuenta activo pasivo capital ingreso gasto',
  'cnt-catalogo-sucursal': 'catalogo cuentas sucursal asignar',
  'cnt-catalogo': 'catalogo plan cuentas contable',
  'cnt-centros': 'centros costo departamentos proyectos',
  'cnt-ncf': 'NCF comprobantes mantenimiento contabilidad',
  'cnt-asientos': 'entrada diario asientos contables',
  'cnt-autorizar-mes': 'autorizar asientos mes cierre periodo',
  'cnt-autorizar-mes-anterior': 'autorizar mes anterior ajustes',
  'cnt-consulta-asientos': 'consulta asientos contables historial',
  'cnt-movimientos': 'movimientos cuentas saldos actividad',
  'cnt-balance': 'balance comprobacion sumas saldos',
  'cnt-mayor': 'mayor general libro contable movimientos',
  'cnt-cierre-mensual': 'cierre mensual contabilidad periodo',
  'cnt-cierres': 'historial cierres periodos cerrados',
  'cnt-grupos-sucursal': 'grupos contables sucursal cuentas rangos',
  'cnt-verificar-asientos': 'verificar asientos aprobar pendientes autorizacion',
  'cnt-presupuesto': 'presupuesto anual cuentas meses proyeccion gasto ingreso',
  'cnt-estado-resultados': 'estado resultados ingresos gastos utilidad perdida PyG',
}

interface FlatItem {
  id: string
  module: string
  category: string
  title: string
  url: string
  search?: Record<string, unknown>
  keywords: string
}

function flattenNav(groups: NavGroup[]): FlatItem[] {
  const result: FlatItem[] = []

  for (const group of groups) {
    for (const item of group.items) {
      if ('url' in item && item.url) {
        const url = item.url as string
        result.push({
          id: url,
          module: group.title,
          category: '',
          title: item.title,
          url,
          search: item.search,
          keywords: VIEW_KEYWORDS[url] ?? '',
        })
        continue
      }
      if ('items' in item && item.items) {
        for (const sub of item.items as NavSubItem[]) {
          if ('url' in sub && sub.url) {
            const url = sub.url as string
            result.push({
              id: `${item.title}-${url}`,
              module: item.title,
              category: '',
              title: sub.title,
              url,
              search: sub.search,
              keywords: VIEW_KEYWORDS[url] ?? '',
            })
          } else if ('items' in sub && sub.items) {
            for (const leaf of sub.items) {
              if (leaf.url) {
                const url = leaf.url as string
                const searchKey = leaf.search?.view ? `${item.title.split(' ')[0].toLowerCase()}-${leaf.search.view}` : url
                result.push({
                  id: `${item.title}-${sub.title}-${url}-${String(leaf.search?.view ?? '')}`,
                  module: item.title,
                  category: sub.title,
                  title: leaf.title,
                  url,
                  search: leaf.search,
                  keywords: VIEW_KEYWORDS[url] ?? VIEW_KEYWORDS[searchKey] ?? '',
                })
              }
            }
          }
        }
      }
    }
  }

  return result
}

const ALL_ITEMS = flattenNav(sidebarData.navGroups)

function groupByModule(items: FlatItem[]): Map<string, FlatItem[]> {
  const map = new Map<string, FlatItem[]>()
  for (const item of items) {
    if (!map.has(item.module)) map.set(item.module, [])
    map.get(item.module)!.push(item)
  }
  return map
}

function score(item: FlatItem, q: string): number {
  const lq = q.toLowerCase()
  const title = item.title.toLowerCase()
  const keywords = item.keywords.toLowerCase()
  const category = item.category.toLowerCase()
  const module_ = item.module.toLowerCase()

  if (title === lq) return 100
  if (title.startsWith(lq)) return 80
  if (title.includes(lq)) return 60
  if (keywords.includes(lq)) return 40
  if (category.includes(lq)) return 30
  if (module_.includes(lq)) return 20

  // multi-word: all words must match somewhere
  const words = lq.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    const haystack = `${title} ${keywords} ${category} ${module_}`
    if (words.every((w) => haystack.includes(w))) return 10
  }
  return 0
}

export function CommandMenu() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const [query, setQuery] = React.useState('')

  const filtered = React.useMemo(() => {
    if (!query.trim()) return ALL_ITEMS
    return ALL_ITEMS
      .map((item) => ({ item, s: score(item, query) }))
      .filter(({ s }) => s > 0)
      .sort((a, b) => b.s - a.s)
      .map(({ item }) => item)
  }, [query])

  const grouped = React.useMemo(() => groupByModule(filtered), [filtered])

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      setQuery('')
      command()
    },
    [setOpen]
  )

  return (
    <CommandDialog
      modal
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setQuery('')
      }}
    >
      <CommandInput
        placeholder='Buscar pantalla, modulo o funcion...'
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <ScrollArea type='hover' className='h-80 pe-1'>
          <CommandEmpty>No se encontraron resultados.</CommandEmpty>

          {Array.from(grouped.entries()).map(([module, items]) => (
            <CommandGroup key={module} heading={module}>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() =>
                    runCommand(() =>
                      navigate({ to: item.url as any, search: item.search as any })
                    )
                  }
                >
                  <span className='flex items-center gap-1 min-w-0 flex-1'>
                    {item.category && (
                      <>
                        <span className='text-muted-foreground text-xs shrink-0'>
                          {item.category}
                        </span>
                        <ChevronRight className='h-3 w-3 text-muted-foreground/60 shrink-0' />
                      </>
                    )}
                    <span className='truncate'>{item.title}</span>
                  </span>
                  {item.keywords && query.trim() && (
                    <span className='text-xs text-muted-foreground/50 truncate max-w-32 hidden md:block'>
                      {item.keywords.split(' ').slice(0, 3).join(' ')}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

          <CommandSeparator />
          <CommandGroup heading='Tema'>
            <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
              <Sun /> <span>Claro</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
              <Moon className='scale-90' />
              <span>Oscuro</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
              <Laptop />
              <span>Sistema</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}