import { createFileRoute } from '@tanstack/react-router'
import { AcfDepreciacion } from '@/features/acf/acf-stubs'
export const Route = createFileRoute('/_authenticated/acf/depreciacion')({ component: AcfDepreciacion })
