// Vista compartida para "Aplicar Saldos Menores Por Ajustar"
// Equivale a Fcxc204 / Fcxp204 legacy. El usuario:
//   1. Ingresa Monto máximo (default desde MAX_SALDO_MENOR_AJ de TCXC_PUNTO / TCXP_PUNTO).
//   2. Click "Buscar" → preview agrupado por cliente/proveedor.
//   3. Revisa los documentos que serían afectados.
//   4. Click "Aplicar" + confirmación → backend genera 1 AC por cliente con
//      saldos positivos pequeños y 1 AD por cliente con saldos negativos
//      pequeños, dejándolos en saldo 0.

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface DocCandidato {
  tipo_doc: string
  no_doc: string
  fecha: string
  valor: number
  saldo: number
  ncf?: string | null
}

interface GrupoCandidato {
  no_cliente?: string
  nombre_cliente?: string
  no_proveedor?: string
  nombre_proveedor?: string
  docs: DocCandidato[]
  total_saldo: number
}

interface Preview {
  max_saldo: number
  max_saldo_default: number
  positivos: GrupoCandidato[]
  negativos: GrupoCandidato[]
}

interface Props {
  noCia: string
  punto: string
  titulo: string
  contextoLegacy: string // ej: "Equivale a Fcxc204 — Aplicar Saldos Menores Por Ajustar"
  /** "cliente" o "proveedor" */
  entidad: 'cliente' | 'proveedor'
  /** Fetch preview */
  fetchPreview: (noCia: string, punto: string, maxSaldo?: number) => Promise<Preview>
  /** POST aplicar */
  fetchAplicar: (p: { no_cia: string; punto: string; max_saldo: number; fecha: string; motivo?: string }) => Promise<any>
}

const fmt = (n: number) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)

