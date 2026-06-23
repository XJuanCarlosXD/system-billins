import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import type { McpToken } from '../types'

type Props = {
  items: McpToken[]
  onRevoke: (id: string) => void
  onShowUsage: (id: string) => void
}

export function TokenList({ items, onRevoke, onShowUsage }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Usuario</TableHead>
          <TableHead>Nombre</TableHead>
          <TableHead>Prefijo</TableHead>
          <TableHead>Empresa</TableHead>
          <TableHead>Punto</TableHead>
          <TableHead>Creado</TableHead>
          <TableHead>Ultimo uso</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((t) => (
          <TableRow key={t.token_id}>
            <TableCell className="font-medium">{t.usuario}</TableCell>
            <TableCell>{t.nombre}</TableCell>
            <TableCell className="font-mono text-xs">mcp_{t.prefijo}...</TableCell>
            <TableCell>
              {t.no_cia ?? '-'} {t.bloquear_cia === 'S' && <Badge variant="secondary">bloq</Badge>}
            </TableCell>
            <TableCell>
              {t.punto ?? '-'} {t.bloquear_punto === 'S' && <Badge variant="secondary">bloq</Badge>}
            </TableCell>
            <TableCell className="text-xs">{t.fecha_creacion}</TableCell>
            <TableCell className="text-xs">{t.fecha_ultimo_uso ?? 'nunca'}</TableCell>
            <TableCell>
              <Badge variant={t.st_activo === 'S' ? 'default' : 'destructive'}>
                {t.st_activo === 'S' ? 'activo' : 'revocado'}
              </Badge>
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Button size="sm" variant="outline" onClick={() => onShowUsage(t.token_id)}>
                Uso
              </Button>
              {t.st_activo === 'S' && (
                <Button size="sm" variant="destructive" onClick={() => onRevoke(t.token_id)}>
                  Revocar
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
