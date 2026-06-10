import { createFileRoute } from '@tanstack/react-router'
import { AccCierre } from '@/features/acc/acc-stub'
export const Route = createFileRoute('/_authenticated/acc/cierre')({ component: AccCierre })
