// Printing utilities — Contabilidad General
// Template replica exacta del sistema legado (catalogo.pdf Rcnt301)
// Orientacion: portrait (vertical), header 3-lineas izq. + tabla Pagina/Fecha/Codigo der.

// ── CSV download ───────────────────────────────────────────────────────────────
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
    allRows.push([''])  // blank separator row
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

// ── Report metadata — fetched from API ────────────────────────────────────────
export interface ReportMeta {
  company: string   // "ABREGONZA,SRL"
  sucursal: string
  mesAno: string
  moneda?: string
  rnc?: string
  direccion1?: string  // "CALLE TUNTI CACERES #93 VILLA CONSUELO"
  ciudad?: string      // "SANTO DOMINGO"
  telefono?: string
  logo_url?: string    // URL absoluta al logo de la empresa (sirve en print window)
}

// Carga datos reales de empresa desde API /cnt/cia-header/
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
      // logo_url from API is a relative path like /api/cnt/cia-logo/01/
      // Convert to absolute so the print window (blob URL) can load it
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

// ── Number format (legado): 0→".00", negativo→"1,234.56-" ────────────────────
export function fmtN(val: number | null | undefined): string {
  if (val == null || val === 0) return '.00'
  const abs = Math.abs(val)
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return val < 0 ? `${s}-` : s
}

// ══════════════════════════════════════════════════════════════════════════════
// CSS — estilo replica factura A4 legacy
// ══════════════════════════════════════════════════════════════════════════════
const CSS = `
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 8pt;
  color: #000;
  background: #fff;
  -webkit-print-color-adjust: exact;
}

/* ── Cabecera estilo factura A4 ── */
.rh {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
}

/* Lado izquierdo: empresa completa igual que factura */
.rh-left .co {
  font-size: 11pt;
  font-weight: bold;
  line-height: 1.3;
}
.rh-left .co-line {
  font-size: 8pt;
  line-height: 1.5;
}
.co-logo {
  height: 52px;
  width: auto;
  object-fit: contain;
  flex-shrink: 0;
}

/* Lado derecho: modulo / codigo / pagina */
.rh-right {
  font-size: 8pt;
  text-align: right;
  line-height: 1.5;
  white-space: nowrap;
}
.rh-right .mod-name {
  font-size: 8pt;
}
.rh-right .rep-code {
  font-size: 10pt;
  font-weight: bold;
}
.rh-right .pag-line {
  font-size: 8pt;
}
.pg-num::after {
  content: counter(page);
}

/* Separador doble igual que factura */
.sep-double {
  border: none;
  border-top: 3px double #000;
  margin: 4px 0 2px 0;
}

/* ── Tabla estilo factura A4: bordes cerrados en cada celda ── */
table.rpt {
  width: 100%;
  border-collapse: collapse;
  font-size: 8pt;
  margin-top: 4px;
  border: 1px solid #000;
}

/* Encabezado: fondo gris claro, negrita, borde en todas las celdas */
table.rpt thead th {
  font-weight: bold;
  text-align: left;
  border: 1px solid #000;
  padding: 3px 5px;
  white-space: nowrap;
  background: #e8e8e8;
}
table.rpt thead th.r { text-align: right; }
table.rpt thead th.c { text-align: center; }

/* Filas de datos: borde en cada celda — cuadro cerrado */
table.rpt tbody td {
  padding: 2px 5px;
  vertical-align: top;
  border: 1px solid #000;
  line-height: 1.4;
}
table.rpt tbody td.r  { text-align: right; }
table.rpt tbody td.c  { text-align: center; }
table.rpt tbody td.mo { font-family: 'Courier New', Courier, monospace; }

/* Fila de grupo/seccion: fondo gris suave */
table.rpt tbody tr.grp > td { font-weight: bold; background: #f4f4f4; }
/* Fila de subtotal */
table.rpt tbody tr.sub > td { font-weight: bold; background: #ececec; border-top: 2px solid #000; }
/* Fila de total general */
table.rpt tbody tr.grand > td { font-weight: bold; background: #ddd; border-top: 2px solid #000; }

/* Pie de tabla */
table.rpt tfoot td {
  border: 1px solid #000;
  font-weight: bold;
  padding: 3px 5px;
  font-size: 8pt;
  background: #e8e8e8;
}
table.rpt tfoot td.r { text-align: right; }

/* Leyenda final */
.legend {
  margin-top: 14px;
  font-size: 7.5pt;
  color: #333;
  columns: 3;
  column-gap: 8px;
}
.legend div { margin-bottom: 2px; }

/* ── Configuracion de pagina: portrait, margenes legado ── */
@page {
  size: letter portrait;
  margin: 1.4cm 1.5cm 1.6cm 1.5cm;
}
@media print {
  body { margin: 0; }
}
`

