import { createFileRoute } from '@tanstack/react-router'
import PdfTemplatesIndex from '@/features/settings/pdf-templates'

export const Route = createFileRoute('/_authenticated/settings/pdf-templates/')({
  component: PdfTemplatesIndex,
})
