import { createFileRoute } from '@tanstack/react-router'
import { ChcPuntos } from '@/features/chc/chc-puntos'
export const Route = createFileRoute('/_authenticated/chc/puntos')({ component: ChcPuntos })
