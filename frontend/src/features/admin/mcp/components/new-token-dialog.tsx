import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useCreateMcpToken } from '../api'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (p: { token_id: string; plaintext: string }) => void
}

export function NewTokenDialog({ open, onOpenChange, onCreated }: Props) {
  const [usuario, setUsuario] = useState('')
  const [nombre, setNombre] = useState('')
  const [noCia, setNoCia] = useState('')
  const [bloqCia, setBloqCia] = useState(false)
  const [punto, setPunto] = useState('')
  const [bloqPunto, setBloqPunto] = useState(false)
  const [expiraDias, setExpiraDias] = useState<number | ''>(90)
  const [noExpira, setNoExpira] = useState(false)
  const create = useCreateMcpToken()

  async function submit() {
    const out = await create.mutateAsync({
      usuario,
      nombre,
      no_cia: noCia || undefined,
      bloquear_cia: bloqCia,
      punto: punto || undefined,
      bloquear_punto: bloqPunto,
      no_expira: noExpira,
      expira_dias: noExpira ? null : typeof expiraDias === 'number' ? expiraDias : null,
    })
    onCreated(out)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo token MCP</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Usuario</Label>
            <Input value={usuario} onChange={(e) => setUsuario(e.target.value.toUpperCase())} placeholder="JCABREU" />
          </div>
          <div>
            <Label>Nombre del token</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Claude Desktop laptop" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Empresa default</Label>
              <Input value={noCia} onChange={(e) => setNoCia(e.target.value)} placeholder="01" />
            </div>
            <div className="flex items-end gap-2">
              <Checkbox checked={bloqCia} onCheckedChange={(v) => setBloqCia(!!v)} />
              <span>Bloquear empresa</span>
            </div>
            <div>
              <Label>Punto default</Label>
              <Input value={punto} onChange={(e) => setPunto(e.target.value)} placeholder="01" />
            </div>
            <div className="flex items-end gap-2">
              <Checkbox checked={bloqPunto} onCheckedChange={(v) => setBloqPunto(!!v)} />
              <span>Bloquear punto</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox checked={noExpira} onCheckedChange={(v) => setNoExpira(!!v)} />
            <span>No expira</span>
            <Input
              className="w-24"
              type="number"
              disabled={noExpira}
              value={expiraDias}
              onChange={(e) => setExpiraDias(Number(e.target.value))}
            />
            <span>dias</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!usuario || !nombre || create.isPending}>
            Generar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
