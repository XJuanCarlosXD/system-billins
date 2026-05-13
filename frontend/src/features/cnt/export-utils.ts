export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escapeCell = (value: string | number | null | undefined) => {
    const text = String(value ?? '')
    return `"${text.replace(/"/g, '""')}"`
  }

  const csv = [headers, ...rows]
    .map((line) => line.map(escapeCell).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function printHtml(title: string, body: string) {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720')
  if (!popup) return

  popup.document.write(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
        h1 { font-size: 18px; margin: 0 0 16px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
        th { background: #f3f4f6; }
        .numeric { text-align: right; font-family: monospace; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${body}
    </body>
  </html>`)
  popup.document.close()
  popup.focus()
  popup.print()
}
