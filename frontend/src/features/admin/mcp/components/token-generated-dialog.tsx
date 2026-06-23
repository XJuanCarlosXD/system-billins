import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'

type Props = { open: boolean; onOpenChange: (v: boolean) => void; plaintext: string }

export function TokenGeneratedDialog({ open, onOpenChange, plaintext }: Props) {
  const snippet = JSON.stringify(
    {
      mcpServers: {
        zentoryerp: {
          type: 'http',
          url: 'https://grupo-abregonza.hopto.org:8443/mcp/',
          headers: { Authorization: `Bearer ${plaintext}` },
        },
      },
    },
    null,
    2,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Token generado</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-amber-600">Copia este token ahora. No se podra ver de nuevo.</p>
        <div className="flex items-center gap-2 rounded border bg-muted p-2 font-mono text-sm">
          <span className="flex-1 break-all">{plaintext}</span>
          <Button size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(plaintext)}>
            <Copy size={14} />
          </Button>
        </div>
        <p className="mt-3 text-sm">Configuracion para Claude Desktop / Code:</p>
        <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">{snippet}</pre>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
