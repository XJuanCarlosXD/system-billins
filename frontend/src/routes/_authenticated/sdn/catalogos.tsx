import { createFileRoute } from '@tanstack/react-router'
import { SdnCatalogos } from '@/features/sdn/sdn-catalogos'

export const Route = createFileRoute('/_authenticated/sdn/catalogos')({
  component: SdnCatalogos,
})