export function SaldosMenoresPanel({ noCia, punto, titulo, contextoLegacy, entidad, fetchPreview, fetchAplicar }: Props) {
  const [maxSaldo, setMaxSaldo] = useState<string>('1')
  const [fecha, setFecha] = useState(today())
  const [motivo, setMotivo] = useState('DOC. GENERADO POR SALDOS MENORES POR AJUSTAR')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [error, setError] = useState<string>('')

  const cargar = useCallback(async (maxVal?: number) => {
    if (!noCia) return
    setLoading(true); setError('')
    try {
      const data = await fetchPreview(noCia, punto || '01', maxVal)
      setPreview(data)
      if (data.max_saldo) setMaxSaldo(String(data.max_saldo))
    } catch (e: any) {
      setError(e?.message || 'Error cargando preview')
      setPreview(null)
    } finally { setLoading(false) }
  }, [noCia, punto, fetchPreview])

  useEffect(() => { cargar() /* default */ }, [cargar])

  const buscar = () => {
    const n = parseFloat(maxSaldo || '0')
    if (!Number.isFinite(n) || n <= 0) {
      setError('Indique un Monto máximo mayor que 0')
      return
    }
    cargar(n)
  }

  const aplicar = async () => {
    const n = parseFloat(maxSaldo || '0')
    if (!Number.isFinite(n) || n <= 0) return
    setAplicando(true); setError('')
    try {
      const res = await fetchAplicar({
        no_cia: noCia, punto: punto || '01',
        max_saldo: n, fecha, motivo,
      })
      if (res?.error) throw new Error(res.error)
      setResultado(res)
      setConfirmando(false)
      // Recargar preview para reflejar que los saldos quedaron en 0
      cargar(n)
    } catch (e: any) {
      setError(e?.message || 'No se pudo aplicar')
    } finally { setAplicando(false) }
  }

  const totalDocsPos = preview?.positivos.reduce((s, g) => s + g.docs.length, 0) ?? 0
  const totalDocsNeg = preview?.negativos.reduce((s, g) => s + g.docs.length, 0) ?? 0
  const sumaPos = preview?.positivos.reduce((s, g) => s + g.total_saldo, 0) ?? 0
  const sumaNeg = preview?.negativos.reduce((s, g) => s + g.total_saldo, 0) ?? 0
  const hayAlgo = totalDocsPos + totalDocsNeg > 0

  const labelEntidad = entidad === 'cliente' ? 'Cliente' : 'Proveedor'

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">{titulo}</h3>
        <p className="text-sm text-muted-foreground">
          {contextoLegacy} Cancela en bloque los saldos pendientes pequeños generando un
          Ajuste Crédito (AC) por cada {entidad} con saldo positivo y un Ajuste Débito (AD)
          por cada {entidad} con saldo negativo. Revise el preview antes de aplicar.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 border rounded-lg p-3 bg-muted/30">
        <div className="space-y-1">
          <Label className="text-xs">Monto máximo (saldo absoluto)</Label>
          <Input
            type="number" step="0.01" min="0"
            value={maxSaldo}
            onChange={e => setMaxSaldo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar()}
            className="h-8 w-32 font-mono tabular-nums"
            placeholder="1.00"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fecha del ajuste</Label>
          <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="h-8 w-40" />
        </div>
        <div className="space-y-1 flex-1 min-w-[280px]">
          <Label className="text-xs">Motivo / Detalle</Label>
          <Input value={motivo} onChange={e => setMotivo(e.target.value)} className="h-8" />
        </div>
        <Button onClick={buscar} size="sm" className="h-8 gap-1">
          <Search className="h-4 w-4" />Buscar
        </Button>
        <Button
          onClick={() => setConfirmando(true)}
          size="sm" variant="destructive"
          className="h-8"
          disabled={!hayAlgo || loading || aplicando}
        >
          Aplicar Ajustes
        </Button>
      </div>

      {/* Errores / resultado */}
      {error && (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>{error}</div>
        </div>
      )}
      {resultado && (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-sm flex gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-700" />
          <div>
            <b>Listo.</b> Se generaron {resultado.docs_creados?.length || 0} documentos de ajuste
            ({resultado.clientes_positivos || resultado.proveedores_positivos || 0} AC,{' '}
            {resultado.clientes_negativos || resultado.proveedores_negativos || 0} AD).
          </div>
        </div>
      )}

      {/* Resumen */}
      {preview && hayAlgo && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ResumenCard label={`${labelEntidad}s con saldo (+)`} value={preview.positivos.length} sub={`${totalDocsPos} documento${totalDocsPos !== 1 ? 's' : ''}`} tone="green" />
          <ResumenCard label={`${labelEntidad}s con saldo (–)`} value={preview.negativos.length} sub={`${totalDocsNeg} documento${totalDocsNeg !== 1 ? 's' : ''}`} tone="red" />
          <ResumenCard
            label="Neto a ajustar"
            value={fmt(sumaPos + sumaNeg)}
            sub={`(+) ${fmt(sumaPos)}   (–) ${fmt(Math.abs(sumaNeg))}`}
            tone="neutral"
          />
        </div>
      )}

      {/* Tablas */}
      {loading && <div className="text-sm text-muted-foreground py-8 text-center">Cargando…</div>}
      {!loading && preview && !hayAlgo && (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No hay documentos con saldo menor o igual a {fmt(parseFloat(maxSaldo || '0'))}.
        </div>
      )}

      {preview && preview.positivos.length > 0 && (
        <SeccionGrupo
          titulo={`Saldos a cancelar con AC (Ajuste Crédito) — ${labelEntidad}s con saldo positivo`}
          grupos={preview.positivos}
          entidad={entidad}
        />
      )}
      {preview && preview.negativos.length > 0 && (
        <SeccionGrupo
          titulo={`Saldos a cancelar con AD (Ajuste Débito) — ${labelEntidad}s con saldo negativo`}
          grupos={preview.negativos}
          entidad={entidad}
        />
      )}

      {/* Diálogo de confirmación */}
      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Aplicar Saldos Menores</DialogTitle>
            <DialogDescription>
              Se generarán <b>{preview?.positivos.length || 0} AC</b> y{' '}
              <b>{preview?.negativos.length || 0} AD</b> con fecha <b>{fecha}</b>,
              cancelando {totalDocsPos + totalDocsNeg} documento(s) con saldo
              menor o igual a {fmt(parseFloat(maxSaldo || '0'))}.
              Esta operación NO se puede revertir desde aquí (solo manualmente).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmando(false)} disabled={aplicando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={aplicar} disabled={aplicando}>
              {aplicando ? 'Aplicando…' : 'Confirmar y Aplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ResumenCard({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone: 'green' | 'red' | 'neutral' }) {
  const cls = tone === 'green' ? 'border-green-300 bg-green-50/50'
    : tone === 'red' ? 'border-red-300 bg-red-50/50'
    : 'bg-muted/30'
  return (
    <div className={`rounded border p-3 ${cls}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  )
}

function SeccionGrupo({ titulo, grupos, entidad }: { titulo: string; grupos: GrupoCandidato[]; entidad: 'cliente' | 'proveedor' }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b text-sm font-medium">{titulo}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">{entidad === 'cliente' ? 'Cliente' : 'Proveedor'}</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead className="w-28">Documento</TableHead>
            <TableHead className="w-28">Fecha</TableHead>
            <TableHead className="w-24 text-right">Valor</TableHead>
            <TableHead className="w-24 text-right">Saldo</TableHead>
            <TableHead className="w-24">NCF</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grupos.flatMap(g => g.docs.map((d, idx) => (
            <TableRow key={`${g.no_cliente || g.no_proveedor}-${d.tipo_doc}-${d.no_doc}`}>
              {idx === 0 && (
                <>
                  <TableCell rowSpan={g.docs.length} className="font-mono align-top">
                    {g.no_cliente || g.no_proveedor}
                  </TableCell>
                  <TableCell rowSpan={g.docs.length} className="align-top">
                    <div className="font-medium">{g.nombre_cliente || g.nombre_proveedor}</div>
                    <Badge variant={g.total_saldo >= 0 ? 'default' : 'destructive'} className="mt-1 tabular-nums">
                      Total: {fmt(g.total_saldo)}
                    </Badge>
                  </TableCell>
                </>
              )}
              <TableCell className="font-mono text-xs">{d.tipo_doc}-{d.no_doc}</TableCell>
              <TableCell className="text-xs tabular-nums">{d.fecha}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(d.valor)}</TableCell>
              <TableCell className={`text-right tabular-nums font-medium ${d.saldo < 0 ? 'text-destructive' : ''}`}>
                {fmt(d.saldo)}
              </TableCell>
              <TableCell className="font-mono text-xs">{d.ncf || ''}</TableCell>
            </TableRow>
          )))}
        </TableBody>
      </Table>
    </div>
  )
}
