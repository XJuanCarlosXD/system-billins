import { createFileRoute } from '@tanstack/react-router'
import { AcfRetiro } from '@/features/acf/acf-stubs'
export const Route = createFileRoute('/_authenticated/acf/retiro')({ component: AcfRetiro })
