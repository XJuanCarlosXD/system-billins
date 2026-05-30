// Utilidades de impresión PDF — Módulo FAT (Facturación)
// Mismo estilo plantilla factura A4 que cnt/export-utils.ts

export interface ReportMeta {
  company: string
  sucursal: string
  mesAno: string
  moneda?: string
  rnc?: string
  direccion1?: string
  ciudad?: string
  telefono?: string
  logo_url?: string    // URL absoluta al logo de la empresa
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  meta?: ReportMeta,
) {
  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const allRows: (string | number | null | undefined)[][] = []
  if (meta) {
    allRows.push([meta.company])
    const rncPart = meta.rnc ? `RNC: ${meta.rnc}` : ''
    const dirPart = [meta.direccion1, meta.ciudad].filter(Boolean).join(', ')
    allRows.push([[rncPart, dirPart].filter(Boolean).join(' | ')])
    const telPart = meta.telefono ? `Tel: ${meta.telefono}` : ''
    const perPart = meta.mesAno ? `Período: ${meta.mesAno}` : ''
    const sucPart = meta.sucursal ? `Sucursal: ${meta.sucursal}` : ''
    allRows.push([[perPart, sucPart, telPart].filter(Boolean).join(' | ')])
    allRows.push([''])
  }
  allRows.push(headers)
  allRows.push(...rows)
  const csv = allRows.map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function buildReportMeta(
  noCia: string,
  sucursal: string,
  mesAno: string,
  moneda = 'Peso',
): Promise<ReportMeta> {
  try {
    const BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? '/api'
    const res = await fetch(
      `${BASE}/cnt/cia-header/?no_cia=${encodeURIComponent(noCia)}`,
      { credentials: 'include' },
    )
    if (res.ok) {
      const d = await res.json()
      const rawLogo: string | null = d.logo_url ?? null
      let logo_url: string | undefined
      if (rawLogo) {
        logo_url = rawLogo.startsWith('http')
          ? rawLogo
          : `${window.location.origin}${rawLogo}`
      }
      return {
        company: (d.descripcion ?? noCia).trim().toUpperCase(),
        rnc: d.rnc?.trim() || undefined,
        direccion1: d.direccion1?.trim() || undefined,
        ciudad: d.direccion2?.trim() || undefined,
        telefono: d.telefono1?.trim() || undefined,
        logo_url,
        sucursal,
        mesAno,
        moneda,
      }
    }
  } catch { /* fallback */ }
  return { company: noCia.toUpperCase(), sucursal, mesAno, moneda }
}

export function fmtN(val: number | null | undefined): string {
  if (val == null || val === 0) return '.00'
  const abs = Math.abs(val)
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return val < 0 ? `${s}-` : s
}

// ── CSS plantilla factura A4 ──────────────────────────────────────────────────
const CSS = `
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; background: #fff; -webkit-print-color-adjust: exact; }

.rh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
.rh-left .co { font-size: 11pt; font-weight: bold; line-height: 1.3; }
.rh-left .co-line { font-size: 8pt; line-height: 1.5; }
.co-logo { height: 52px; width: auto; object-fit: contain; flex-shrink: 0; }
.rh-right { font-size: 8pt; text-align: right; line-height: 1.5; white-space: nowrap; }
.rh-right .mod-name { font-size: 8pt; }
.rh-right .rep-code { font-size: 10pt; font-weight: bold; }
.rh-right .pag-line { font-size: 8pt; }
.pg-num::after { content: counter(page); }
.sep-double { border: none; border-top: 3px double #000; margin: 4px 0 2px 0; }

table.rpt { width: 100%; border-collapse: collapse; font-size: 8pt; margin-top: 4px; border: 1px solid #000; }
table.rpt thead th { font-weight: bold; text-align: left; border: 1px solid #000; padding: 3px 5px; white-space: nowrap; background: #e8e8e8; }
table.rpt thead th.r { text-align: right; }
table.rpt thead th.c { text-align: center; }
table.rpt tbody td { padding: 2px 5px; vertical-align: top; border: 1px solid #000; line-height: 1.4; }
table.rpt tbody td.r  { text-align: right; }
table.rpt tbody td.c  { text-align: center; }
table.rpt tbody td.mo { font-family: 'Courier New', Courier, monospace; }
table.rpt tbody tr.grp > td { font-weight: bold; background: #f4f4f4; }
table.rpt tbody tr.sub > td { font-weight: bold; background: #ececec; border-top: 2px solid #000; }
table.rpt tbody tr.grand > td { font-weight: bold; background: #ddd; border-top: 2px solid #000; }
table.rpt tfoot td { border: 1px solid #000; font-weight: bold; padding: 3px 5px; font-size: 8pt; background: #e8e8e8; }
table.rpt tfoot td.r { text-align: right; }

.legend { margin-top: 14px; font-size: 7.5pt; color: #333; columns: 3; column-gap: 8px; }
.legend div { margin-bottom: 2px; }

@page { size: letter portrait; margin: 1.4cm 1.5cm 1.6cm 1.5cm; }
@media print { body { margin: 0; } }
`

function buildHeader(meta: ReportMeta, code: string, title: string): string {
  const now  = new Date()
  const dd   = String(now.getDate()).padStart(2, '0')
  const mm   = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  const hh   = String(now.getHours() % 12 || 12).padStart(2, '0')
  const min  = String(now.getMinutes()).padStart(2, '0')
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM'
  const fecha = `${dd}/${mm}/${yyyy} ${hh}:${min} ${ampm}`

  const dir1  = meta.direccion1 ? `<div class="co-line">${meta.direccion1}</div>` : ''
  const ciudad = meta.ciudad    ? `<div class="co-line">${meta.ciudad}</div>`     : ''
  const tel   = meta.telefono   ? `<div class="co-line">Tel. ${meta.telefono}</div>` : ''
  const rnc   = meta.rnc        ? `<div class="co-line">RNC ${meta.rnc}</div>`    : ''
  const logoHtml = meta.logo_url
    ? `<img src="${meta.logo_url}" class="co-logo" onerror="this.style.display='none'" alt="logo"/>`
    : ''

  return `<div class="rh">
  <div class="rh-left" style="display:flex;align-items:flex-start;gap:8px">
    ${logoHtml}
    <div>
      <div class="co">${meta.company}</div>
      ${dir1}${ciudad}${tel}${rnc}
      <div class="co-line">${fecha}</div>
    </div>
  </div>
  <div class="rh-right">
    <div class="mod-name">Facturaci&oacute;n</div>
    <div class="rep-code">${code}</div>
    <div class="pag-line">P&aacute;gina &nbsp;<span class="pg-num"></span></div>
    <div class="pag-line">${title}</div>
  </div>
</div>
<hr class="sep-double"/>`
}

function doPrint(title: string, bodyHtml: string) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>${CSS}</style>
</head>
<body>${bodyHtml}</body>
</html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const ifr  = document.createElement('iframe')
  ifr.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0'
  document.body.appendChild(ifr)
  ifr.onload = () => {
    setTimeout(() => {
      ifr.contentWindow?.print()
      setTimeout(() => { document.body.removeChild(ifr); URL.revokeObjectURL(url) }, 4000)
    }, 400)
  }
  ifr.src = url
}

