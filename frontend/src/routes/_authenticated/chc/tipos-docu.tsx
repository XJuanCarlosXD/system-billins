import { createFileRoute } from '@tanstack/react-router'
import { ChcTiposDocu } from '@/features/chc/chc-tipos-docu'
export const Route = createFileRoute('/_authenticated/chc/tipos-docu')({ component: ChcTiposDocu })
