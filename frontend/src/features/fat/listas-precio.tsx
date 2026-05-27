import { useEffect, useState } from 'react'
import { FileSpreadsheet, List, Printer } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'

interface Props { noCia: string; punto: string }

type TipoLista = { no_lista: string; descripcion: string; activa: boolean; tipo_moneda: string }
type DetalleLista = { no_produ: string; descripcion: string; precio: number; activo: boolean }

export function ListasPrecioFat({ noCia, punto }: Props) {
  const [tipos, setTipos] = useState<TipoLista[]>([])
  const [detalle, setDetalle] = useState<DetalleLista[]>([])
  const [selectedLista, setSelectedLista] = useState('')
  const [loadingTipos, setLoadingTipos] = useState(false)
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  useEffect(() => {
    if (!noCia) return
    setLoadingTipos(true)
    regalGeneralApi.fatListasPrecio(noCia, punto)
      .then((d) => {
        setTipos(d.tipos as TipoLista[])
        if (d.tipos?.length) setSelectedLista(d.tipos[0].no_lista)
      })
      .catch(() => {})
      .finally(() => setLoadingTipos(false))
  }, [noCia, punto])

  useEffect(() => {
    if (!selectedLista || !noCia) return
    setLoadingDetalle(true)
    regalGeneralApi.fatListasPrecio(noCia, punto, selectedLista)
      .then((d) => setDetalle(d.detalle as DetalleLista[] || []))
      .catch(() => {})
      .finally(() => setLoadingDetalle(false))
  }, [selectedLista, noCia, punto])

  const exportCsv = async () => {
    const meta = await buildReportMeta(noCia, punto, '')
    const lista = tipos.find((t) => t.no_lista === selectedLista)
    downloadCsv(
      `fat-lista-precio-${selectedLista}.csv`,
      ['No. Producto', 'Descripción', 'Precio', 'Activo'],
      detalle.map((r) => [r.no_produ, r.descripcion, r.precio.toFixed(4), r.activo ? 'S' : 'N']),
      meta,
    )
  }

  const exportPdf = async () => {
    const lista = tipos.find((t) => t.no_lista === selectedLista)
    const meta = await buildReportMeta(noCia, punto, '')
    const win = window.open('', '_blank')!
    win.document.write(`<html><head><title>RFAT106 - Lista de Precio ${selectedLista}</title>
    <style>body{font-family:Arial,sans-serif;font-size:10px;padding:20px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:3px 6px}
    th{background:#ddd;font-weight:bold;text-align:left}.hdr{margin-bottom:10px}
    h3{margin:0;font-size:13px}.sub{color:#666}</style></head><body>
    <div class="hdr"><h3>${meta.empresa}</h3>
    <div class="sub">Lista de Precio: ${selectedLista} — ${lista?.descripcion || ''} (${lista?.tipo_moneda || 'RD'})</div>
    <div class="sub">Generado: ${meta.fecha}</div></div>
    <table><thead><tr><th>No. Producto</th><th>Descripción</th><th style="text-align:right">Precio</th><th>Activo</th></tr></thead>
    <tbody>${detalle.map((r) => `<tr><td class="mono">${r.no_produ}</td><td>${r.descripcion}</td>
    <td style="text-align:right">${r.precio.toFixed(4)}</td><td>${r.activo ? 'S' : 'N'}</td></tr>`).join('')}
    </tbody></table></body></html>`)
    win.document.close(); win.print()
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <List className='h-5 w-5' /> Mantenimiento Tipo de Lista de Precio
          </h2>
          <p className='text-sm text-muted-foreground'>FFAT106 — Empresa {noCia} · Punto {punto}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={exportPdf} disabled={!selectedLista}><Printer className='mr-1 h-4 w-4' /> PDF</Button>
          <Button variant='outline' size='sm' onClick={exportCsv} disabled={!selectedLista}><FileSpreadsheet className='mr-1 h-4 w-4' /> Excel</Button>
        </div>
      </div>

      {/* Tipos de lista */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-20'>No. Lista</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className='w-24 text-center'>Moneda</TableHead>
              <TableHead className='w-20 text-center'>Activa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingTipos && <TableRow><TableCell colSpan={4} className='py-6 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
            {tipos.map((t) => (
              <TableRow key={t.no_lista}
                className={`cursor-pointer ${selectedLista === t.no_lista ? 'bg-muted' : ''}`}
                onClick={() => setSelectedLista(t.no_lista)}>
                <TableCell className='font-mono font-semibold'>{t.no_lista}</TableCell>
                <TableCell className='font-medium'>{t.descripcion}</TableCell>
                <TableCell className='text-center'><Badge variant='outline'>{t.tipo_moneda}</Badge></TableCell>
                <TableCell className='text-center'>
                  <Badge variant={t.activa ? 'default' : 'secondary'}>{t.activa ? 'Activa' : 'Inactiva'}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detalle de lista seleccionada */}
      {selectedLista && (
        <div>
          <h3 className='text-sm font-semibold mb-2'>
            Productos — Lista {selectedLista}
            {tipos.find((t) => t.no_lista === selectedLista)?.descripcion
              ? ` (${tipos.find((t) => t.no_lista === selectedLista)?.descripcion})` : ''}
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-28'>No. Producto</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className='w-28 text-right'>Precio</TableHead>
                <TableHead className='w-16 text-center'>Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingDetalle && <TableRow><TableCell colSpan={4} className='py-6 text-center text-muted-foreground'>Cargando...</TableCell></TableRow>}
              {!loadingDetalle && detalle.length === 0 && <TableRow><TableCell colSpan={4} className='py-6 text-center text-muted-foreground'>Sin productos en esta lista.</TableCell></TableRow>}
              {detalle.map((r) => (
                <TableRow key={r.no_produ}>
                  <TableCell className='font-mono'>{r.no_produ}</TableCell>
                  <TableCell>{r.descripcion}</TableCell>
                  <TableCell className='text-right font-mono'>{r.precio.toFixed(4)}</TableCell>
                  <TableCell className='text-center'>
                    <Badge variant={r.activo ? 'default' : 'secondary'} className='text-xs'>{r.activo ? 'S' : 'N'}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