// ══════════════════════════════════════════════════════════════════════════════
// LISTA DE FACTURAS — Rfat201
// ══════════════════════════════════════════════════════════════════════════════

export interface FacturaRow {
  tipo_factura: string
  no_factura: string
  fecha: string | null
  nombre_cliente: string
  vendedor?: string
  total_linea?: number
  descuento?: number
  impuesto?: number
  total_neto: number
  estado: string
  ncf?: number | null
  ncf_dgi?: string | null
  codigo_ncf?: string
}

const ESTADO_LABEL: Record<string, string> = { A: 'Autorizada', P: 'Pendiente', C: 'Cancelada' }

export function printFacturas(meta: ReportMeta, rows: FacturaRow[], filtros?: string) {
  const title = 'Lista de Facturas'
  let totLinea = 0, totDesc = 0, totImp = 0, totNeto = 0

  const dataRows = rows.map((r) => {
    totLinea += r.total_linea ?? 0
    totDesc  += r.descuento  ?? 0
    totImp   += r.impuesto   ?? 0
    totNeto  += r.total_neto ?? 0
    const numFactura = `${r.tipo_factura}-${r.no_factura}`
    return `<tr>
      <td class="c" style="width:28px">${r.tipo_factura}</td>
      <td class="mo" style="width:62px">${numFactura}</td>
      <td class="c" style="width:62px">${r.fecha ?? ''}</td>
      <td>${r.nombre_cliente}</td>
      <td class="c" style="width:40px">${r.vendedor ?? ''}</td>
      <td class="r" style="width:68px">${fmtN(r.total_linea)}</td>
      <td class="r" style="width:56px">${fmtN(r.descuento)}</td>
      <td class="r" style="width:56px">${fmtN(r.impuesto)}</td>
      <td class="r" style="width:68px">${fmtN(r.total_neto)}</td>
      <td class="c" style="width:52px">${ESTADO_LABEL[r.estado] ?? r.estado}</td>
      <td class="mo" style="width:50px">${r.ncf_dgi ?? String(r.ncf ?? '')}</td>
    </tr>`
  }).join('')

  const filtroLine = filtros ? `<div style="font-size:7.5pt;margin-bottom:4px;color:#555">${filtros}</div>` : ''

  const body = `
${buildHeader(meta, 'Rfat201', title)}
${filtroLine}
<table class="rpt">
  <thead><tr>
    <th class="c" style="width:28px">Tipo</th>
    <th style="width:62px">No.Factura</th>
    <th class="c" style="width:62px">Fecha</th>
    <th>Cliente</th>
    <th class="c" style="width:40px">Vend.</th>
    <th class="r" style="width:68px">Total L&iacute;nea</th>
    <th class="r" style="width:56px">Descuento</th>
    <th class="r" style="width:56px">ITBIS</th>
    <th class="r" style="width:68px">Total Neto</th>
    <th class="c" style="width:52px">Estado</th>
    <th class="mo" style="width:50px">NCF</th>
  </tr></thead>
  <tbody>${dataRows}</tbody>
  <tfoot><tr>
    <td colspan="5">Total &mdash; ${rows.length} factura(s)</td>
    <td class="r">${fmtN(totLinea)}</td>
    <td class="r">${fmtN(totDesc)}</td>
    <td class="r">${fmtN(totImp)}</td>
    <td class="r">${fmtN(totNeto)}</td>
    <td colspan="2"></td>
  </tr></tfoot>
</table>`
  doPrint(title, body)
}

