import { createFileRoute } from '@tanstack/react-router'
import { AccReposiciones } from '@/features/acc/acc-reposiciones'
export const Route = createFileRoute('/_authenticated/acc/reposiciones')({ component: AccReposiciones })
