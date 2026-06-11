import { createFileRoute } from '@tanstack/react-router'
import PdfTemplateEditor from '@/features/settings/pdf-templates/editor'

export const Route = createFileRoute('/_authenticated/settings/pdf-templates/$codigo')({
  component: _Page,
})

function _Page() {
  const { codigo } = Route.useParams()
  return <PdfTemplateEditor codigo={codigo} />
}