// ══════════════════════════════════════════════════════════════════════════════
// DETALLE DE FACTURA — Rfat202
// ══════════════════════════════════════════════════════════════════════════════

export interface FacturaLinea {
  no_linea: number
  no_produ: string
  descripcion: string
  cantidad: number
  precio: number
  porc_descuento: number
  descuento: number
  porciento_impuesto: number
  impuesto: number
  monto_neto: number
}

export interface FacturaDetalle {
  tipo_factura: string
  no_factura: string
  fecha: string | null
  no_cliente: number
  nombre_cliente: string
  vendedor?: string
  forma_pago?: string
  plazo_pago?: number
  codigo_ncf?: string
  ncf?: number | null
  nota?: string
  total_linea: number
  descuento: number
  impuesto: number
  propina?: number
  total_neto: number
  estado: string
  lineas: FacturaLinea[]
}

export function printFacturaDetalle(meta: ReportMeta, f: FacturaDetalle) {
  const numFactura = `${f.tipo_factura}-${f.no_factura}`
  const title = `Factura ${numFactura}`
  const lineas = f.lineas.map((l) => `<tr>
    <td class="c" style="width:28px">${l.no_linea}</td>
    <td class="mo" style="width:70px">${l.no_produ}</td>
    <td>${l.descripcion}</td>
    <td class="r" style="width:44px">${l.cantidad.toLocaleString('en-US')}</td>
    <td class="r" style="width:60px">${fmtN(l.precio)}</td>
    <td class="r" style="width:36px">${l.porc_descuento ? l.porc_descuento + '%' : ''}</td>
    <td class="r" style="width:56px">${fmtN(l.descuento)}</td>
    <td class="r" style="width:36px">${l.porciento_impuesto ? l.porciento_impuesto + '%' : ''}</td>
    <td class="r" style="width:60px">${fmtN(l.monto_neto)}</td>
  </tr>`).join('')

  const body = `
${buildHeader(meta, 'Rfat202', title)}
<table class="rpt" style="margin-bottom:6px">
  <tbody>
    <tr>
      <td style="width:80px"><strong>Tipo/No.</strong></td>
      <td>${numFactura}</td>
      <td style="width:60px"><strong>Fecha</strong></td>
      <td>${f.fecha ?? ''}</td>
      <td style="width:60px"><strong>Estado</strong></td>
      <td>${ESTADO_LABEL[f.estado] ?? f.estado}</td>
    </tr>
    <tr>
      <td><strong>Cliente</strong></td>
      <td colspan="3">${f.no_cliente} &mdash; ${f.nombre_cliente}</td>
      <td><strong>Vendedor</strong></td>
      <td>${f.vendedor ?? ''}</td>
    </tr>
    <tr>
      <td><strong>Forma Pago</strong></td>
      <td>${f.forma_pago ?? ''}</td>
      <td><strong>Plazo</strong></td>
      <td>${f.plazo_pago ? f.plazo_pago + ' d&iacute;as' : ''}</td>
      <td><strong>NCF</strong></td>
      <td class="mo">${f.codigo_ncf ?? ''} ${f.ncf ?? ''}</td>
    </tr>
  </tbody>
</table>
<table class="rpt">
  <thead><tr>
    <th class="c" style="width:28px">Lin.</th>
    <th style="width:70px">Producto</th>
    <th>Descripci&oacute;n</th>
    <th class="r" style="width:44px">Cant.</th>
    <th class="r" style="width:60px">Precio</th>
    <th class="r" style="width:36px">%Desc</th>
    <th class="r" style="width:56px">Descuento</th>
    <th class="r" style="width:36px">%ITBIS</th>
    <th class="r" style="width:60px">Neto</th>
  </tr></thead>
  <tbody>${lineas}</tbody>
  <tfoot>
    <tr><td colspan="8" class="r"><strong>Total L&iacute;nea</strong></td><td class="r">${fmtN(f.total_linea)}</td></tr>
    <tr><td colspan="8" class="r"><strong>Descuento</strong></td><td class="r">${fmtN(f.descuento)}</td></tr>
    <tr><td colspan="8" class="r"><strong>ITBIS</strong></td><td class="r">${fmtN(f.impuesto)}</td></tr>
    ${f.propina ? `<tr><td colspan="8" class="r"><strong>Propina</strong></td><td class="r">${fmtN(f.propina)}</td></tr>` : ''}
    <tr><td colspan="8" class="r"><strong>TOTAL NETO</strong></td><td class="r"><strong>${fmtN(f.total_neto)}</strong></td></tr>
  </tfoot>
</table>
${f.nota ? `<div style="margin-top:8px;font-size:7.5pt"><strong>Nota:</strong> ${f.nota}</div>` : ''}`
  doPrint(title, body)
}

