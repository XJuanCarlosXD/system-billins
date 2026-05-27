// CXC Cierre: asiento contable, generar asiento al mayor, cierre período
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Printer, ChevronRight, CheckCircle2 } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { buildReportMeta } from '../cnt/export-utils'


interface P { noCia: string; punto?: string; mes?: number; ano?: number }

const fmt = (n: any) => Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })

// ─── FCXC401 Imprimir Asiento Contable ───────────────────────────────────────
export function CxcAsientoContable({ noCia, punto = '01', mes = 1, ano = 2025 }: P) {
  const [mesVal, setMesVal] = useState(mes)
  const [anoVal, setAnoVal] = useState(ano)
  const [puntoVal, setPuntoVal] = useState(punto)
  const [tipoImpresion, setTipoImpresion] = useState<'detallado' | 'diario'>('detallado')
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await regalGeneralApi.cxcAsientoContable(noCia, puntoVal, mesVal, anoVal)
      setRows(r)
    } finally { setLoading(false) }
  }

  const totalDebito = rows.reduce((s, r) => s + (r.total_debito || 0), 0)
  const totalCredito = rows.reduce((s, r) => s + (r.total_credito || 0), 0)

  const printPdf = async () => {
    const mesAno = String(mesVal).padStart(2, '0') + '-' + anoVal
    const meta = await buildReportMeta(noCia, puntoVal, mesAno)
    const win = window.open('', '_blank')!
    const mesNombre = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mesVal - 1]
    win.document.write('<html><head><title>RCXC301 Asiento CXC</title><style>body{font-family:Arial,sans-serif;font-size:9pt;-webkit-print-color-adjust:exact}table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:3px 6px}th{background:#ddd;font-weight:bold}.r{text-align:right}@media print{body{-webkit-print-color-adjust:exact}}</style></head><body><h3>' + meta.company + '</h3><p>' + mesNombre + ' ' + anoVal + ' - Punto ' + puntoVal + '</p><table><thead><tr><th>Cuenta</th><th>Centro Costo</th><th class=r>Debito</th><th class=r>Credito</th></tr></thead><tbody>' + rows.map(function(r) { return '<tr><td>' + r.cuenta + '</td><td>' + (r.centro_costo||'') + '</td><td class=r>' + (r.total_debito>0?fmt(r.total_debito):'') + '</td><td class=r>' + (r.total_credito>0?fmt(r.total_credito):'') + '</td></tr>'; }).join('') + '<tr style=font-weight:bold;background:#eee><td colspan=2>TOTALES</td><td class=r>' + fmt(totalDebito) + '</td><td class=r>' + fmt(totalCredito) + '</td></tr></tbody></table></body></html>')
    win.document.close(); win.print()
  }

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">FCXC401 — Imprimir Asiento Contable</h1>

      <div className="grid grid-cols-3 gap-3 border rounded-lg p-4 bg-muted/30">
        <div className="space-y-1"><Label>Mes</Label><Input type="number" min={1} max={12} value={mesVal} onChange={e => setMesVal(Number(e.target.value))} /></div>
        <div className="space-y-1"><Label>Año</Label><Input type="number" min={2000} value={anoVal} onChange={e => setAnoVal(Number(e.target.value))} /></div>
        <div className="space-y-1"><Label>Punto</Label><Input value={puntoVal} onChange={e => setPuntoVal(e.target.value)} /></div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <Label className="text-sm font-semibold">Tipo de Impresión</Label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={tipoImpresion === 'detallado'} onChange={() => setTipoImpresion('detallado')} />
            <span>Soporte Detallado</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={tipoImpresion === 'diario'} onChange={() => setTipoImpresion('diario')} />
            <span>Entrada de Diario</span>
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={load} variant="secondary" className="gap-1">Previsualizar</Button>
        <Button onClick={printPdf} disabled={!rows.length} className="gap-1"><Printer className="h-4 w-4" />Imprimir</Button>
      </div>

      {rows.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead className="w-32">Centro Costo</TableHead>
                <TableHead className="w-36 text-right">Débito</TableHead>
                <TableHead className="w-36 text-right">Crédito</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono">{r.cuenta}</TableCell>
                  <TableCell>{r.centro_costo}</TableCell>
                  <TableCell className="text-right">{r.total_debito > 0 ? fmt(r.total_debito) : ''}</TableCell>
                  <TableCell className="text-right">{r.total_credito > 0 ? fmt(r.total_credito) : ''}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/50 border-t-2">
                <TableCell colSpan={2}>TOTALES</TableCell>
                <TableCell className="text-right">{fmt(totalDebito)}</TableCell>
                <TableCell className="text-right">{fmt(totalCredito)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── FCXC402 Generar Asiento al Mayor ────────────────────────────────────────
export function CxcGenerarAsiento({ noCia, punto = '01', mes = 1, ano = 2025 }: P) {
  const [mesProceso, setMesProceso] = useState(mes)
  const [anoProceso, setAnoProceso] = useState(ano)
  const [mesConta, setMesConta] = useState(mes)
  const [anoConta, setAnoConta] = useState(ano)
  const [puntoVal, setPuntoVal] = useState(punto)
  const [cierreFiscal, setCierreFiscal] = useState(false)
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const generar = async () => {
    setError(''); setSuccess('')
    if (!confirm('¿Generar asiento al mayor? Esta operación es irreversible.')) return
    setLoading(true)
    try {
      await regalGeneralApi.cxcGenerarAsiento({
        no_cia: noCia, punto: puntoVal,
        mes_proceso: mesProceso, ano_proceso: anoProceso,
        cierre_fiscal: cierreFiscal
      })
      setSuccess(`Asiento generado correctamente para ${String(mesProceso).padStart(2,'0')}/${anoProceso}`)
    } catch (e: any) { setError(e?.message || 'Error') } finally { setLoading(false) }
  }

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <h1 className="text-2xl font-semibold">FCXC402 — Generar Asiento al Mayor</h1>

      <div className="grid grid-cols-2 gap-3 border rounded-lg p-4 bg-muted/30">
        <div className="space-y-1"><Label>Mes en Proceso</Label><Input type="number" min={1} max={12} value={mesProceso} onChange={e => setMesProceso(Number(e.target.value))} /></div>
        <div className="space-y-1"><Label>Año en Proceso</Label><Input type="number" value={anoProceso} onChange={e => setAnoProceso(Number(e.target.value))} /></div>
        <div className="space-y-1"><Label>Mes Contabilidad</Label><Input type="number" min={1} max={12} value={mesConta} onChange={e => setMesConta(Number(e.target.value))} /></div>
        <div className="space-y-1"><Label>Año Contabilidad</Label><Input type="number" value={anoConta} onChange={e => setAnoConta(Number(e.target.value))} /></div>
        <div className="space-y-1"><Label>Punto</Label><Input value={puntoVal} onChange={e => setPuntoVal(e.target.value)} /></div>
        <div className="space-y-1"><Label>Fecha</Label><Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
      </div>

      <div className="border rounded-lg p-4 space-y-2">
        <Label className="font-semibold">Cierre del Período Fiscal</Label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={!cierreFiscal} onChange={() => setCierreFiscal(false)} />
            <span>No</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={cierreFiscal} onChange={() => setCierreFiscal(true)} />
            <span>Sí</span>
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
      {success && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded p-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{success}</p>}

      <Button onClick={generar} disabled={loading} className="w-full gap-2">
        <ChevronRight className="h-4 w-4" />{loading ? 'Generando...' : 'Generar Asiento'}
      </Button>
    </div>
  )
}

// ─── FCXC403 Cierre de Cuentas por Cobrar ────────────────────────────────────
export function CxcCierre({ noCia, punto = '01', mes = 1, ano = 2025 }: P) {
  const [puntoVal, setPuntoVal] = useState(punto)
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  const cerrar = async () => {
    setError(''); setResult(null)
    if (!confirm(`¿Ejecutar CIERRE de CXC para ${String(mes).padStart(2,'0')}/${ano}? Esta operación avanzará el período y NO puede deshacerse.`)) return
    setLoading(true)
    try {
      const r = await regalGeneralApi.cxcCierre({ no_cia: noCia, punto: puntoVal })
      setResult(r)
    } catch (e: any) { setError(e?.message || 'Error') } finally { setLoading(false) }
  }

  return (
    <div className="p-6 space-y-6 max-w-md">
      <h1 className="text-2xl font-semibold">FCXC403 — Cierre de Cuentas por Cobrar</h1>

      <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 text-sm text-amber-800">
        <strong>Advertencia:</strong> El cierre avanzará el período contable de CXC. Esta operación es irreversible. Asegúrese de haber generado el asiento al mayor primero.
      </div>

      <div className="grid grid-cols-2 gap-3 border rounded-lg p-4 bg-muted/30">
        <div className="space-y-1">
          <Label>Mes / Año Actual</Label>
          <div className="h-9 flex items-center font-semibold">{meses[mes - 1]} {ano}</div>
        </div>
        <div className="space-y-1">
          <Label>Punto</Label>
          <Input value={puntoVal} onChange={e => setPuntoVal(e.target.value)} />
        </div>
        <div className="space-y-1 col-span-2">
          <Label>Fecha</Label>
          <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded p-2">{error}</p>}

      {result && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
          <div>
            <div className="font-semibold text-green-800">Cierre ejecutado correctamente</div>
            <div className="text-sm text-green-700">Nuevo período: {meses[(result.mes || 1) - 1]} {result.ano}</div>
          </div>
        </div>
      )}

      <Button onClick={cerrar} disabled={loading} variant="destructive" className="w-full gap-2">
        <CheckCircle2 className="h-4 w-4" />{loading ? 'Procesando...' : 'Ejecutar Cierre'}
      </Button>
    </div>
  )
}
