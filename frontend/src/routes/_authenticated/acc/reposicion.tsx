import { createFileRoute } from '@tanstack/react-router'
import { AccReposicion } from '@/features/acc/acc-reposicion'
export const Route = createFileRoute('/_authenticated/acc/reposicion')({ component: AccReposicion })
