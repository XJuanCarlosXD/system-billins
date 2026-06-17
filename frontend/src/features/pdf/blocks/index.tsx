/* eslint-disable react-refresh/only-export-components */
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { DropZone } from '@measured/puck'
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
  // Layout horizontal real (legacy): logo a un lado, datos al otro.
  const logoEl = showLogo && cia.logo_url ? (
    <div className="pdf-logo" style={{ flex: '0 0 auto', maxWidth: 130, lineHeight: 0 }}>
      <img
        src={cia.logo_url}
        alt="logo"
        style={{ maxHeight: 70, maxWidth: 130, objectFit: 'contain', display: 'block' }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    </div>
  ) : null
  const infoEl = (
    <div className="pdf-empresa-info" style={{ flex: '1 1 auto' }}>
      <div style={{ fontSize: razonSize, fontWeight: 700, color: colorPrimario, lineHeight: 1.15 }}>
        {cia.razon_social}
      </div>
      {showDireccion && cia.direccion && <div className="pdf-text-sm">{cia.direccion}</div>}
      <div className="pdf-text-sm">
        {[
          showRnc && cia.rnc ? `RNC: ${cia.rnc}` : '',
          showTelefono && cia.telefono ? `Tel: ${cia.telefono}` : '',
          showEmail && cia.email ? cia.email : '',
        ].filter(Boolean).join(' | ')}
      </div>
    </div>
  )
  const isCenter = logoAlign === 'center'
  return (
    <div
      className="pdf-header-empresa"
      style={{
        display: 'flex',
        flexDirection: isCenter ? 'column' : 'row',
        alignItems: isCenter ? 'center' : 'center',
        gap: 12,
        paddingBottom: 6,
        borderBottom: `2px solid ${colorPrimario}`,
        textAlign: isCenter ? 'center' : 'left',
      }}
    >
      {isCenter ? (<>{logoEl}{infoEl}</>) : logoAlign === 'right' ? (<>{infoEl}{logoEl}</>) : (<>{logoEl}{infoEl}</>)}
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
// Fila — agrupa otros bloques en N columnas (usa DropZones de Puck)
// ────────────────────────────────────────────────────────────────────
type FilaProps = {
  columnas: number
  gap: number
  alineacion: 'flex-start' | 'center' | 'flex-end' | 'stretch'
}
function Fila({ columnas, gap, alineacion }: FilaProps & { puck?: any }) {
  const cols = Math.max(1, Math.min(6, Number(columnas) || 1))
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap, alignItems: alineacion, width: '100%',
    }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i}>
          <DropZone zone={`col-${i}`} />
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// EncabezadoFactura — combo legacy: empresa (logo + datos) + tarjeta doc
// ────────────────────────────────────────────────────────────────────
type EncabezadoFacturaProps = {
  showLogo: boolean
  colorPrimario: string
  showRnc: boolean
  showTelefono: boolean
  showEmail: boolean
  showDireccion: boolean
  razonSize: number
  docBg: string
  docColor: string
  showNcf: boolean
  showImpresion: boolean
}
function EncabezadoFactura(p: EncabezadoFacturaProps) {
  const data = usePdfData()
  if (!data || isReportePayload(data)) return null
  const cia = data.cia
  const d = (data as DocumentoPrintPayload).doc
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90mm', gap: 12, marginBottom: 4 }}>
      {/* Columna empresa: logo + razón + dirección + RNC|tel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 6, borderBottom: `2px solid ${p.colorPrimario}` }}>
        {p.showLogo && cia.logo_url ? (
          <img
            src={cia.logo_url}
            alt="logo"
            style={{ maxHeight: 70, maxWidth: 130, objectFit: 'contain', flex: '0 0 auto', display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        ) : null}
        <div style={{ flex: '1 1 auto' }}>
          <div style={{ fontSize: p.razonSize, fontWeight: 700, color: p.colorPrimario, lineHeight: 1.15 }}>
            {cia.razon_social || 'Empresa'}
          </div>
          {p.showDireccion && cia.direccion && <div className="pdf-text-sm">{cia.direccion}</div>}
          <div className="pdf-text-sm">
            {[
              p.showRnc && cia.rnc ? `RNC: ${cia.rnc}` : '',
              p.showTelefono && cia.telefono ? `Tel: ${cia.telefono}` : '',
              p.showEmail && cia.email ? cia.email : '',
            ].filter(Boolean).join(' | ') || 'RNC/teléfono no registrados'}
          </div>
        </div>
      </div>
      {/* Columna documento: tarjeta dark */}
      <div style={{ background: p.docBg, color: p.docColor, padding: '8px 10px', borderRadius: 4, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 70 }}>
        <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.1 }}>{d.tipo_label || d.tipo}</div>
        <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1, marginTop: 2 }}>
          {d.numero_display || `${d.tipo}-${d.no}`}
        </div>
        {p.showNcf && d.ncf_dgi && (
          <div style={{ fontSize: 10, marginTop: 4 }}>NCF: {d.ncf_dgi}</div>
        )}
        {p.showImpresion && d.impresion && (
          <div style={{ fontSize: 9, marginTop: 2, opacity: 0.85 }}>{d.impresion}</div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// PanelInfoFactura — panel cliente + panel fiscal estilo legacy
// ────────────────────────────────────────────────────────────────────
type PanelInfoFacturaProps = {
  showCliente: boolean
  showRnc: boolean
  showDireccion: boolean
  showVendedor: boolean
  showFecha: boolean
  showCondicion: boolean
  showPlazo: boolean
  showTipoNcf: boolean
  showFormaPago: boolean
  showEstado: boolean
}
function PanelInfoFactura(p: PanelInfoFacturaProps) {
  const data = usePdfData()
  if (!data || isReportePayload(data)) return null
  const d = (data as DocumentoPrintPayload).doc
  const cli = (data as DocumentoPrintPayload).cliente
  if (!cli) return null
  const cell = (label: string, value: any) => (
    <div style={{ padding: '5px 8px', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
      <div style={{ fontSize: 8, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 10, color: '#0F172A' }}>{value || 'N/A'}</div>
    </div>
  )
  return (
    <div style={{ marginTop: 4 }}>
      {/* Panel cliente: 2 columnas, 4 filas */}
      <div style={{
        display: 'grid', gridTemplateColumns: '62% 38%',
        background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 3,
      }}>
        {p.showCliente && cell('Cliente', cli.nombre)}
        {p.showCliente && cell('No. Cliente', cli.no)}
        {p.showRnc && cell('RNC/Cédula', cli.rnc)}
        {p.showFecha && cell('Fecha', d.fecha ? fmtDate(d.fecha) : null)}
        {p.showDireccion && cell('Dirección', cli.direccion)}
        {p.showCondicion && cell('Condición', d.condicion_pago)}
        {p.showVendedor && cell('Vendedor', d.vendedor)}
        {p.showPlazo && cell('Plazo', d.plazo_pago !== undefined ? `${d.plazo_pago} días` : null)}
      </div>
      {/* Panel fiscal: 4 columnas */}
      <div style={{
        display: 'grid', gridTemplateColumns: '30% 22% 30% 18%',
        background: '#EFF6FF', border: '1px solid #BFDBFE', borderTop: 'none', borderRadius: '0 0 3px 3px',
      }}>
        {p.showTipoNcf && cell('Tipo NCF', d.tipo_ncf_label || d.tipo_ncf)}
        {p.showEstado && cell('Estado', d.anulada ? 'ANULADA' : (d.impresion || d.estado))}
        {p.showFormaPago && cell('Forma Pago', d.forma_pago)}
        {p.showFecha && cell('Fecha', d.fecha ? fmtDate(d.fecha) : null)}
      </div>
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
  // position:absolute relativo al .pdf-page (que tiene position:relative en print.css)
  // para que aparezca centrado en la hoja, incluso al imprimir multi-página.
  return (
    <div className="pdf-watermark" style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: `translate(-50%, -50%) rotate(${angle}deg)`,
      fontSize: 140, fontWeight: 900, color, opacity,
      pointerEvents: 'none', zIndex: 999, whiteSpace: 'nowrap',
      letterSpacing: '0.1em',
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
// BloqueCuadreCaja — pinta resumen forma de pago + por NCF + matriz NCF×forma_pago
// + opcionalmente detalle de facturas del día. Lee de payload.extra.
// ────────────────────────────────────────────────────────────────────
type ResumenPagoItem = { tipo_pago: string; forma_pago: string; cantidad: number; total: number }
type PorNcfItem = {
  ncf_tipo: string; cantidad: number
  total_linea: number; descuento: number; impuesto: number; total_neto: number
}
type NcfFormaPagoItem = {
  ncf_tipo: string; tipo_pago: string; forma_pago: string
  cantidad: number; total: number
}
type FacturaItem = {
  tipo_factura: string; no_factura: string; nombre_cliente?: string; ncf_dgi?: string
  fecha?: string | null; total_neto?: number; impuesto?: number; descuento?: number
  forma_pago?: string; estado?: string; st_anulado?: string
}

function labelNcfHuman(t: string): string {
  const k = (t || '').toUpperCase()
  const map: Record<string, string> = {
    B01: 'Crédito Fiscal', B02: 'Consumo', B03: 'Nota de Débito', B04: 'Nota de Crédito',
    B11: 'Proveedor Informal', B12: 'Registro Único', B13: 'Gastos Menores',
    B14: 'Régimen Especial', B15: 'Gubernamental', B16: 'Exportación',
  }
  return map[k] || ''
}

type BloqueCuadreCajaProps = {
  showResumenPago: boolean
  showPorNcf: boolean
  showMatrizNcfFormaPago: boolean
  showDetalleFacturas: boolean
  colorTitulo: string
  fontSize: number
}

function BloqueCuadreCaja({
  showResumenPago, showPorNcf, showMatrizNcfFormaPago, showDetalleFacturas,
  colorTitulo, fontSize,
}: BloqueCuadreCajaProps) {
  const data = usePdfData()
  if (!data || !isReportePayload(data)) return null
  const extra = ((data as ReportePrintPayload).extra ?? {}) as Record<string, unknown>
  const resumen = (extra.resumen_pago as ResumenPagoItem[]) ?? []
  const porNcf = (extra.por_ncf as PorNcfItem[]) ?? []
  const porNcfFormaPago = (extra.por_ncf_forma_pago as NcfFormaPagoItem[]) ?? []
  const facturas = (extra.facturas as FacturaItem[]) ?? []

  // Pivot NCF × forma_pago
  const formasSet = new Set<string>()
  const filaMap = new Map<string, { ncf_tipo: string; total: number; por: Record<string, number> }>()
  for (const r of porNcfFormaPago) {
    formasSet.add(r.forma_pago)
    let f = filaMap.get(r.ncf_tipo)
    if (!f) { f = { ncf_tipo: r.ncf_tipo, total: 0, por: {} }; filaMap.set(r.ncf_tipo, f) }
    f.por[r.forma_pago] = (f.por[r.forma_pago] || 0) + (r.total || 0)
    f.total += r.total || 0
  }
  const formas = [...formasSet].sort((a, b) => a.localeCompare(b, 'es'))
  const filasMx = [...filaMap.values()].sort((a, b) => a.ncf_tipo.localeCompare(b.ncf_tipo))
  const totalesCol: Record<string, number> = {}
  for (const f of formas) totalesCol[f] = filasMx.reduce((s, fila) => s + (fila.por[f] || 0), 0)
  const totalMatrix = filasMx.reduce((s, f) => s + f.total, 0)

  // Resumen ordenado: cobros crédito (tipo_pago C*) al final
  const resumenSorted = [...resumen].sort((a, b) => {
    const ac = (a.tipo_pago || '').startsWith('C')
    const bc = (b.tipo_pago || '').startsWith('C')
    if (ac !== bc) return ac ? 1 : -1
    return (a.forma_pago || '').localeCompare(b.forma_pago || '', 'es')
  })
  const totalResumen = resumen.reduce((s, r) => s + (r.total || 0), 0)
  const totalPorNcf = porNcf.reduce((s, r) => s + (r.total_neto || 0), 0)
  const totalFacturas = facturas.reduce((s, f) => s + (f.total_neto || 0), 0)

  const sectionTitle: any = {
    fontSize: fontSize + 2, fontWeight: 700, color: colorTitulo,
    margin: '12px 0 4px 0', borderBottom: `1px solid ${colorTitulo}33`, paddingBottom: 2,
  }
  const tableStyle: any = { width: '100%', borderCollapse: 'collapse', fontSize }
  const thBase: any = {
    background: colorTitulo, color: '#fff', padding: '4px 6px', textAlign: 'left',
    fontWeight: 700,
  }
  const td: any = { padding: '3px 6px', borderBottom: '1px solid #e5e7eb' }
  const tdR: any = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  const tfootRow: any = { background: '#f3f4f6', fontWeight: 700 }

  return (
    <div className="pdf-cuadre-caja">
      {showResumenPago && (
        <>
          <div style={sectionTitle}>Resumen por Forma de Pago</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thBase, width: '15%' }}>Tipo</th>
                <th style={thBase}>Descripción</th>
                <th style={{ ...thBase, textAlign: 'right', width: '12%' }}>Cant.</th>
                <th style={{ ...thBase, textAlign: 'right', width: '20%' }}>Monto RD$</th>
              </tr>
            </thead>
            <tbody>
              {resumenSorted.length === 0 ? (
                <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#777' }}>Sin movimientos.</td></tr>
              ) : resumenSorted.map((r, i) => (
                <tr key={`${r.tipo_pago}-${r.forma_pago}-${i}`}>
                  <td style={{ ...td, fontFamily: 'monospace' }}>{r.tipo_pago}</td>
                  <td style={td}>{r.forma_pago}</td>
                  <td style={tdR}>{r.cantidad}</td>
                  <td style={tdR}>{money(r.total)}</td>
                </tr>
              ))}
              {resumenSorted.length > 0 && (
                <tr style={tfootRow}>
                  <td colSpan={3} style={{ ...tdR }}>Total Ingresos</td>
                  <td style={tdR}>{money(totalResumen)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {showPorNcf && (
        <>
          <div style={sectionTitle}>Resumen por Tipo NCF (DGII)</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thBase, width: '8%' }}>Tipo</th>
                <th style={thBase}>Descripción</th>
                <th style={{ ...thBase, textAlign: 'right', width: '8%' }}>Cant.</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Total Línea</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Descuento</th>
                <th style={{ ...thBase, textAlign: 'right' }}>ITBIS</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Total Neto</th>
              </tr>
            </thead>
            <tbody>
              {porNcf.length === 0 ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#777' }}>Sin facturas.</td></tr>
              ) : porNcf.map((r) => (
                <tr key={r.ncf_tipo}>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{r.ncf_tipo || '—'}</td>
                  <td style={td}>{labelNcfHuman(r.ncf_tipo)}</td>
                  <td style={tdR}>{r.cantidad}</td>
                  <td style={tdR}>{money(r.total_linea)}</td>
                  <td style={tdR}>{money(r.descuento)}</td>
                  <td style={tdR}>{money(r.impuesto)}</td>
                  <td style={{ ...tdR, fontWeight: 700 }}>{money(r.total_neto)}</td>
                </tr>
              ))}
              {porNcf.length > 0 && (
                <tr style={tfootRow}>
                  <td colSpan={6} style={tdR}>TOTAL</td>
                  <td style={tdR}>{money(totalPorNcf)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {showMatrizNcfFormaPago && formas.length > 0 && (
        <>
          <div style={sectionTitle}>NCF × Forma de Pago</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thBase, width: '8%' }}>NCF</th>
                <th style={thBase}>Descripción</th>
                {formas.map((f) => (
                  <th key={f} style={{ ...thBase, textAlign: 'right' }}>{f}</th>
                ))}
                <th style={{ ...thBase, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filasMx.map((fila) => (
                <tr key={fila.ncf_tipo}>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{fila.ncf_tipo || '—'}</td>
                  <td style={td}>{labelNcfHuman(fila.ncf_tipo)}</td>
                  {formas.map((f) => (
                    <td key={f} style={tdR}>{fila.por[f] ? money(fila.por[f]) : ''}</td>
                  ))}
                  <td style={{ ...tdR, fontWeight: 700 }}>{money(fila.total)}</td>
                </tr>
              ))}
              <tr style={tfootRow}>
                <td colSpan={2} style={tdR}>TOTAL</td>
                {formas.map((f) => <td key={f} style={tdR}>{money(totalesCol[f] || 0)}</td>)}
                <td style={tdR}>{money(totalMatrix)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {showDetalleFacturas && (() => {
        // Agrupar facturas por tipo NCF (mismo agrupamiento que los resúmenes).
        type Grupo = { ncf_tipo: string; rows: FacturaItem[]; total: number; itbis: number; descuento: number }
        const groups = new Map<string, Grupo>()
        for (const f of facturas) {
          const key = ((f.ncf_dgi || '').slice(0, 3) || '—').toUpperCase()
          const g = groups.get(key) || { ncf_tipo: key, rows: [], total: 0, itbis: 0, descuento: 0 }
          g.rows.push(f)
          g.total += f.total_neto || 0
          g.itbis += f.impuesto || 0
          g.descuento += f.descuento || 0
          groups.set(key, g)
        }
        const facturasPorNcf = [...groups.values()].sort((a, b) => a.ncf_tipo.localeCompare(b.ncf_tipo))
        const grupoHdr: any = { ...td, background: '#e2e8f0', fontWeight: 700 }
        const subTotalRow: any = { ...td, background: '#f1f5f9', fontWeight: 700 }
        return (
          <>
            <div style={sectionTitle}>Detalle de Facturas · agrupado por NCF</div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thBase, width: '14%' }}>No.</th>
                  <th style={{ ...thBase, width: '10%' }}>Fecha</th>
                  <th style={thBase}>Cliente</th>
                  <th style={{ ...thBase, width: '14%' }}>NCF</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>Descuento</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>ITBIS</th>
                  <th style={{ ...thBase, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {facturasPorNcf.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#777' }}>Sin facturas en el día.</td></tr>
                ) : facturasPorNcf.map((g) => (
                  <Fragment key={g.ncf_tipo}>
                    <tr>
                      <td colSpan={7} style={grupoHdr}>
                        <span style={{ fontFamily: 'monospace' }}>{g.ncf_tipo}</span>
                        <span style={{ marginLeft: 8, fontWeight: 400 }}>{labelNcfHuman(g.ncf_tipo)}</span>
                        <span style={{ marginLeft: 8, fontSize: fontSize - 1, color: '#555' }}>({g.rows.length} facturas)</span>
                      </td>
                    </tr>
                    {g.rows.map((f, i) => {
                      const num = `${f.tipo_factura || ''}-${f.no_factura || ''}`
                      const anul = (f.st_anulado === 'S')
                      return (
                        <tr key={`${g.ncf_tipo}-${num}-${i}`} style={anul ? { color: '#b91c1c' } : undefined}>
                          <td style={{ ...td, fontFamily: 'monospace', paddingLeft: 14 }}>{num}{anul ? ' (ANUL)' : ''}</td>
                          <td style={td}>{fmtDate(f.fecha)}</td>
                          <td style={td}>{(f.nombre_cliente || '').slice(0, 60)}</td>
                          <td style={{ ...td, fontFamily: 'monospace' }}>{f.ncf_dgi || '—'}</td>
                          <td style={tdR}>{money(f.descuento ?? 0)}</td>
                          <td style={tdR}>{money(f.impuesto ?? 0)}</td>
                          <td style={tdR}>{money(f.total_neto ?? 0)}</td>
                        </tr>
                      )
                    })}
                    <tr>
                      <td colSpan={4} style={{ ...subTotalRow, textAlign: 'right' }}>Subtotal {g.ncf_tipo}</td>
                      <td style={{ ...subTotalRow, textAlign: 'right' }}>{money(g.descuento)}</td>
                      <td style={{ ...subTotalRow, textAlign: 'right' }}>{money(g.itbis)}</td>
                      <td style={{ ...subTotalRow, textAlign: 'right' }}>{money(g.total)}</td>
                    </tr>
                  </Fragment>
                ))}
                {facturasPorNcf.length > 0 && (
                  <tr style={tfootRow}>
                    <td colSpan={6} style={tdR}>TOTAL FACTURAS ({facturas.length})</td>
                    <td style={tdR}>{money(totalFacturas)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )
      })()}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Puck Config
// ────────────────────────────────────────────────────────────────────
export type PuckBlockProps = {
  Fila: FilaProps
  HeaderEmpresa: HeaderEmpresaProps
  EncabezadoFactura: EncabezadoFacturaProps
  PanelInfoFactura: PanelInfoFacturaProps
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
  BloqueCuadreCaja: BloqueCuadreCajaProps
}

export const puckConfig: any = {
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
    Fila: {
      label: 'Fila — agrupar bloques en columnas',
      fields: {
        columnas: { type: 'number', min: 1, max: 6 },
        gap: { type: 'number', min: 0, max: 40 },
        alineacion: { type: 'select', options: [
          { label: 'Arriba', value: 'flex-start' },
          { label: 'Centro', value: 'center' },
          { label: 'Abajo', value: 'flex-end' },
          { label: 'Estirar', value: 'stretch' },
        ] },
      },
      defaultProps: { columnas: 2, gap: 12, alineacion: 'flex-start' },
      render: Fila as any,
    },
    EncabezadoFactura: {
      label: 'Encabezado Factura (empresa + doc)',
      fields: {
        showLogo: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        colorPrimario: { type: 'text' },
        showRnc: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showTelefono: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showEmail: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showDireccion: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        razonSize: { type: 'number', min: 10, max: 24 },
        docBg: { type: 'text' },
        docColor: { type: 'text' },
        showNcf: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showImpresion: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
      },
      defaultProps: {
        showLogo: true, colorPrimario: '#0F172A',
        showRnc: true, showTelefono: true, showEmail: false, showDireccion: true, razonSize: 15,
        docBg: '#0F172A', docColor: '#ffffff', showNcf: true, showImpresion: true,
      },
      render: EncabezadoFactura,
    },
    PanelInfoFactura: {
      label: 'Panel Info Factura (cliente + fiscal)',
      fields: {
        showCliente: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showRnc: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showDireccion: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showVendedor: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showFecha: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showCondicion: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showPlazo: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showTipoNcf: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showFormaPago: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showEstado: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
      },
      defaultProps: {
        showCliente: true, showRnc: true, showDireccion: true, showVendedor: true,
        showFecha: true, showCondicion: true, showPlazo: true,
        showTipoNcf: true, showFormaPago: true, showEstado: true,
      },
      render: PanelInfoFactura,
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
    BloqueCuadreCaja: {
      label: 'Bloque — Cuadre de Caja',
      fields: {
        showResumenPago: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showPorNcf: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showMatrizNcfFormaPago: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        showDetalleFacturas: { type: 'radio', options: [{ label: 'Sí', value: true }, { label: 'No', value: false }] },
        colorTitulo: { type: 'text' },
        fontSize: { type: 'number', min: 7, max: 14 },
      },
      defaultProps: {
        showResumenPago: true, showPorNcf: true, showMatrizNcfFormaPago: true,
        showDetalleFacturas: true, colorTitulo: '#0F172A', fontSize: 9,
      },
      render: BloqueCuadreCaja,
    },
  },
  root: {
    render: ({ children }: { children?: ReactNode }) => <div className="pdf-canvas">{children}</div>,
  },
}
