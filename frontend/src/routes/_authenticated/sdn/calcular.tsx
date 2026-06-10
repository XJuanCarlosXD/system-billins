import { createFileRoute } from '@tanstack/react-router'
import { SdnCalcular } from '@/features/sdn/sdn-stubs'
export const Route = createFileRoute('/_authenticated/sdn/calcular')({ component: SdnCalcular })
