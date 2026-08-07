/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
// Convención: cada bloque usa `usePdfData<T>()` para leer el payload activo.
// El payload se entrega vía Context desde la página /print (puck-render.tsx).

import { DropZone, type Config } from '@measured/puck'
import QRCode from 'qrcode'
import { renderTemplate } from '../handlebars-helpers'
import {
  isReportePayload,
  type DocumentoPrintPayload,
  type LineaPayload,
  type PrintPayload,
  type ReportePrintPayload,
} from '../types'

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
  return n.toLocaleString('es-DO', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
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
  showLogo,
  logoAlign,
  colorPrimario,
  showRnc,
  showTelefono,
  showEmail,
  showDireccion,
  razonSize,
}: HeaderEmpresaProps) {
  const data = usePdfData()
  const cia = data?.cia
  if (!cia) return null
  // Layout horizontal real (legacy): logo a un lado, datos al otro.
  const logoEl =
    showLogo && cia.logo_url ? (
      <div
        className='pdf-logo'
        style={{ flex: '0 0 auto', maxWidth: 130, lineHeight: 0 }}
      >
        <img
          src={cia.logo_url}
          alt='logo'
          style={{
            maxHeight: 70,
            maxWidth: 130,
            objectFit: 'contain',
            display: 'block',
          }}
          onError={(e) => {
            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      </div>
    ) : null
  const infoEl = (
    <div className='pdf-empresa-info' style={{ flex: '1 1 auto' }}>
      <div
        style={{
          fontSize: razonSize,
          fontWeight: 700,
          color: colorPrimario,
          lineHeight: 1.15,
        }}
      >
        {cia.razon_social}
      </div>
      {showDireccion && cia.direccion && (
        <div className='pdf-text-sm'>{cia.direccion}</div>
      )}
      <div className='pdf-text-sm'>
        {[
          showRnc && cia.rnc ? `RNC: ${cia.rnc}` : '',
          showTelefono && cia.telefono ? `Tel: ${cia.telefono}` : '',
          showEmail && cia.email ? cia.email : '',
        ]
          .filter(Boolean)
          .join(' | ')}
      </div>
    </div>
  )
  const isCenter = logoAlign === 'center'
  return (
    <div
      className='pdf-header-empresa'
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
      {isCenter ? (
        <>
          {logoEl}
          {infoEl}
        </>
      ) : logoAlign === 'right' ? (
        <>
          {infoEl}
          {logoEl}
        </>
      ) : (
        <>
          {logoEl}
          {infoEl}
        </>
      )}
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
function HeaderDocumento({
  showNcf,
  showFechaVenc,
  showImpresion,
  bgColor,
  textColor,
}: HeaderDocProps) {
  const data = usePdfData()
  if (!data || isReportePayload(data)) return null
  const d = (data as DocumentoPrintPayload).doc
  return (
    <div
      className='pdf-header-doc'
      style={{ background: bgColor, color: textColor, padding: 10 }}
    >
      <div style={{ fontSize: 14, fontWeight: 700 }}>
        {d.tipo_label || d.tipo}
      </div>
      <div style={{ fontSize: 13 }}>
        No: {d.numero_display || `${d.tipo}-${d.no}`}
      </div>
      {showImpresion && d.impresion && (
        <div style={{ fontSize: 10 }}>{d.impresion}</div>
      )}
      {d.fecha && <div className='pdf-text-sm'>Fecha: {fmtDate(d.fecha)}</div>}
      {showFechaVenc && d.fecha_venc && (
        <div className='pdf-text-sm'>Vence: {fmtDate(d.fecha_venc)}</div>
      )}
      {showNcf && d.ncf_dgi && (
        <div style={{ fontSize: 11 }}>NCF: {d.ncf_dgi}</div>
      )}
      {showNcf && d.tipo_ncf_label && (
        <div className='pdf-text-sm'>{d.tipo_ncf_label}</div>
      )}
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
function Fila({ columnas, gap, alineacion }: FilaProps) {
  const cols = Math.max(1, Math.min(6, Number(columnas) || 1))
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap,
        alignItems: alineacion,
        width: '100%',
      }}
    >
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 90mm',
        gap: 12,
        marginBottom: 4,
      }}
    >
      {/* Columna empresa: logo + razón + dirección + RNC|tel */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingBottom: 6,
          borderBottom: `2px solid ${p.colorPrimario}`,
        }}
      >
        {p.showLogo && cia.logo_url ? (
          <img
            src={cia.logo_url}
            alt='logo'
            style={{
              maxHeight: 70,
              maxWidth: 130,
              objectFit: 'contain',
              flex: '0 0 auto',
              display: 'block',
            }}
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : null}
        <div style={{ flex: '1 1 auto' }}>
          <div
            style={{
              fontSize: p.razonSize,
              fontWeight: 700,
              color: p.colorPrimario,
              lineHeight: 1.15,
            }}
          >
            {cia.razon_social || 'Empresa'}
          </div>
          {p.showDireccion && cia.direccion && (
            <div className='pdf-text-sm'>{cia.direccion}</div>
          )}
          <div className='pdf-text-sm'>
            {[
              p.showRnc && cia.rnc ? `RNC: ${cia.rnc}` : '',
              p.showTelefono && cia.telefono ? `Tel: ${cia.telefono}` : '',
              p.showEmail && cia.email ? cia.email : '',
            ]
              .filter(Boolean)
              .join(' | ') || 'RNC/teléfono no registrados'}
          </div>
        </div>
      </div>
      {/* Columna documento: tarjeta dark */}
      <div
        style={{
          background: p.docBg,
          color: p.docColor,
          padding: '8px 10px',
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: 70,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.1 }}>
          {d.tipo_label || d.tipo}
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            lineHeight: 1.1,
            marginTop: 2,
          }}
        >
          {d.numero_display || `${d.tipo}-${d.no}`}
        </div>
        {p.showNcf && d.ncf_dgi && (
          <div style={{ fontSize: 10, marginTop: 4 }}>NCF: {d.ncf_dgi}</div>
        )}
        {p.showImpresion && d.impresion && (
          <div style={{ fontSize: 9, marginTop: 2, opacity: 0.85 }}>
            {d.impresion}
          </div>
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
  const cell = (label: string, value: ReactNode) => (
    <div
      style={{
        padding: '5px 8px',
        borderRight: '1px solid #E2E8F0',
        borderBottom: '1px solid #E2E8F0',
      }}
    >
      <div
        style={{
          fontSize: 8,
          color: '#64748B',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 10, color: '#0F172A' }}>{value || 'N/A'}</div>
    </div>
  )
  return (
    <div style={{ marginTop: 4 }}>
      {/* Panel cliente: 2 columnas, 4 filas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '62% 38%',
          background: '#F8FAFC',
          border: '1px solid #CBD5E1',
          borderRadius: 3,
        }}
      >
        {p.showCliente && cell('Cliente', cli.nombre)}
        {p.showCliente && cell('No. Cliente', cli.no)}
        {p.showRnc && cell('RNC/Cédula', cli.rnc)}
        {p.showFecha && cell('Fecha', d.fecha ? fmtDate(d.fecha) : null)}
        {p.showDireccion && cell('Dirección', cli.direccion)}
        {p.showCondicion && cell('Condición', d.condicion_pago)}
        {p.showVendedor && cell('Vendedor', d.vendedor)}
        {p.showPlazo &&
          cell(
            'Plazo',
            d.plazo_pago !== undefined ? `${d.plazo_pago} días` : null
          )}
      </div>
      {/* Panel fiscal: 4 columnas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '30% 22% 30% 18%',
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderTop: 'none',
          borderRadius: '0 0 3px 3px',
        }}
      >
        {p.showTipoNcf && cell('Tipo NCF', d.tipo_ncf_label || d.tipo_ncf)}
        {p.showEstado &&
          cell('Estado', d.anulada ? 'ANULADA' : d.impresion || d.estado)}
        {p.showFormaPago && cell('Forma Pago', d.forma_pago)}
        {p.showFecha && cell('Fecha', d.fecha ? fmtDate(d.fecha) : null)}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// WatermarkAnulada
// ────────────────────────────────────────────────────────────────────
type WatermarkProps = {
  texto: string
  opacity: number
  angle: number
  color: string
}
function WatermarkAnulada({ texto, opacity, angle, color }: WatermarkProps) {
  const data = usePdfData()
  if (!data || isReportePayload(data)) return null
  const anulada = (data as DocumentoPrintPayload).doc.anulada
  if (!anulada) return null
  // position:absolute relativo al .pdf-page (que tiene position:relative en print.css)
  // para que aparezca centrado en la hoja, incluso al imprimir multi-página.
  return (
    <div
      className='pdf-watermark'
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) rotate(${angle}deg)`,
        fontSize: 140,
        fontWeight: 900,
        color,
        opacity,
        pointerEvents: 'none',
        zIndex: 999,
        whiteSpace: 'nowrap',
        letterSpacing: '0.1em',
      }}
    >
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
  columnas,
  showNombre,
  showRnc,
  showDireccion,
  showTelefono,
  showEmail,
  showTipoNcf,
  showCondicion,
  showVendedor,
}: BloqueClienteProps) {
  const data = usePdfData()
  if (!data || isReportePayload(data)) return null
  const doc = (data as DocumentoPrintPayload).doc
  const cli = (data as DocumentoPrintPayload).cliente
  if (!cli) return null
  const rows: Array<{ k: string; v: string }> = []
  if (showNombre) rows.push({ k: 'Cliente', v: cli.nombre })
  if (showRnc && cli.rnc) rows.push({ k: 'RNC', v: cli.rnc })
  if (showDireccion && cli.direccion)
    rows.push({ k: 'Dirección', v: cli.direccion })
  if (showTelefono && cli.telefono)
    rows.push({ k: 'Teléfono', v: cli.telefono })
  if (showEmail && cli.email) rows.push({ k: 'Email', v: cli.email })
  if (showTipoNcf && doc.tipo_ncf_label)
    rows.push({ k: 'Tipo NCF', v: doc.tipo_ncf_label })
  if (showCondicion && doc.condicion_pago)
    rows.push({ k: 'Condición', v: doc.condicion_pago })
  if (showVendedor && doc.vendedor)
    rows.push({ k: 'Vendedor', v: doc.vendedor })
  return (
    <div
      className='pdf-bloque-cliente'
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columnas}, 1fr)`,
        gap: 4,
        padding: 10,
        border: '1px solid #ddd',
        borderRadius: 4,
      }}
    >
      {rows.map((r, i) => (
        <div key={i} className='pdf-text-sm'>
          <span style={{ fontWeight: 600 }}>{r.k}:</span> {r.v}
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// TablaLineas
// ────────────────────────────────────────────────────────────────────
type Col =
  | 'codigo'
  | 'descripcion'
  | 'cantidad'
  | 'unidad'
  | 'precio'
  | 'descuento'
  | 'itbis'
  | 'total'
type TablaLineasProps = {
  columnas: Col[]
  zebra: boolean
  headerBg: string
  headerColor: string
  fontSize: number
}
function TablaLineas({
  columnas,
  zebra,
  headerBg,
  headerColor,
  fontSize,
}: TablaLineasProps) {
  const data = usePdfData()
  if (!data || isReportePayload(data)) return null
  const lineas = (data as DocumentoPrintPayload).lineas || []
  const extra = (data as DocumentoPrintPayload).extra as
    | { documentos_aplicados?: DocumentoAplicadoPayload[]; tiene_devolucion?: boolean }
    | undefined
  const documentosAplicados = extra?.documentos_aplicados || []
  const colLabel: Record<Col, string> = {
    codigo: 'Código',
    descripcion: 'Descripción',
    cantidad: 'Cant.',
    unidad: 'U/M',
    precio: 'Precio',
    descuento: 'Desc.',
    itbis: 'ITBIS',
    total: 'Total',
  }
  const align = (c: Col): 'left' | 'right' | 'center' =>
    c === 'codigo' || c === 'descripcion' || c === 'unidad'
      ? 'left'
      : c === 'cantidad'
        ? 'center'
        : 'right'
  const renderCell = (l: LineaPayload, c: Col): string => {
    switch (c) {
      case 'codigo':
        return l.codigo || ''
      case 'descripcion':
        return l.descripcion || ''
      case 'cantidad':
        return money(l.cantidad, l.cantidad % 1 === 0 ? 0 : 2)
      case 'unidad':
        return l.unidad || ''
      case 'precio':
        return money(l.precio)
      case 'descuento':
        return money(l.descuento)
      case 'itbis':
        return money(l.itbis)
      case 'total':
        return money(l.total)
    }
  }
  // La descripcion y el total necesitan JSX (badge + monto actualizado)
  // cuando el producto tuvo una devolucion parcial/total contra esta misma
  // factura — el resto de columnas se quedan como texto plano.
  const renderCellNode = (l: LineaPayload, c: Col) => {
    const devuelto = l.devuelto_cantidad || 0
    if (c === 'descripcion' && devuelto > 0) {
      return (
        <>
          {l.descripcion || ''}
          <span
            style={{
              marginLeft: 6,
              padding: '1px 6px',
              borderRadius: 3,
              fontSize: fontSize - 2,
              fontWeight: 700,
              color: '#fff',
              background: '#ea580c',
              textTransform: 'uppercase',
            }}
          >
            Devuelto {money(devuelto, devuelto % 1 === 0 ? 0 : 2)}
          </span>
        </>
      )
    }
    if (c === 'total' && devuelto > 0) {
      return (
        <>
          <span style={{ textDecoration: 'line-through', color: '#888' }}>
            {money(l.total)}
          </span>
          <br />
          <span style={{ fontWeight: 700 }}>
            {money(l.monto_actualizado ?? l.total)}
          </span>
        </>
      )
    }
    return renderCell(l, c)
  }
  const tabla = (
    <table
      className='pdf-tabla-lineas'
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize,
      }}
    >
      <thead>
        <tr style={{ background: headerBg, color: headerColor }}>
          {columnas.map((c) => (
            <th
              key={c}
              style={{
                textAlign: align(c),
                padding: '6px 4px',
                fontWeight: 700,
                borderBottom: '1px solid #999',
              }}
            >
              {colLabel[c]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lineas.map((l, i) => (
          <tr
            key={i}
            style={{
              background: zebra && i % 2 ? '#f5f5f5' : 'transparent',
              pageBreakInside: 'avoid',
            }}
          >
            {columnas.map((c) => (
              <td
                key={c}
                style={{
                  textAlign: align(c),
                  padding: '4px',
                  borderBottom: '1px solid #eee',
                }}
              >
                {renderCellNode(l, c)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <>
      {tabla}
      {documentosAplicados.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: fontSize + 1, fontWeight: 700, marginBottom: 2 }}>
            Documentos aplicados (NC / RI / Devolución)
          </div>
          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontSize }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid #999', fontWeight: 700 }}>
                <td style={{ padding: '3px 4px' }}>Documento</td>
                <td style={{ padding: '3px 4px' }}>Fecha</td>
                <td style={{ padding: '3px 4px', textAlign: 'right' }}>
                  Monto
                </td>
              </tr>
            </thead>
            <tbody>
              {documentosAplicados.map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '3px 4px', fontFamily: 'monospace' }}>
                    {d.numero_display}
                  </td>
                  <td style={{ padding: '3px 4px' }}>{d.fecha}</td>
                  <td style={{ padding: '3px 4px', textAlign: 'right' }}>
                    {money(d.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
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
  showSubtotal,
  showDescuento,
  showItbis,
  showPropina,
  showOtros,
  showMontoLetras,
  align,
  colorTotal,
}: BloqueTotalesProps) {
  const data = usePdfData()
  if (!data || isReportePayload(data)) return null
  const t = (data as DocumentoPrintPayload).totales
  const row = (k: string, v: number, bold = false, color?: string) => (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td
        style={{
          textAlign: 'right',
          padding: '3px 8px',
          fontWeight: bold ? 700 : 400,
          color,
        }}
      >
        {k}
      </td>
      <td
        style={{
          textAlign: 'right',
          padding: '3px 8px',
          width: 110,
          fontWeight: bold ? 700 : 400,
          color,
        }}
      >
        RD$ {money(v)}
      </td>
    </tr>
  )
  return (
    <div
      className='pdf-bloque-totales'
      style={{
        display: 'flex',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        marginTop: 8,
      }}
    >
      <table style={{ borderCollapse: 'collapse', minWidth: 260 }}>
        <tbody>
          {showSubtotal && row('Subtotal', t.subtotal ?? 0)}
          {showDescuento &&
            (t.descuento ?? 0) > 0 &&
            row('Descuento', -(t.descuento ?? 0))}
          {showItbis && row('ITBIS', t.itbis ?? 0)}
          {showPropina &&
            (t.propina ?? 0) > 0 &&
            row('Propina', t.propina ?? 0)}
          {showOtros && (t.otros ?? 0) > 0 && row('Otros', t.otros ?? 0)}
          {row('TOTAL', t.total, true, colorTotal)}
          {showMontoLetras && t.monto_letras && (
            <tr>
              <td
                colSpan={2}
                style={{ paddingTop: 6, fontSize: 9, fontStyle: 'italic' }}
              >
                ({t.monto_letras})
              </td>
            </tr>
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
  const nota =
    (data as DocumentoPrintPayload).doc.nota ||
    (data as DocumentoPrintPayload).doc.detalle ||
    ''
  if (!nota && !mostrarSiVacio) return null
  return (
    <div className='pdf-nota' style={{ marginTop: 8, fontSize: 10 }}>
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
    <div
      className='pdf-firmas'
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cantidad}, 1fr)`,
        gap: 24,
        marginTop: 28,
      }}
    >
      {arr.map((lbl, i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <div
            style={{
              borderTop: '1px solid #000',
              width: `${lineWidth}%`,
              margin: '0 auto',
              marginBottom: 4,
            }}
          />
          <div style={{ fontSize: 10 }}>{lbl.trim()}</div>
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// FooterEmpresa
// ────────────────────────────────────────────────────────────────────
type FooterProps = {
  texto: string
  showPaginacion: boolean
  showFechaGeneracion: boolean
  color: string
}
function FooterEmpresa({
  texto,
  showPaginacion,
  showFechaGeneracion,
  color,
}: FooterProps) {
  const data = usePdfData()
  // Para documentos usamos la fecha del documento (no la hora del navegador),
  // así un documento con fecha retroactiva muestra "Generado" coherente.
  let generado = new Date().toLocaleString('es-DO')
  if (data && !isReportePayload(data)) {
    const f = (data as DocumentoPrintPayload).doc?.fecha
    if (f) generado = fmtDate(f)
  }
  return (
    <div
      className='pdf-footer'
      style={{
        marginTop: 20,
        paddingTop: 6,
        borderTop: '1px solid #ccc',
        fontSize: 8,
        color,
        display: 'flex',
        justifyContent: 'space-between',
      }}
    >
      <div>{renderTemplate(texto, data || {})}</div>
      <div>
        {showFechaGeneracion && <span>Generado: {generado}</span>}
        {showPaginacion && (
          <span className='pdf-pageno' style={{ marginLeft: 12 }} />
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// QRCode
// ────────────────────────────────────────────────────────────────────
type QrProps = {
  contenido: string
  size: number
  align: 'left' | 'center' | 'right'
}
function QrBlock({ contenido, size, align }: QrProps) {
  const data = usePdfData()
  const [dataUrl, setDataUrl] = useState('')
  const resolved = renderTemplate(contenido, data || {})
  useEffect(() => {
    let canceled = false
    if (!resolved) {
      queueMicrotask(() => {
        if (!canceled) setDataUrl('')
      })
      return () => {
        canceled = true
      }
    }
    QRCode.toDataURL(resolved, { width: size })
      .then((url) => {
        if (!canceled) setDataUrl(url)
      })
      .catch(() => {
        if (!canceled) setDataUrl('')
      })
    return () => {
      canceled = true
    }
  }, [resolved, size])
  if (!dataUrl) return null
  return (
    <div style={{ textAlign: align, margin: '6px 0' }}>
      <img src={dataUrl} alt='QR' style={{ width: size, height: size }} />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// TextoLibre (con Handlebars)
// ────────────────────────────────────────────────────────────────────
type TextoLibreProps = {
  html: string
  fontSize: number
  textAlign: 'left' | 'center' | 'right'
}
function TextoLibre({ html, fontSize, textAlign }: TextoLibreProps) {
  const data = usePdfData()
  const out = renderTemplate(html, data || {})
  return (
    <div
      style={{ fontSize, textAlign }}
      dangerouslySetInnerHTML={{ __html: out }}
    />
  )
}

// ────────────────────────────────────────────────────────────────────
// Imagen
// ────────────────────────────────────────────────────────────────────
type ImagenProps = {
  url: string
  maxWidth: number
  align: 'left' | 'center' | 'right'
}
function Imagen({ url, maxWidth, align }: ImagenProps) {
  const data = usePdfData()
  const resolved = renderTemplate(url, data || {})
  if (!resolved) return null
  return (
    <div style={{ textAlign: align }}>
      <img src={resolved} alt='' style={{ maxWidth: `${maxWidth}%` }} />
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
  return (
    <hr
      style={{
        border: 'none',
        borderTop: `${thickness}px solid ${color}`,
        margin: `${margin}px 0`,
      }}
    />
  )
}

// ────────────────────────────────────────────────────────────────────
// HeaderReporte / TablaReporte / FooterReporte
// ────────────────────────────────────────────────────────────────────
type HeaderReporteProps = {
  showFiltros: boolean
  showFechaGeneracion: boolean
  colorPrimario: string
}
function HeaderReporte({
  showFiltros,
  showFechaGeneracion,
  colorPrimario,
}: HeaderReporteProps) {
  const data = usePdfData()
  if (!data || !isReportePayload(data)) return null
  const r = (data as ReportePrintPayload).reporte
  return (
    <div
      style={{
        borderBottom: `2px solid ${colorPrimario}`,
        paddingBottom: 6,
        marginBottom: 8,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, color: colorPrimario }}>
        {r.titulo}
      </div>
      {showFiltros && r.filtros && Object.keys(r.filtros).length > 0 && (
        <div style={{ fontSize: 10, color: '#555' }}>
          {Object.entries(r.filtros)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')}
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

type TablaReporteColumna = {
  campo: string
  label: string
  align?: 'left' | 'right' | 'center'
  format?: 'money' | 'date' | 'text'
}
type TablaReporteProps = {
  columnasJson: string
  zebra: boolean
  headerBg: string
  headerColor: string
  fontSize: number
  /** Campo por el que agrupar filas (ej. 'almacen_label'). Vacío = sin agrupar. */
  groupBy?: string
  /** Campos (separados por coma) a sumar en la fila de subtotal de cada grupo. */
  subtotalCampos?: string
}
function TablaReporte({
  columnasJson,
  zebra,
  headerBg,
  headerColor,
  fontSize,
  groupBy,
  subtotalCampos,
}: TablaReporteProps) {
  const data = usePdfData()
  if (!data || !isReportePayload(data)) return null
  let cols: TablaReporteColumna[] = []
  try {
    cols = JSON.parse(columnasJson)
  } catch {
    cols = []
  }
  const filas = (data as ReportePrintPayload).filas || []
  const fmt = (v: unknown, format?: string) => {
    if (format === 'money') return money(v)
    if (format === 'date') return fmtDate(v)
    return String(v ?? '')
  }
  const subtotalFields = (subtotalCampos || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const renderRow = (f: Record<string, unknown>, key: string | number) => (
    <tr
      key={key}
      style={{
        background: zebra && Number(key) % 2 ? '#f5f5f5' : 'transparent',
        pageBreakInside: 'avoid',
      }}
    >
      {cols.map((c, j) => (
        <td
          key={j}
          style={{
            textAlign: c.align || 'left',
            padding: '4px 6px',
            borderBottom: '1px solid #ccc',
          }}
        >
          {fmt(f[c.campo], c.format)}
        </td>
      ))}
    </tr>
  )

  const thead = (
    <thead>
      <tr
        style={{
          background: headerBg,
          color: headerColor,
          borderTop: '1px solid #333',
        }}
      >
        {cols.map((c, i) => (
          <th
            key={i}
            style={{
              textAlign: c.align || 'left',
              padding: '5px 6px',
              fontWeight: 700,
              borderBottom: '1px solid #333',
            }}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  )

  if (!groupBy) {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize }}>
        {thead}
        <tbody>
          {filas.map((f, i) => renderRow(f as Record<string, unknown>, i))}
        </tbody>
      </table>
    )
  }

  // Agrupado: misma logica que el renderer ReportLab retirado (group_by +
  // totals_row por grupo) — preserva el orden de primera aparicion del grupo.
  const groups: { key: string; rows: Record<string, unknown>[] }[] = []
  const groupIndex = new Map<string, number>()
  for (const f of filas as Record<string, unknown>[]) {
    const key = String(f[groupBy] ?? '')
    if (!groupIndex.has(key)) {
      groupIndex.set(key, groups.length)
      groups.push({ key, rows: [] })
    }
    groups[groupIndex.get(key)!].rows.push(f)
  }

  let rowCounter = 0
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize }}>
      {thead}
      <tbody>
        {groups.map((g) => {
          const subtotales: Record<string, number> = {}
          for (const campo of subtotalFields) {
            subtotales[campo] = g.rows.reduce(
              (acc, r) => acc + (Number(r[campo]) || 0),
              0
            )
          }
          return (
            <>
              <tr key={`grp-${g.key}`} style={{ background: '#eef2f7' }}>
                <td
                  colSpan={cols.length}
                  style={{ padding: '5px 4px', fontWeight: 700, borderBottom: '1px solid #ccc' }}
                >
                  {g.key || '(sin almacén)'}
                </td>
              </tr>
              {g.rows.map((f) => renderRow(f, rowCounter++))}
              {subtotalFields.length > 0 && (
                <tr key={`sub-${g.key}`} style={{ fontWeight: 700, background: '#f8fafc' }}>
                  {cols.map((c, j) => (
                    <td
                      key={j}
                      style={{
                        textAlign: c.align || 'left',
                        padding: '4px',
                        borderTop: '1px solid #999',
                      }}
                    >
                      {c.campo in subtotales
                        ? fmt(subtotales[c.campo], c.format)
                        : j === 0
                          ? `Subtotal (${g.rows.length})`
                          : ''}
                    </td>
                  ))}
                </tr>
              )}
            </>
          )
        })}
      </tbody>
    </table>
  )
}

type FooterReporteProps = {
  showCantidad: boolean
  showTotal: boolean
  colorPrimario: string
}
function FooterReporte({
  showCantidad,
  showTotal,
  colorPrimario,
}: FooterReporteProps) {
  const data = usePdfData()
  if (!data || !isReportePayload(data)) return null
  const t = (data as ReportePrintPayload).totales
  if (!t) return null
  return (
    <div
      style={{
        marginTop: 8,
        borderTop: `1px solid ${colorPrimario}`,
        paddingTop: 6,
        fontSize: 10,
        fontWeight: 700,
        display: 'flex',
        justifyContent: 'space-between',
      }}
    >
      {showCantidad && <span>Total de registros: {t.cantidad ?? 0}</span>}
      {showTotal && t.total !== undefined && (
        <span>Total: RD$ {money(t.total)}</span>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// BloqueCuadreCaja — pinta resumen forma de pago + por NCF + matriz NCF×forma_pago
// + opcionalmente detalle de facturas del día. Lee de payload.extra.
// ────────────────────────────────────────────────────────────────────
type ResumenPagoItem = {
  tipo_pago: string
  forma_pago: string
  cantidad: number
  total: number
}
type PorNcfItem = {
  ncf_tipo: string
  cantidad: number
  total_linea: number
  descuento: number
  impuesto: number
  total_neto: number
}
type NcfFormaPagoItem = {
  ncf_tipo: string
  tipo_pago: string
  forma_pago: string
  cantidad: number
  total: number
}
type ResumenVentasItem = {
  clase: string
  descripcion: string
  cantidad: number
  total: number
  impacta_ingreso?: boolean
}
type FacturaItem = {
  tipo_factura: string
  no_factura: string
  nombre_cliente?: string
  ncf_dgi?: string
  posiciones_fijas_ncf?: string
  fecha?: string | null
  total_neto?: number
  impuesto?: number
  descuento?: number
  forma_pago?: string
  estado?: string
  st_anulado?: string
  motivo_anulacion?: string
}
type HojaPorNcfItem = {
  ncf_tipo: string
  contado_dia: number
  cheques_dia: number
  transferencia_dia: number
  total_venta_dia: number
  contado_anterior: number
  cheques_anterior: number
  transferencia_anterior: number
  total_venta_anterior: number
  venta_general: number
  total_ingreso: number
  factura_desde: string | null
  factura_hasta: string | null
}

function labelNcfHuman(t: string): string {
  const k = (t || '').toUpperCase()
  const map: Record<string, string> = {
    B01: 'Crédito Fiscal',
    B02: 'Consumo',
    B03: 'Nota de Débito',
    B04: 'Nota de Crédito',
    B11: 'Proveedor Informal',
    B12: 'Registro Único',
    B13: 'Gastos Menores',
    B14: 'Régimen Especial',
    B15: 'Gubernamental',
    B16: 'Exportación',
  }
  return map[k] || ''
}

type BloqueCuadreCajaProps = {
  showResumenPago: boolean
  showPorNcf: boolean
  showMatrizNcfFormaPago: boolean
  showDetalleFacturas: boolean
  showHojaPorNcf: boolean
  colorTitulo: string
  fontSize: number
}

function BloqueCuadreCaja({
  showResumenPago,
  showPorNcf,
  showMatrizNcfFormaPago,
  showDetalleFacturas,
  showHojaPorNcf,
  colorTitulo,
  fontSize,
}: BloqueCuadreCajaProps) {
  const data = usePdfData()
  if (!data || !isReportePayload(data)) return null
  const cia = (data as ReportePrintPayload).cia
  const extra = ((data as ReportePrintPayload).extra ?? {}) as Record<
    string,
    unknown
  >
  const resumen = (extra.resumen_pago as ResumenPagoItem[]) ?? []
  const resumenVentas = (extra.resumen_ventas as ResumenVentasItem[]) ?? []
  const porNcf = (extra.por_ncf as PorNcfItem[]) ?? []
  const porNcfFormaPago = (extra.por_ncf_forma_pago as NcfFormaPagoItem[]) ?? []
  // Las facturas a credito (FC) SI deben listarse en el detalle del dia
  // (para ver que se facturaron) marcadas como "a credito, sin pagar" —
  // pero no deben sumar al total/subtotal hasta que tengan un RI.
  const facturas = (extra.facturas as FacturaItem[]) ?? []
  const facturasNoCredito = facturas.filter(
    (f) => (f.tipo_factura || '').toUpperCase() !== 'FC'
  )
  // El usuario activa "Incluir detalle" desde el switch de la pantalla —
  // viaja como extra.incluir_detalle. Sobreescribe la plantilla.
  const incluirDetalleFlag = !!extra.incluir_detalle
  const renderDetalle = showDetalleFacturas || incluirDetalleFlag

  // Hoja de cuadre por NCF (formato legado Ffat266, "CUADRE DE CAJA B02").
  // El backend solo la calcula si la pantalla pidio hoja_por_ncf=1.
  const hojaPorNcf = (extra.hoja_por_ncf as HojaPorNcfItem[]) ?? []
  const renderHojaPorNcf = (showHojaPorNcf || hojaPorNcf.length > 0) && hojaPorNcf.length > 0
  const fechaCuadre = (extra.fecha as string) || ''

  // Pivot NCF × forma_pago
  const formasSet = new Set<string>()
  const filaMap = new Map<
    string,
    { ncf_tipo: string; total: number; por: Record<string, number> }
  >()
  for (const r of porNcfFormaPago) {
    formasSet.add(r.forma_pago)
    let f = filaMap.get(r.ncf_tipo)
    if (!f) {
      f = { ncf_tipo: r.ncf_tipo, total: 0, por: {} }
      filaMap.set(r.ncf_tipo, f)
    }
    f.por[r.forma_pago] = (f.por[r.forma_pago] || 0) + (r.total || 0)
    f.total += r.total || 0
  }
  const formas = [...formasSet].sort((a, b) => a.localeCompare(b, 'es'))
  const filasMx = [...filaMap.values()].sort((a, b) =>
    a.ncf_tipo.localeCompare(b.ncf_tipo)
  )
  const totalesCol: Record<string, number> = {}
  for (const f of formas)
    totalesCol[f] = filasMx.reduce((s, fila) => s + (fila.por[f] || 0), 0)
  const totalMatrix = filasMx.reduce((s, f) => s + f.total, 0)

  // tipo_pago='4' = "A CREDITO" (catalogo TFAT_TIPO_PAGO, fijo en las 5
  // companias) - factura vendida a credito y SIN cobrar todavia (sin RI).
  // OJO: esto NO es lo mismo que las filas 'C<forma>' ("COBRO CRED - ..."),
  // que son recibos de ingreso (RI) de CxC que SI cobraron hoy un credito
  // anterior - esas SI deben sumar a Ingresos.
  const esVendidoACredito = (tipoPago: string) => (tipoPago || '').trim() === '4'
  const resumenCredito = resumen.filter((r) => esVendidoACredito(r.tipo_pago))

  // Resumen ordenado: vendido a credito sin cobrar al final
  const resumenSorted = [...resumen].sort((a, b) => {
    const ac = esVendidoACredito(a.tipo_pago)
    const bc = esVendidoACredito(b.tipo_pago)
    if (ac !== bc) return ac ? 1 : -1
    return (a.forma_pago || '').localeCompare(b.forma_pago || '', 'es')
  })
  // Total Ingresos = solo lo que realmente entro (efectivo, cheque, tarjeta,
  // transferencia, y cobros de credito anterior via RI). Lo vendido a
  // credito SIN cobrar se muestra aparte.
  const totalResumen = resumen
    .filter((r) => !esVendidoACredito(r.tipo_pago))
    .reduce((s, r) => s + (r.total || 0), 0)
  const totalResumenCredito = resumenCredito.reduce((s, r) => s + (r.total || 0), 0)
  // "Total ventas del dia" = solo CONTADO. La fila CREDITO (facturado hoy a
  // credito, sin RI) se muestra aparte, no se suma aqui.
  const totalVentas = resumenVentas
    .filter((r) => (r.clase || '').toUpperCase() === 'CONTADO')
    .reduce((s, r) => s + (r.total || 0), 0)
  const totalPorNcf = porNcf.reduce((s, r) => s + (r.total_neto || 0), 0)
  const totalFacturas = facturasNoCredito.reduce((s, f) => s + (f.total_neto || 0), 0)

  const sectionTitle: CSSProperties = {
    fontSize: fontSize + 2,
    fontWeight: 700,
    color: colorTitulo,
    margin: '12px 0 4px 0',
    borderBottom: `1px solid ${colorTitulo}33`,
    paddingBottom: 2,
  }
  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize,
  }
  // Estilo fino CxP: encabezado en negrita con raya #333 (sin barra oscura).
  const thBase: CSSProperties = {
    background: '#fff',
    color: '#0F172A',
    padding: '4px 6px',
    textAlign: 'left',
    fontWeight: 700,
    borderTop: '1px solid #333',
    borderBottom: '1px solid #333',
  }
  const td: CSSProperties = {
    padding: '3px 6px',
    borderBottom: '1px solid #ccc',
  }
  const tdR: CSSProperties = {
    ...td,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  }
  const tfootRow: CSSProperties = { background: '#f3f4f6', fontWeight: 700 }

  return (
    <div className='pdf-cuadre-caja'>
      {resumenVentas.length > 0 && (
        <>
          <div style={sectionTitle}>Ventas del Dia</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thBase, width: '18%' }}>Tipo</th>
                <th style={thBase}>DescripciÃ³n</th>
                <th style={{ ...thBase, textAlign: 'right', width: '12%' }}>
                  Fact.
                </th>
                <th style={{ ...thBase, textAlign: 'right', width: '20%' }}>
                  Total RD$
                </th>
              </tr>
            </thead>
            <tbody>
              {resumenVentas.map((r) => (
                <tr key={r.clase}>
                  <td style={{ ...td, fontFamily: 'monospace' }}>{r.clase}</td>
                  <td style={td}>{r.descripcion}</td>
                  <td style={tdR}>{r.cantidad}</td>
                  <td style={tdR}>{money(r.total)}</td>
                </tr>
              ))}
              <tr style={tfootRow}>
                <td colSpan={3} style={tdR}>
                  Total ventas del dia (contado, no incluye credito sin RI)
                </td>
                <td style={tdR}>{money(totalVentas)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {showResumenPago && (
        <>
          <div style={sectionTitle}>Ingresos por Forma de Pago</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thBase, width: '15%' }}>Tipo</th>
                <th style={thBase}>Descripción</th>
                <th style={{ ...thBase, textAlign: 'right', width: '12%' }}>
                  Cant.
                </th>
                <th style={{ ...thBase, textAlign: 'right', width: '20%' }}>
                  Monto RD$
                </th>
              </tr>
            </thead>
            <tbody>
              {resumenSorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{ ...td, textAlign: 'center', color: '#777' }}
                  >
                    Sin movimientos.
                  </td>
                </tr>
              ) : (
                resumenSorted.map((r, i) => (
                  <tr key={`${r.tipo_pago}-${r.forma_pago}-${i}`}>
                    <td style={{ ...td, fontFamily: 'monospace' }}>
                      {r.tipo_pago}
                    </td>
                    <td style={td}>{r.forma_pago}</td>
                    <td style={tdR}>{r.cantidad}</td>
                    <td style={tdR}>{money(r.total)}</td>
                  </tr>
                ))
              )}
              {resumenSorted.length > 0 && (
                <tr style={tfootRow}>
                  <td colSpan={3} style={{ ...tdR }}>
                    Total Ingresos
                  </td>
                  <td style={tdR}>{money(totalResumen)}</td>
                </tr>
              )}
              {resumenCredito.length > 0 && (
                <tr>
                  <td
                    colSpan={3}
                    style={{ ...tdR, fontStyle: 'italic', color: '#555' }}
                  >
                    Vendido a credito (no cobrado, no suma a Ingresos)
                  </td>
                  <td style={{ ...tdR, fontStyle: 'italic', color: '#555' }}>
                    {money(totalResumenCredito)}
                  </td>
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
                <th style={{ ...thBase, textAlign: 'right', width: '8%' }}>
                  Cant.
                </th>
                <th style={{ ...thBase, textAlign: 'right' }}>Total Línea</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Descuento</th>
                <th style={{ ...thBase, textAlign: 'right' }}>ITBIS</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Total Neto</th>
              </tr>
            </thead>
            <tbody>
              {porNcf.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ ...td, textAlign: 'center', color: '#777' }}
                  >
                    Sin facturas.
                  </td>
                </tr>
              ) : (
                porNcf.map((r) => (
                  <tr key={r.ncf_tipo}>
                    <td
                      style={{
                        ...td,
                        fontFamily: 'monospace',
                        fontWeight: 700,
                      }}
                    >
                      {r.ncf_tipo || '—'}
                    </td>
                    <td style={td}>{labelNcfHuman(r.ncf_tipo)}</td>
                    <td style={tdR}>{r.cantidad}</td>
                    <td style={tdR}>{money(r.total_linea)}</td>
                    <td style={tdR}>{money(r.descuento)}</td>
                    <td style={tdR}>{money(r.impuesto)}</td>
                    <td style={{ ...tdR, fontWeight: 700 }}>
                      {money(r.total_neto)}
                    </td>
                  </tr>
                ))
              )}
              {porNcf.length > 0 && (
                <tr style={tfootRow}>
                  <td colSpan={6} style={tdR}>
                    TOTAL
                  </td>
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
                  <th key={f} style={{ ...thBase, textAlign: 'right' }}>
                    {f}
                  </th>
                ))}
                <th style={{ ...thBase, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filasMx.map((fila) => (
                <tr key={fila.ncf_tipo}>
                  <td
                    style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}
                  >
                    {fila.ncf_tipo || '—'}
                  </td>
                  <td style={td}>{labelNcfHuman(fila.ncf_tipo)}</td>
                  {formas.map((f) => (
                    <td key={f} style={tdR}>
                      {fila.por[f] ? money(fila.por[f]) : ''}
                    </td>
                  ))}
                  <td style={{ ...tdR, fontWeight: 700 }}>
                    {money(fila.total)}
                  </td>
                </tr>
              ))}
              <tr style={tfootRow}>
                <td colSpan={2} style={tdR}>
                  TOTAL
                </td>
                {formas.map((f) => (
                  <td key={f} style={tdR}>
                    {money(totalesCol[f] || 0)}
                  </td>
                ))}
                <td style={tdR}>{money(totalMatrix)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {renderDetalle &&
        (() => {
          // Group invoices by NCF so the printed detail matches the screen.
          type Grupo = {
            ncf_tipo: string
            rows: FacturaItem[]
            total: number
            itbis: number
            descuento: number
          }
          const getNcfTipo = (f: FacturaItem) => {
            const fixed = (f.posiciones_fijas_ncf || '').trim().toUpperCase()
            if (fixed) return fixed
            const dgi = (f.ncf_dgi || '').trim().toUpperCase()
            return /^B\d{2}/.test(dgi) ? dgi.slice(0, 3) : 'SIN NCF'
          }
          const esCredito = (f: FacturaItem) =>
            (f.tipo_factura || '').toUpperCase() === 'FC'
          const groups = new Map<string, Grupo>()
          for (const f of facturas) {
            const key = getNcfTipo(f)
            const g = groups.get(key) || {
              ncf_tipo: key,
              rows: [],
              total: 0,
              itbis: 0,
              descuento: 0,
            }
            g.rows.push(f)
            // Las FC (a credito) se listan pero no suman hasta tener un RI.
            if (!esCredito(f)) {
              g.total += f.total_neto || 0
              g.itbis += f.impuesto || 0
              g.descuento += f.descuento || 0
            }
            groups.set(key, g)
          }
          const facturasPorNcf = [...groups.values()].sort((a, b) =>
            a.ncf_tipo.localeCompare(b.ncf_tipo, 'es')
          )
          const grupoHdr: CSSProperties = {
            ...td,
            background: '#e2e8f0',
            fontWeight: 700,
          }
          const subTotalRow: CSSProperties = {
            ...td,
            background: '#f1f5f9',
            fontWeight: 700,
          }
          return (
            <>
              <div style={sectionTitle}>
                Detalle de Facturas - agrupado por NCF
              </div>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thBase, width: '14%' }}>No.</th>
                    <th style={{ ...thBase, width: '10%' }}>Fecha</th>
                    <th style={thBase}>Cliente</th>
                    <th style={{ ...thBase, width: '14%' }}>NCF</th>
                    <th style={{ ...thBase, width: '12%' }}>Forma Pago</th>
                    <th style={{ ...thBase, textAlign: 'right' }}>Descuento</th>
                    <th style={{ ...thBase, textAlign: 'right' }}>ITBIS</th>
                    <th style={{ ...thBase, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {facturasPorNcf.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        style={{ ...td, textAlign: 'center', color: '#777' }}
                      >
                        Sin facturas en el dia.
                      </td>
                    </tr>
                  ) : (
                    facturasPorNcf.map((g) => (
                      <Fragment key={g.ncf_tipo}>
                        <tr>
                          <td colSpan={8} style={grupoHdr}>
                            <span>
                              {g.ncf_tipo} -{' '}
                              {labelNcfHuman(g.ncf_tipo) || g.ncf_tipo}
                            </span>
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: fontSize - 1,
                                color: '#555',
                              }}
                            >
                              ({g.rows.length} facturas)
                            </span>
                          </td>
                        </tr>
                        {g.rows.map((f, i) => {
                          const num = `${f.tipo_factura || ''}-${f.no_factura || ''}`
                          const anul = f.st_anulado === 'S'
                          const credito = esCredito(f)
                          return (
                            <Fragment key={`${g.ncf_tipo}-${num}-${i}`}>
                              <tr
                                style={
                                  anul
                                    ? { color: '#b91c1c' }
                                    : credito
                                      ? { background: '#fffbeb' }
                                      : undefined
                                }
                              >
                                <td
                                  style={{
                                    ...td,
                                    fontFamily: 'monospace',
                                    paddingLeft: 14,
                                  }}
                                >
                                  {num}
                                  {anul ? ' (ANUL)' : ''}
                                </td>
                                <td style={td}>{fmtDate(f.fecha)}</td>
                                <td style={td}>
                                  {(f.nombre_cliente || '').slice(0, 60)}
                                  {credito && !anul && (
                                    <span
                                      style={{
                                        marginLeft: 6,
                                        padding: '1px 6px',
                                        borderRadius: 3,
                                        fontSize: fontSize - 2,
                                        fontWeight: 700,
                                        color: '#fff',
                                        background: '#ea580c',
                                        textTransform: 'uppercase',
                                      }}
                                    >
                                      A credito · sin pagar
                                    </span>
                                  )}
                                </td>
                                <td style={{ ...td, fontFamily: 'monospace' }}>
                                  {f.ncf_dgi || '—'}
                                </td>
                                <td style={td}>{f.forma_pago || ''}</td>
                                <td style={tdR}>{money(f.descuento ?? 0)}</td>
                                <td style={tdR}>{money(f.impuesto ?? 0)}</td>
                                <td style={tdR}>
                                  {credito
                                    ? `(${money(f.total_neto ?? 0)})`
                                    : money(f.total_neto ?? 0)}
                                </td>
                              </tr>
                              {anul && f.motivo_anulacion && (
                                <tr style={{ color: '#b91c1c' }}>
                                  <td
                                    colSpan={8}
                                    style={{
                                      ...td,
                                      paddingLeft: 14,
                                      fontStyle: 'italic',
                                      fontSize: fontSize - 1,
                                    }}
                                  >
                                    Motivo: {f.motivo_anulacion}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                        <tr>
                          <td
                            colSpan={5}
                            style={{ ...subTotalRow, textAlign: 'right' }}
                          >
                            Subtotal {g.ncf_tipo}
                          </td>
                          <td style={{ ...subTotalRow, textAlign: 'right' }}>
                            {money(g.descuento)}
                          </td>
                          <td style={{ ...subTotalRow, textAlign: 'right' }}>
                            {money(g.itbis)}
                          </td>
                          <td style={{ ...subTotalRow, textAlign: 'right' }}>
                            {money(g.total)}
                          </td>
                        </tr>
                      </Fragment>
                    ))
                  )}
                  {facturasPorNcf.length > 0 && (
                    <tr style={tfootRow}>
                      <td colSpan={7} style={tdR}>
                        TOTAL COBRADO ({facturasNoCredito.length} de{' '}
                        {facturas.length} facturas
                        {facturas.length !== facturasNoCredito.length
                          ? ` · ${facturas.length - facturasNoCredito.length} a credito sin pagar`
                          : ''}
                        )
                      </td>
                      <td style={tdR}>{money(totalFacturas)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )
        })()}

      {renderHojaPorNcf && (
        <>
          {hojaPorNcf.map((h) => {
            const labelRow: CSSProperties = {
              display: 'flex',
              justifyContent: 'space-between',
              borderBottom: '1px solid #e5e7eb',
              padding: '3px 0',
            }
            const totalRow: CSSProperties = {
              ...labelRow,
              fontWeight: 700,
              borderTop: '1px solid #999',
              borderBottom: 'none',
              marginTop: 2,
              paddingTop: 4,
            }
            return (
              <div
                key={h.ncf_tipo}
                style={{ pageBreakBefore: 'always', paddingTop: 8 }}
              >
                <div
                  style={{
                    border: `2px solid ${colorTitulo}`,
                    borderRadius: 4,
                    padding: '8px 12px',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: fontSize + 4,
                      fontWeight: 700,
                      textAlign: 'center',
                      color: colorTitulo,
                      marginBottom: 8,
                    }}
                  >
                    CUADRE DE CAJA {h.ncf_tipo}
                  </div>
                  <div style={{ ...labelRow, borderBottom: 'none' }}>
                    <span style={{ fontWeight: 700 }}>Empresa:</span>
                    <span>{cia?.razon_social || ''}</span>
                  </div>
                  <div
                    style={{
                      textAlign: 'right',
                      fontWeight: 700,
                    }}
                  >
                    {fmtDate(fechaCuadre)}
                  </div>
                </div>

                <div style={labelRow}>
                  <span>CONTADO DEL DIA:</span>
                  <span>{money(h.contado_dia)}</span>
                </div>
                <div style={labelRow}>
                  <span>CHEQUES:</span>
                  <span>{money(h.cheques_dia)}</span>
                </div>
                <div style={labelRow}>
                  <span>TRANSFERENCIA:</span>
                  <span>{money(h.transferencia_dia)}</span>
                </div>
                <div style={totalRow}>
                  <span>TOTAL VENTA DEL DIA:</span>
                  <span>{money(h.total_venta_dia)}</span>
                </div>

                <div style={{ ...labelRow, marginTop: 16 }}>
                  <span>CONTADO ANTERIORES:</span>
                  <span>{money(h.contado_anterior)}</span>
                </div>
                <div style={labelRow}>
                  <span>CHEQUES ANTERIORES:</span>
                  <span>{money(h.cheques_anterior)}</span>
                </div>
                <div style={labelRow}>
                  <span>TRANSFERENCIA ANTERIORES:</span>
                  <span>{money(h.transferencia_anterior)}</span>
                </div>
                <div style={totalRow}>
                  <span>TOTAL VENTA ANTERIOR:</span>
                  <span>{money(h.total_venta_anterior)}</span>
                </div>

                <div style={{ ...totalRow, marginTop: 16 }}>
                  <span>VENTA GENERAL</span>
                  <span>{money(h.venta_general)}</span>
                </div>
                <div style={totalRow}>
                  <span>TOTAL INGRESO</span>
                  <span>{money(h.total_ingreso)}</span>
                </div>

                <div style={{ ...labelRow, marginTop: 24, borderBottom: 'none' }}>
                  <span>Factura Desde:</span>
                  <span>{stripLeadingZeros(h.factura_desde)}</span>
                </div>
                <div style={{ ...labelRow, borderBottom: 'none' }}>
                  <span>Factura Hasta:</span>
                  <span>{stripLeadingZeros(h.factura_hasta)}</span>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function stripLeadingZeros(s: string | null | undefined): string {
  if (!s) return ''
  const n = s.replace(/^0+/, '')
  return n || '0'
}

// ────────────────────────────────────────────────────────────────────
// DocumentoSimple — documento completo en el estilo "sencillo" de
// cxp-factura-proveedor: TODO líneas finas, encabezado de tabla en negrita
// con raya (SIN barra oscura, SIN zebra), sin paneles de colores. Un solo
// bloque reutilizable que arma header + tercero + líneas + totales + firmas
// leyendo el payload y ramificando por tipo (proveedor vs cliente, almacén,
// NCF). Es el patrón a usar en plantillas nuevas en lugar del combo
// EncabezadoFactura + PanelInfoFactura + TablaLineas(barra) + BloqueTotales.
// ────────────────────────────────────────────────────────────────────
type DocumentoSimpleProps = {
  firmaIzq: string
  firmaDer: string
  mostrarAlmacen: boolean
  /** Columnas de la tabla de líneas, separadas por coma. Ej:
   *  "codigo,descripcion,cantidad,precio,descuento,itbis,total". */
  columnas: string
  /** Mostrar "Son: <monto en letras>" debajo de los totales. */
  montoLetras: boolean
  /** HTML Handlebars opcional arriba (después del header). Ej. saludo cotización. */
  introHtml: string
  /** HTML Handlebars opcional abajo (después de totales, antes de firmas). */
  pieHtml: string
}
function DocumentoSimple({
  firmaIzq,
  firmaDer,
  mostrarAlmacen,
  columnas,
  montoLetras,
  introHtml,
  pieHtml,
}: DocumentoSimpleProps) {
  const data = usePdfData()
  if (!data || isReportePayload(data)) return null
  const d = data as DocumentoPrintPayload
  const doc = d.doc as DocPayload & {
    almacen_origen?: string
    almacen_destino?: string
  }
  const cia = d.cia
  const prov = d.proveedor
  const cli = d.cliente
  const tercero = prov?.nombre
    ? { label: 'PROVEEDOR', p: prov }
    : cli?.nombre
      ? { label: 'CLIENTE', p: cli }
      : null
  const lineas = d.lineas || []
  const t = d.totales || { total: 0 }

  const thin = '1px solid #333'
  const hair = '1px solid #ccc'
  type C =
    | 'codigo'
    | 'descripcion'
    | 'cantidad'
    | 'unidad'
    | 'precio'
    | 'descuento'
    | 'itbis'
    | 'total'
  const colMeta: Record<C, { label: string; align: 'left' | 'right' | 'center' }> = {
    codigo: { label: 'Código', align: 'left' },
    descripcion: { label: 'Descripción', align: 'left' },
    cantidad: { label: 'Cant.', align: 'center' },
    unidad: { label: 'U/M', align: 'left' },
    precio: { label: 'Precio', align: 'right' },
    descuento: { label: 'Desc.', align: 'right' },
    itbis: { label: 'ITBIS', align: 'right' },
    total: { label: 'Total', align: 'right' },
  }
  const defaultCols: C[] = ['codigo', 'descripcion', 'cantidad', 'precio', 'total']
  const cols: { key: C; label: string; align: 'left' | 'right' | 'center' }[] = (
    (columnas || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is C => s in colMeta)
  )
    .concat([])
    .reduce<C[]>((acc, k) => (acc.includes(k) ? acc : [...acc, k]), [])
    .map((k) => ({ key: k, ...colMeta[k] }))
  const finalCols = cols.length ? cols : defaultCols.map((k) => ({ key: k, ...colMeta[k] }))
  const cellVal = (l: LineaPayload, k: C): string => {
    switch (k) {
      case 'codigo':
        return l.codigo || ''
      case 'descripcion':
        return l.descripcion || ''
      case 'cantidad':
        return money(l.cantidad, l.cantidad % 1 === 0 ? 0 : 2)
      case 'unidad':
        return l.unidad || ''
      case 'precio':
        return money(l.precio)
      case 'descuento':
        return money(l.descuento)
      case 'itbis':
        return money(l.itbis)
      case 'total':
        return money(l.total)
    }
  }

  return (
    <div style={{ fontSize: 9, color: '#0F172A' }}>
      {/* Header: empresa (logo + datos) | tipo + número + fecha + NCF */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top', width: '55%' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                {cia.logo_url && (
                  <img
                    src={cia.logo_url}
                    alt=''
                    style={{ maxHeight: 60, maxWidth: 80, objectFit: 'contain' }}
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                    }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>
                    {cia.razon_social}
                  </div>
                  {cia.direccion && <div>{cia.direccion}</div>}
                  {cia.telefono && <div>TEL. {cia.telefono}</div>}
                  {cia.rnc && <div>RNC {cia.rnc}</div>}
                </div>
              </div>
            </td>
            <td style={{ verticalAlign: 'top', textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {(doc.tipo_label || doc.tipo || '').toUpperCase()}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {doc.numero_display || `${doc.tipo}-${doc.no}`}
              </div>
              {doc.fecha && (
                <div style={{ marginTop: 6 }}>Fecha {fmtDate(doc.fecha)}</div>
              )}
              {doc.ncf_dgi && (
                <div style={{ marginTop: 4 }}>
                  <b>NCF:</b> {doc.ncf_dgi}
                </div>
              )}
              {doc.anulada && (
                <div style={{ marginTop: 2, color: '#dc2626', fontWeight: 700 }}>
                  ANULADA
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Intro opcional (Handlebars) — ej. saludo de cotización */}
      {introHtml && (
        <div
          style={{ margin: '2px 0 8px', fontSize: 10 }}
          dangerouslySetInnerHTML={{ __html: renderTemplate(introHtml, d) }}
        />
      )}

      {/* Tercero (proveedor o cliente) — solo si el documento tiene uno */}
      {tercero && (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            borderTop: thin,
            borderBottom: thin,
            marginBottom: 6,
          }}
        >
          <tbody>
            <tr style={{ borderBottom: hair }}>
              <td style={{ padding: '3px 6px', width: 90, fontWeight: 700, borderRight: hair }}>
                {tercero.label} NO.
              </td>
              <td style={{ padding: '3px 6px' }}>{tercero.p.no}</td>
              <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                {tercero.p.rnc ? `RNC: ${tercero.p.rnc}` : ''}
              </td>
            </tr>
            <tr style={{ borderBottom: hair }}>
              <td style={{ padding: '3px 6px', fontWeight: 700, borderRight: hair }}>
                NOMBRE
              </td>
              <td style={{ padding: '3px 6px' }} colSpan={2}>
                {tercero.p.nombre}
              </td>
            </tr>
            <tr style={{ borderBottom: hair }}>
              <td style={{ padding: '3px 6px', fontWeight: 700, borderRight: hair }}>
                DIRECCION
              </td>
              <td style={{ padding: '3px 6px' }} colSpan={2}>
                {tercero.p.direccion || '—'}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '3px 6px', fontWeight: 700, borderRight: hair }}>
                TELEFONO
              </td>
              <td style={{ padding: '3px 6px' }} colSpan={2}>
                {tercero.p.telefono || '—'}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Línea de contexto: almacén (solo INV), vendedor, forma y condición de
          pago. La condición SOLO aplica a crédito (pago diferido): en Contado
          -pago en el momento (efectivo/transferencia/cheque)- no se muestra. */}
      {(() => {
        const esContado = /contado/i.test(String(doc.condicion_pago || ''))
        const mostrarCondicion = !!doc.condicion_pago && !esContado
        const hayLinea =
          (mostrarAlmacen && doc.almacen_origen) || doc.vendedor || doc.forma_pago || mostrarCondicion
        if (!hayLinea) return null
        return (
          <div style={{ margin: '2px 0 8px', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {mostrarAlmacen && doc.almacen_origen && (
              <span>
                <b>Almacén:</b> {doc.almacen_origen}
                {doc.almacen_destino ? ` → ${doc.almacen_destino}` : ''}
              </span>
            )}
            {doc.vendedor && (
              <span>
                <b>Vendedor:</b> {doc.vendedor}
              </span>
            )}
            {doc.forma_pago && (
              <span>
                <b>Forma de pago:</b> {doc.forma_pago}
              </span>
            )}
            {mostrarCondicion && (
              <span>
                <b>Condición de pago:</b> {doc.condicion_pago}
                {doc.plazo_pago ? ` (${doc.plazo_pago} días)` : ''}
              </span>
            )}
          </div>
        )
      })()}

      {/* Líneas: encabezado en negrita con raya fina (sin barra ni zebra) */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
        <thead>
          <tr style={{ borderTop: thin, borderBottom: thin }}>
            {finalCols.map((c) => (
              <th
                key={c.key}
                style={{ textAlign: c.align, padding: '4px 6px', fontWeight: 700 }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lineas.map((l, i) => (
            <tr key={i} style={{ borderBottom: hair, pageBreakInside: 'avoid' }}>
              {finalCols.map((c) => (
                <td
                  key={c.key}
                  style={{ textAlign: c.align, padding: '4px 6px' }}
                >
                  {cellVal(l, c.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totales compactos, alineados a la derecha */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
        <tbody>
          <tr>
            <td style={{ width: '62%' }} />
            <td style={{ width: '38%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '3px 6px' }}>Subtotal</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                      {money(t.subtotal)}
                    </td>
                  </tr>
                  {!!t.descuento && (
                    <tr>
                      <td style={{ padding: '3px 6px' }}>Descuento</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                        {money(t.descuento)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ padding: '3px 6px' }}>ITBIS</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                      {money(t.itbis)}
                    </td>
                  </tr>
                  {!!t.propina && (
                    <tr>
                      <td style={{ padding: '3px 6px' }}>Propina</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right' }}>
                        {money(t.propina)}
                      </td>
                    </tr>
                  )}
                  <tr style={{ borderTop: thin }}>
                    <td style={{ padding: '3px 6px', fontWeight: 700 }}>
                      TOTAL RD$
                    </td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', fontWeight: 700 }}>
                      {money(t.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Monto en letras (opcional) */}
      {montoLetras && t.monto_letras && (
        <div style={{ marginTop: 4, fontSize: 9 }}>
          <b>Son:</b> {t.monto_letras}
        </div>
      )}

      {/* Observación */}
      {doc.nota && (
        <div style={{ marginTop: 8 }}>
          <b>Observación:</b> {doc.nota}
        </div>
      )}

      {/* Pie opcional (Handlebars) — ej. validez/condiciones de cotización */}
      {pieHtml && (
        <div
          style={{ marginTop: 10, fontSize: 9 }}
          dangerouslySetInnerHTML={{ __html: renderTemplate(pieHtml, d) }}
        />
      )}

      {/* Firmas: una o dos líneas finas (firmaDer vacío = una sola) */}
      <table style={{ width: '100%', marginTop: 40 }}>
        <tbody>
          <tr>
            <td style={{ borderTop: '1px solid #000', width: firmaDer ? '45%' : '55%', paddingTop: 4, fontSize: 9 }}>
              {firmaIzq}
            </td>
            {firmaDer ? (
              <>
                <td style={{ width: '10%' }} />
                <td style={{ borderTop: '1px solid #000', width: '45%', paddingTop: 4, fontSize: 9, textAlign: 'center' }}>
                  {firmaDer}
                </td>
              </>
            ) : (
              <td style={{ width: '45%' }} />
            )}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Puck Config
// ────────────────────────────────────────────────────────────────────
export type PuckBlockProps = {
  DocumentoSimple: DocumentoSimpleProps
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

export const puckConfig = {
  components: {
    DocumentoSimple: {
      label: 'Documento — sencillo (estilo CxP)',
      fields: {
        columnas: { type: 'text' },
        firmaIzq: { type: 'text' },
        firmaDer: { type: 'text' },
        mostrarAlmacen: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        montoLetras: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        introHtml: { type: 'textarea' },
        pieHtml: { type: 'textarea' },
      },
      defaultProps: {
        columnas: 'codigo,descripcion,cantidad,precio,total',
        firmaIzq: 'Recibido por',
        firmaDer: 'Entregado por',
        mostrarAlmacen: true,
        montoLetras: false,
        introHtml: '',
        pieHtml: '',
      },
      render: DocumentoSimple,
    },
    HeaderEmpresa: {
      label: 'Header — Empresa',
      fields: {
        showLogo: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        logoAlign: {
          type: 'select',
          options: [
            { label: 'Izquierda', value: 'left' },
            { label: 'Centro', value: 'center' },
            { label: 'Derecha', value: 'right' },
          ],
        },
        colorPrimario: { type: 'text' },
        showRnc: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showTelefono: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showEmail: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showDireccion: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        razonSize: { type: 'number', min: 8, max: 28 },
      },
      defaultProps: {
        showLogo: true,
        logoAlign: 'left',
        colorPrimario: '#0F172A',
        showRnc: true,
        showTelefono: true,
        showEmail: false,
        showDireccion: true,
        razonSize: 16,
      },
      render: HeaderEmpresa,
    },
    Fila: {
      label: 'Fila — agrupar bloques en columnas',
      fields: {
        columnas: { type: 'number', min: 1, max: 6 },
        gap: { type: 'number', min: 0, max: 40 },
        alineacion: {
          type: 'select',
          options: [
            { label: 'Arriba', value: 'flex-start' },
            { label: 'Centro', value: 'center' },
            { label: 'Abajo', value: 'flex-end' },
            { label: 'Estirar', value: 'stretch' },
          ],
        },
      },
      defaultProps: { columnas: 2, gap: 12, alineacion: 'flex-start' },
      render: Fila,
    },
    EncabezadoFactura: {
      label: 'Encabezado Factura (empresa + doc)',
      fields: {
        showLogo: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        colorPrimario: { type: 'text' },
        showRnc: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showTelefono: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showEmail: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showDireccion: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        razonSize: { type: 'number', min: 10, max: 24 },
        docBg: { type: 'text' },
        docColor: { type: 'text' },
        showNcf: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showImpresion: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
      },
      defaultProps: {
        showLogo: true,
        colorPrimario: '#0F172A',
        showRnc: true,
        showTelefono: true,
        showEmail: false,
        showDireccion: true,
        razonSize: 15,
        docBg: '#0F172A',
        docColor: '#ffffff',
        showNcf: true,
        showImpresion: true,
      },
      render: EncabezadoFactura,
    },
    PanelInfoFactura: {
      label: 'Panel Info Factura (cliente + fiscal)',
      fields: {
        showCliente: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showRnc: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showDireccion: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showVendedor: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showFecha: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showCondicion: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showPlazo: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showTipoNcf: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showFormaPago: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showEstado: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
      },
      defaultProps: {
        showCliente: true,
        showRnc: true,
        showDireccion: true,
        showVendedor: true,
        showFecha: true,
        showCondicion: true,
        showPlazo: true,
        showTipoNcf: true,
        showFormaPago: true,
        showEstado: true,
      },
      render: PanelInfoFactura,
    },
    HeaderDocumento: {
      label: 'Header — Documento',
      fields: {
        showNcf: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showFechaVenc: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showImpresion: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        bgColor: { type: 'text' },
        textColor: { type: 'text' },
      },
      defaultProps: {
        showNcf: true,
        showFechaVenc: false,
        showImpresion: true,
        bgColor: '#0F172A',
        textColor: '#fff',
      },
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
      defaultProps: {
        texto: 'ANULADA',
        opacity: 0.18,
        angle: -30,
        color: '#dc2626',
      },
      render: WatermarkAnulada,
    },
    BloqueCliente: {
      label: 'Bloque — Cliente',
      fields: {
        columnas: { type: 'number', min: 1, max: 3 },
        showNombre: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showRnc: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showDireccion: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showTelefono: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showEmail: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showTipoNcf: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showCondicion: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showVendedor: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
      },
      defaultProps: {
        columnas: 2,
        showNombre: true,
        showRnc: true,
        showDireccion: true,
        showTelefono: false,
        showEmail: false,
        showTipoNcf: true,
        showCondicion: true,
        showVendedor: true,
      },
      render: BloqueCliente,
    },
    TablaLineas: {
      label: 'Tabla — Líneas del documento',
      fields: {
        columnas: {
          type: 'array',
          arrayFields: { value: { type: 'text' } },
          getItemSummary: (i: { value?: string }) => i.value ?? '',
        },
        zebra: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        headerBg: { type: 'text' },
        headerColor: { type: 'text' },
        fontSize: { type: 'number', min: 7, max: 14 },
      },
      defaultProps: {
        columnas: [
          'codigo',
          'descripcion',
          'cantidad',
          'precio',
          'descuento',
          'itbis',
          'total',
        ] as Col[],
        zebra: true,
        headerBg: '#0F172A',
        headerColor: '#ffffff',
        fontSize: 9,
      },
      render: TablaLineas,
    },
    BloqueTotales: {
      label: 'Bloque — Totales',
      fields: {
        showSubtotal: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showDescuento: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showItbis: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showPropina: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showOtros: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showMontoLetras: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        align: {
          type: 'select',
          options: [
            { label: 'Derecha', value: 'right' },
            { label: 'Izquierda', value: 'left' },
          ],
        },
        colorTotal: { type: 'text' },
      },
      defaultProps: {
        showSubtotal: true,
        showDescuento: true,
        showItbis: true,
        showPropina: true,
        showOtros: false,
        showMontoLetras: true,
        align: 'right',
        colorTotal: '#0F172A',
      },
      render: BloqueTotales,
    },
    NotaDetalle: {
      label: 'Nota / Detalle',
      fields: {
        titulo: { type: 'text' },
        mostrarSiVacio: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
      },
      defaultProps: { titulo: 'Nota:', mostrarSiVacio: false },
      render: NotaDetalle,
    },
    Firmas: {
      label: 'Firmas',
      fields: {
        cantidad: {
          type: 'select',
          options: [
            { label: '1', value: 1 },
            { label: '2', value: 2 },
            { label: '3', value: 3 },
          ],
        },
        labels: { type: 'text' },
        lineWidth: { type: 'number', min: 30, max: 100 },
      },
      defaultProps: {
        cantidad: 2,
        labels: 'Recibido por|Entregado por',
        lineWidth: 80,
      },
      render: Firmas,
    },
    FooterEmpresa: {
      label: 'Footer — Empresa',
      fields: {
        texto: { type: 'textarea' },
        showPaginacion: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showFechaGeneracion: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        color: { type: 'text' },
      },
      defaultProps: {
        texto: '{{ cia.razon_social }} | {{ cia.rnc }}',
        showPaginacion: true,
        showFechaGeneracion: true,
        color: '#777777',
      },
      render: FooterEmpresa,
    },
    QRCode: {
      label: 'QR Code',
      fields: {
        contenido: { type: 'text' },
        size: { type: 'number', min: 40, max: 200 },
        align: {
          type: 'select',
          options: [
            { label: 'Izquierda', value: 'left' },
            { label: 'Centro', value: 'center' },
            { label: 'Derecha', value: 'right' },
          ],
        },
      },
      defaultProps: {
        contenido: '{{ doc.ncf_dgi }}',
        size: 100,
        align: 'right',
      },
      render: QrBlock,
    },
    TextoLibre: {
      label: 'Texto libre (Handlebars)',
      fields: {
        html: { type: 'textarea' },
        fontSize: { type: 'number', min: 8, max: 24 },
        textAlign: {
          type: 'select',
          options: [
            { label: 'Izquierda', value: 'left' },
            { label: 'Centro', value: 'center' },
            { label: 'Derecha', value: 'right' },
          ],
        },
      },
      defaultProps: {
        html: '<p>Texto editable. Usa variables: {{ doc.numero_display }}</p>',
        fontSize: 10,
        textAlign: 'left',
      },
      render: TextoLibre,
    },
    Imagen: {
      label: 'Imagen',
      fields: {
        url: { type: 'text' },
        maxWidth: { type: 'number', min: 10, max: 100 },
        align: {
          type: 'select',
          options: [
            { label: 'Izquierda', value: 'left' },
            { label: 'Centro', value: 'center' },
            { label: 'Derecha', value: 'right' },
          ],
        },
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
        showFiltros: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showFechaGeneracion: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        colorPrimario: { type: 'text' },
      },
      defaultProps: {
        showFiltros: true,
        showFechaGeneracion: true,
        colorPrimario: '#0F172A',
      },
      render: HeaderReporte,
    },
    TablaReporte: {
      label: 'Tabla — Reporte',
      fields: {
        columnasJson: { type: 'textarea' },
        zebra: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        headerBg: { type: 'text' },
        headerColor: { type: 'text' },
        fontSize: { type: 'number', min: 7, max: 14 },
        groupBy: { type: 'text' },
        subtotalCampos: { type: 'text' },
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
          null,
          2
        ),
        zebra: false,
        headerBg: '#ffffff',
        headerColor: '#0F172A',
        fontSize: 9,
        groupBy: '',
        subtotalCampos: '',
      },
      render: TablaReporte,
    },
    FooterReporte: {
      label: 'Footer — Reporte',
      fields: {
        showCantidad: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showTotal: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        colorPrimario: { type: 'text' },
      },
      defaultProps: {
        showCantidad: true,
        showTotal: true,
        colorPrimario: '#0F172A',
      },
      render: FooterReporte,
    },
    BloqueCuadreCaja: {
      label: 'Bloque — Cuadre de Caja',
      fields: {
        showResumenPago: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showPorNcf: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showMatrizNcfFormaPago: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showDetalleFacturas: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        showHojaPorNcf: {
          type: 'radio',
          options: [
            { label: 'Sí', value: true },
            { label: 'No', value: false },
          ],
        },
        colorTitulo: { type: 'text' },
        fontSize: { type: 'number', min: 7, max: 14 },
      },
      defaultProps: {
        showResumenPago: true,
        showPorNcf: true,
        showMatrizNcfFormaPago: true,
        showDetalleFacturas: true,
        showHojaPorNcf: false,
        colorTitulo: '#0F172A',
        fontSize: 9,
      },
      render: BloqueCuadreCaja,
    },
  },
  root: {
    render: ({ children }: { children?: ReactNode }) => (
      <div className='pdf-canvas'>{children}</div>
    ),
  },
} as unknown as Config<PuckBlockProps>
