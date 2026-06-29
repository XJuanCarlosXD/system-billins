import { useEffect, useRef } from 'react'

export type ShortcutHandlers = {
  onNewConv?: () => void
  onCancelStream?: () => void
  onFocusSearch?: () => void
  onToggleAsistente?: () => void
}

// Hook de atajos globales para la pagina /asistente.
// Ignora cuando el target es un input/textarea (excepto Esc y atajos con Ctrl/Meta).
export function useAsistenteShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const h = ref.current
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
      const isEditable =
        tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable

      if (e.key === 'Escape') {
        h.onCancelStream?.()
        return
      }

      if (!(e.ctrlKey || e.metaKey)) {
        if (isEditable) return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        h.onNewConv?.()
      } else if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        h.onFocusSearch?.()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (h.onToggleAsistente) {
          e.preventDefault()
          h.onToggleAsistente()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