// ══════════════════════════════════════════════════════════════════════════════
// Generador de cabecera — estilo factura A4 legacy (con logo)
// ══════════════════════════════════════════════════════════════════════════════
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
    <div class="mod-name">Contabilidad General</div>
    <div class="rep-code">${code}</div>
    <div class="pag-line">P&aacute;gina &nbsp;<span class="pg-num"></span></div>
    <div class="pag-line">${title}</div>
  </div>
</div>
<hr class="sep-double"/>`
}

// ── Motor de impresion ─────────────────────────────────────────────────────────
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
// CATÁLOGO DE CUENTAS — Rcnt301
// Columnas: Cuenta | Nombre | Tipo | Clase | Acepta Movi | Moneda | Activa
// ══════════════════════════════════════════════════════════════════════════════

export interface CatalogoRow {
  cuenta: string
  nombre: string
  tipo?: string
  clase?: string
  acepta_movimiento?: string
  moneda?: string
  activa?: string
  isGroup?: boolean
  nivel?: number
}

export function printCatalogoCuentas(
  meta: ReportMeta,
  rows: CatalogoRow[],
  title = 'Catálogo de Cuentas',
) {
  const dataRows = rows
    .map(
      (r) => `<tr class="${r.isGroup ? 'grp' : ''}">
      <td class="mo" style="padding-left:${(r.nivel ?? 0) * 10}px">${r.cuenta}</td>
      <td>${r.nombre ?? ''}</td>
      <td class="c">${r.tipo ?? ''}</td>
      <td class="c">${r.clase ?? ''}</td>
      <td class="c">${r.acepta_movimiento ?? ''}</td>
      <td class="c">${r.moneda ?? ''}</td>
      <td class="c">${r.activa ?? ''}</td>
    </tr>`,
    )
    .join('')

  const body = `
${buildHeader(meta, 'Rcnt301', title)}
<table class="rpt">
  <thead><tr>
    <th style="width:90px">Cuenta</th>
    <th>Nombre</th>
    <th class="c" style="width:38px">Tipo</th>
    <th class="c" style="width:38px">Clase</th>
    <th class="c" style="width:72px">Acepta Movi</th>
    <th class="c" style="width:50px">Moneda</th>
    <th class="c" style="width:42px">Activa</th>
  </tr></thead>
  <tbody>${dataRows}</tbody>
  <tfoot><tr><td colspan="7">Total Cuentas &nbsp; ${rows.filter((r) => !r.isGroup).length}</td></tr></tfoot>
</table>`
  doPrint(title, body)
}

// ══════════════════════════════════════════════════════════════════════════════
// TIPOS DE CUENTA — Rcnt300-T
// Columnas: Tipo | Descripcion | Clase
// ══════════════════════════════════════════════════════════════════════════════

export interface TipoCuentaRow {
  tipo: string
  descripcion: string
  clase: string
}

const CLASE_NOMBRE: Record<string, string> = {
  A: 'Activo', P: 'Pasivo', C: 'Capital', I: 'Ingreso', E: 'Egreso',
}

export function printTiposCuenta(meta: ReportMeta, rows: TipoCuentaRow[]) {
  const title = 'Tipo de Cuenta'
  const dataRows = rows
    .map(
      (r) => `<tr>
      <td class="mo" style="width:70px">${r.tipo}</td>
      <td>${(r.descripcion ?? '').trim()}</td>
      <td class="c" style="width:70px">${CLASE_NOMBRE[r.clase] ?? r.clase}</td>
    </tr>`,
    )
    .join('')

  const body = `
${buildHeader(meta, 'Rcnt300-T', title)}
<table class="rpt">
  <thead><tr>
    <th style="width:70px">Tipo</th>
    <th>Descripci&oacute;n</th>
    <th class="c" style="width:70px">Clase</th>
  </tr></thead>
  <tbody>${dataRows}</tbody>
  <tfoot><tr><td colspan="3">Total &nbsp; ${rows.length} tipo(s) de cuenta</td></tr></tfoot>
