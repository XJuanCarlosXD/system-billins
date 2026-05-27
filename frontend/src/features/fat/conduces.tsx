import { useEffect, useState } from 'react'
import { FileSpreadsheet, PackageOpen, Printer, Search } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string; ano: number; mes: number }

type Conduce = {
  no_cia: string; punto: string; tipo_conduce: string; no_conduce: string
  no_cliente: string; fecha: string; total_neto: number; total_linea: number
  impuesto: number; descuento: number; st_anulado: string; clase: string
  tipo_factura: string; no_factura: string; vendedor: string
}

export function ConducesFat({ noCia, punto, ano, mes }: Props) {
  const [rows, setRows] = useState<Conduce[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState('ALL')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 30

  const load = (p = 1) => {
    if (!noCia) return
    setLoading(true)
    regalGeneralApi.fatListConduces(noCia, punto, p, pageSize, search, tipo === 'ALL' ? '' : tipo, ano, mes)
      .then((d) => { setRows(d.items as Conduce[]); setTotal(d.total ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { setPage(1); load(1) }, [noCia, punto, ano, mes, tipo])

  const handleSearch = () => { setPage(1); load(1) }

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, `${String(mes).padStart(2, '0')}/${ano}`)
    downloadCsv(
    `fat-conduces-${ano}${String(mes).padStart(2, '0')}.csv`,
    ['No. Conduce', 'Tipo', 'Cliente', 'Fecha', 'Total Neto', 'Impuesto', 'Descuento', 'Estado', 'No. Factura'],
    rows.map((r) => [r.no_conduce, r.tipo_conduce, r.no_cliente, r.fecha,
                     r.total_neto.toFixed(2), r.impuesto.toFixed(2), r.descuento.toFixed(2),
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
    <div class="sub">Cotizaciones / Conduces · ${meta.periodo}</div>
    <div class="sub">Generado: ${meta.fecha}</div></div>
    <table><thead><tr><th>No.</th><th>Tipo</th><th>Cliente</th><th>Fecha</th>
    <th class="r">Total Neto</th><th class="r">ITBIS</th><th>Estado</th><th>Factura</th></tr></thead>
    <tbody>${rows.map((r) => `<tr class="${r.st_anulado === 'S' ? 'anulado' : ''}">
    <td>${r.no_conduce}</td><td>${r.tipo_conduce}</td><td>${r.no_cliente}</td><td>${r.fecha}</td>
    <td class="r">${r.total_neto.toFixed(2)}</td><td class="r">${r.impuesto.toFixed(2)}</td>
    <td>${r.st_anulado === 'S' ? 'Anulado' : 'Activo'}</td><td>${r.no_factura || ''}</td></tr>`).join('')}
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
          <p className='text-sm text-muted-foreground'>FFAT — Empresa {noCia} · Punto {punto}</p>
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
            <SelectItem value='C'>Cotización</SelectItem>
            <SelectItem value='D'>Conduce</SelectItem>
            <SelectItem value='P'>Pedido</SelectItem>
          </SelectContent>
        </Select>
        <div className='flex gap-1'>
          <Input placeholder='Buscar cliente o no. conduce…' value={search} className='h-9 w-60 text-sm'
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
            <TableHead className='w-24'>Fecha</TableHead>
            <TableHead className='w-28 text-right'>Total Neto</TableHead>
            <TableHead className='w-24 text-right'>ITBIS</TableHead>
            <TableHead className='w-24 text-right'>Descuento</TableHead>
            <TableHead className='w-20 text-center'>Estado</TableHead>
            <TableHead className='w-24'>Factura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
          {!loading && rows.length === 0 && <TableRow><TableCell colSpan={9} className='py-10 text-center text-muted-foreground'>No hay conduces para este período.</TableCell></TableRow>}
          {rows.map((row) => (
            <TableRow key={`${row.tipo_conduce}-${row.no_conduce}`}
              className={row.st_anulado === 'S' ? 'opacity-50 line-through' : ''}>
              <TableCell className='font-mono font-semibold'>{row.no_conduce}</TableCell>
              <TableCell className='text-center'>
                <Badge variant='outline' className='text-xs'>{row.tipo_conduce}</Badge>
              </TableCell>
              <TableCell className='font-mono text-sm'>{row.no_cliente}</TableCell>
              <TableCell className='text-sm'>{row.fecha}</TableCell>
              <TableCell className='text-right font-mono'>{row.total_neto.toFixed(2)}</TableCell>
              <TableCell className='text-right font-mono'>{row.impuesto.toFixed(2)}</TableCell>
              <TableCell className='text-right font-mono'>{row.descuento.toFixed(2)}</TableCell>
              <TableCell className='text-center'>
                <Badge variant={row.st_anulado === 'S' ? 'destructive' : 'default'} className='text-xs'>
                  {row.st_anulado === 'S' ? 'Anulado' : 'Activo'}
                </Badge>
              </TableCell>
              <TableCell className='font-mono text-sm'>{row.no_factura || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className='flex items-center justify-between text-sm text-muted-foreground'>
          <span>{total} registros · Página {page} de {totalPages}</span>
          <div className='flex gap-1'>
            <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1) }}>Anterior</Button>
            <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => { setPage(page + 1); load(page + 1) }}>Siguiente</Button>
          </div>
        </div>
      )}
    </section>
  )
}
