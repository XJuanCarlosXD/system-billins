import { createFileRoute } from '@tanstack/react-router'
import { AccDocumentos } from '@/features/acc/acc-documentos'

export const Route = createFileRoute('/_authenticated/acc/documentos')({
  component: AccDocumentos,
})