// ══════════════════════════════════════════════════════════════════════════════
// TIPOS DE DOCUMENTO — Rfat104
// ══════════════════════════════════════════════════════════════════════════════

export interface TipoDocuRow {
  tipo_docu: string
  descripcion: string
  tipo_transaccion: string
  codigo_ncf?: string | null
  activo: boolean
}

const TIPO_TRANS: Record<string, string> = {
  F: 'Crédito', O: 'Contado', C: 'Conduce', A: 'Anulación',
}

export function printTiposDocumento(meta: ReportMeta, rows: TipoDocuRow[]) {
  const title = 'Tipos de Documento'
  const dataRows = rows.map((r) => `<tr>
    <td class="mo" style="width:50px">${r.tipo_docu}</td>
    <td>${r.descripcion}</td>
    <td class="c" style="width:70px">${TIPO_TRANS[r.tipo_transaccion] ?? r.tipo_transaccion}</td>
    <td class="c" style="width:60px">${r.codigo_ncf ?? ''}</td>
    <td class="c" style="width:50px">${r.activo ? 'Sí' : 'No'}</td>
  </tr>`).join('')

  const body = `
${buildHeader(meta, 'Rfat104', title)}
<table class="rpt">
  <thead><tr>
    <th style="width:50px">Tipo</th>
    <th>Descripci&oacute;n</th>
    <th class="c" style="width:70px">Transacci&oacute;n</th>
    <th class="c" style="width:60px">C&oacute;d. NCF</th>
    <th class="c" style="width:50px">Activo</th>
  </tr></thead>
  <tbody>${dataRows}</tbody>
  <tfoot><tr><td colspan="5">Total &nbsp; ${rows.length} tipo(s) de documento</td></tr></tfoot>
</table>`
  doPrint(title, body)
}

// ══════════════════════════════════════════════════════════════════════════════
// CONDICIONES DE PAGO — Rfat105
// ══════════════════════════════════════════════════════════════════════════════

export interface CondicionPagoRow {
  no_condicion_pago: string
  descripcion: string
  plazo_pago: number
  porciento: number
  activa: boolean
}

export function printCondicionesPago(meta: ReportMeta, rows: CondicionPagoRow[]) {
  const title = 'Condiciones de Pago'
  const dataRows = rows.map((r) => `<tr>
    <td class="mo" style="width:80px">${r.no_condicion_pago}</td>
    <td>${r.descripcion}</td>
    <td class="r" style="width:60px">${r.plazo_pago} d&iacute;as</td>
    <td class="r" style="width:60px">${r.porciento ? r.porciento + '%' : ''}</td>
    <td class="c" style="width:50px">${r.activa ? 'Activa' : 'Inactiva'}</td>
  </tr>`).join('')

  const body = `
${buildHeader(meta, 'Rfat105', title)}
<table class="rpt">
  <thead><tr>
    <th style="width:80px">C&oacute;digo</th>
    <th>Descripci&oacute;n</th>
    <th class="r" style="width:60px">Plazo</th>
    <th class="r" style="width:60px">% Dto. Pronto</th>
    <th class="c" style="width:50px">Estado</th>
  </tr></thead>
  <tbody>${dataRows}</tbody>
  <tfoot><tr><td colspan="5">Total &nbsp; ${rows.length} condici&oacute;n(es)</td></tr></tfoot>
</table>`
  doPrint(title, body)
}
