import { createFileRoute } from '@tanstack/react-router'
import { EmpresasPage } from '@/features/empresas'

export const Route = createFileRoute('/_authenticated/empresas')({
  component: EmpresasPage,
})
