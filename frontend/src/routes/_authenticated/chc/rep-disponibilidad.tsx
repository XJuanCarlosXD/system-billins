import { createFileRoute } from '@tanstack/react-router'
import { ChcRepDisponibilidad } from '@/features/chc/chc-stubs'
export const Route = createFileRoute('/_authenticated/chc/rep-disponibilidad')({ component: ChcRepDisponibilidad })
