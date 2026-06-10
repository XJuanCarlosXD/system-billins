import { useState } from 'react'
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

const TAB_TO_QUERY_KEY: Record<string, string> = {
  fat: 'fat-puntos',
  cxc: 'cxc-puntos',
  cxp: 'cxp-puntos',
  odc: 'odc-puntos',
  inv: 'inv-puntos',
  chc: 'chc-puntos',
  acc: 'acc-puntos',
  acf: 'acf-puntos',
}

export function UnifiedPuntos() {
  const { selectedCompany } = useCompany()
  const qc = useQueryClient()
  const [active, setActive] = useState('fat')
  const noCia = selectedCompany ?? ''

  const onValueChange = (next: string) => {
    setActive(next)
    const k = TAB_TO_QUERY_KEY[next]
    if (k) qc.invalidateQueries({ queryKey: [k] })
  }

  return (
    <Tabs value={active} onValueChange={onValueChange} className='flex h-full flex-col'>
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
        {active === 'fat' && <TabsContent value='fat'><PuntosTrabajoFat noCia={noCia} /></TabsContent>}
        {active === 'cxc' && <TabsContent value='cxc'><CxcPuntos noCia={noCia} /></TabsContent>}
        {active === 'cxp' && <TabsContent value='cxp'><CxpPuntos noCia={noCia} /></TabsContent>}
        {active === 'odc' && <TabsContent value='odc'><OdcPuntos /></TabsContent>}
        {active === 'inv' && <TabsContent value='inv'><PuntosTrabajoInv noCia={noCia} /></TabsContent>}
        {active === 'chc' && <TabsContent value='chc'><ChcPuntos /></TabsContent>}
        {active === 'acc' && <TabsContent value='acc'><AccPuntos /></TabsContent>}
        {active === 'acf' && <TabsContent value='acf'><AcfPuntos /></TabsContent>}
      </div>
    </Tabs>
  )
}
