import { createFileRoute } from '@tanstack/react-router'
import { SdnDeducciones } from '@/features/sdn/sdn-simple-tables'
export const Route = createFileRoute('/_authenticated/sdn/deducciones')({ component: SdnDeducciones })
