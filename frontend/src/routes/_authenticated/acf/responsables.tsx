import { createFileRoute } from '@tanstack/react-router'
import { AcfResponsables } from '@/features/acf/acf-simple-tables'
export const Route = createFileRoute('/_authenticated/acf/responsables')({ component: AcfResponsables })
