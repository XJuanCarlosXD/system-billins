import { createFileRoute } from '@tanstack/react-router'
import { ChcRepBalance } from '@/features/chc/chc-rep-balance'
export const Route = createFileRoute('/_authenticated/chc/rep-balance')({ component: ChcRepBalance })
