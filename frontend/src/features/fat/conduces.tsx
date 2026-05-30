import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Eye, FileSpreadsheet, PackageOpen, Pencil, Printer, Search } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string; ano: number; mes: number }

type Conduce = {
  no_cia: string; punto: string; tipo_conduce: string; no_conduce: string
  no_cliente: number; nombre_cliente: string; fecha: string | null
  total_neto: number; total_linea: number; impuesto: number; descuento: number
  st_anulado: string; st_impresion: string; clase: string
  tipo_factura: string; no_factura: string; vendedor: string; detalle: string
}

type ConduceDetalle = Conduce & {
  forma_pago: string; no_condicion_pago: string; tipo_moneda: string
  tasa_us: number; ncf_dgi: string
  lineas: Array<{
    no_linea: number; almacen: string; no_produ: string; descripcion: string
    cantidad: number; precio: number; porc_descuento: number; descuento: number
    itbis: number; st_anulado: string
  }>
}

const fmtN = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ConducesFat({ noCia, punto, ano, mes }: Props) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Conduce[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState('ALL')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 30

  const [selected, setSelected] = useState<ConduceDetalle | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const load = (p = 1) => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatListConduces(noCia, punto, p, pageSize, search, tipo === 'ALL' ? '' : tipo, ano, mes)
      .then((d) => { setRows((d.items ?? []) as Conduce[]); setTotal(d.total ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { setPage(1); load(1) }, [noCia, punto, ano, mes, tipo])

  const handleSearch = () => { setPage(1); load(1) }

  const openDetail = async (row: Conduce) => {
    setLoadingDetail(true)
    try {
      const d = await regalGeneralApi.fatGetConduce(noCia, punto, row.tipo_conduce, row.no_conduce)
      setSelected(d as ConduceDetalle)
    } catch { /* ignore */ }
    finally { setLoadingDetail(false) }
  }

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, `${String(mes).padStart(2, '0')}/${ano}`)
    downloadCsv(
      `fat-conduces-${ano}${String(mes).padStart(2, '0')}.csv`,
      ['No. Conduce', 'Tipo', 'Cliente', 'Nombre', 'Fecha', 'Total Neto', 'ITBIS', 'Descuento', 'Estado', 'No. Factura'],
      rows.map((r) => [r.no_conduce, r.tipo_conduce, r.no_cliente, r.nombre_cliente, r.fecha || '',
                       (r.total_neto ?? 0).toFixed(2), (r.impuesto ?? 0).toFixed(2),
                       (r.descuento ?? 0).toFixed(2),
                       r.st_anulado === 'S' ? 'Anulado' : 'Activo', r.no_factura || '']),
      meta,
    )
  }

  const exportPdf = async () => {
    const meta = await buildReportMeta(noCia, punto, `${String(mes).padStart(2, '0')}/${ano}`)
    const win = window.open('', '_blank')!
    win.document.write(`<html><head><title>Conduces / Cotizaciones</title>
    <style>body{font-family:Arial,sans-serif;font-size:10px;padding:20px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:3px 5px}
    th{background:#ddd;font-weight:bold}.hdr{margin-bottom:10px}h3{margin:0;font-size:13px}
    .sub{color:#666}.r{text-align:right}.anulado{color:#999;text-decoration:line-through}</style></head><body>
    <div class="hdr"><h3>${meta.empresa}</h3>
    <div class="sub">Cotizaciones / Conduces &middot; ${meta.periodo}</div>
    <div class="sub">Generado: ${meta.fecha}</div></div>
    <table><thead><tr><th>No.</th><th>Tipo</th><th>Cliente</th><th>Fecha</th>
    <th class="r">Total Neto</th><th class="r">ITBIS</th><th>Estado</th><th>Factura</th></tr></thead>
    <tbody>${rows.map((r) => `<tr class="${r.st_anulado === 'S' ? 'anulado' : ''}">
    <td>${r.no_conduce}</td><td>${r.tipo_conduce}</td>
    <td>${r.no_cliente}${r.nombre_cliente ? ' - ' + r.nombre_cliente : ''}</td>
    <td>${r.fecha || ''}</td>
    <td class="r">${(r.total_neto ?? 0).toFixed(2)}</td>
    <td class="r">${(r.impuesto ?? 0).toFixed(2)}</td>
    <td>${r.st_anulado === 'S' ? 'Anulado' : 'Activo'}</td>
    <td>${r.no_factura || ''}</td></tr>`).join('')}
    </tbody></table></body></html>`)
    win.document.close(); win.print()
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <PackageOpen className='h-5 w-5' /> Cotizaciones / Conduces
          </h2>
          <p className='text-sm text-muted-foreground'>FFAT — Empresa {noCia} &middot; Punto {punto}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf}><Printer className='mr-1 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv}><FileSpreadsheet className='mr-1 h-4 w-4' /> Excel</Button>
        </div>
      </div>

      <div className='flex flex-wrap gap-2'>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className='w-40 h-9 text-sm'>
            <SelectValue placeholder='Tipo' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='ALL'>Todos</SelectItem>
            <SelectItem value='C'>Cotizacion</SelectItem>
            <SelectItem value='D'>Conduce</SelectItem>
            <SelectItem value='P'>Pedido</SelectItem>
          </SelectContent>
        </Select>
        <div className='flex gap-1'>
          <Input placeholder='Buscar cliente o no. conduce...' value={search} className='h-9 w-60 text-sm'
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          <Button size='sm' className='h-9' onClick={handleSearch}><Search className='h-4 w-4' /></Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-24'>No. Conduce</TableHead>
            <TableHead className='w-16 text-center'>Tipo</TableHead>
            <TableHead className='w-24'>Cliente</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead className='w-24'>Fecha</TableHead>
            <TableHead className='w-28 text-right'>Total Neto</TableHead>
            <TableHead className='w-24 text-right'>ITBIS</TableHead>
            <TableHead className='w-24 text-right'>Descuento</TableHead>
            <TableHead className='w-20 text-center'>Estado</TableHead>
            <TableHead className='w-24'>Factura</TableHead>
            <TableHead className='w-10'></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={11} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={11} className='py-10 text-center text-muted-foreground'>No hay conduces para este periodo.</TableCell></TableRow>}
          {rows.map((row) => (
            <TableRow key={`${row.tipo_conduce}-${row.no_conduce}`}
              className={`cursor-pointer hover:bg-muted/50 ${row.st_anulado === 'S' ? 'opacity-50 line-through' : ''}`}
              onClick={() => openDetail(row)}>
              <TableCell className='font-mono font-semibold'>{row.no_conduce}</TableCell>
              <TableCell className='text-center'>
                <Badge variant='outline' className='text-xs'>{row.tipo_conduce}</Badge>
              </TableCell>
              <TableCell className='font-mono text-sm'>{row.no_cliente}</TableCell>
              <TableCell className='text-sm'>{row.nombre_cliente}</TableCell>
              <TableCell className='text-sm'>{row.fecha}</TableCell>
              <TableCell className='text-right font-mono'>{(row.total_neto ?? 0).toFixed(2)}</TableCell>
              <TableCell className='text-right font-mono'>{(row.impuesto ?? 0).toFixed(2)}</TableCell>
              <TableCell className='text-right font-mono'>{(row.descuento ?? 0).toFixed(2)}</TableCell>
              <TableCell className='text-center'>
                <Badge variant={row.st_anulado === 'S' ? 'destructive' : 'default'} className='text-xs'>
                  {row.st_anulado === 'S' ? 'Anulado' : 'Activo'}
                </Badge>
              </TableCell>
              <TableCell className='font-mono text-sm'>{row.no_factura || '—'}</TableCell>
              <TableCell>
                <Button variant='ghost' size='icon' className='h-7 w-7' onClick={(e) => { e.stopPropagation(); openDetail(row) }}>
                  <Eye className='h-3.5 w-3.5' />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className='flex items-center justify-between text-sm text-muted-foreground'>
          <span>{total} registros &middot; Pagina {page} de {totalPages}</span>
          <div className='flex gap-1'>
            <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1) }}>Anterior</Button>
            <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => { setPage(page + 1); load(page + 1) }}>Siguiente</Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!selected || loadingDetail} onOpenChange={() => setSelected(null)}>
        <DialogContent className='w-[80vw] max-h-[85vh] max-w-none sm:max-w-none flex flex-col p-0 gap-0 overflow-hidden'>
          <DialogHeader className='px-6 py-4 border-b shrink-0 bg-white'>
            <div className='flex items-center justify-between gap-4 flex-wrap'>
              <div className='flex items-center gap-3 flex-wrap'>
                <DialogTitle className='text-lg'>
                  {loadingDetail ? 'Cargando...' : selected ? `Conduce ${selected.tipo_conduce}-${selected.no_conduce}` : ''}
                </DialogTitle>
                {selected && (
                  <>
                    <Badge variant={selected.st_anulado === 'S' ? 'destructive' : 'default'}>
                      {selected.st_anulado === 'S' ? 'Anulado' : 'Activo'}
                    </Badge>
                    {selected.ncf_dgi && (
                      <span className='font-mono text-sm bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-blue-800'>
                        NCF: {selected.ncf_dgi}
                      </span>
                    )}
                  </>
                )}
              </div>
              {selected && selected.st_anulado !== 'S' && (
                <Button
                  size='sm'
                  variant='outline'
                  className='gap-1 shrink-0'
                  onClick={() => {
                    setSelected(null)
                    navigate({
                      to: '/fat/nuevo-conduce' as never,
                      search: { id: selected.no_conduce, tipo: selected.tipo_conduce } as never,
                    })
                  }}
                >
                  <Pencil className='h-3.5 w-3.5' /> Editar
                </Button>
              )}
            </div>
          </DialogHeader>

          {selected && (
            <div className='flex-1 overflow-y-auto px-6 py-4 space-y-4'>
              {/* Header info */}
              <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
                <div>
                  <Label className='text-xs text-muted-foreground'>Cliente</Label>
                  <p className='font-mono font-semibold'>{selected.no_cliente}</p>
                  <p className='text-sm'>{selected.nombre_cliente}</p>
                </div>
                <div>
                  <Label className='text-xs text-muted-foreground'>Fecha</Label>
                  <p className='text-sm'>{selected.fecha || '—'}</p>
                </div>
                <div>
                  <Label className='text-xs text-muted-foreground'>Vendedor</Label>
                  <p className='font-mono text-sm'>{selected.vendedor || '—'}</p>
                </div>
                <div>
                  <Label className='text-xs text-muted-foreground'>Clase</Label>
                  <p className='text-sm'>{selected.clase || '—'}</p>
                </div>
                <div>
                  <Label className='text-xs text-muted-foreground'>Forma Pago</Label>
                  <p className='text-sm'>{selected.forma_pago || '—'}</p>
                </div>
                <div>
                  <Label className='text-xs text-muted-foreground'>Moneda</Label>
                  <p className='text-sm'>{selected.tipo_moneda || 'RD'} {selected.tasa_us ? `(${selected.tasa_us.toFixed(2)})` : ''}</p>
                </div>
                <div>
                  <Label className='text-xs text-muted-foreground'>Factura vinculada</Label>
                  <p className='font-mono text-sm'>{selected.no_factura ? `${selected.tipo_factura}-${selected.no_factura}` : '—'}</p>
                </div>
                <div>
                  <Label className='text-xs text-muted-foreground'>NCF DGI</Label>
                  <p className='font-mono text-sm text-blue-700'>{selected.ncf_dgi || '—'}</p>
                </div>
              </div>

              {selected.detalle && (
                <div>
                  <Label className='text-xs text-muted-foreground'>Detalle / Nota</Label>
                  <p className='text-sm mt-0.5 text-muted-foreground'>{selected.detalle}</p>
                </div>
              )}

              {/* Lines */}
              <div>
                <h3 className='font-semibold text-sm mb-2'>Lineas de Detalle</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-10'>Lin.</TableHead>
                      <TableHead className='w-16'>Alm.</TableHead>
                      <TableHead className='w-28'>Producto</TableHead>
                      <TableHead>Descripcion</TableHead>
                      <TableHead className='w-20 text-right'>Cantidad</TableHead>
                      <TableHead className='w-24 text-right'>Precio</TableHead>
                      <TableHead className='w-16 text-right'>%Desc.</TableHead>
                      <TableHead className='w-24 text-right'>Descuento</TableHead>
                      <TableHead className='w-20 text-right'>ITBIS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.lineas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className='text-center py-6 text-muted-foreground'>
                          Sin lineas de detalle.
                        </TableCell>
                      </TableRow>
                    )}
                    {selected.lineas.map((l) => (
                      <TableRow key={l.no_linea} className={l.st_anulado === 'S' ? 'opacity-40 line-through' : ''}>
                        <TableCell className='font-mono text-center text-sm'>{l.no_linea}</TableCell>
                        <TableCell className='font-mono text-sm'>{l.almacen}</TableCell>
                        <TableCell className='font-mono text-sm font-semibold'>{l.no_produ}</TableCell>
                        <TableCell className='text-sm'>{l.descripcion}</TableCell>
                        <TableCell className='text-right font-mono text-sm'>{fmtN(l.cantidad)}</TableCell>
                        <TableCell className='text-right font-mono text-sm'>{fmtN(l.precio)}</TableCell>
                        <TableCell className='text-right font-mono text-sm'>{l.porc_descuento > 0 ? `${l.porc_descuento}%` : '—'}</TableCell>
                        <TableCell className='text-right font-mono text-sm'>{l.descuento > 0 ? fmtN(l.descuento) : '—'}</TableCell>
                        <TableCell className='text-right font-mono text-sm'>{l.itbis > 0 ? fmtN(l.itbis) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Footer totals */}
          {selected && (
            <div className='border-t px-6 py-3 shrink-0 bg-gray-50 flex flex-wrap gap-6 justify-end text-sm'>
              <div className='flex gap-2'>
                <span className='text-muted-foreground'>Total Linea:</span>
                <span className='font-mono font-semibold'>{fmtN(selected.total_linea)}</span>
              </div>
              {selected.descuento > 0 && (
                <div className='flex gap-2 text-red-600'>
                  <span>Descuento:</span>
                  <span className='font-mono'>({fmtN(selected.descuento)})</span>
                </div>
              )}
              <div className='flex gap-2'>
                <span className='text-muted-foreground'>ITBIS:</span>
                <span className='font-mono'>{fmtN(selected.impuesto)}</span>
              </div>
              <div className='flex gap-2 font-bold text-base'>
                <span>Total Neto:</span>
                <span className='font-mono'>{fmtN(selected.total_neto)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
