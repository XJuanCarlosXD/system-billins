import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listPlantillas } from '@/features/pdf/api'
import { listRegistry, PLANIFICADOS, registry } from '@/features/pdf/registry'

export { PdfTemplatesIndex as PdfTemplatesEditor }

export default function PdfTemplatesIndex() {
  const { selectedCompany } = useCompany()
  const noCia = selectedCompany ?? '01'

  const { data, isLoading } = useQuery({
    queryKey: ['plantillas-pdf', noCia],
    queryFn: () => listPlantillas(noCia),
    enabled: !!noCia,
  })

  const persistidas = new Map((data?.results ?? []).map(p => [p.codigo_doc, p]))

  const rows = listRegistry().map(e => ({
    codigo: e.codigo,
    modulo: e.modulo,
    nombre: e.nombre,
    estado: 'Disponible',
    personalizada: persistidas.get(e.codigo)?.personalizada ?? false,
    fecha_mod: persistidas.get(e.codigo)?.fecha_mod ?? null,
    page_size: persistidas.get(e.codigo)?.page_size ?? e.defaultPageSize ?? 'A4',
  }))

  const planificadas = PLANIFICADOS.filter(p => !registry[p.codigo]).map(p => ({
    codigo: p.codigo,
    modulo: p.modulo,
    nombre: p.nombre,
    estado: 'Próximamente',
    personalizada: false,
    fecha_mod: null as string | null,
    page_size: 'A4',
  }))

  const all = [...rows, ...planificadas]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Plantillas PDF</CardTitle>
          <CardDescription>
            Editor visual de plantillas PDF (estilo Odoo) por empresa. Cada documento
            tiene su propia plantilla con bloques arrastrables: Header, Cliente,
            Tabla, Totales, Firmas, Footer, etc. Los cambios afectan a todas las
            impresiones siguientes de la empresa <b>{noCia}</b>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tamaño</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Personalizada</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7}>Cargando…</TableCell></TableRow>
              )}
              {!isLoading && all.map(r => (
                <TableRow key={`${r.modulo}-${r.codigo}`}>
                  <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                  <TableCell><Badge variant="secondary">{r.modulo}</Badge></TableCell>
                  <TableCell>{r.nombre}</TableCell>
                  <TableCell><span className="text-xs">{r.page_size}</span></TableCell>
                  <TableCell>
                    {r.estado === 'Disponible'
                      ? <Badge>Disponible</Badge>
                      : <Badge variant="outline">Próximamente</Badge>}
                  </TableCell>
                  <TableCell>
                    {r.personalizada
                      ? <Badge variant="default">Sí</Badge>
                      : <Badge variant="outline">Default</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.estado === 'Disponible' ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/settings/pdf-templates/$codigo" params={{ codigo: r.codigo }}>
                          Editar
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled>—</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
