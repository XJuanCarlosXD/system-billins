import { createFileRoute } from '@tanstack/react-router'
import { ChcSolicitar } from '@/features/chc/chc-stubs'
export const Route = createFileRoute('/_authenticated/chc/solicitar')({ component: ChcSolicitar })
