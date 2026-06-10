import { createFileRoute } from '@tanstack/react-router'
import { AccAsiento } from '@/features/acc/acc-stub'
export const Route = createFileRoute('/_authenticated/acc/asiento')({ component: AccAsiento })
