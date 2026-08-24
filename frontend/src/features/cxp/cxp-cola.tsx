import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { RefreshCw, PlayCircle, Pencil, Clock, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface P { noCia: string; punto?: string }

const fmt = (n: any) => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ESTADO_STYLE: Record<string, string> = {
  PENDIENTE: 'text-amber-700 bg-amber-50',
  MATERIALIZADO: 'text-green-700 bg-green-50',
  ERROR: 'text-red-700 bg-red-50',
}

// Cola de documentos CxP cuyo periodo (fecha) es POSTERIOR al periodo de
// proceso abierto. La captura en INV/FAT/manual no se rompe: el FP queda aqui
// en espera y se materializa solo al abrir su mes (cierre de CxP), o a mano
// desde el boton "Materializar" cuando ese mes ya este abierto.
export function CxpCola({ noCia, punto = '' }: P) {
  const navigate = useNavigate()
  const [data, setData] = useState<{ items: any[]; count: number; pendientes: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!noCia) return
    setLoading(true)
    try { setData(await regalGeneralApi.cxpCola(noCia, punto)) }
    finally { setLoading(false) }
  }, [noCia, punto])

  useEffect(() => { load() }, [load])

  const materializar = async (id: number) => {
    setMsg(null)
    try {
      const r: any = await regalGeneralApi.cxpColaMaterializar(id)
      const err = (r?.resultado || []).find((x: any) => x.error)
      setMsg(err ? `No se pudo materializar: ${err.error}` : `Materializado (${id}).`)
      await load()
    } catch (e: any) {
      setMsg(e?.message || 'Error al materializar')
    }
  }

  const items = data?.items || []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cola de Documentos (período no abierto)</h1>
          <p className="text-sm text-muted-foreground">
            Compras/facturas capturadas con fecha de un mes que CxP aún no ha abierto. Se materializan
            solas al cerrar/abrir ese período, o con el botón Materializar cuando ya esté abierto.
          </p>
        </div>
        <Button onClick={load} size="sm" variant="outline" className="h-8 gap-1" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refrescar
        </Button>
      </div>

      {data && (
        <div className="flex gap-6 text-sm text-muted-foreground border rounded-lg p-3 bg-muted/20">
          <span><b className="text-foreground">{data.count}</b> en cola</span>
          <span className="flex items-center gap-1"><Clock className="h-4 w-4 text-amber-600" />Pendientes: <b className="text-foreground">{data.pendientes}</b></span>
        </div>
      )}

      {msg && <div className="text-sm border rounded-lg p-3 bg-muted/30">{msg}</div>}

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">ID</TableHead>
              <TableHead className="w-24">Período obj.</TableHead>
              <TableHead className="w-20">Origen</TableHead>
              <TableHead className="w-16">Tipo</TableHead>
              <TableHead className="w-24">Proveedor</TableHead>
              <TableHead className="w-24">NCF</TableHead>
              <TableHead className="w-28">Fecha doc</TableHead>
              <TableHead className="w-28 text-right">Valor</TableHead>
              <TableHead className="w-32">Estado</TableHead>
              <TableHead className="w-40">Detalle</TableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={11} className="text-center py-8">Cargando...</TableCell></TableRow>}
            {!loading && items.length === 0 && <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No hay documentos en cola.</TableCell></TableRow>}
            {items.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">{r.id}</TableCell>
                <TableCell className="font-mono text-sm">{String(r.ano_objetivo)}-{String(r.mes_objetivo).padStart(2, '0')}</TableCell>
                <TableCell className="text-sm">{r.origen}</TableCell>
                <TableCell className="text-sm">{r.tipo_docu}</TableCell>
                <TableCell className="font-mono text-sm">{r.no_proveedor}</TableCell>
                <TableCell className="font-mono text-sm">{r.ncf || '—'}</TableCell>
                <TableCell className="text-sm">{r.fecha_doc}</TableCell>
                <TableCell className="text-right font-medium">{fmt(r.valor)}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${ESTADO_STYLE[r.estado] || ''}`}>
                    {r.estado === 'MATERIALIZADO' && <CheckCircle2 className="h-3 w-3" />}
                    {r.estado === 'PENDIENTE' && <Clock className="h-3 w-3" />}
                    {r.estado === 'ERROR' && <AlertTriangle className="h-3 w-3" />}
                    {r.estado}
                  </span>
                  {r.estado === 'MATERIALIZADO' && r.no_docu_generado && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">→ {r.tipo_docu} {r.no_docu_generado}</div>
                  )}
                  {r.estado === 'ERROR' && r.mensaje_error && (
                    <div className="text-[11px] text-red-600 mt-0.5 max-w-[16rem]">
                      <div className="truncate" title={r.mensaje_error}>{r.mensaje_error}</div>
                      {(() => {
                        // Si el error menciona el documento en conflicto
                        // ("... documento FP 0008690 ..."), ofrecer un enlace
                        // directo para abrirlo y ver ese caso (misma empresa).
                        const m = /documento\s+([A-Za-z]{2})\s+(\d+)/.exec(r.mensaje_error)
                        if (!m) return null
                        const tipo = m[1].toUpperCase()
                        const noDocu = m[2]
                        return (
                          <button
                            type="button"
                            onClick={() => navigate({ to: '/cxp/entrada-documentos', search: { tipo, no_docu: noDocu, cola_id: undefined } })}
                            className="mt-0.5 inline-flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />Ver {tipo}-{noDocu}
                          </button>
                        )
                      })()}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.usuario} · {r.fecha_encolado}</TableCell>
                <TableCell>
                  {r.estado === 'PENDIENTE' && (
                    <div className="flex gap-1">
                      <Button
                        onClick={() => navigate({ to: '/cxp/entrada-documentos', search: { cola_id: r.id, tipo: undefined, no_docu: undefined } })}
                        size="sm" variant="outline" className="h-7 gap-1 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />Editar
                      </Button>
                      <Button onClick={() => materializar(r.id)} size="sm" variant="outline" className="h-7 gap-1 text-xs">
                        <PlayCircle className="h-3.5 w-3.5" />Materializar
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
