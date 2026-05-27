import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Building2 } from 'lucide-react'
import { sigafApi, type Company, ApiError } from '@/lib/sigaf-api'
import { useCompany } from '@/context/company-context'

export function EmpresasPage() {
  const { selectedCompany } = useCompany()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCompanies() {
      setLoading(true)
      setError(null)
      try {
        const res = await sigafApi.adminListCompanies()
        setCompanies(res.companies)
      } catch (e) {
        const msg = e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    loadCompanies()
  }, [])

  return (
    <>
      <Header>
        <h2 className='text-lg font-semibold me-auto flex items-center gap-2'>
          <Building2 className='h-5 w-5' /> Empresas
        </h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        {error && (
          <div className='mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700'>
            {error}
          </div>
        )}

        {loading ? (
          <div className='flex justify-center py-12'>
            <Loader2 className='h-6 w-6 animate-spin' />
          </div>
        ) : (
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {companies.map((c) => {
              const isSelected = selectedCompany === c.no_cia
              return (
                <Card key={c.no_cia} className={`cursor-pointer transition hover:shadow-lg ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                  <CardHeader className='pb-3'>
                    <CardTitle className='flex items-start justify-between'>
                      <span>{c.no_cia}</span>
                      {isSelected && <Badge>Seleccionada</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-2'>
                    <div>
                      <p className='text-sm font-semibold'>{c.descripcion}</p>
                    </div>
                    <div className='grid grid-cols-2 gap-2 text-xs text-muted-foreground'>
                      <div>
                        <span className='block font-medium'>RNC</span>
                        <code className='text-[11px]'>{c.rnc || '—'}</code>
                      </div>
                      <div>
                        <span className='block font-medium'>Estado</span>
                        <Badge variant={c.activa ? 'default' : 'secondary'} className='text-[10px]'>
                          {c.activa ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </Main>
    </>
  )
}
