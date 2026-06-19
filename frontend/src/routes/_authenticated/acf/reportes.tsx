import { createFileRoute } from '@tanstack/react-router'
import { AcfReportes } from '@/features/acf/acf-reportes'
export const Route = createFileRoute('/_authenticated/acf/reportes')({ component: AcfReportes })
