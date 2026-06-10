import { createFileRoute } from '@tanstack/react-router'
import { AccCias } from '@/features/acc/acc-cias'
export const Route = createFileRoute('/_authenticated/acc/cias')({ component: AccCias })
