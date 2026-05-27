import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { toast } from 'sonner'

interface Props {
  noCia: string
  punto: string
}

interface CuentaRow {
  cuenta: string
  nombre: string
  tipo: string
  clase: string
  acepta_movi: string
  asignada: 'S' | 'N'
}

const CLASE_BADGE: Record<string, string> = {
  A: 'Activo',
  P: 'Pasivo',
  C: 'Capital',
  I: 'Ingreso',
  E: 'Egreso',
}

export function CatalogoSucursal({ noCia, punto }: Props) {
  const [rows, setRows] = useState<CuentaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterClase, setFilterClase] = useState<string>('all')

  const load = () => {
    if (!noCia || !punto) return
    setLoading(true)
    regalGeneralApi
      .cntCatalogoSucursal(noCia, punto)
      .then((data) => setRows(data as CuentaRow[]))
      .catch(() => toast.error('Error cargando cuentas'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [noCia, punto])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterClase !== 'all' && r.clase !== filterClase) return false
      if (search) {
        const q = search.toLowerCase()
        return r.cuenta.toLowerCase().includes(q) || r.nombre.toLowerCase().includes(q)
      }
      return true
    })
  }, [rows, search, filterClase])

  const assigned = rows.filter((r) => r.asignada === 'S').length

  const handleToggle = async (cuenta: string, currentAsignada: 'S' | 'N') => {
    setToggling(cuenta)
    const asignar = currentAsignada !== 'S'
    try {
      await regalGeneralApi.cntAsignarCuentaSucursal(noCia, punto, cuenta, asignar)
      setRows((prev) =>
        prev.map((r) => (r.cuenta === cuenta ? { ...r, asignada: asignar ? 'S' : 'N' } : r))
      )
    } catch (err: any) {
      toast.error(err?.message || 'Error al modificar asignación')
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className='space-y-4'>
      <div>
        <h2 className='text-lg font-semibold'>Asignar Cuentas a Sucursal</h2>
        <p className='text-sm text-muted-foreground'>
          FCNT106 — {noCia}/{punto} — {assigned} de {rows.length} cuentas asignadas
        </p>
      </div>

      <div className='flex gap-3 flex-wrap'>
        <div className='relative flex-1 min-w-48'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            className='pl-9'
            placeholder='Buscar cuenta o nombre...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className='flex gap-1'>
          {['all', 'A', 'P', 'C', 'I', 'E'].map((c) => (
            <Button
              key={c}
              size='sm'
              variant={filterClase === c ? 'default' : 'outline'}
              onClick={() => setFilterClase(c)}
            >
              {c === 'all' ? 'Todos' : CLASE_BADGE[c]}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className='py-10 text-center text-sm text-muted-foreground'>Cargando...</div>
      ) : (
        <div className='rounded-xl border overflow-hidden'>
          <div className='overflow-y-auto max-h-[600px]'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50 sticky top-0'>
                <tr>
                  <th className='px-4 py-2 text-center font-medium text-muted-foreground w-16'>Asig.</th>
                  <th className='px-4 py-2 text-left font-medium text-muted-foreground w-28'>Cuenta</th>
                  <th className='px-4 py-2 text-left font-medium text-muted-foreground'>Nombre</th>
                  <th className='px-4 py-2 text-center font-medium text-muted-foreground w-24'>Clase</th>
                  <th className='px-4 py-2 text-center font-medium text-muted-foreground w-24'>Movim.</th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                {filtered.map((r) => (
                  <tr
                    key={r.cuenta}
                    className={`hover:bg-muted/30 ${r.asignada === 'S' ? 'bg-green-50 dark:bg-green-950/20' : ''}`}
                  >
                    <td className='px-4 py-2 text-center'>
                      <Checkbox
                        checked={r.asignada === 'S'}
                        disabled={toggling === r.cuenta}
                        onCheckedChange={() => handleToggle(r.cuenta, r.asignada)}
                      />
                    </td>
                    <td className='px-4 py-2 font-mono'>{r.cuenta}</td>
                    <td className='px-4 py-2'>{r.nombre}</td>
                    <td className='px-4 py-2 text-center'>
                      <Badge variant='outline' className='text-xs'>
                        {CLASE_BADGE[r.clase] ?? r.clase}
                      </Badge>
                    </td>
                    <td className='px-4 py-2 text-center text-muted-foreground'>
                      {r.acepta_movi === 'S' ? 'Sí' : 'No'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className='px-4 py-8 text-center text-muted-foreground'>
                      No hay cuentas que coincidan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
