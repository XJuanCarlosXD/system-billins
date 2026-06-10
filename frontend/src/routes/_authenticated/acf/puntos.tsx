import { createFileRoute } from '@tanstack/react-router'
import { AcfPuntos } from '@/features/acf/acf-simple-tables'
export const Route = createFileRoute('/_authenticated/acf/puntos')({ component: AcfPuntos })
