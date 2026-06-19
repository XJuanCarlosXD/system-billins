import { useEffect, useState } from 'react'
import { ChevronsUpDown, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { regalGeneralApi, type Company } from '@/lib/regal-general-api'
import { useCompany } from '@/context/company-context'

function CompanyLogoBadge({
  no_cia,
  size = 'lg',
}: {
  no_cia: string
  size?: 'lg' | 'sm'
}) {
  const [hasLogo, setHasLogo] = useState(true)
  const dim = size === 'lg' ? 'size-8' : 'size-6'
  const text = size === 'lg' ? 'text-xs' : 'text-[10px]'
  const rounded = size === 'lg' ? 'rounded-lg' : 'rounded-sm'
  if (!no_cia) {
    return (
      <div
        className={`flex aspect-square ${dim} items-center justify-center ${rounded} bg-sidebar-primary font-bold ${text} text-sidebar-primary-foreground`}
      >
        —
      </div>
    )
  }
  if (hasLogo) {
    return (
      <img
        src={regalGeneralApi.cntCiaLogoUrl(no_cia)}
        alt={no_cia}
        className={`aspect-square ${dim} ${rounded} object-cover ring-1 ring-black/5 dark:ring-white/10`}
        onError={() => setHasLogo(false)}
      />
    )
  }
  return (
    <div
      className={`flex aspect-square ${dim} items-center justify-center ${rounded} bg-sidebar-primary font-bold ${text} text-sidebar-primary-foreground`}
    >
      {no_cia}
    </div>
  )
}

type TeamSwitcherProps = {
  teams?: {
    name: string
    logo: React.ElementType
    plan: string
  }[]
}

export function TeamSwitcher({ teams }: TeamSwitcherProps) {
  const { isMobile } = useSidebar()
  const { selectedCompany, setSelectedCompany, setSelectedPoint } = useCompany()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadCompanies() {
      setLoading(true)
      try {
        // 1) Cualquier usuario logueado puede llamar /api/me/.
        //    El backend ya filtra companies por las que tienen permiso
        //    (al menos un módulo activo). Admin recibe todas.
        const me = await regalGeneralApi.me()
        let cias = (me.companies || []).filter((c: Company) => c.activa)
        // 2) Si es admin y por alguna razón no recibió ninguna, complementa
        //    con la lista admin global (todas las activas).
        if (me.is_admin && cias.length === 0) {
          try {
            const res = await regalGeneralApi.adminListCompanies()
            cias = (res.companies || []).filter((c: Company) => c.activa)
          } catch { /* ignore */ }
        }
        if (!cancelled) setCompanies(cias)
      } catch (e) {
        console.error('Error loading companies', e)
        if (!cancelled) setCompanies([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadCompanies()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (companies.length === 0) return
    const hasSelected = companies.some((company) => company.no_cia === selectedCompany)
    if (!hasSelected) {
      setSelectedCompany(companies[0].no_cia)
      setSelectedPoint('01')
    }
  }, [companies, selectedCompany, setSelectedCompany, setSelectedPoint])

  const activeCompany = companies.find(c => c.no_cia === selectedCompany) || companies[0]
  const defaultTeam = teams?.[0] || { name: 'ZentoryERP', plan: 'ZentoryERP', logo: () => null }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <CompanyLogoBadge no_cia={activeCompany?.no_cia || ''} size='lg' />
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <span className='truncate font-semibold'>
                  {activeCompany?.descripcion || defaultTeam.name}
                </span>
                <span className='flex items-center gap-1.5 truncate text-xs text-muted-foreground'>
                  <img
                    src='/images/zentory-logo.png'
                    alt='ZentoryERP'
                    className='size-4 rounded-full ring-1 ring-black/5 dark:ring-white/10'
                  />
                  <span className='truncate'>{defaultTeam.plan}</span>
                </span>
              </div>
              <ChevronsUpDown className='ms-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-xs text-muted-foreground'>
              Empresas
            </DropdownMenuLabel>
            {loading ? (
              <div className='flex items-center justify-center py-4 text-muted-foreground'>
                <Loader2 className='h-4 w-4 animate-spin' />
              </div>
            ) : (
              <>
                {companies.map((company) => (
                  <DropdownMenuItem
                    key={company.no_cia}
                    onClick={() => {
                      setSelectedCompany(company.no_cia)
                      setSelectedPoint('01')
                    }}
                    className='gap-2 p-2'
                  >
                    <CompanyLogoBadge no_cia={company.no_cia} size='sm' />
                    <div className='flex-1'>
                      <div className='text-sm font-medium'>{company.no_cia}</div>
                      <div className='text-xs text-muted-foreground'>{company.descripcion.slice(0, 20)}</div>
                    </div>
                    {selectedCompany === company.no_cia && <span className='text-xs'>✓</span>}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            <DropdownMenuSeparator />
            <div className='px-2 py-2 text-xs text-muted-foreground'>
              Selecciona empresa activa
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
