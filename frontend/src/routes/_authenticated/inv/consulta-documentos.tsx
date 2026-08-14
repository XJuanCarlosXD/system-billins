import { createFileRoute } from '@tanstack/react-router'
import { ConsultaDocumentos } from '@/features/inv/consulta-documentos'

export const Route = createFileRoute('/_authenticated/inv/consulta-documentos')({
  validateSearch: (search: Record<string, unknown>) => ({
    tipo_docu: typeof search.tipo_docu === 'string' ? search.tipo_docu : undefined,
  }),
  component: ConsultaDocumentos,
})
