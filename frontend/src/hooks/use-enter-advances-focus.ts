// Hook utilitario: en cualquier contenedor (form, card, sección), al presionar
// Enter dentro de un input avanza el foco al siguiente elemento enfocable, en
// lugar de submitir el formulario. Útil para captura rápida de datos.
//
// Uso:
//   const ref = useEnterAdvancesFocus<HTMLFormElement>()
//   return <form ref={ref}>...</form>
//
// Excepciones (no avanza, deja el comportamiento por defecto):
//   - Textareas (Enter inserta salto de línea).
//   - Botones (Enter activa el botón).
//   - Inputs con data-enter-submit="true" (ej. botón Guardar embebido).
//   - Modificadores Shift/Ctrl/Alt.

import { useCallback, useEffect, useRef } from 'react'

const FOCUSABLE = [
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
  '[contenteditable="true"]',
].join(',')

export function useEnterAdvancesFocus<T extends HTMLElement = HTMLFormElement>() {
  const ref = useRef<T | null>(null)

  const handler = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Enter') return
    if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return
    const t = e.target as HTMLElement | null
    if (!t) return
    const tag = (t.tagName || '').toUpperCase()
    if (tag === 'TEXTAREA') return
    if (tag === 'BUTTON') return
    if ((t as any).getAttribute?.('data-enter-submit') === 'true') return
    // Inputs tipo submit dejan que el browser submita
    if (tag === 'INPUT' && (t as HTMLInputElement).type === 'submit') return

    const root = ref.current
    if (!root || !root.contains(t)) return
    const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((el) =>
        !el.hasAttribute('disabled') &&
        el.offsetParent !== null && // visible
        el.getAttribute('aria-hidden') !== 'true',
      )
    const idx = focusables.indexOf(t)
    if (idx < 0) return
    e.preventDefault()
    const next = focusables[idx + 1]
    if (next) {
      next.focus()
      if (next instanceof HTMLInputElement && next.type !== 'checkbox' && next.type !== 'radio') {
        try { next.select() } catch { /* noop */ }
      }
    }
  }, [])

  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.addEventListener('keydown', handler as any)
    return () => node.removeEventListener('keydown', handler as any)
  }, [handler])

  return ref
}
