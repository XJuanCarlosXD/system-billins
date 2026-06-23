import { createFileRoute } from '@tanstack/react-router'
import { McpTokensPage } from '@/features/admin/mcp/routes/mcp-tokens-page'

export const Route = createFileRoute('/_authenticated/admin/mcp/tokens')({
  component: McpTokensPage,
})
