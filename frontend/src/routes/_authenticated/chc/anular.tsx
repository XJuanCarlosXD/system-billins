import { createFileRoute } from '@tanstack/react-router'
import { ChcAnular } from '@/features/chc/chc-stubs'
export const Route = createFileRoute('/_authenticated/chc/anular')({ component: ChcAnular })
