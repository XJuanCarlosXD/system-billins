import { useEffect } from 'react'
import { usePrintDoc } from './use-print-doc'
import { PuckRender } from './PuckRender'
import './print.css'

type Props = {
  codigo: string
  id: string
  no_cia: string
  punto: string
  /** Si true, no dispara window.print() automáticamente (modo preview/draft del editor). */
  noAutoPrint?: boolean
}

export function PrintPage({ codigo, id, no_cia, punto, noAutoPrint }: Props) {
  const { loading, error, data, template, plantilla } = usePrintDoc(codigo, id, no_cia, punto)

  useEffect(() => {
    document.body.classList.add('pdf-screen')
    return () => { document.body.classList.remove('pdf-screen') }
  }, [])

  useEffect(() => {
    if (!loading && !error && data && template && !noAutoPrint) {
      // Pequeño delay para que el navegador termine de pintar imágenes (logo, QR).
      const t = setTimeout(() => {
        try { window.print() } catch { /* noop */ }
      }, 600)
      return () => clearTimeout(t)
    }
  }, [loading, error, data, template, noAutoPrint])

  if (loading) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Cargando documento…</div>
  }
  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#b91c1c' }}>
        <h2>Error al cargar el documento</h2>
        <pre>{error}</pre>
      </div>
    )
  }
  if (!data || !template) return null

  return (
    <PuckRender
      template={template}
      data={data}
      pageSize={plantilla?.page_size as any || 'A4'}
      pageOrientation={plantilla?.page_orientation as any || 'P'}
    />
  )
}
