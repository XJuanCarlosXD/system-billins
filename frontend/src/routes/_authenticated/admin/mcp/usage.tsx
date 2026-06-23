import { createFileRoute } from '@tanstack/react-router'
import { McpUsagePage } from '@/features/admin/mcp/routes/mcp-usage-page'

export const Route = createFileRoute('/_authenticated/admin/mcp/usage')({
  component: McpUsagePage,
})
