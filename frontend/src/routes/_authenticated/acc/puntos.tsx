import { createFileRoute } from '@tanstack/react-router'
import { AccPuntos } from '@/features/acc/acc-puntos'
export const Route = createFileRoute('/_authenticated/acc/puntos')({ component: AccPuntos })
