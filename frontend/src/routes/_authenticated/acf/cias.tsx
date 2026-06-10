import { createFileRoute } from '@tanstack/react-router'
import { AcfCias } from '@/features/acf/acf-simple-tables'
export const Route = createFileRoute('/_authenticated/acf/cias')({ component: AcfCias })
