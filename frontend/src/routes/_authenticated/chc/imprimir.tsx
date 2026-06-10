import { createFileRoute } from '@tanstack/react-router'
import { ChcImprimir } from '@/features/chc/chc-stubs'
export const Route = createFileRoute('/_authenticated/chc/imprimir')({ component: ChcImprimir })
