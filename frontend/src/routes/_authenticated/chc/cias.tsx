import { createFileRoute } from '@tanstack/react-router'
import { ChcCias } from '@/features/chc/chc-cias'
export const Route = createFileRoute('/_authenticated/chc/cias')({ component: ChcCias })
