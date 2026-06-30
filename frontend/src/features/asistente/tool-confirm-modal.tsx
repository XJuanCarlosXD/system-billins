import { useMutation } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { confirmTool } from '@/lib/api-client-asistente'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type ToolEntry } from './use-chat-stream'

type Props = {
  tool: ToolEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ToolConfirmModal({ tool, open, onOpenChange }: Props) {
  const confirmMut = useMutation({
    mutationFn: (approved: boolean) =>
      confirmTool(tool!.sig!, approved),
    onSuccess: () => onOpenChange(false),
  })

  if (!tool) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <AlertTriangle className='h-5 w-5 text-amber-500' />
            Confirmar operacion
          </DialogTitle>
          <DialogDescription>
            El asistente quiere ejecutar la herramienta{' '}
            <code className='rounded bg-muted px-1 py-0.5 font-mono text-xs'>
              {tool.tool_name}
            </code>
            . Revisa los argumentos antes de aprobar.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          {tool.preview && (
            <div className='rounded-md border border-amber-500/40 bg-amber-50/40 p-3 text-sm dark:bg-amber-950/20'>
              {tool.preview}
            </div>
          )}

          <div>
            <p className='mb-1 text-xs font-medium text-muted-foreground'>
              Argumentos
            </p>
            <pre className='max-h-64 overflow-auto rounded bg-muted/50 p-2 text-xs'>
              {JSON.stringify(tool.args, null, 2)}
            </pre>
          </div>

          <p className='text-xs text-muted-foreground'>
            Esta accion modifica datos en el sistema y no se puede revertir
            automaticamente.
          </p>
        </div>

        <DialogFooter className='gap-2'>
          <Button
            variant='outline'
            disabled={confirmMut.isPending}
            onClick={() => confirmMut.mutate(false)}
          >
            Cancelar
          </Button>
          <Button
            disabled={confirmMut.isPending}
            onClick={() => confirmMut.mutate(true)}
          >
            {confirmMut.isPending ? 'Ejecutando...' : 'Confirmar y ejecutar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
