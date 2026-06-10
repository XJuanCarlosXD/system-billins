import { createFileRoute } from '@tanstack/react-router'
import { AcfGrupos } from '@/features/acf/acf-simple-tables'
export const Route = createFileRoute('/_authenticated/acf/grupos')({ component: AcfGrupos })