</table>`
  doPrint(title, body)
}

// ══════════════════════════════════════════════════════════════════════════════
// CENTROS DE COSTO — Rcnt308
// Columnas: Centro | Descripcion | Estado | Acepta Movi
// ══════════════════════════════════════════════════════════════════════════════

export interface CentroCostoRow {
  centro_costo: string
  descripcion: string
  activo?: string
  acepta_movi?: string
}

export function printCentrosCosto(meta: ReportMeta, rows: CentroCostoRow[]) {
  const title = 'Catálogo Centros de Costos'
  const dataRows = rows
    .map(
      (r) => `<tr>
      <td class="mo" style="width:80px">${r.centro_costo}</td>
      <td>${(r.descripcion ?? '').trim()}</td>
      <td class="c" style="width:60px">${r.activo === 'S' ? 'Activo' : 'Inactivo'}</td>
      <td class="c" style="width:80px">${r.acepta_movi === 'S' ? 'Sí' : 'No'}</td>
    </tr>`,
    )
    .join('')

  const body = `
${buildHeader(meta, 'Rcnt308', title)}
<table class="rpt">
  <thead><tr>
    <th style="width:80px">Centro</th>
    <th>Descripci&oacute;n</th>
    <th class="c" style="width:60px">Estado</th>
    <th class="c" style="width:80px">Acepta Movi.</th>
  </tr></thead>
  <tbody>${dataRows}</tbody>
  <tfoot><tr><td colspan="4">Total &nbsp; ${rows.length} centro(s) de costo</td></tr></tfoot>
</table>`
  doPrint(title, body)
}

// ══════════════════════════════════════════════════════════════════════════════
// BALANCE DE COMPROBACIÓN — Rcnt302
// Columnas: Cuenta | Nombre | Saldo Mes Ant. | Débitos | Créditos | Sal.D | Sal.C
// ══════════════════════════════════════════════════════════════════════════════

export interface BalanceRow {
  cuenta: string
  nombre: string
  isGroup?: boolean
  saldoMesAnt: number | null
  debitos: number | null
  creditos: number | null
  saldoDebito: number | null
  saldoCredito: number | null
}

export function printBalanceComprobacion(meta: ReportMeta, rows: BalanceRow[]) {
  const title = `Balance de Comprobación &nbsp;&mdash;&nbsp; ${meta.mesAno}`
  let totD = 0, totC = 0, totSD = 0, totSC = 0

  const dataRows = rows
    .map((r) => {
      if (!r.isGroup) {
        totD  += r.debitos      ?? 0
        totC  += r.creditos     ?? 0
        totSD += r.saldoDebito  ?? 0
        totSC += r.saldoCredito ?? 0
      }
      return `<tr class="${r.isGroup ? 'grp' : ''}">
        <td class="mo" style="width:90px">${r.cuenta}</td>
        <td>${r.nombre}</td>
        <td class="r" style="width:70px">${fmtN(r.saldoMesAnt)}</td>
        <td class="r" style="width:70px">${fmtN(r.debitos)}</td>
        <td class="r" style="width:70px">${fmtN(r.creditos)}</td>
        <td class="r" style="width:70px">${fmtN(r.saldoDebito)}</td>
        <td class="r" style="width:70px">${fmtN(r.saldoCredito)}</td>
      </tr>`
    })
    .join('')

  const body = `
${buildHeader(meta, 'Rcnt302', 'Balance de Comprobación')}
<table class="rpt">
  <thead><tr>
    <th style="width:90px">Cuenta</th>
    <th>Nombre Cuenta</th>
    <th class="r" style="width:70px">Saldo Mes Ant.</th>
    <th class="r" style="width:70px">Débitos</th>
    <th class="r" style="width:70px">Créditos</th>
    <th class="r" style="width:70px">Saldo Débito</th>
    <th class="r" style="width:70px">Saldo Crédito</th>
  </tr></thead>
  <tbody>${dataRows}</tbody>
  <tfoot><tr>
    <td colspan="2">Totales</td>
    <td class="r">.00</td>
    <td class="r">${fmtN(totD)}</td>
    <td class="r">${fmtN(totC)}</td>
    <td class="r">${fmtN(totSD)}</td>
    <td class="r">${fmtN(totSC)}</td>
  </tr></tfoot>
