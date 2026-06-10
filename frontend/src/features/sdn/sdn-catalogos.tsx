import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/regal-general-api'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const fmtCol = (v: any) => v ?? '—'

function GenericTable({ cols, rows }: { cols: { key: string; label: string }[]; rows: any[] }) {
  return (
    <div className="rounded border overflow-x-auto">
      <Table>
        <TableHeader><TableRow>{cols.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {cols.map(c => <TableCell key={c.key} className={c.key.includes('descri') ? '' : 'font-mono text-xs'}>{fmtCol(r[c.key])}</TableCell>)}
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={cols.length} className="text-center text-muted-foreground py-4">Sin registros.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  )
}

export function SdnCatalogos() {
  const afpQ = useQuery({ queryKey: ['sdn-afp'], queryFn: api.sdnListAfp })
  const arsQ = useQuery({ queryKey: ['sdn-ars'], queryFn: api.sdnListArs })
  const gerQ = useQuery({ queryKey: ['sdn-gerencias'], queryFn: api.sdnListGerencias })
  const areaQ = useQuery({ queryKey: ['sdn-areas'], queryFn: api.sdnListAreas })
  const deptQ = useQuery({ queryKey: ['sdn-deptos'], queryFn: api.sdnListDeptos })
  const ingQ = useQuery({ queryKey: ['sdn-ingresos'], queryFn: () => api.sdnListIngresos() })
  const dedQ = useQuery({ queryKey: ['sdn-deducciones'], queryFn: () => api.sdnListDeducciones() })

  return (
    <Tabs defaultValue="ingresos">
      <TabsList>
        <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
        <TabsTrigger value="deducciones">Deducciones</TabsTrigger>
        <TabsTrigger value="org">Organización</TabsTrigger>
        <TabsTrigger value="ss">AFP / ARS</TabsTrigger>
      </TabsList>
      <TabsContent value="ingresos" className="pt-4">
        <GenericTable
          cols={[
            { key: 'no_ingreso', label: 'Código' },
            { key: 'descripcion', label: 'Descripción' },
            { key: 'descri_corta', label: 'Corto' },
            { key: 'tipo_ingreso', label: 'Tipo' },
            { key: 'clase_ingreso', label: 'Clase' },
            { key: 'multiplicado_por', label: 'Mult.' },
          ]}
          rows={ingQ.data || []}
        />
      </TabsContent>
      <TabsContent value="deducciones" className="pt-4">
        <GenericTable
          cols={[
            { key: 'no_deduccion', label: 'Código' },
            { key: 'descripcion', label: 'Descripción' },
            { key: 'tipo_deduccion', label: 'Tipo' },
            { key: 'empleado_patrono', label: 'E/P' },
            { key: 'porciento_monto', label: '%/$' },
            { key: 'valor', label: 'Valor' },
            { key: 'cuenta', label: 'Cuenta' },
          ]}
          rows={dedQ.data || []}
        />
      </TabsContent>
      <TabsContent value="org" className="pt-4 space-y-4">
        <div>
          <div className="font-medium mb-2">Gerencias <Badge variant="outline">{gerQ.data?.length || 0}</Badge></div>
          <GenericTable cols={[{ key: 'no_gerencia', label: 'No.' }, { key: 'descripcion', label: 'Descripción' }]} rows={gerQ.data || []} />
        </div>
        <div>
          <div className="font-medium mb-2">Áreas <Badge variant="outline">{areaQ.data?.length || 0}</Badge></div>
          <GenericTable cols={[
            { key: 'no_gerencia', label: 'Gerencia' }, { key: 'no_area', label: 'Área' }, { key: 'descripcion', label: 'Descripción' },
          ]} rows={areaQ.data || []} />
        </div>
        <div>
          <div className="font-medium mb-2">Departamentos <Badge variant="outline">{deptQ.data?.length || 0}</Badge></div>
          <GenericTable cols={[
            { key: 'no_gerencia', label: 'Ger.' }, { key: 'no_area', label: 'Área' }, { key: 'no_depto', label: 'Depto' }, { key: 'descripcion', label: 'Descripción' },
          ]} rows={deptQ.data || []} />
        </div>
      </TabsContent>
      <TabsContent value="ss" className="pt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="font-medium mb-2">AFP</div>
          <GenericTable cols={[{ key: 'no_afp', label: 'No.' }, { key: 'descripcion', label: 'Descripción' }]} rows={afpQ.data || []} />
        </div>
        <div>
          <div className="font-medium mb-2">ARS</div>
          <GenericTable cols={[{ key: 'no_ars', label: 'No.' }, { key: 'descripcion', label: 'Descripción' }]} rows={arsQ.data || []} />
        </div>
      </TabsContent>
    </Tabs>
  )
}
