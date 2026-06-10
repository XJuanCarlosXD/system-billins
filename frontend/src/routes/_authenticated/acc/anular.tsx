import { createFileRoute } from '@tanstack/react-router'
import { AccAnular } from '@/features/acc/acc-anular'
export const Route = createFileRoute('/_authenticated/acc/anular')({ component: AccAnular })
