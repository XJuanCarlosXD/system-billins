import { createFileRoute } from '@tanstack/react-router'
import { ManManualDocsPage } from '@/features/man/man-manuales'

export const Route = createFileRoute('/_authenticated/docs')({
  component: ManManualDocsPage,
})
