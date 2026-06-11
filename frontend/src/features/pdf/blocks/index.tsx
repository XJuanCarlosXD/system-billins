/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { Config } from '@measured/puck'
import type { DocumentoPrintPayload, ReportePrintPayload, PrintPayload } from '../types'
import { isReportePayload } from '../types'
import { renderTemplate } from '../handlebars-helpers'

// Convención: cada bloque usa `usePdfData<T>()` para leer el payload activo.
// El payload se entrega vía Context desde la página /print (puck-render.tsx).

import { createContext, useContext } from 'react'
const PdfDataContext = createContext<PrintPayload | null>(null)
export const PdfDataProvider = PdfDataContext.Provider
export function usePdfData<T extends PrintPayload = PrintPayload>(): T | null {
  return useContext(PdfDataContext) as T | null
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────
const money = (v: unknown, d = 2) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0
  return n.toLocaleString('es-DO', { minimumFractionDigits: d, maximumFractionDigits: d })
}
const fmtDate = (v: unknown) => {
  if (!v) return ''
  const s = String(v)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return s
  const [, y, mo, d] = m
  return `${d}/${mo}/${y}`
}

// ────────────────────────────────────────────────────────────────────
// HeaderEmpresa
// ────────────────────────────────────────────────────────────────────
type HeaderEmpresaProps = {
  showLogo: boolean
  logoAlign: 'left' | 'center' | 'right'
  colorPrimario: string
  showRnc: boolean
  showTelefono: boolean
  showEmail: boolean
  showDireccion: boolean
  razonSize: number
}
function HeaderEmpresa({
  showLogo, logoAlign, colorPrimario, showRnc, showTelefono, showEmail, showDireccion, razonSize,
}: HeaderEmpresaProps) {
  const data = usePdfData()
  const cia = data?.cia
  if (!cia) return null
  return (
    <div className="pdf-header-empresa" style={{ borderBottom: `2px solid ${colorPrimario}` }}>
      {showLogo && cia.logo_url && (
        <div className={`pdf-logo pdf-logo-${logoAlign}`}>
          <img src={cia.logo_url} alt="logo" style={{ maxHeight: 60 }} />
        </div>
      )}
      <div className="pdf-empresa-info">
        <div style={{ fontSize: razonSize, fontWeight: 700, color: colorPrimario, lineHeight: 1.1 }}>
          {cia.razon_social}
        </div>
        {showDireccion && cia.direccion && <div className="pdf-text-sm">{cia.direccion}</div>}
        {showRnc && cia.rnc && <div className="pdf-text-sm">RNC: {cia.rnc}</div>}
        {showTelefono && cia.telefono && <div className="pdf-text-sm">Tel: {cia.telefono}</div>}
        {showEmail && cia.email && <div className="pdf-text-sm">{cia.email}</div>}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// HeaderDocumento
// ────────────────────────────────────────────────────────────────────
type HeaderDocProps = {
  showNcf: boolean
  showFechaVenc: boolean
  showImpresion: boolean
  bgColor: string
  textColor: string
}
function HeaderDocumento({ showNcf, showFechaVenc, showImpresion, bgColor, textColor }: HeaderDocProps) {
  const data = usePdfData()
  if (!data || isReportePayload(data)) return null
  const d = (data as DocumentoPrintPayload).doc
  return (
    <div className="pdf-header-doc" style={{ background: bgColor, color: textColor, padding: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{d.tipo_label || d.tipo}</div>
      <div style={{ fontSize: 13 }}>No: {d.numero_display || `${d.tipo}-${d.no}`}</div>
      {showImpresion && d.impresion && <div style={{ fontSize: 10 }}>{d.impresion}</div>}
      {d.fecha && <div className="pdf-text-sm">Fecha: {fmtDate(d.fecha)}</div>}
      {showFechaVenc && d.fecha_venc && <div className="pdf-text-sm">Vence: {fmtDate(d.fecha_venc)}</div>}
      {showNcf && d.ncf_dgi && <div style={{ fontSize: 11 }}>NCF: {d.ncf_dgi}</div>}
      {showNcf && d.tipo_ncf_label && <div className="pdf-text-sm">{d.tipo_ncf_label}</div>}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// WatermarkAnulada
// ────────────────────────────────────────────────────────────────────
type WatermarkProps = { texto: string; opacity: number; angle: number; color: string }
function WatermarkAnulada({ texto, opacity, angle, color }: WatermarkProps) {
  const data = usePdfData()
  if (!data || isReportePayload(data)) return null
  const anulada = (data as DocumentoPrintPayload).doc.anulada
  if (!anulada) return null
  return (
    <div className="pdf-watermark" style={{
      position: 'fixed', top: '40%', left: '50%',
      transform: `translate(-50%, -50%) rotate(${angle}deg)`,
      fontSize: 120, fontWeight: 900, color, opacity,
      pointerEvents: 'none', zIndex: 999,
    }}>
      {texto}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// BloqueCliente
// ────────────────────────────────────────────────────────────────────
type BloqueClienteProps = {
  columnas: number
  showNombre: boolean
  showRnc: boolean
  showDireccion: boolean
  showTelefono: boolean
  showEmail: boolean
  showTipoNcf: boolean
  showCondicion: boolean
  showVendedor: boolean
}
function BloqueCliente({
  columnas, showNombre, showRnc, showDireccion, showTelefono, showEmail,
  showTipoNcf, showCondicion, showVendedor,
}: BloqueClienteProps) {
  const data = usePdfData()
  if (!data || isReportePayload(data)) return null
  const doc = (data as DocumentoPrintPayload).doc
  const cli = (data as DocumentoPrintPayload).cliente
  if (!cli) return null
  const rows: Array<{ k: string; v: string }> = []
  if (showNombre) rows.push({ k: 'Cliente', v: cli.nombre })
  if (showRnc && cli.rnc) rows.push({ k: 'RNC', v: cli.rnc })
  if (showDireccion && cli.direccion) rows.push({ k: 'Dirección', v: cli.direccion })
  if (showTelefono && cli.telefono) rows.push({ k: 'Teléfono', v: cli.telefono })
  if (showEmail && cli.email) rows.push({ k: 'Email', v: cli.email })
  if (showTipoNcf && doc.tipo_ncf_label) rows.push({ k: 'Tipo NCF', v: doc.tipo_ncf_label })
  if (showCondicion && doc.condicion_pago) rows.push({ k: 'Condición', v: doc.condicion_pago })
  if (showVendedor && doc.vendedor) rows.push({ k: 'Vendedor', v: doc.vendedor })
  return (
    <div className="pdf-bloque-cliente" style={{
      display: 'grid', gridTemplateColumns: `repeat(${columnas}, 1fr)`,
      gap: 4, padding: 10, border: '1px solid #ddd', borderRadius: 4,
    }}>
      {rows.map((r, i) => (
        <div key={i} className="pdf-text-sm">
          <span style={{ fontWeight: 600 }}>{r.k}:</span> {r.v}
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// TablaLineas
// ────────────────────────────────────────────────────────────────────
type Col = 'codigo' | 'descripcion' | 'cantidad' | 'unidad' | 'precio' | 'descuento' | 'itbis' | 'total'
type TablaLineasProps = {
  columnas: Col[]
  zebra: boolean
  headerBg: string
  headerColor: string
  fontSize: number
}
function TablaLineas({ columnas, zebra, headerBg, headerColor, fontSize }: TablaLineasProps) {
  const data = usePdfData()
  if (!data || isReportePayload(data)) return null
  const lineas = (data as DocumentoPrintPayload).lineas || []
  const colLabel: Record<Col, string> = {
    codigo: 'Código', descripcion: 'Descripción', cantidad: 'Cant.', unidad: 'U/M',
    precio: 'Precio', descuento: 'Desc.', itbis: 'ITBIS', total: 'Total',
  }
  const align = (c: Col): 'left' | 'right' | 'center' =>
    c === 'codigo' || c === 'descripcion' || c === 'unidad' ? 'left'
    : c === 'cantidad' ? 'center' : 'right'
  const renderCell = (l: any, c: Col): string => {
    switch (c) {
      case 'codigo': return l.codigo || ''
      case 'descripcion': return l.descripcion || ''
      case 'cantidad': return money(l.cantidad, l.cantidad % 1 === 0 ? 0 : 2)
      case 'unidad': return l.unidad || ''
      case 'precio': return money(l.precio)
      case 'descuento': return money(l.descuento)
      case 'itbis': return money(l.itbis)
      case 'total': return money(l.total)
    }
  }
  return (
    <table className="pdf-tabla-lineas" style={{
      width: '100%', borderCollapse: 'collapse', fontSize,
    }}>
      <thead>
        <tr style={{ background: headerBg, color: headerColor }}>
          {columnas.map((c) => (
            <th key={c} style={{
              textAlign: align(c), padding: '6px 4px', fontWeight: 700,
              borderBottom: '1px solid #999',
            }}>
              {colLabel[c]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lineas.map((l, i) => (
          <tr key={i} style={{
            background: zebra && i % 2 ? '#f5f5f5' : 'transparent',
            pageBreakInside: 'avoid',
          }}>
            {columnas.map((c) => (
              <td key={c} style={{
                textAlign: align(c), padding: '4px',
                borderBottom: '1px solid #eee',
              }}>
                {renderCell(l, c)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ────────────────────────────────────────────────────────────────────
// BloqueTotales
// ────────────────────────────────────────────────────────────────────
type BloqueTotalesProps = {
  showSubtotal: boolean
  showDescuento: boolean
  showItbis: boolean
  showPropina: boolean
  showOtros: boolean
  showMontoLetras: boolean
  align: 'left' | 'right'
  colorTotal: string
}
function BloqueTotales({
  showSubtotal, showDescuento, showItbis, showPropina, showOtros, showMontoLetras, align, colorTotal,
}: BloqueTotalesProps) {
  const data = usePdfData()
  if (!data || isReportePayload(data)) return null
  const t = (data as DocumentoPrintPayload).totales
  const row = (k: string, v: number, bold = false, color?: string) => (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ textAlign: 'right', padding: '3px 8px', fontWeight: bold ? 700 : 400, color }}>{k}</td>
      <td style={{ textAlign: 'right', padding: '3px 8px', width: 110, fontWeight: bold ? 700 : 400, color }}>
        RD$ {money(v)}
      </td>
    </tr>
  )
  return (
    <div className="pdf-bloque-totales" style={{ display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', marginTop: 8 }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 260 }}>
        <tbody>
          {showSubtotal && row('Subtotal', t.subtotal ?? 0)}
          {showDescuento && (t.descuento ?? 0) > 0 && row('Descuento', -(t.descuento ?? 0))}
          {showItbis && row('ITBIS', t.itbis ?? 0)}
          {showPropina && (t.propina ?? 0) > 0 && row('Propina', t.propina ?? 0)}
          {showOtros && (t.otros ?? 0) > 0 && row('Otros', t.otros ?? 0)}
          {row('TOTAL', t.total, true, colorTotal)}
          {showMontoLetras && t.monto_letras && (
            <tr><td colSpan={2} style={{ paddingTop: 6, fontSize: 9, fontStyle: 'italic' }}>
              ({t.monto_letras})
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// NotaDetalle
// ────────────────────────────────────────────────────────────────────
type NotaProps = { titulo: string; mostrarSiVacio: boolean }
function NotaDetalle({ titulo, mostrarSiVacio }: NotaProps) {
  const data = usePdfData()
  if (!data || isReportePayload(data)) return null
  const nota = (data as DocumentoPrintPayload).doc.nota || (data as DocumentoPrintPayload).doc.detalle || ''
  if (!nota && !mostrarSiVacio) return null
  return (
    <div className="pdf-nota" style={{ marginTop: 8, fontSize: 10 }}>
      <div style={{ fontWeight: 700 }}>{titulo}</div>
      <div>{nota || '—'}</div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Firmas
// ────────────────────────────────────────────────────────────────────
type FirmasProps = { cantidad: 1 | 2 | 3; labels: string; lineWidth: number }
function Firmas({ cantidad, labels, lineWidth }: FirmasProps) {
  const arr = labels.split('|').slice(0, cantidad)
  while (arr.length < cantidad) arr.push('Firma')
  return (
    <div className="pdf-firmas" style={{
      display: 'grid', gridTemplateColumns: `repeat(${cantidad}, 1fr)`,
      gap: 24, marginTop: 28,
    }}>
      {arr.map((lbl, i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: `${lineWidth}%`, margin: '0 auto', marginBottom: 4 }} />
          <div style={{ fontSize: 10 }}>{lbl.trim()}</div>
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// FooterEmpresa
// ────────────────────────────────────────────────────────────────────
type FooterProps = { texto: string; showPaginacion: boolean; showFechaGeneracion: boolean; color: string }
function FooterEmpresa({ texto, showPaginacion, showFechaGeneracion, color }: FooterProps) {
  const data = usePdfData()
  const now = new Date().toLocaleString('es-DO')
  return (
    <div className="pdf-footer" style={{
      marginTop: 20, paddingTop: 6, borderTop: '1px solid #ccc',
      fontSize: 8, color, display: 'flex', justifyContent: 'space-between',
    }}>
      <div>{renderTemplate(texto, data || {})}</div>
      <div>
        {showFechaGeneracion && <span>Generado: {now}</span>}
        {showPaginacion && <span className="pdf-pageno" style={{ marginLeft: 12 }} />}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// QRCode
// ────────────────────────────────────────────────────────────────────
type QrProps = { contenido: string; size: number; align: 'left' | 'center' | 'right' }
function QrBlock({ contenido, size, align }: QrProps) {
  const data = usePdfData()
  const [dataUrl, setDataUrl] = useState('')
  const resolved = renderTemplate(contenido, data || {})
  useEffect(() => {
    if (!resolved) { setDataUrl(''); return }
    QRCode.toDataURL(resolved, { width: size }).then(setDataUrl).catch(() => setDataUrl(''))
  }, [resolved, size])
  if (!dataUrl) return null
  return (
    <div style={{ textAlign: align, margin: '6px 0' }}>
      <img src={dataUrl} alt="QR" style={{ width: size, height: size }} />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// TextoLibre (con Handlebars)
// ────────────────────────────────────────────────────────────────────
type TextoLibreProps = { html: string; fontSize: number; textAlign: 'left' | 'center' | 'right' }
function TextoLibre({ html, fontSize, textAlign }: TextoLibreProps) {
  const data = usePdfData()
  const out = renderTemplate(html, data || {})
  return (
    <div style={{ fontSize, textAlign }} dangerouslySetInnerHTML={{ __html: out }} />
  )
}

// ────────────────────────────────────────────────────────────────────
// Imagen
// ────────────────────────────────────────────────────────────────────
type ImagenProps = { url: string; maxWidth: number; align: 'left' | 'center' | 'right' }
function Imagen({ url, maxWidth, align }: ImagenProps) {
  const data = usePdfData()
  const resolved = renderTemplate(url, data || {})
  if (!resolved) return null
  return (
    <div style={{ textAlign: align }}>
      <img src={resolved} alt="" style={{ maxWidth: `${maxWidth}%` }} />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Spacer / SeparadorHR
// ────────────────────────────────────────────────────────────────────
type SpacerProps = { height: number }
function Spacer({ height }: SpacerProps) {
  return <div style={{ height }} />
}
type HRProps = { thickness: number; color: string; margin: number }
function SeparadorHR({ thickness, color, margin }: HRProps) {
  return <hr style={{ border: 'none', borderTop: `${thickness}px solid ${color}`, margin: `${margin}px 0` }} />
}

// ────────────────────────────────────────────────────────────────────
// HeaderReporte / TablaReporte / FooterReporte
// ────────────────────────────────────────────────────────────────────
type HeaderReporteProps = { showFiltros: boolean; showFechaGeneracion: boolean; colorPrimario: string }
function HeaderReporte({ showFiltros, showFechaGeneracion, colorPrimario }: HeaderReporteProps) {
  const data = usePdfData()
  if (!data || !isReportePayload(data)) return null
  const r = (data as ReportePrintPayload).reporte
  return (
    <div style={{ borderBottom: `2px solid ${colorPrimario}`, paddingBottom: 6, marginBottom: 8 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: colorPrimario }}>{r.titulo}</div>
      {showFiltros && r.filtros && Object.keys(r.filtros).length > 0 && (
        <div style={{ fontSize: 10, color: '#555' }}>
          {Object.entries(r.filtros).map(([k, v]) => `${k}: ${v}`).join(' | ')}
        </div>
      )}
      {showFechaGeneracion && (
        <div style={{ fontSize: 9, color: '#777' }}>
          Generado: {new Date().toLocaleString('es-DO')}
        </div>
      )}
    </div>
  )
}

type TablaReporteColumna = { campo: string; label: string; align?: 'left' | 'right' | 'center'; format?: 'money' | 'date' | 'text' }
type TablaReporteProps = {
  columnasJson: string
  zebra: boolean
  headerBg: string
  headerColor: string
  fontSize: number
}
function TablaReporte({ columnasJson, zebra, headerBg, headerColor, fontSize }: TablaReporteProps) {
  const data = usePdfData()
  if (!data || !isReportePayload(data)) return null
  let cols: TablaReporteColumna[] = []
  try { cols = JSON.parse(columnasJson) } catch { cols = [] }
  const filas = (data as ReportePrintPayload).filas || []
  const fmt = (v: unknown, format?: string) => {
    if (format === 'money') return money(v)
    if (format === 'date') return fmtDate(v)
    return String(v ?? '')
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize }}>
      <thead>
        <tr style={{ background: headerBg, color: headerColor }}>
          {cols.map((c, i) => (
            <th key={i} style={{ textAlign: c.align || 'left', padding: '6px 4px', borderBottom: '1px solid #999' }}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={i} style={{ background: zebra && i % 2 ? '#f5f5f5' : 'transparent', pageBreakInside: 'avoid' }}>
            {cols.map((c, j) => (
              <td key={j} style={{ textAlign: c.align || 'left', padding: '4px', borderBottom: '1px solid #eee' }}>
                {fmt((f as Record<string, unknown>)[c.campo], c.format)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

type FooterReporteProps = { showCantidad: boolean; showTotal: boolean; colorPrimario: string }
function FooterReporte({ showCantidad, showTotal, colorPrimario }: FooterReporteProps) {
  const data = usePdfData()
  if (!data || !isReportePayload(data)) return null
  const t = (data as ReportePrintPayload).totales
  if (!t) return null
  return (
    <div style={{ marginTop: 8, borderTop: `1px solid ${colorPrimario}`, paddingTop: 6, fontSize: 10, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
      {showCantidad && <span>Total de registros: {t.cantidad ?? 0}</span>}
      {showTotal && t.total !== undefined && <span>Total: RD$ {money(t.total)}</span>}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Puck Config
// ────────────────────────────────────────────────────────────────────
export type PuckBlockProps = {
  HeaderEmpresa: HeaderEmpresaProps
  HeaderDocumento: HeaderDocProps
  WatermarkAnulada: WatermarkProps
  BloqueCliente: BloqueClienteProps
  TablaLineas: TablaLineasProps
  BloqueTotales: BloqueTotalesProps
  NotaDetalle: NotaProps
  Firmas: FirmasProps
  FooterEmpresa: FooterProps
  QRCode: QrProps
  TextoLibre: TextoLibreProps
  Imagen: ImagenProps
  Spacer: SpacerProps
  SeparadorHR: HRProps
  HeaderReporte: HeaderReporteProps
  TablaReporte: TablaReporteProps
  FooterReporte: FooterReporteProps
}

export const puckConfig: Config<PuckBlockProps> = {
  components: {
    HeaderEmpresa: {
      label: 'Header — Empresa',
      fields: {
        showLogo: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        logoAlign: { type: 'select', options: [
          { label: 'Izquierda', value: 'left' }, { label: 'Centro', value: 'center' }, { label: 'Derecha', value: 'right' },
        ] },
        colorPrimario: { type: 'text' },
        showRnc: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showTelefono: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showEmail: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showDireccion: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        razonSize: { type: 'number', min: 8, max: 28 },
      },
      defaultProps: {
        showLogo: true, logoAlign: 'left', colorPrimario: '#0F172A',
        showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 16,
      },
      render: HeaderEmpresa,
    },
    HeaderDocumento: {
      label: 'Header — Documento',
      fields: {
        showNcf: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showFechaVenc: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showImpresion: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        bgColor: { type: 'text' },
        textColor: { type: 'text' },
      },
      defaultProps: { showNcf: true, showFechaVenc: false, showImpresion: true, bgColor: '#0F172A', textColor: '#fff' },
      render: HeaderDocumento,
    },
    WatermarkAnulada: {
      label: 'Marca de agua — Anulada',
      fields: {
        texto: { type: 'text' },
        opacity: { type: 'number', min: 0.05, max: 0.5 },
        angle: { type: 'number', min: -90, max: 90 },
        color: { type: 'text' },
      },
      defaultProps: { texto: 'ANULADA', opacity: 0.18, angle: -30, color: '#dc2626' },
      render: WatermarkAnulada,
    },
    BloqueCliente: {
      label: 'Bloque — Cliente',
      fields: {
        columnas: { type: 'number', min: 1, max: 3 },
        showNombre: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showRnc: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showDireccion: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showTelefono: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showEmail: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showTipoNcf: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showCondicion: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showVendedor: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
      },
      defaultProps: {
        columnas: 2, showNombre: true, showRnc: true, showDireccion: true,
        showTelefono: false, showEmail: false, showTipoNcf: true, showCondicion: true, showVendedor: true,
      },
      render: BloqueCliente,
    },
    TablaLineas: {
      label: 'Tabla — Líneas del documento',
      fields: {
        columnas: { type: 'array', arrayFields: { value: { type: 'text' } }, getItemSummary: (i: any) => i.value },
        zebra: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        headerBg: { type: 'text' },
        headerColor: { type: 'text' },
        fontSize: { type: 'number', min: 7, max: 14 },
      } as any,
      defaultProps: {
        columnas: ['codigo', 'descripcion', 'cantidad', 'precio', 'descuento', 'itbis', 'total'] as Col[],
        zebra: true, headerBg: '#0F172A', headerColor: '#ffffff', fontSize: 9,
      },
      render: TablaLineas,
    },
    BloqueTotales: {
      label: 'Bloque — Totales',
      fields: {
        showSubtotal: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showDescuento: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showItbis: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showPropina: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showOtros: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showMontoLetras: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        align: { type: 'select', options: [{ label: 'Derecha', value: 'right' }, { label: 'Izquierda', value: 'left' }] },
        colorTotal: { type: 'text' },
      },
      defaultProps: {
        showSubtotal: true, showDescuento: true, showItbis: true, showPropina: true,
        showOtros: false, showMontoLetras: true, align: 'right', colorTotal: '#0F172A',
      },
      render: BloqueTotales,
    },
    NotaDetalle: {
      label: 'Nota / Detalle',
      fields: {
        titulo: { type: 'text' },
        mostrarSiVacio: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
      },
      defaultProps: { titulo: 'Nota:', mostrarSiVacio: false },
      render: NotaDetalle,
    },
    Firmas: {
      label: 'Firmas',
      fields: {
        cantidad: { type: 'select', options: [
          { label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 },
        ] },
        labels: { type: 'text' },
        lineWidth: { type: 'number', min: 30, max: 100 },
      },
      defaultProps: { cantidad: 2, labels: 'Recibido por|Entregado por', lineWidth: 80 },
      render: Firmas,
    },
    FooterEmpresa: {
      label: 'Footer — Empresa',
      fields: {
        texto: { type: 'textarea' },
        showPaginacion: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showFechaGeneracion: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        color: { type: 'text' },
      },
      defaultProps: {
        texto: '{{ cia.razon_social }} | {{ cia.rnc }}',
        showPaginacion: true, showFechaGeneracion: true, color: '#777777',
      },
      render: FooterEmpresa,
    },
    QRCode: {
      label: 'QR Code',
      fields: {
        contenido: { type: 'text' },
        size: { type: 'number', min: 40, max: 200 },
        align: { type: 'select', options: [
          { label: 'Izquierda', value: 'left' }, { label: 'Centro', value: 'center' }, { label: 'Derecha', value: 'right' },
        ] },
      },
      defaultProps: { contenido: '{{ doc.ncf_dgi }}', size: 100, align: 'right' },
      render: QrBlock,
    },
    TextoLibre: {
      label: 'Texto libre (Handlebars)',
      fields: {
        html: { type: 'textarea' },
        fontSize: { type: 'number', min: 8, max: 24 },
        textAlign: { type: 'select', options: [
          { label: 'Izquierda', value: 'left' }, { label: 'Centro', value: 'center' }, { label: 'Derecha', value: 'right' },
        ] },
      },
      defaultProps: { html: '<p>Texto editable. Usa variables: {{ doc.numero_display }}</p>', fontSize: 10, textAlign: 'left' },
      render: TextoLibre,
    },
    Imagen: {
      label: 'Imagen',
      fields: {
        url: { type: 'text' },
        maxWidth: { type: 'number', min: 10, max: 100 },
        align: { type: 'select', options: [
          { label: 'Izquierda', value: 'left' }, { label: 'Centro', value: 'center' }, { label: 'Derecha', value: 'right' },
        ] },
      },
      defaultProps: { url: '{{ cia.logo_url }}', maxWidth: 30, align: 'left' },
      render: Imagen,
    },
    Spacer: {
      label: 'Espacio',
      fields: { height: { type: 'number', min: 1, max: 100 } },
      defaultProps: { height: 8 },
      render: Spacer,
    },
    SeparadorHR: {
      label: 'Separador horizontal',
      fields: {
        thickness: { type: 'number', min: 1, max: 5 },
        color: { type: 'text' },
        margin: { type: 'number', min: 0, max: 30 },
      },
      defaultProps: { thickness: 1, color: '#cccccc', margin: 6 },
      render: SeparadorHR,
    },
    HeaderReporte: {
      label: 'Header — Reporte',
      fields: {
        showFiltros: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showFechaGeneracion: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        colorPrimario: { type: 'text' },
      },
      defaultProps: { showFiltros: true, showFechaGeneracion: true, colorPrimario: '#0F172A' },
      render: HeaderReporte,
    },
    TablaReporte: {
      label: 'Tabla — Reporte',
      fields: {
        columnasJson: { type: 'textarea' },
        zebra: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        headerBg: { type: 'text' },
        headerColor: { type: 'text' },
        fontSize: { type: 'number', min: 7, max: 14 },
      },
      defaultProps: {
        columnasJson: JSON.stringify(
          [
            { campo: 'no_factura', label: 'No.', align: 'left' },
            { campo: 'fecha', label: 'Fecha', align: 'left', format: 'date' },
            { campo: 'cliente', label: 'Cliente', align: 'left' },
            { campo: 'ncf_dgi', label: 'NCF', align: 'left' },
            { campo: 'total', label: 'Total', align: 'right', format: 'money' },
          ],
          null, 2,
        ),
        zebra: true, headerBg: '#0F172A', headerColor: '#ffffff', fontSize: 9,
      },
      render: TablaReporte,
    },
    FooterReporte: {
      label: 'Footer — Reporte',
      fields: {
        showCantidad: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showTotal: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        colorPrimario: { type: 'text' },
      },
      defaultProps: { showCantidad: true, showTotal: true, colorPrimario: '#0F172A' },
      render: FooterReporte,
    },
  },
  root: {
    render: ({ children }) => <div className="pdf-canvas">{children}</div>,
  },
}
