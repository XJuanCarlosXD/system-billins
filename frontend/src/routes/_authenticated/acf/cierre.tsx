import { createFileRoute } from '@tanstack/react-router'
import { AcfCierre } from '@/features/acf/acf-stubs'
export const Route = createFileRoute('/_authenticated/acf/cierre')({ component: AcfCierre })
