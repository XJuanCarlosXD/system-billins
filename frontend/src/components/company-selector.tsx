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
 * - Lee las empresas vía `apiClient.me()` → solo las que el usuario tiene
 *   permiso para usar (no lista admin).
 * - Si el usuario es admin pero su perfil aún no tiene empresas asignadas,
 *   cae a `adminListCompanies()` como fallback para que pueda navegar.
 * - Si solo tiene 1 empresa, se muestra como info estática (no Select)
 *   y se setea automáticamente.
 * - Cualquier cambio del selector actualiza el contexto global y vuelve
 *   a ejecutar todas las queries que dependen de selectedCompany.
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
        let cias = me.companies.filter((c) => c.activa)
        // Admin sin asignaciones explícitas: ver TODAS las empresas activas.
        if (me.is_admin && cias.length === 0) {
          try {
            const res = await apiClient.adminListCompanies()
            cias = res.companies.filter((c) => c.activa)
          } catch { /* ignore */ }
        }
        if (cancelled) return
        setCompanies(cias)
        if (cias.length > 0) {
          // Si el seleccionado actual ya no está en la lista permitida,
          // forzar al primero.
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
        title='Tienes acceso a una sola empresa'
      >
        <Building2 className='h-4 w-4 text-muted-foreground' />
        <span className='font-mono text-xs'>{c.no_cia}</span>
        <span className='max-w-[160px] truncate'>{c.descripcion}</span>
      </div>
    )
  }

  return (
    <div className='flex items-center gap-2'>
      <Building2 className='h-4 w-4 text-muted-foreground' />
      <Select value={selectedCompany} onValueChange={setSelectedCompany}>
        <SelectTrigger className='h-9 w-[220px] text-sm'>
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
