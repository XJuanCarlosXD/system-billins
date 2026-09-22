// Side sheet que se abre al cargar una cotización en Nueva Factura si trae
// líneas "manuales" (no_produ='X', solo marca/descripción libre — ver
// fat-nuevo-conduce.tsx::agregarLineaCustom). Esas líneas no corresponden a
// ningún producto real de INV.TINV_PRODUCTO, así que no se pueden facturar
// tal cual: por cada una, el usuario decide si se materializa como Artículo
// o como Servicio, reutilizando el mismo CrearProductoModal del resto del
// sistema (no se duplica el formulario de producto).
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CrearProductoModal,
  type CrearProductoModalResult,
} from './crear-producto-modal'

export interface LineaFaltante {
  idx: number
  descripcion: string
  cantidad: number
  precio: number
}

interface Props {
  open: boolean
  lineas: LineaFaltante[]
  noCia: string
  punto: string
  preselectAlmacenKey?: string
  onResolved: (idx: number, producto: CrearProductoModalResult) => void
  onClose: () => void
}

export function MissingProductsSheet({
  open,
  lineas,
  noCia,
  punto,
  preselectAlmacenKey,
  onResolved,
  onClose,
}: Props) {
  const [creando, setCreando] = useState<{
    idx: number
    tipo: 'I' | 'S'
    descripcion: string
  } | null>(null)

  return (
    <>
      <Sheet
        open={open && !creando}
        onOpenChange={(o) => {
          if (!o) onClose()
        }}
      >
        <SheetContent size='lg' className='sm:max-w-2xl'>
          <SheetHeader>
            <SheetTitle>Estos artículos no existen en el inventario</SheetTitle>
          </SheetHeader>
          <div className='space-y-3 overflow-y-auto px-6 py-4'>
            <p className='text-sm text-muted-foreground'>
              La cotización tiene {lineas.length} línea
              {lineas.length !== 1 ? 's' : ''} con producto manual (marca/
              descripción libre) que no corresponde a un artículo real.
              Elige cómo crear cada una antes de guardar la factura.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className='text-right'>Cantidad</TableHead>
                  <TableHead className='text-right'>Precio</TableHead>
                  <TableHead className='w-56 text-center'>Crear como</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((l) => (
                  <TableRow key={l.idx}>
                    <TableCell className='text-sm'>
                      {l.descripcion || '(sin descripción)'}
                    </TableCell>
                    <TableCell className='text-right font-mono text-sm'>
                      {l.cantidad}
                    </TableCell>
                    <TableCell className='text-right font-mono text-sm'>
                      {l.precio.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className='flex justify-center gap-2'>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() =>
                            setCreando({ idx: l.idx, tipo: 'I', descripcion: l.descripcion })
                          }
                        >
                          Artículo
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() =>
                            setCreando({ idx: l.idx, tipo: 'S', descripcion: l.descripcion })
                          }
                        >
                          Servicio
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <SheetFooter>
            <Button variant='outline' onClick={onClose}>
              Cerrar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {creando && (
        <CrearProductoModal
          open={true}
          onClose={() => setCreando(null)}
          noCia={noCia}
          punto={punto}
          descripcionInicial={creando.descripcion}
          tipoInicial={creando.tipo}
          preselectAlmacenKey={preselectAlmacenKey}
          onCreated={(p) => {
            const idx = creando.idx
            setCreando(null)
            onResolved(idx, p)
          }}
        />
      )}
    </>
  )
}
