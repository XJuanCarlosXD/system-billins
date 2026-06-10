import { createFileRoute } from '@tanstack/react-router'
import { AcfSubgrupos } from '@/features/acf/acf-simple-tables'
export const Route = createFileRoute('/_authenticated/acf/subgrupos')({ component: AcfSubgrupos })
