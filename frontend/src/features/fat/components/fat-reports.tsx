import { useState } from 'react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft, Download } from 'lucide-react'
import { fatApi } from '@/services/fat-api'

interface FATReportsProps {
  onBack: () => void
}

export function FATReports({ onBack }: FATReportsProps) {
  const [loading, setLoading] = useState(false)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [reportData, setReportData] = useState<any>(null)

  const handleGenerarReporte = async () => {
    if (!desde || !hasta) {
      toast.error('Debe seleccionar rango de fechas')
      return
    }

    setLoading(true)
    try {
      const data = await fatApi.reporteVentas({
        desde,
        hasta,
      })
      setReportData(data)
      toast.success('Reporte generado correctamente')
    } catch (err: any) {
      toast.error(err.message || 'Error al generar reporte')
    } finally {
      setLoading(false)
    }
  }

  const handleExportarExcel = () => {
    if (!reportData) return

    const csv = [
      ['Reporte de Ventas', desde + ' a ' + hasta],
      [],
      ['Concepto', 'Valor'],
      ['Total Facturas', reportData.total_facturas],
      ['Total Neto', reportData.total_neto],
      ['Total Impuesto', reportData.total_impuesto],
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-ventas-${desde}-${hasta}.csv`
    a.click()
  }

  return (
    <>
      <Header>
        <Button variant='ghost' size='sm' onClick={onBack} className='me-2'>
          <ArrowLeft className='h-4 w-4' />
        </Button>
        <h2 className='text-lg font-semibold me-auto'>Reportes de Facturación</h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main fluid>
        <Card className='mb-6'>
          <CardHeader>
            <CardTitle>Reporte de Ventas</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <Label>Desde *</Label>
                <Input
                  type='date'
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </div>
              <div>
                <Label>Hasta *</Label>
                <Input
                  type='date'
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                />
              </div>
            </div>

            <div className='flex gap-2'>
              <Button onClick={handleGenerarReporte} disabled={loading}>
                {loading && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                Generar Reporte
              </Button>
            </div>
          </CardContent>
        </Card>

        {reportData && (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center justify-between'>
                <span>Resultados</span>
                <Button
                  size='sm'
                  onClick={handleExportarExcel}
                >
                  <Download className='h-4 w-4 mr-2' /> Descargar CSV
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4 max-w-md'>
                <div className='p-3 bg-muted rounded flex justify-between'>
                  <span>Período:</span>
                  <span className='font-semibold'>{desde} a {hasta}</span>
                </div>

                <div className='border-t pt-4 space-y-3'>
                  <div className='flex justify-between'>
                    <span>Total Facturas:</span>
                    <span className='font-mono font-semibold'>
                      {reportData.total_facturas}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Total Neto:</span>
                    <span className='font-mono font-semibold'>
                      {reportData.total_neto?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Total Impuesto:</span>
                    <span className='font-mono font-semibold'>
                      {reportData.total_impuesto?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </Main>
    </>
  )
}
