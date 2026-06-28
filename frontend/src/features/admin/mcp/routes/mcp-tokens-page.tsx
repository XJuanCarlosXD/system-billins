import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMcpTokens, useRevokeMcpToken } from '../api'
import { TokenList } from '../components/token-list'
import { NewTokenDialog } from '../components/new-token-dialog'
import { TokenGeneratedDialog } from '../components/token-generated-dialog'
import { TokenUsageDrawer } from '../components/token-usage-drawer'

export function McpTokensPage() {
  const [q, setQ] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [generated, setGenerated] = useState<string | null>(null)
  const [usageId, setUsageId] = useState<string | null>(null)
  const { data = [], isLoading } = useMcpTokens({ q })
  const revoke = useRevokeMcpToken()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">MCP Tokens</h1>
        <Button onClick={() => setShowNew(true)}>+ Nuevo token</Button>
      </div>
      <div className="mb-3">
        <Input
          placeholder="Buscar por nombre o prefijo"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
      </div>
      {isLoading ? (
        <p>Cargando...</p>
      ) : (
        <TokenList items={data} onRevoke={(id) => revoke.mutate(id)} onShowUsage={setUsageId} />
      )}
      <NewTokenDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={(p) => setGenerated(p.plaintext)}
      />
      <TokenGeneratedDialog
        open={!!generated}
        onOpenChange={(v) => !v && setGenerated(null)}
        plaintext={generated ?? ''}
      />
      <TokenUsageDrawer tokenId={usageId} onClose={() => setUsageId(null)} />
    </div>
  )
}
