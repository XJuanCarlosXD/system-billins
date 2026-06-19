import { createFileRoute } from '@tanstack/react-router'
import { AcfDepreciacion } from '@/features/acf/acf-depreciacion'
export const Route = createFileRoute('/_authenticated/acf/depreciacion')({ component: AcfDepreciacion })
