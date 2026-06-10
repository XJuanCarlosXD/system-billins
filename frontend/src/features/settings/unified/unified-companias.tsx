import { useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@/context/company-context'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Companias as FatCompanias } from '@/features/fat/companias'
import { Companias as CntCompanias } from '@/features/cnt/companias'
import { CxcCias } from '@/features/cxc/cxc-catalogos'
import { CxpCias } from '@/features/cxp/cxp-catalogos'
import { OdcCias } from '@/features/odc/odc-cias'
import { CompaniasInv } from '@/features/inv/companias'
import { ChcCias } from '@/features/chc/chc-cias'
import { AccCias } from '@/features/acc/acc-cias'
import { SdnCias } from '@/features/sdn/sdn-simple-tables'
import { AcfCias } from '@/features/acf/acf-simple-tables'

const COMPANIAS_QUERY_KEYS = [
  'fat-companias',
  'cxc-cias',
  'cxp-cias',
  'odc-cias',
  'inv-companias',
  'chc-cias',
  'acc-cias',
  'sdn-cias',
  'acf-cias',
  'cnt-companias',
]

export function UnifiedCompanias() {
  const { selectedCompany } = useCompany()
  const qc = useQueryClient()
  const noCia = selectedCompany ?? ''

  // Refresh all module queries when user switches tabs — keeps data coherent.
  const onValueChange = () => {
    for (const k of COMPANIAS_QUERY_KEYS) qc.invalidateQueries({ queryKey: [k] })
  }

  return (
    <Tabs defaultValue='fat' onValueChange={onValueChange} className='flex h-full flex-col'>
      <TabsList className='w-full justify-start overflow-x-auto'>
        <TabsTrigger value='fat'>Facturación</TabsTrigger>
        <TabsTrigger value='cxc'>Cuentas por Cobrar</TabsTrigger>
        <TabsTrigger value='cxp'>Cuentas por Pagar</TabsTrigger>
        <TabsTrigger value='odc'>Órdenes de Compra</TabsTrigger>
        <TabsTrigger value='inv'>Inventario</TabsTrigger>
        <TabsTrigger value='chc'>Bancos / Cheques</TabsTrigger>
        <TabsTrigger value='acc'>Caja Chica</TabsTrigger>
        <TabsTrigger value='sdn'>Nómina</TabsTrigger>
        <TabsTrigger value='acf'>Activos Fijos</TabsTrigger>
        <TabsTrigger value='cnt'>Contabilidad</TabsTrigger>
      </TabsList>
      <div className='mt-3 flex-1 overflow-auto'>
        <TabsContent value='fat'><FatCompanias noCia={noCia} /></TabsContent>
        <TabsContent value='cxc'><CxcCias noCia={noCia} /></TabsContent>
        <TabsContent value='cxp'><CxpCias noCia={noCia} /></TabsContent>
        <TabsContent value='odc'><OdcCias /></TabsContent>
        <TabsContent value='inv'><CompaniasInv /></TabsContent>
        <TabsContent value='chc'><ChcCias /></TabsContent>
        <TabsContent value='acc'><AccCias /></TabsContent>
        <TabsContent value='sdn'><SdnCias /></TabsContent>
        <TabsContent value='acf'><AcfCias /></TabsContent>
        <TabsContent value='cnt'><CntCompanias noCia={noCia} /></TabsContent>
      </div>
    </Tabs>
  )
}
