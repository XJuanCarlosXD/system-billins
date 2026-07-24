import { createFileRoute } from '@tanstack/react-router'
import { LicDocumentosEmpresa } from '@/features/lic/lic-documentos-empresa'

export const Route = createFileRoute('/_authenticated/lic/config/documentos')({
  component: LicDocumentosEmpresa,
})
