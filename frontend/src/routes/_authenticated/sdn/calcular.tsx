import { createFileRoute } from '@tanstack/react-router'
import { SdnCalcular } from '@/features/sdn/sdn-calcular'
export const Route = createFileRoute('/_authenticated/sdn/calcular')({ component: SdnCalcular })