</table>`
  doPrint('Balance de Comprobación', body)
}

// ══════════════════════════════════════════════════════════════════════════════
// MAYOR GENERAL — Rcnt304
// ══════════════════════════════════════════════════════════════════════════════

export interface MayorTx {
  asiento: string
  fecha: string
  auxiliar?: string
  ap: string
  compnte?: string
  detalle: string
  debito: number
  credito: number
  balance: number
}

export interface MayorAccount {
  cuenta: string
  nombre: string
  balanceInicial: number
  transactions: MayorTx[]
  totalDebito: number
  totalCredito: number
  balanceFinal: number
}

export function printMayorGeneral(meta: ReportMeta, accounts: MayorAccount[]) {
  const title = `Mayor General &mdash; ${meta.mesAno}`
  let totDeb = 0, totCre = 0

  const blocks = accounts
    .map((a) => {
      totDeb += a.totalDebito
      totCre += a.totalCredito
      const txs = a.transactions
        .map(
          (tx) => `<tr>
            <td class="mo">${tx.asiento}</td>
            <td>${tx.fecha}</td>
            <td>${tx.auxiliar ?? ''}</td>
            <td class="c">${tx.ap}</td>
            <td>${tx.compnte ?? ''}</td>
            <td>${tx.detalle}</td>
            <td class="r">${fmtN(tx.debito)}</td>
            <td class="r">${fmtN(tx.credito)}</td>
            <td class="r">${fmtN(tx.balance)}</td>
          </tr>`,
        )
        .join('')
      return `<tr class="grp">
          <td colspan="6">${a.cuenta} &nbsp;&nbsp; ${a.nombre}</td>
          <td colspan="2" class="r" style="font-weight:normal;font-size:7.5pt">Balance Inicial ===&gt;</td>
          <td class="r">${fmtN(a.balanceInicial)}</td>
        </tr>
        <tr style="font-size:7.5pt;color:#444;border-bottom:1px solid #bbb">
          <td>Asiento</td><td>Fecha</td><td>Auxiliar</td>
          <td class="c">AP</td><td>Compnte.</td><td>Detalle</td>
          <td class="r">Débito</td><td class="r">Crédito</td><td class="r">Balance</td>
        </tr>
        ${txs}
        <tr class="sub">
          <td colspan="6"></td>
          <td class="r">${fmtN(a.totalDebito)}</td>
          <td class="r">${fmtN(a.totalCredito)}</td>
          <td class="r">${fmtN(a.balanceFinal)}</td>
        </tr>`
    })
    .join('')

  const body = `
${buildHeader(meta, 'Rcnt304', 'Mayor General')}
<table class="rpt">
  <thead><tr>
    <th style="width:46px">Asiento</th>
    <th style="width:62px">Fecha</th>
    <th style="width:46px">Auxiliar</th>
    <th class="c" style="width:24px">AP</th>
    <th style="width:46px">Compnte.</th>
    <th>Detalle</th>
    <th class="r" style="width:62px">Débito</th>
    <th class="r" style="width:62px">Crédito</th>
    <th class="r" style="width:62px">Balance</th>
  </tr></thead>
  <tbody>${blocks}</tbody>
  <tfoot><tr>
    <td colspan="4">TOTALES &nbsp; &mdash; &nbsp; ${accounts.length} cuenta(s)</td>
    <td colspan="2">Balance Inicial</td>
    <td class="r">${fmtN(totDeb)}</td>
    <td class="r">${fmtN(totCre)}</td>
    <td class="r">.00</td>
  </tr></tfoot>
</table>`
  doPrint('Mayor General', body)
}

// ══════════════════════════════════════════════════════════════════════════════
// HISTÓRICO DE ASIENTOS — Rcnt316
// ══════════════════════════════════════════════════════════════════════════════

export interface AsientoLinea {
  lin: number
  cuenta: string
  nombre: string
  ap?: string
  noComp?: string
  debito: number
  credito: number
}

export interface AsientoHistorico {
  asiento: string
  fecha: string
  status: string
  generadoDesde?: string
  detalle: string
  lineas: AsientoLinea[]
  totalDebito: number
  totalCredito: number
}

export function printHistoricoAsientos(
  meta: ReportMeta,
  asientos: AsientoHistorico[],
  desde: string,
  hasta: string,
) {
  const title = `Histórico de Asientos &mdash; ${desde} al ${hasta}`
  let totDeb = 0, totCre = 0

  const blocks = asientos
    .map((a) => {
      totDeb += a.totalDebito
      totCre += a.totalCredito
      const lineas = a.lineas
        .map(
          (l) => `<tr>
            <td class="c">${l.lin}</td>
            <td class="mo">${l.cuenta}</td>
            <td>${l.nombre}</td>
            <td class="c">${l.ap ?? ''}</td>
            <td>${l.noComp ?? ''}</td>
            <td class="r">${fmtN(l.debito)}</td>
            <td class="r">${fmtN(l.credito)}</td>
            <td class="r">.00</td>
          </tr>`,
        )
        .join('')
      return `<tr class="grp">
          <td>${String(a.asiento).padStart(4, '0')}</td>
          <td>${a.fecha}</td>
          <td colspan="2">${a.status}</td>
          <td>${a.generadoDesde ?? ''}</td>
          <td colspan="3">${a.detalle}</td>
        </tr>
        <tr style="font-size:7.5pt;color:#444;border-bottom:1px solid #bbb">
          <td class="c">Lin.</td><td colspan="2">Cuenta &nbsp; Nombre</td>
          <td class="c">AP</td><td>No.Comp.</td>
          <td class="r">Débito</td><td class="r">Crédito</td><td class="r">Diferencia</td>
        </tr>
        ${lineas}
        <tr class="sub">
          <td colspan="5"></td>
          <td class="r">${fmtN(a.totalDebito)}</td>
          <td class="r">${fmtN(a.totalCredito)}</td>
          <td class="r">.00</td>
        </tr>`
    })
    .join('')

  const body = `
