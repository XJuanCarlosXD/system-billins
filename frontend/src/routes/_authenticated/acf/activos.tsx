import { createFileRoute } from '@tanstack/react-router'
import { AcfActivos } from '@/features/acf/acf-activos'
export const Route = createFileRoute('/_authenticated/acf/activos')({ component: AcfActivos })
