import { createFileRoute } from '@tanstack/react-router'
import { AcfDepartamentos } from '@/features/acf/acf-simple-tables'
export const Route = createFileRoute('/_authenticated/acf/departamentos')({ component: AcfDepartamentos })
