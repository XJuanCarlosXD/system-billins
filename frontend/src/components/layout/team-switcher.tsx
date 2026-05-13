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
    async function loadCompanies() {
      setLoading(true)
      try {
        const res = await regalGeneralApi.adminListCompanies()
        setCompanies(res.companies)
      } catch (e) {
        console.error('Error loading companies', e)
      } finally {
        setLoading(false)
      }
    }
    loadCompanies()
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
  const defaultTeam = teams?.[0] || { name: 'Regal General Clon', plan: 'Multi-empresa', logo: () => null }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-xs'>
                {activeCompany?.no_cia || '—'}
              </div>
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <span className='truncate font-semibold'>
                  {activeCompany?.descripcion || defaultTeam.name}
                </span>
                <span className='truncate text-xs'>{defaultTeam.plan}</span>
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
                    <div className='flex size-6 items-center justify-center rounded-sm border bg-sidebar-primary text-sidebar-primary-foreground font-bold text-xs'>
                      {company.no_cia}
                    </div>
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
