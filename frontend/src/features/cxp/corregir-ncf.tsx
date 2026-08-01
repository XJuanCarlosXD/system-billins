// CxP — Corregir NCF / datos DGII de un documento (equivale a Fcxp212).
// Busca los documentos de un proveedor y permite corregir NCF, RNC,
// ITBIS y clasificaciones DGII sin tocar valores ni saldos. Se bloquea
// corregir un documento de un periodo contable YA CERRADO (el backend
// tambien lo exige, ver corregir_datos_dgii) -- el boton "Corregir" se
// deshabilita para esos documentos.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Search, X } from 'lucide-react'
import { regalGeneralApi as api } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ProveedorPicker } from './cxp-procesos'
import {
  CxpCorregirDocumentoDialog,
  esDocumentoEditable,
  usePeriodoActualCxP,
  type CxpDocumentoParaCorregir,
} from './corregir-documento-dialog'

interface P {
  noCia: string
  punto?: string
}

const fmt = (n: any) =>
  Number(n || 0).toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

// NCF DGI real: prefijo + LPAD(ncf). B01..B15 usan 8 dígitos (total 11);
// e-CF (E31/E32) usan 10 dígitos (total 13).
const ncfWidth = (pos: string): number => (pos.startsWith('E') ? 10 : 8)
const ncfDgi = (doc: any): string => {
  const pos = (doc?.posiciones_fijas_ncf ?? '').toString().trim().toUpperCase()
  const n = doc?.ncf
  if (!pos || n == null || n === '') return ''
  return pos + String(n).padStart(ncfWidth(pos), '0')
}

export function CxpCorregirNcf({ noCia, punto = '' }: P) {
  const periodoQ = usePeriodoActualCxP(noCia, punto)
  const [proveedor, setProveedor] = useState<any | null>(null)
  const [fpInput, setFpInput] = useState('')
  const [fpBusqueda, setFpBusqueda] = useState('')
  const [editing, setEditing] = useState<CxpDocumentoParaCorregir | null>(null)

  // NO_DOCU en TCXP_DOCUMENTO es CHAR(7): "8347" → "0008347"
  const buscarFp = () => {
    const n = fpInput.replace(/[^0-9]/g, '')
    setFpBusqueda(n ? n.padStart(7, '0') : '')
  }

  const docsQ = useQuery({
    queryKey: ['cxp-corregir-ncf', noCia, punto, proveedor?.no_proveedor ?? '', fpBusqueda],
    queryFn: () =>
      api.cxpCorregirNcfDocs({
        no_cia: noCia,
        punto,
        ...(fpBusqueda
          ? { tipo_docu: 'FP', no_docu: fpBusqueda }
          : { no_proveedor: proveedor.no_proveedor }),
      }),
    enabled: !!noCia && !!punto && (!!fpBusqueda || !!proveedor?.no_proveedor),
  })

  const rows = docsQ.data || []

  return (
    <div className='space-y-4 p-6'>
      <div>
        <h1 className='text-2xl font-semibold'>Corregir NCF</h1>
        <p className='text-sm text-muted-foreground'>
          Corrige el NCF, RNC, ITBIS y clasificaciones DGII de un documento ya
          registrado, sin alterar valores ni saldos. Equivale a la forma legacy{' '}
          <i>Fcxp212</i> sobre <span className='font-mono'>TCXP_DOCUMENTO</span>.
          No se pueden corregir documentos de un periodo contable ya cerrado.
        </p>
      </div>

      <div className='grid grid-cols-1 gap-3 md:grid-cols-2 md:max-w-3xl'>
        <ProveedorPicker value={proveedor} onChange={setProveedor} />
        <div className='min-w-0 space-y-1'>
          <Label className='text-xs'>Buscar por No. FP</Label>
          <div className='flex gap-2'>
            <Input
              value={fpInput}
              onChange={(e) => setFpInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
              onKeyDown={(e) => e.key === 'Enter' && buscarFp()}
              className='h-10 font-mono'
              inputMode='numeric'
              maxLength={7}
              placeholder='ej. 8347'
            />
            <Button variant='outline' className='h-10' onClick={buscarFp} disabled={!fpInput}>
              <Search className='mr-1 h-4 w-4' /> Buscar
            </Button>
            {fpBusqueda && (
              <Button
                variant='ghost'
                size='icon'
                className='h-10 w-10'
                onClick={() => {
                  setFpBusqueda('')
                  setFpInput('')
                }}
                title='Limpiar búsqueda por FP'
              >
                <X className='h-4 w-4' />
              </Button>
            )}
          </div>
          {fpBusqueda && (
            <p className='font-mono text-xs text-muted-foreground'>
              Mostrando documento FP-{fpBusqueda}
            </p>
          )}
        </div>
      </div>

      {!proveedor?.no_proveedor && !fpBusqueda ? (
        <div className='rounded border py-10 text-center text-sm text-muted-foreground'>
          Busca un proveedor con la lupa, o escribe el número de la factura (FP)
          y pulsa Buscar, para ver los documentos y corregir el NCF.
        </div>
      ) : docsQ.isLoading ? (
        <Skeleton className='h-40 w-full' />
      ) : (
        <div className='overflow-x-auto rounded border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>NCF DGI</TableHead>
                <TableHead>RNC</TableHead>
                <TableHead className='text-right'>Valor</TableHead>
                <TableHead className='text-right'>ITBIS</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className='text-right'>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d: any) => {
                const editable = esDocumentoEditable(d.fecha, periodoQ.periodo) && d.status !== 'R'
                return (
                  <TableRow key={`${d.tipo_docu}-${d.no_docu}`}>
                    <TableCell className='font-mono'>
                      {d.tipo_docu}-{d.no_docu}
                    </TableCell>
                    <TableCell>{d.fecha}</TableCell>
                    <TableCell className='font-mono'>
                      {ncfDgi(d) || <span className='text-muted-foreground'>—</span>}
                    </TableCell>
                    <TableCell className='font-mono'>{d.rnc || ''}</TableCell>
                    <TableCell className='text-right font-mono tabular-nums'>
                      RD$ {fmt(d.valor_original)}
                    </TableCell>
                    <TableCell className='text-right font-mono tabular-nums'>
                      {Number(d.impuesto) > 0 ? fmt(d.impuesto) : ''}
                    </TableCell>
                    <TableCell>
                      {d.status === 'R' ? (
                        <Badge variant='destructive'>Reversado</Badge>
                      ) : d.status === 'C' ? (
                        <Badge variant='outline'>Cerrado</Badge>
                      ) : (
                        <Badge>Activo</Badge>
                      )}
                    </TableCell>
                    <TableCell className='text-right'>
                      {editable ? (
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() =>
                            setEditing({
                              ...d,
                              no_cia: noCia,
                              punto,
                              nombre_proveedor: d.proveedor || proveedor?.nombre,
                            })
                          }
                        >
                          <Pencil className='mr-1 h-3.5 w-3.5' /> Corregir
                        </Button>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button size='sm' variant='outline' disabled>
                                <Pencil className='mr-1 h-3.5 w-3.5' /> Corregir
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {d.status === 'R'
                              ? 'Documento reversado, no se puede corregir.'
                              : 'Este documento pertenece a un periodo contable ya cerrado.'}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className='py-6 text-center text-muted-foreground'>
                    {fpBusqueda
                      ? `No existe el documento FP-${fpBusqueda} en este punto.`
                      : `El proveedor ${proveedor?.nombre || proveedor?.no_proveedor} no tiene documentos registrados en este punto.`}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <CxpCorregirDocumentoDialog
        doc={editing}
        noCia={noCia}
        punto={punto}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  )
}
