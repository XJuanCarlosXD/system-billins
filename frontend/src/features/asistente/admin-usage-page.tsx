import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'
import { fetchAuditoria } from '@/lib/api-client-asistente'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'

export function AsistenteAdminUsagePage() {
  const [days, setDays] = useState(7)
  const [noCia, setNoCia] = useState('')

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['asistente', 'auditoria', days, noCia],
    queryFn: () => fetchAuditoria({ days, no_cia: noCia || undefined }),
  })

  return (
    <div className='flex flex-col gap-4 p-4'>
      <header className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-semibold'>Asistente — Auditoria de uso</h1>
          <p className='text-sm text-muted-foreground'>
            Tool calls registradas en TCHAT_TOOL_LOG. Solo DBA.
          </p>
        </div>
      </header>

      <div className='flex flex-wrap items-end gap-3 rounded-md border p-3'>
        <div className='flex flex-col gap-1'>
          <Label htmlFor='days'>Dias</Label>
          <Input
            id='days'
            type='number'
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
            className='w-24'
          />
        </div>
        <div className='flex flex-col gap-1'>
          <Label htmlFor='no_cia'>no_cia (opcional)</Label>
          <Input
            id='no_cia'
            value={noCia}
            onChange={(e) => setNoCia(e.target.value.trim())}
            placeholder='ej: 01'
            className='w-32'
          />
        </div>
        <Button
          variant='secondary'
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : null}
          Refrescar
        </Button>
      </div>

      {isLoading && (
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <Loader2 className='h-4 w-4 animate-spin' /> Cargando...
        </div>
      )}

      {error && (
        <div className='flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
          <AlertCircle className='h-4 w-4' />
          {(error as any)?.body?.detail || (error as Error).message}
        </div>
      )}

      {data && (
        <>
          <section className='grid grid-cols-2 gap-3 md:grid-cols-4'>
            <KpiCard label='Calls' value={data.totals.calls} />
            <KpiCard
              label='Errores'
              value={data.totals.errors}
              tone={data.totals.errors > 0 ? 'warn' : undefined}
            />
            <KpiCard label='Writes' value={data.totals.writes} />
            <KpiCard label='Avg ms' value={data.totals.avg_ms} />
          </section>

          <section className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
            <DataTable
              title={`Top users (${data.by_user.length})`}
              columns={['Usuario', 'Calls', 'Errores', 'Writes', 'Avg ms']}
              rows={data.by_user.slice(0, 30).map((r) => [
                r.usuario,
                r.calls,
                r.errors,
                r.writes,
                r.avg_ms,
              ])}
            />
            <DataTable
              title={`Top tools (${data.by_tool.length})`}
              columns={['Tool', 'Calls', 'Errores', 'Writes']}
              rows={data.by_tool.slice(0, 30).map((r) => [
                r.tool_name,
                r.calls,
                r.errors,
                r.writes,
              ])}
            />
          </section>

          <section>
            <DataTable
              title={`Por dia (${data.by_day.length})`}
              columns={['Dia', 'Calls', 'Errores']}
              rows={data.by_day.map((r) => [r.dia, r.calls, r.errors])}
            />
          </section>
        </>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'warn'
}) {
  return (
    <div
      className={
        'rounded-md border bg-card p-3 ' +
        (tone === 'warn' ? 'border-amber-500/60 bg-amber-50/40 dark:bg-amber-950/20' : '')
      }
    >
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='text-2xl font-semibold tabular-nums'>{value ?? 0}</div>
    </div>
  )
}

function DataTable({
  title,
  columns,
  rows,
}: {
  title: string
  columns: string[]
  rows: (string | number)[][]
}) {
  return (
    <div className='rounded-md border'>
      <header className='border-b bg-muted/40 px-3 py-2 text-sm font-medium'>
        {title}
      </header>
      <ScrollArea className='max-h-80'>
        <table className='w-full text-sm'>
          <thead className='sticky top-0 bg-card'>
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className='border-b px-3 py-2 text-start text-xs font-medium text-muted-foreground'
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className='px-3 py-4 text-center text-xs text-muted-foreground'
                >
                  Sin datos en el rango.
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={i} className='border-b last:border-b-0'>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={
                      'px-3 py-1.5 tabular-nums ' +
                      (j === 0 ? 'font-mono text-xs' : 'text-end')
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  )
}
