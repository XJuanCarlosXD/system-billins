import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Puck } from '@measured/puck'
import '@measured/puck/puck.css'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Eye, RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCompany } from '@/context/company-context'
import {
  getPlantilla,
  restoreDefault,
  savePlantilla,
} from '@/features/pdf/api'
import { getRegistryEntry } from '@/features/pdf/registry'
import { puckConfig } from '@/features/pdf/blocks'

type Props = { codigo: string }

export default function PdfTemplateEditor({ codigo }: Props) {
  const { selectedCompany } = useCompany()
  const noCia = selectedCompany ?? '01'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const entry = getRegistryEntry(codigo)

  const { data: plantilla, isLoading } = useQuery({
    queryKey: ['plantilla-pdf', noCia, codigo],
    queryFn: () => getPlantilla(noCia, codigo),
    enabled: !!noCia && !!codigo,
  })

  const [puckData, setPuckData] = useState<any>(null)
  const [pageSize, setPageSize] = useState<'A4' | 'LETTER' | 'POS80'>('A4')
  const [orientation, setOrientation] = useState<'P' | 'L'>('P')

  // Inicializar lienzo cuando llega plantilla.
  useEffect(() => {
    if (!entry) return
    if (plantilla?.definicion_json) {
      try {
        setPuckData(JSON.parse(plantilla.definicion_json))
      } catch {
        setPuckData(entry.defaultTemplate)
      }
    } else if (plantilla || !isLoading) {
      setPuckData(entry.defaultTemplate)
    }
    if (plantilla?.page_size) setPageSize(plantilla.page_size)
    if (plantilla?.page_orientation) setOrientation(plantilla.page_orientation)
  }, [plantilla, entry, isLoading])

  const saveMut = useMutation({
    mutationFn: (data: any) =>
      savePlantilla(noCia, codigo, {
        nombre: entry?.nombre ?? codigo,
        definicion_json: data,
        page_size: pageSize,
        page_orientation: orientation,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plantilla-pdf', noCia, codigo] })
      qc.invalidateQueries({ queryKey: ['plantillas-pdf', noCia] })
      toast.success('Plantilla guardada')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const restoreMut = useMutation({
    mutationFn: () => restoreDefault(noCia, codigo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plantilla-pdf', noCia, codigo] })
      if (entry) setPuckData(entry.defaultTemplate)
      toast.success('Restaurada a plantilla por defecto')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openPreview = useCallback(() => {
    // Vista previa con datos reales del último documento — placeholder simple:
    // navegamos a /print/<codigo>/<id> con un id de demo según el documento.
    // El usuario puede sustituirlo en la barra de URL si tiene otro.
    let demoId = ''
    if (codigo === 'factura') demoId = 'FT-0039350'
    else if (codigo === 'conduce') demoId = 'CO-00002409'
    else if (codigo === 'cotizacion') demoId = 'CT-00003931'
    else if (codigo === 'listado-facturas') demoId = 'listado'
    else demoId = 'demo'
    const url = `/print/${codigo}/${encodeURIComponent(demoId)}?no_cia=${noCia}&punto=01`
    window.open(url, '_blank', 'noopener')
  }, [codigo, noCia])

  const headerSummary = useMemo(() => entry?.nombre ?? codigo, [entry, codigo])

  if (!entry) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Plantilla desconocida</h2>
        <p className="text-sm text-muted-foreground">El código <code>{codigo}</code> no está registrado.</p>
        <Button asChild className="mt-4">
          <Link to="/settings/pdf-templates">Volver</Link>
        </Button>
      </div>
    )
  }

  if (!puckData) {
    return <div className="p-6">Cargando editor…</div>
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"
            onClick={() => navigate({ to: '/settings/pdf-templates' })}>
            <Link to="/settings/pdf-templates"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="text-sm font-semibold">{headerSummary}</div>
            <div className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="mr-1">{entry.modulo}</Badge>
              Código: <code>{codigo}</code> · Empresa: {noCia}
              {plantilla?.personalizada && <Badge className="ml-2">Personalizada v{plantilla.version}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={pageSize} onValueChange={(v) => setPageSize(v as any)}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="LETTER">Carta</SelectItem>
              <SelectItem value="POS80">POS 80mm</SelectItem>
            </SelectContent>
          </Select>
          <Select value={orientation} onValueChange={(v) => setOrientation(v as 'P' | 'L')}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="P">Portrait</SelectItem>
              <SelectItem value="L">Landscape</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={openPreview}>
            <Eye className="mr-1 h-4 w-4" /> Vista previa
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => {
              if (confirm('¿Restaurar a la plantilla por defecto? Se perderán los cambios.')) {
                restoreMut.mutate()
              }
            }}
            disabled={restoreMut.isPending || !plantilla?.personalizada}
          >
            <RotateCcw className="mr-1 h-4 w-4" /> Restaurar default
          </Button>
          <Button size="sm" onClick={() => saveMut.mutate(puckData)} disabled={saveMut.isPending}>
            <Save className="mr-1 h-4 w-4" /> Guardar
          </Button>
        </div>
      </div>

      {/* Puck editor */}
      <div className="flex-1 overflow-hidden">
        <Puck
          config={puckConfig}
          data={puckData}
          onChange={(d: any) => setPuckData(d)}
          onPublish={(d: any) => saveMut.mutate(d)}
        />
      </div>
    </div>
  )
}