${buildHeader(meta, 'Rcnt316', 'Histórico de Asientos')}
<table class="rpt">
  <thead><tr>
    <th style="width:40px">Asiento</th>
    <th style="width:62px">Fecha</th>
    <th colspan="2">Estado</th>
    <th>Generado Desde</th>
    <th colspan="3">Detalle del Asiento</th>
  </tr></thead>
  <tbody>${blocks}</tbody>
  <tfoot><tr>
    <td colspan="3">Total General &nbsp;&mdash;&nbsp; ${asientos.length} asiento(s)</td>
    <td colspan="2"></td>
    <td class="r">${fmtN(totDeb)}</td>
    <td class="r">${fmtN(totCre)}</td>
    <td class="r">.00</td>
  </tr></tfoot>
</table>`
  doPrint('Histórico de Asientos', body)
}

// ══════════════════════════════════════════════════════════════════════════════
// VERIFICACIÓN DE ASIENTOS — Rcnt303
// ══════════════════════════════════════════════════════════════════════════════

export function printVerificacionAsientos(meta: ReportMeta, asientos: AsientoHistorico[]) {
  printHistoricoAsientos(meta, asientos, meta.mesAno, meta.mesAno)
}

// ══════════════════════════════════════════════════════════════════════════════
// MANTENIMIENTO NCF — Rcnt114
// Columnas: Codigo | Inicial | Final | Proximo | Disponibles | Tipo | Vencimiento
// ══════════════════════════════════════════════════════════════════════════════

export interface NcfRow {
  codigo_ncf: string
  ncf_inicial: number | string
  ncf_final: number | string
  prox_ncf: number | string
  disponibles: number | string
  tipo_ncf_fiscal: string
  fecha_vencimiento?: string | null
}

export function printNcf(meta: ReportMeta, rows: NcfRow[]) {
  const title = 'Mantenimiento NCF'
  const dataRows = rows
    .map(
      (r) => `<tr>
      <td class="mo">${r.codigo_ncf ?? ''}</td>
      <td class="r">${r.ncf_inicial ?? ''}</td>
      <td class="r">${r.ncf_final ?? ''}</td>
      <td class="r">${r.prox_ncf ?? ''}</td>
      <td class="r">${r.disponibles ?? ''}</td>
      <td>${r.tipo_ncf_fiscal ?? ''}</td>
      <td class="c">${r.fecha_vencimiento ? String(r.fecha_vencimiento).slice(0, 10) : ''}</td>
    </tr>`,
    )
    .join('')

  const body = `
${buildHeader(meta, 'Rcnt114', title)}
<table class="rpt">
  <thead><tr>
    <th style="width:90px">Codigo NCF</th>
    <th class="r" style="width:70px">Inicial</th>
    <th class="r" style="width:70px">Final</th>
    <th class="r" style="width:70px">Proximo</th>
    <th class="r" style="width:70px">Disponibles</th>
    <th>Tipo Fiscal</th>
    <th class="c" style="width:80px">Vencimiento</th>
  </tr></thead>
  <tbody>${dataRows}</tbody>
  <tfoot><tr><td colspan="7">Total &nbsp; ${rows.length} secuencia(s) NCF</td></tr></tfoot>
</table>`
  doPrint(title, body)
}

// ── Kept for backward compat ──────────────────────────────────────────────────
export function printHtml(title: string, body: string) {
  doPrint(title, `<h2 style="margin-bottom:8px;font-size:11pt">${title}</h2>${body}`)
}