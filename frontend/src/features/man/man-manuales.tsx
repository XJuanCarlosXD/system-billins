import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
} from 'lucide-react'
import { api } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { renderMarkdown } from '@/features/docs/md'

type Manual = {
  sistema?: string | null
  programa?: string | null
  tipo_prg?: string | null
  clase_prg?: string | null
  descripcion_prg?: string | null
  detalle?: string | null
}

type ManualItem = Manual & {
  key: string
  title: string
  filename: string
}

const PAGE_SIZE = 12

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase()
}

function getManualTitle(manual: Manual) {
  return manual.descripcion_prg || manual.programa || 'Manual sin descripcion'
}

function getManualFilename(manual: Manual) {
  return (
    [manual.sistema, manual.programa].filter(Boolean).join(' / ') ||
    'Sin referencia'
  )
}

function getManualMarkdown(manual: ManualItem) {
  const meta = [
    manual.sistema ? `**Sistema:** ${manual.sistema}` : null,
    manual.programa ? `**Programa:** ${manual.programa}` : null,
    manual.tipo_prg || manual.clase_prg
      ? `**Tipo:** ${[manual.tipo_prg, manual.clase_prg].filter(Boolean).join(' / ')}`
      : null,
  ].filter(Boolean)

  return [
    `# ${manual.title}`,
    ...meta,
    '',
    manual.detalle || 'Sin detalle registrado.',
  ].join('\n\n')
}

export function ManManualDocsPage() {
  return (
    <>
      <Header>
        <h2 className='me-auto flex items-center gap-2 text-lg font-semibold'>
          <BookOpen className='h-5 w-5' /> Manuales del Sistema
        </h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <ManManuales />
      </Main>
    </>
  )
}

export function ManManuales() {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['man-manuales'],
    queryFn: () => api.manListManuales(),
  })
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const items = useMemo<ManualItem[]>(
    () =>
      (Array.isArray(data) ? (data as Manual[]) : []).map((manual, index) => ({
        ...manual,
        key: `${manual.sistema ?? 'sis'}-${manual.programa ?? 'prg'}-${index}`,
        title: getManualTitle(manual),
        filename: getManualFilename(manual),
      })),
    [data]
  )

  const filtered = useMemo(() => {
    const term = normalize(search).trim()
    if (!term) return items

    return items.filter((manual) =>
      [
        manual.title,
        manual.filename,
        manual.sistema,
        manual.programa,
        manual.tipo_prg,
        manual.clase_prg,
        manual.detalle,
      ].some((value) => normalize(value).includes(term))
    )
  }, [items, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedItems = useMemo(
    () =>
      filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, filtered]
  )
  const activeManual =
    filtered.find((manual) => manual.key === selectedKey) ?? filtered[0] ?? null
  const activeKey = activeManual?.key ?? null
  const html = useMemo(
    () => (activeManual ? renderMarkdown(getManualMarkdown(activeManual)) : ''),
    [activeManual]
  )
  const errorMessage =
    error instanceof Error ? error.message : error ? 'Error de red' : null

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <div className='relative w-full max-w-md'>
          <Search className='absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Buscar en los manuales...'
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            className='ps-8'
          />
        </div>
        {search && (
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              setSearch('')
              setPage(1)
            }}
          >
            Limpiar
          </Button>
        )}
        <div className='ml-auto text-sm text-muted-foreground'>
          {filtered.length} de {items.length}
        </div>
      </div>

      {errorMessage && (
        <div className='rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700'>
          {errorMessage}
        </div>
      )}

      <div className='grid gap-4 md:grid-cols-[300px_1fr]'>
        <Card className='h-[calc(100vh-220px)]'>
          <CardHeader className='pb-2'>
            <CardTitle className='flex items-center gap-2 text-sm'>
              <FileText className='h-4 w-4' />
              Documentos{' '}
              {filtered.length > 0 && (
                <Badge variant='outline'>{filtered.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className='p-0'>
            <ScrollArea className='h-[calc(100vh-380px)]'>
              <div className='space-y-1 p-2'>
                {isLoading && (
                  <div className='p-2 text-xs text-muted-foreground'>
                    Cargando...
                  </div>
                )}
                {!isLoading && filtered.length === 0 && (
                  <div className='p-2 text-xs text-muted-foreground'>
                    Sin resultados
                  </div>
                )}
                {pagedItems.map((manual) => (
                  <button
                    key={manual.key}
                    type='button'
                    onClick={() => setSelectedKey(manual.key)}
                    className={`w-full rounded px-2 py-1.5 text-start text-sm hover:bg-muted ${
                      activeKey === manual.key ? 'bg-muted font-medium' : ''
                    }`}
                  >
                    <div className='max-w-9/12 truncate capitalize'>
                      {manual.title.toLocaleLowerCase()}
                    </div>
                    <div className='truncate text-xs text-muted-foreground'>
                      {manual.filename}
                    </div>
                    {(manual.tipo_prg || manual.clase_prg) && (
                      <div className='mt-1 text-[11px] text-muted-foreground'>
                        {[manual.tipo_prg, manual.clase_prg]
                          .filter(Boolean)
                          .join(' / ')}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
          {filtered.length > PAGE_SIZE && (
            <div className='flex items-center justify-between gap-2 border-t p-2 text-xs'>
              <Button
                variant='ghost'
                size='sm'
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className='h-3 w-3' /> Atras
              </Button>
              <span className='text-muted-foreground'>
                {currentPage} / {totalPages}
              </span>
              <Button
                variant='ghost'
                size='sm'
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                Sig. <ChevronRight className='h-3 w-3' />
              </Button>
            </div>
          )}
        </Card>

        <Card className='h-[calc(100vh-220px)]'>
          <CardContent className='p-0'>
            <ScrollArea className='h-[calc(100vh-220px)]'>
              <div className='p-6'>
                {isLoading && (
                  <div className='text-muted-foreground'>Cargando...</div>
                )}
                {!isLoading && activeManual && (
                  <article
                    className='prose prose-sm dark:prose-invert max-w-none'
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                )}
                {!isLoading && !activeManual && !errorMessage && (
                  <div className='text-muted-foreground'>
                    Selecciona un documento.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
