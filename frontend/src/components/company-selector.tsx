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
 * - Solo administradores pueden CAMBIAR de empresa.
 * - Admin ve todas las empresas activas (vía adminListCompanies()).
 * - No-admin se queda fijo en su empresa asignada (la primera que tenga
 *   con módulo activo). Si tiene varias, igual queda fija — no hay Select.
 *   Para cambiarle de empresa hay que pedirlo al administrador.
 * - Si el usuario no tiene ninguna empresa asignada, muestra error en rojo.
 */
export function CompanySelector() {
  const { selectedCompany, setSelectedCompany } = useCompany()
  const [companies, setCompanies] = useState<Company[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const me = await apiClient.me()
        if (cancelled) return
        setIsAdmin(!!me.is_admin)

        let cias: Company[]
        if (me.is_admin) {
          // Admin: lista completa de empresas activas.
          try {
            const res = await apiClient.adminListCompanies()
            cias = res.companies.filter((c) => c.activa)
          } catch {
            cias = me.companies.filter((c) => c.activa)
          }
        } else {
          // No admin: solo las empresas con permiso.
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

  // No admin → info estática con la empresa activa (no puede cambiar).
  if (!isAdmin) {
    const c = companies.find((x) => x.no_cia === selectedCompany) ?? companies[0]
    return (
      <div
        className='flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm'
        title='Solo los administradores pueden cambiar de empresa'
      >
        <Building2 className='h-4 w-4 text-muted-foreground' />
        <span className='font-mono text-xs'>{c.no_cia}</span>
        <span className='max-w-[180px] truncate'>{c.descripcion}</span>
      </div>
    )
  }

  // Admin → Select.
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
