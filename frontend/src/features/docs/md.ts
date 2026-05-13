// Renderizador markdown mínimo, sin dependencias externas.
// Suficiente para los .md del proyecto: headings, bold, italic, code, links,
// listas, tablas y bloques de código. Escapa HTML antes de transformar.

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(s: string) {
  // code spans
  s = s.replace(/`([^`]+?)`/g, '<code class="px-1 rounded bg-muted text-[0.85em]">$1</code>')
  // bold
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // italic
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  // links [text](url)
  s = s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="underline text-primary" target="_blank" rel="noopener">$1</a>',
  )
  return s
}

export function renderMarkdown(src: string): string {
  const escaped = escapeHtml(src)
  const lines = escaped.split('\n')
  const out: string[] = []
  let i = 0
  let inCode = false
  let codeLang = ''
  let codeBuf: string[] = []
  let inList = false
  let listType: 'ul' | 'ol' | null = null
  let inTable = false
  let tableHeader: string[] = []

  function closeList() {
    if (inList && listType) {
      out.push(listType === 'ul' ? '</ul>' : '</ol>')
      inList = false
      listType = null
    }
  }
  function closeTable() {
    if (inTable) {
      out.push('</tbody></table>')
      inTable = false
      tableHeader = []
    }
  }

  while (i < lines.length) {
    const line = lines[i]
    const stripped = line.trimEnd()

    if (stripped.startsWith('```')) {
      if (!inCode) {
        closeList(); closeTable()
        inCode = true
        codeLang = stripped.slice(3).trim()
        codeBuf = []
      } else {
        out.push(
          `<pre class="rounded bg-muted p-3 my-3 overflow-x-auto text-xs"><code data-lang="${codeLang}">${codeBuf.join('\n')}</code></pre>`,
        )
        inCode = false
      }
      i++
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      i++
      continue
    }

    // Tablas (header | sep | rows)
    if (stripped.includes('|') && lines[i + 1] && /^\s*\|?\s*[:\- \|]+\s*\|?\s*$/.test(lines[i + 1])) {
      closeList()
      tableHeader = stripped.split('|').map((c) => c.trim()).filter((c, idx, arr) => !(c === '' && (idx === 0 || idx === arr.length - 1)))
      out.push('<table class="my-3 w-full text-sm border-collapse"><thead><tr>')
      tableHeader.forEach((h) => out.push(`<th class="text-start border-b py-1 px-2">${inline(h)}</th>`))
      out.push('</tr></thead><tbody>')
      inTable = true
      i += 2
      continue
    }
    if (inTable && stripped.includes('|') && stripped.trim() !== '') {
      const cells = stripped.split('|').map((c) => c.trim()).filter((c, idx, arr) => !(c === '' && (idx === 0 || idx === arr.length - 1)))
      out.push('<tr>')
      cells.forEach((c) => out.push(`<td class="py-1 px-2 border-b border-border/50">${inline(c)}</td>`))
      out.push('</tr>')
      i++
      continue
    } else if (inTable) {
      closeTable()
    }

    // Headings
    const h = /^(#{1,6})\s+(.*)$/.exec(stripped)
    if (h) {
      closeList(); closeTable()
      const lvl = h[1].length
      const cls = lvl === 1
        ? 'text-2xl font-bold mt-4 mb-3'
        : lvl === 2
        ? 'text-xl font-semibold mt-4 mb-2'
        : lvl === 3
        ? 'text-lg font-semibold mt-3 mb-2'
        : 'text-base font-semibold mt-2 mb-1'
      out.push(`<h${lvl} class="${cls}">${inline(h[2])}</h${lvl}>`)
      i++
      continue
    }

    // Lista no ordenada
    const ul = /^\s*[-*]\s+(.*)$/.exec(line)
    if (ul) {
      if (!inList || listType !== 'ul') {
        closeList(); closeTable()
        out.push('<ul class="list-disc ms-6 my-2 space-y-1">')
        inList = true; listType = 'ul'
      }
      out.push(`<li>${inline(ul[1])}</li>`)
      i++
      continue
    }
    // Lista ordenada
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (ol) {
      if (!inList || listType !== 'ol') {
        closeList(); closeTable()
        out.push('<ol class="list-decimal ms-6 my-2 space-y-1">')
        inList = true; listType = 'ol'
      }
      out.push(`<li>${inline(ol[1])}</li>`)
      i++
      continue
    }

    if (stripped === '') {
      closeList(); closeTable()
      i++
      continue
    }

    // Párrafo
    closeList(); closeTable()
    out.push(`<p class="my-2 leading-relaxed">${inline(stripped)}</p>`)
    i++
  }

  closeList(); closeTable()
  if (inCode) out.push(`<pre class="rounded bg-muted p-3 my-3"><code>${codeBuf.join('\n')}</code></pre>`)
  return out.join('\n')
}
