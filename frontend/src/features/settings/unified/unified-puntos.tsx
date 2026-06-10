import { useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@/context/company-context'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PuntosTrabajoFat } from '@/features/fat/puntos'
import { CxcPuntos } from '@/features/cxc/cxc-catalogos'
import { CxpPuntos } from '@/features/cxp/cxp-catalogos'
import { OdcPuntos } from '@/features/odc/odc-puntos'
import { PuntosTrabajoInv } from '@/features/inv/puntos-trabajo'
import { ChcPuntos } from '@/features/chc/chc-puntos'
import { AccPuntos } from '@/features/acc/acc-puntos'
import { AcfPuntos } from '@/features/acf/acf-simple-tables'

const PUNTOS_QUERY_KEYS = [
  'fat-puntos',
  'cxc-puntos',
  'cxp-puntos',
  'odc-puntos',
  'inv-puntos',
  'chc-puntos',
  'acc-puntos',
  'acf-puntos',
]

export function UnifiedPuntos() {
  const { selectedCompany } = useCompany()
  const qc = useQueryClient()
  const noCia = selectedCompany ?? ''

  const onValueChange = () => {
    for (const k of PUNTOS_QUERY_KEYS) qc.invalidateQueries({ queryKey: [k] })
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
        <TabsTrigger value='acf'>Activos Fijos</TabsTrigger>
      </TabsList>
      <div className='mt-3 flex-1 overflow-auto'>
        <TabsContent value='fat'><PuntosTrabajoFat noCia={noCia} /></TabsContent>
        <TabsContent value='cxc'><CxcPuntos noCia={noCia} /></TabsContent>
        <TabsContent value='cxp'><CxpPuntos noCia={noCia} /></TabsContent>
        <TabsContent value='odc'><OdcPuntos /></TabsContent>
        <TabsContent value='inv'><PuntosTrabajoInv noCia={noCia} /></TabsContent>
        <TabsContent value='chc'><ChcPuntos /></TabsContent>
        <TabsContent value='acc'><AccPuntos /></TabsContent>
        <TabsContent value='acf'><AcfPuntos /></TabsContent>
      </div>
    </Tabs>
  )
}
