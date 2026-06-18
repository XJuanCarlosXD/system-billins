import { createFileRoute } from '@tanstack/react-router'
import { AccCierre } from '@/features/acc/acc-cierre'
export const Route = createFileRoute('/_authenticated/acc/cierre')({ component: AccCierre })
