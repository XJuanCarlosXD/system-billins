import { useEffect, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CxpProveedores } from './proveedores'
import { CxpDocumentos } from './documentos'
import { CxpCuentas } from './cuentas'
import { CxpMovimientos } from './movimientos'
import { CxpAging } from './aging'

const route = getRouteApi('/_authenticated/cxp/')

const TABS = ['proveedores', 'documentos', 'cuentas', 'movimientos', 'aging'] as const
type TabKey = (typeof TABS)[number]

export function CxpModule() {
  const search = route.useSearch() as { view?: string }
  const navigate = route.useNavigate()

  const initial: TabKey =
    search.view && (TABS as readonly string[]).includes(search.view)
      ? (search.view as TabKey)
      : 'proveedores'
  const [tab, setTab] = useState<TabKey>(initial)

  // Deep-link from the sidebar: ?view= selects the matching tab.
  useEffect(() => {
    if (search.view && (TABS as readonly string[]).includes(search.view) && search.view !== tab) {
      setTab(search.view as TabKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.view])

  function changeTab(value: string) {
    const next = value as TabKey
    setTab(next)
    navigate({ search: (prev) => ({ ...prev, view: next }), replace: true })
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold">Cuentas por Pagar</h2>
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="cuentas">Cuentas por Pagar</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="aging">Antigüedad</TabsTrigger>
        </TabsList>
        <TabsContent value="proveedores" className="mt-4">
          <CxpProveedores />
        </TabsContent>
        <TabsContent value="documentos" className="mt-4">
          <CxpDocumentos />
        </TabsContent>
        <TabsContent value="cuentas" className="mt-4">
          <CxpCuentas />
        </TabsContent>
        <TabsContent value="movimientos" className="mt-4">
          <CxpMovimientos />
        </TabsContent>
        <TabsContent value="aging" className="mt-4">
          <CxpAging />
        </TabsContent>
      </Tabs>
    </div>
  )
}
