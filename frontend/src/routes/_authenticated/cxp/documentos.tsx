import { createFileRoute } from '@tanstack/react-router'
import { CxpDocumentos } from '@/features/cxp/documentos'

export const Route = createFileRoute('/_authenticated/cxp/documentos')({
  component: CxpDocumentos,
})
