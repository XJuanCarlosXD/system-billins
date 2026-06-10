import { createFileRoute } from '@tanstack/react-router'
import { ChcEntregar } from '@/features/chc/chc-stubs'
export const Route = createFileRoute('/_authenticated/chc/entregar')({ component: ChcEntregar })
