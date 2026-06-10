import { createFileRoute } from '@tanstack/react-router'
import { ChcSolicitar } from '@/features/chc/chc-solicitar'
export const Route = createFileRoute('/_authenticated/chc/solicitar')({ component: ChcSolicitar })
