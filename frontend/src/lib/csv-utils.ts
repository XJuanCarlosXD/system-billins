// CSV genérico para pantallas CxP (aging, cuentas, documentos, movimientos,
// proveedores): recibe un array de objetos planos {columna: valor} y
// descarga un .csv con esas columnas como encabezado. Distinto del
// downloadCsv de @/features/cnt/export-utils (firma columnar
// filename/headers/rows[][] para los reportes CNT con formato de página) --
// mismo nombre, propósito distinto, no reexportar ese sin adaptar la firma.
export function downloadCsv(rows: Record<string, string | number | null | undefined>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [headers, ...rows.map(r => headers.map(h => r[h]))]
    .map(line => line.map(esc).join(','))
    .join('\r\n')
  const blob = new Blob(['﻿' + lines], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
