import { createFileRoute } from '@tanstack/react-router'
import { AcfCompra } from '@/features/acf/acf-compra'
export const Route = createFileRoute('/_authenticated/acf/compra')({ component: AcfCompra })
