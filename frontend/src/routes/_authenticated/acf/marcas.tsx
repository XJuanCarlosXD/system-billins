import { createFileRoute } from '@tanstack/react-router'
import { AcfMarcas } from '@/features/acf/acf-simple-tables'
export const Route = createFileRoute('/_authenticated/acf/marcas')({ component: AcfMarcas })
