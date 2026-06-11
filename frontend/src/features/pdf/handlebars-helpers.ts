import Handlebars from 'handlebars'

// Helpers registrados globalmente para los bloques TextoLibre.

function safeNumber(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return isNaN(n) ? 0 : n
  }
  return 0
}

Handlebars.registerHelper('formatMoney', function (v: unknown, decimals?: unknown) {
  const d = typeof decimals === 'number' ? decimals : 2
  const n = safeNumber(v)
  return n.toLocaleString('es-DO', { minimumFractionDigits: d, maximumFractionDigits: d })
})

Handlebars.registerHelper('formatDate', function (v: unknown, fmt?: unknown) {
  if (!v) return ''
  const s = String(v)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return s
  const [, y, mo, d] = m
  const format = typeof fmt === 'string' ? fmt : 'dd/MM/yyyy'
  return format
    .replace('dd', d)
    .replace('MM', mo)
    .replace('yyyy', y)
})

Handlebars.registerHelper('upper', function (v: unknown) {
  return String(v ?? '').toUpperCase()
})

Handlebars.registerHelper('lower', function (v: unknown) {
  return String(v ?? '').toLowerCase()
})

Handlebars.registerHelper('pad', function (v: unknown, len: unknown, char?: unknown) {
  const n = typeof len === 'number' ? len : 0
  const c = typeof char === 'string' ? char : '0'
  return String(v ?? '').padStart(n, c)
})

Handlebars.registerHelper('eq', function (a: unknown, b: unknown) {
  return a === b
})

Handlebars.registerHelper('default', function (v: unknown, alt: unknown) {
  if (v === undefined || v === null || v === '') return alt
  return v
})

export function compileTemplate(source: string): HandlebarsTemplateDelegate {
  return Handlebars.compile(source, { noEscape: false, strict: false })
}

export function renderTemplate(source: string, data: unknown): string {
  try {
    return compileTemplate(source)(data)
  } catch (err) {
    return `{{ error: ${(err as Error).message} }}`
  }
}

export default Handlebars
