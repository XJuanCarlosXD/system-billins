// Renderer de Markdown ligero para las respuestas del asistente.
// Sin dependencias externas: cubre tablas GFM (estilizadas), listas,
// encabezados, bloques de código, negrita/cursiva/código inline y links.
// Tolerante al streaming: contenido parcial degrada a párrafos.

import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const INLINE_RE =
  /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\))|(\*([^*\s][^*]*)\*)/g

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0
    if (idx > last) out.push(text.slice(last, idx))
    const key = `${keyBase}-${i++}`
    if (m[2] !== undefined) {
      out.push(<strong key={key}>{m[2]}</strong>)
    } else if (m[4] !== undefined) {
      out.push(
        <code
          key={key}
          className='rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]'
        >
          {m[4]}
        </code>
      )
    } else if (m[6] !== undefined) {
      out.push(
        <a
          key={key}
          href={m[7]}
          target={m[7].startsWith('/') ? undefined : '_blank'}
          rel='noreferrer'
          className='text-primary underline underline-offset-2'
        >
          {m[6]}
        </a>
      )
    } else if (m[9] !== undefined) {
      out.push(<em key={key}>{m[9]}</em>)
    }
    last = idx + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const NUMERIC_RE = /^-?\$?(RD\$)?\s?[\d.,]+\s?%?$/

function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

function isSeparatorRow(line: string): boolean {
  const s = line.trim()
  if (!s.includes('-') || !s.includes('|')) return false
  return /^\|?[\s:|-]+\|?$/.test(s)
}

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'h'; level: number; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'table'; header: string[]; rows: string[][] }
  | { kind: 'hr' }

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    // Bloque de código cercado
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim()
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++ // cierra ```
      blocks.push({ kind: 'code', lang, text: buf.join('\n') })
      continue
    }

    // Tabla GFM: fila con pipes + separador en la línea siguiente
    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      isSeparatorRow(lines[i + 1])
    ) {
      const header = splitRow(trimmed)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]))
        i++
      }
      blocks.push({ kind: 'table', header, rows })
      continue
    }

    // Encabezados
    const h = /^(#{1,4})\s+(.*)$/.exec(trimmed)
    if (h) {
      blocks.push({ kind: 'h', level: h[1].length, text: h[2] })
      i++
      continue
    }

    // Línea horizontal
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push({ kind: 'hr' })
      i++
      continue
    }

    // Listas
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push({ kind: 'ul', items })
      continue
    }
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''))
        i++
      }
      blocks.push({ kind: 'ol', items })
      continue
    }

    // Párrafo: agrupa líneas consecutivas "normales"
    const buf: string[] = [line]
    i++
    while (i < lines.length) {
      const t = lines[i].trim()
      if (
        !t ||
        t.startsWith('```') ||
        t.startsWith('|') ||
        /^(#{1,4})\s+/.test(t) ||
        /^[-*]\s+/.test(t) ||
        /^\d+[.)]\s+/.test(t)
      ) {
        break
      }
      buf.push(lines[i])
      i++
    }
    blocks.push({ kind: 'p', lines: buf })
  }
  return blocks
}

export function MarkdownContent({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const blocks = parseBlocks(text)
  return (
    <div className={cn('space-y-2 text-sm leading-relaxed break-words', className)}>
      {blocks.map((b, bi) => {
        const key = `b${bi}`
        switch (b.kind) {
          case 'h': {
            const cls =
              b.level <= 2
                ? 'mt-3 text-base font-semibold'
                : 'mt-2 text-sm font-semibold'
            return (
              <div key={key} className={cls}>
                {renderInline(b.text, key)}
              </div>
            )
          }
          case 'hr':
            return <hr key={key} className='my-3 border-t' />
          case 'code':
            return (
              <pre
                key={key}
                className='overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre'
              >
                <code>{b.text}</code>
              </pre>
            )
          case 'ul':
            return (
              <ul key={key} className='list-disc space-y-0.5 ps-5'>
                {b.items.map((it, ii) => (
                  <li key={`${key}-${ii}`}>{renderInline(it, `${key}-${ii}`)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={key} className='list-decimal space-y-0.5 ps-5'>
                {b.items.map((it, ii) => (
                  <li key={`${key}-${ii}`}>{renderInline(it, `${key}-${ii}`)}</li>
                ))}
              </ol>
            )
          case 'table':
            return (
              <div key={key} className='overflow-x-auto rounded-lg border'>
                <table className='w-full border-collapse text-sm'>
                  <thead>
                    <tr className='border-b bg-muted/60'>
                      {b.header.map((c, ci) => (
                        <th
                          key={`${key}-h${ci}`}
                          className='px-3 py-2 text-start font-semibold whitespace-nowrap'
                        >
                          {renderInline(c, `${key}-h${ci}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, ri) => (
                      <tr
                        key={`${key}-r${ri}`}
                        className='border-b last:border-b-0 even:bg-muted/20 hover:bg-muted/40'
                      >
                        {row.map((c, ci) => (
                          <td
                            key={`${key}-r${ri}c${ci}`}
                            className={cn(
                              'px-3 py-1.5 align-top',
                              NUMERIC_RE.test(c.replace(/\*\*/g, '')) &&
                                'text-end tabular-nums whitespace-nowrap'
                            )}
                          >
                            {renderInline(c, `${key}-r${ri}c${ci}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'p':
          default:
            return (
              <p key={key} className='whitespace-pre-wrap'>
                {b.lines.map((ln, li) => (
                  <Fragment key={`${key}-l${li}`}>
                    {li > 0 && '\n'}
                    {renderInline(ln, `${key}-l${li}`)}
                  </Fragment>
                ))}
              </p>
            )
        }
      })}
    </div>
  )
}
