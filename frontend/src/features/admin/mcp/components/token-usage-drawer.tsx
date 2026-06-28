import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { useMcpTokenUsage } from '../api'

type Props = { tokenId: string | null; onClose: () => void }

export function TokenUsageDrawer({ tokenId, onClose }: Props) {
  const { data, isLoading } = useMcpTokenUsage(tokenId)
  return (
    <Sheet open={!!tokenId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[700px] sm:max-w-[700px]">
        <SheetHeader>
          <SheetTitle>Ultimas 100 llamadas</SheetTitle>
        </SheetHeader>
        {isLoading ? (
          <p>Cargando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>ms</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{r.fecha}</TableCell>
                  <TableCell className="font-mono text-xs">{r.tool}</TableCell>
                  <TableCell>{r.ok === 'S' ? 'OK' : 'ERR'}</TableCell>
                  <TableCell className="text-xs">{r.error_code ?? '-'}</TableCell>
                  <TableCell>{r.duration_ms}</TableCell>
                  <TableCell className="text-xs">{r.ip ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SheetContent>
    </Sheet>
  )
}
