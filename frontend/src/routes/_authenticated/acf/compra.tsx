import { createFileRoute } from '@tanstack/react-router'
import { AcfCompra } from '@/features/acf/acf-stubs'
export const Route = createFileRoute('/_authenticated/acf/compra')({ component: AcfCompra })
