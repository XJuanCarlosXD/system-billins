import { useEffect, useState } from 'react'
import { Building2, Loader2 } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { sigafApi, type Company } from '@/lib/sigaf-api'
import { useCompany } from '@/context/company-context'

export function CompanySelector() {
  const { selectedCompany, setSelectedCompany } = useCompany()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadCompanies() {
      setLoading(true)
      try {
        const res = await sigafApi.adminListCompanies()
        setCompanies(res.companies)
      } catch (e) {
        console.error('Error loading companies', e)
      } finally {
        setLoading(false)
      }
    }
    loadCompanies()
  }, [])

  return (
    <div className='flex items-center gap-2'>
      <Building2 className='h-4 w-4 text-muted-foreground' />
      <Select value={selectedCompany} onValueChange={setSelectedCompany} disabled={loading}>
        <SelectTrigger className='h-9 w-[160px] text-sm'>
          {loading ? (
            <>
              <Loader2 className='h-3.5 w-3.5 animate-spin' />
              Cargando...
            </>
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent align='start'>
          {companies.map((c) => (
            <SelectItem key={c.no_cia} value={c.no_cia}>
              {c.no_cia} · {c.descripcion.slice(0, 20)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
