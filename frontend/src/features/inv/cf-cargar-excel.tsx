import { useRef, useState } from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

interface Props {
  noCia: string
  punto: string
}

interface FilaConteo {
  contador: string
  almacen: string
  no_produ: string
  nombre: string
  ubicacion: string
  emp: string
  exist_libro: number
  cf_mayor: number
  cf_unidades: number
  diferencia: number
}

interface ResultadoCarga {
  fecha: string
  cant_por_emp: number
  exist_libro: number
  exist_fisico: number
  diferencia: number
  total_cf: number
  filas: FilaConteo[]
}

const COLUMNAS_ESPERADAS = [
  { col: 'A', campo: 'Contador', descripcion: 'Código del contador' },
  { col: 'B', campo: 'Almacén', descripcion: 'Código del almacén (ej: 01)' },
  { col: 'C', campo: 'No. Producto', descripcion: 'Código del producto' },
  { col: 'D', campo: 'Nombre Producto', descripcion: 'Descripción del producto' },
  { col: 'E', campo: 'Ubicación', descripcion: 'Estante/tramo' },
  { col: 'F', campo: 'Emp.', descripcion: 'Código empleado' },
  { col: 'G', campo: 'Existencia Libro', descripcion: 'Existencia teórica (número)' },
  { col: 'H', campo: 'CF Emp. Mayor', descripcion: 'Conteo físico mayor (número)' },
  { col: 'I', campo: 'CF Unidades', descripcion: 'Conteo físico unidades (número)' },
]

export function CargarConteoExcel({ noCia, punto }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [lineasTitulo, setLineasTitulo] = useState(1)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setArchivo(f)
    setResultado(null)
    setError(null)
  }

  async function handleCargar() {
    if (!archivo) return
    setLoading(true)
    setError(null)
    setResultado(null)

    const formData = new FormData()
    formData.append('archivo', archivo)
    formData.append('no_cia', noCia)
    formData.append('punto', punto)
    formData.append('lineas_titulo', String(lineasTitulo))

    try {
      const res = await fetch(`${API_BASE}/inv/conteo-fisico/cargar-excel/`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err?.detail ?? `Error HTTP ${res.status}`)
        return
      }
      const data = await res.json()
      setResultado(data)
    } catch {
      setError('No se pudo conectar con el servidor. El endpoint puede estar en construcción.')
    } finally {
      setLoading(false)
    }
  }

  const totalDiferencia = resultado
    ? resultado.filas.reduce((acc, f) => acc + f.diferencia, 0)
    : 0

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-lg font-semibold'>Cargar Conteo Físico desde Excel</h2>
        <p className='text-sm text-muted-foreground'>
          FINV709 — Sube un archivo .xlsx con el conteo físico capturado.
        </p>
      </div>

      <div className='rounded-md border p-5 bg-muted/20 space-y-5'>
        {/* Formato esperado */}
        <div className='flex items-center gap-3'>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant='outline' size='sm' className='gap-2'>
                <FileSpreadsheet className='h-4 w-4' />
                Ver Formato Hoja Excel
              </Button>
            </DialogTrigger>
            <DialogContent className='max-w-2xl'>
              <DialogHeader>
                <DialogTitle>Formato de Hoja Excel — Conteo Físico</DialogTitle>
              </DialogHeader>
              <p className='text-sm text-muted-foreground mb-3'>
                La hoja debe tener las siguientes columnas en orden, comenzando en la fila indicada
                (luego de las líneas de título a omitir).
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-14'>Columna</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Descripción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COLUMNAS_ESPERADAS.map((c) => (
                    <TableRow key={c.col}>
                      <TableCell className='font-mono font-bold'>{c.col}</TableCell>
                      <TableCell>{c.campo}</TableCell>
                      <TableCell className='text-muted-foreground text-xs'>{c.descripcion}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DialogContent>
          </Dialog>
        </div>

        {/* Inputs */}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div className='space-y-1.5'>
            <Label>Líneas de título a omitir</Label>
            <Input
              type='number'
              className='h-9 w-32'
              min={0}
              max={20}
              value={lineasTitulo}
              onChange={(e) => setLineasTitulo(Number(e.target.value))}
            />
          </div>

          <div className='space-y-1.5 sm:col-span-2'>
            <Label>Archivo Excel (.xlsx)</Label>
            <div className='flex items-center gap-3'>
              <Input
                ref={fileRef}
                type='file'
                accept='.xlsx,.xls'
                className='h-9 max-w-sm'
                onChange={handleFileChange}
              />
              {archivo && (
                <Badge variant='outline' className='text-xs max-w-xs truncate'>
                  {archivo.name}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className='text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2'>
            {error}
          </p>
        )}

        <Button
          className='gap-2'
          disabled={!archivo || loading}
          onClick={handleCargar}
        >
          <Upload className='h-4 w-4' />
          {loading ? 'Cargando...' : 'Cargar Datos'}
        </Button>
      </div>

      {/* Tabla de preview */}
      {resultado && (
        <div className='space-y-4'>
          {/* Totales */}
          <div className='rounded-md border p-4 bg-muted/10'>
            <p className='text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide'>Resumen de carga</p>
            <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3'>
              {[
                { label: 'Fecha', value: resultado.fecha },
                { label: 'Cant. por Emp.', value: resultado.cant_por_emp },
                { label: 'Exist. Libro', value: resultado.exist_libro.toLocaleString() },
                { label: 'Exist. Físico', value: resultado.exist_fisico.toLocaleString() },
                { label: 'Diferencia', value: resultado.diferencia.toLocaleString() },
                { label: 'Total CF', value: resultado.total_cf.toLocaleString() },
              ].map((item) => (
                <div key={item.label} className='text-center'>
                  <p className='text-xs text-muted-foreground'>{item.label}</p>
                  <p className='font-semibold text-sm'>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className='rounded-md border overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cont.</TableHead>
                  <TableHead>Alm.</TableHead>
                  <TableHead>No Prod.</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ubic.</TableHead>
                  <TableHead>Emp.</TableHead>
                  <TableHead className='text-right'>Exist. Libro</TableHead>
                  <TableHead className='text-right'>CF Mayor</TableHead>
                  <TableHead className='text-right'>CF Unid.</TableHead>
                  <TableHead className='text-right'>Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.filas.map((fila, i) => (
                  <TableRow key={i}>
                    <TableCell>{fila.contador}</TableCell>
                    <TableCell>{fila.almacen}</TableCell>
                    <TableCell className='font-mono text-xs'>{fila.no_produ}</TableCell>
                    <TableCell className='max-w-[180px] truncate'>{fila.nombre}</TableCell>
                    <TableCell>{fila.ubicacion}</TableCell>
                    <TableCell>{fila.emp}</TableCell>
                    <TableCell className='text-right'>{fila.exist_libro.toLocaleString()}</TableCell>
                    <TableCell className='text-right'>{fila.cf_mayor.toLocaleString()}</TableCell>
                    <TableCell className='text-right'>{fila.cf_unidades.toLocaleString()}</TableCell>
                    <TableCell
                      className={`text-right font-semibold ${fila.diferencia < 0 ? 'text-destructive' : fila.diferencia > 0 ? 'text-green-600' : ''}`}
                    >
                      {fila.diferencia.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totales footer */}
                <TableRow className='border-t-2 font-semibold bg-muted/30'>
                  <TableCell colSpan={9} className='text-right'>Total Diferencia:</TableCell>
                  <TableCell
                    className={`text-right ${totalDiferencia < 0 ? 'text-destructive' : totalDiferencia > 0 ? 'text-green-600' : ''}`}
                  >
                    {totalDiferencia.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
