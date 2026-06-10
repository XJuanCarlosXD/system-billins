import { createFileRoute } from '@tanstack/react-router'
import { ChcEntregar } from '@/features/chc/chc-entregar'
export const Route = createFileRoute('/_authenticated/chc/entregar')({ component: ChcEntregar })
