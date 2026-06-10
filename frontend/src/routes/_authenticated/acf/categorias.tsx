import { createFileRoute } from '@tanstack/react-router'
import { AcfCategorias } from '@/features/acf/acf-simple-tables'
export const Route = createFileRoute('/_authenticated/acf/categorias')({ component: AcfCategorias })
