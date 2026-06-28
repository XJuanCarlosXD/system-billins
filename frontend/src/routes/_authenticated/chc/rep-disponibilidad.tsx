import { createFileRoute } from '@tanstack/react-router'
import { ChcRepDisponibilidad } from '@/features/chc/chc-rep-disponibilidad'
export const Route = createFileRoute('/_authenticated/chc/rep-disponibilidad')({ component: ChcRepDisponibilidad })
