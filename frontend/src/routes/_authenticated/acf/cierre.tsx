import { createFileRoute } from '@tanstack/react-router'
import { AcfCierre } from '@/features/acf/acf-cierre'
export const Route = createFileRoute('/_authenticated/acf/cierre')({ component: AcfCierre })
