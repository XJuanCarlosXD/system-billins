import { createFileRoute } from '@tanstack/react-router'
import { AccTiposBene } from '@/features/acc/acc-tipos-bene'
export const Route = createFileRoute('/_authenticated/acc/tipos-bene')({ component: AccTiposBene })
