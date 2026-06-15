import { useEffect, useState } from 'react'
import { Building2, Loader2 } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { apiClient, type Company } from '@/lib/api-client'
import { useCompany } from '@/context/company-context'

/**
 * Selector global de empresa.
 *
 * Reglas:
 * - Admin: ve TODAS las empresas activas (lista completa, vía
 *   adminListCompanies) y puede cambiar entre ellas.
 * - No admin: ve solo las empresas a las que tiene permiso (al menos
 *   un módulo activo). Si tiene 2+, puede cambiar entre ellas con el
 *   Select; si tiene 1, se muestra como chip estático.
 * - Sin empresas asignadas: chip rojo "Sin empresas asignadas".
 *
 * Para dar/quitar empresas a un usuario se usa la pantalla de Permisos
 * (asignar al menos un módulo en la empresa → aparece en su selector).
 */
export function CompanySelector() {
  const { selectedCompany, setSelectedCompany } = useCompany()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const me = await apiClient.me()
        if (cancelled) return

        let cias: Company[]
        if (me.is_admin) {
          // Admin: lista completa.
          try {
            const res = await apiClient.adminListCompanies()
            cias = res.companies.filter((c) => c.activa)
          } catch {
            cias = me.companies.filter((c) => c.activa)
          }
        } else {
          // No admin: solo las empresas con al menos un módulo activo.
          cias = me.companies.filter((c) => c.activa)
        }
        if (cancelled) return

        setCompanies(cias)
        if (cias.length > 0) {
          const stillAllowed = cias.find((c) => c.no_cia === selectedCompany)
          if (!stillAllowed) setSelectedCompany(cias[0].no_cia)
        }
      } catch (e) {
        console.error('Error loading companies', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <Building2 className='h-4 w-4' />
        <Loader2 className='h-3.5 w-3.5 animate-spin' />
        Cargando empresas…
      </div>
    )
  }

  if (companies.length === 0) {
    return (
      <div className='flex items-center gap-2 text-xs text-destructive'>
        <Building2 className='h-4 w-4' />
        Sin empresas asignadas
      </div>
    )
  }

  if (companies.length === 1) {
    const c = companies[0]
    return (
      <div
        className='flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm'
        title='Solo una empresa asignada'
      >
        <Building2 className='h-4 w-4 text-muted-foreground' />
        <span className='font-mono text-xs'>{c.no_cia}</span>
        <span className='max-w-[180px] truncate'>{c.descripcion}</span>
      </div>
    )
  }

  return (
    <div className='flex items-center gap-2'>
      <Building2 className='h-4 w-4 text-muted-foreground' />
      <Select value={selectedCompany} onValueChange={setSelectedCompany}>
        <SelectTrigger className='h-9 w-[260px] text-sm'>
          <SelectValue placeholder='Seleccione empresa' />
        </SelectTrigger>
        <SelectContent align='start'>
          {companies.map((c) => (
            <SelectItem key={c.no_cia} value={c.no_cia}>
              <span className='font-mono text-xs mr-2'>{c.no_cia}</span>
              {c.descripcion}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
