import { useQuery } from '@tanstack/react-query'
import { historialDocumento } from '@/lib/api-client-historial'
import { HistorialTimeline } from '@/features/historial/historial-timeline'

// Quién creó/editó/anuló este documento. No requiere ser admin: el backend
// (HistorialDocumentoView) usa el mismo permiso que ya protege ver el
// documento (tipo_docu asignado al usuario en el módulo/empresa/punto, o
// acceso al módulo cuando el módulo no maneja tipo_docu como ODC) -- a
// diferencia de /sistema/historial (auditoría completa, solo admin).
// Componente de solo lectura: no expone ninguna acción de editar/anular.
export function DocumentoHistorial({
  modulo, noCia, punto, tipoDocumento, noDocumento, usuarioDoc,
}: {
  modulo: string; noCia: string; punto: string
  tipoDocumento: string; noDocumento: string; usuarioDoc?: string | null
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['historial-documento', modulo, noCia, punto, tipoDocumento, noDocumento],
    queryFn: () =>
      historialDocumento({ no_cia: noCia, punto, modulo, tipo_documento: tipoDocumento, no_documento: noDocumento }),
  })
  if (isLoading) return <p className="py-4 text-center text-sm text-muted-foreground">Cargando historial…</p>
  const items = data?.items ?? []
  // Los documentos migrados o creados antes de que existiera la bitácora
  // de auditoría no tienen eventos -- pero el header del documento sí suele
  // guardar quién lo creó/tocó por último, y "sin actividad registrada" a
  // secas no responde la pregunta que la pantalla existe para resolver.
  if (items.length === 0) {
    return (
      <div className="rounded-lg border p-3 text-sm text-muted-foreground text-center">
        {usuarioDoc
          ? <>Creado por <span className="font-medium text-foreground">{usuarioDoc}</span> (sin bitácora detallada de ediciones posteriores).</>
          : 'Sin actividad registrada.'}
      </div>
    )
  }
  return (
    <div className="rounded-lg border p-3">
      <HistorialTimeline eventos={items} modo="completo" />
    </div>
  )
}
