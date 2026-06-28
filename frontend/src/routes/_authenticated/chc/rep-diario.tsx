import { createFileRoute } from '@tanstack/react-router'
import { ChcRepDiario } from '@/features/chc/chc-rep-diario'
export const Route = createFileRoute('/_authenticated/chc/rep-diario')({ component: ChcRepDiario })
