import { useEffect, useMemo, useState } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BookOpen, FileText, Search } from 'lucide-react'
import { renderMarkdown } from './md'
import { regalGeneralDocsApi, ApiError, type DocItem, type DocFull } from '@/lib/regal-general-api-docs'

export function DocsPage() {
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q, 250)
  const [items, setItems] = useState<DocItem[]>([])
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [doc, setDoc] = useState<DocFull | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadList(query: string) {
    setLoadingList(true)
    try {
      const res = await regalGeneralDocsApi.docsList(query)
      setItems(res.items)
      if (!activeSlug && res.items.length > 0) {
        setActiveSlug(res.items[0].slug)
      } else if (activeSlug && !res.items.find((i) => i.slug === activeSlug)) {
        setActiveSlug(res.items[0]?.slug ?? null)
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red'
      setError(msg)
    } finally {
      setLoadingList(false)
    }
  }

  async function loadDoc(slug: string) {
    setLoadingDoc(true)
    setError(null)
    try {
      const d = await regalGeneralDocsApi.docsGet(slug)
      setDoc(d)
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail?.detail || 'Error' : 'Error de red'
      setError(msg)
      setDoc(null)
    } finally {
      setLoadingDoc(false)
    }
  }

  useEffect(() => { loadList(debouncedQ) /* eslint-disable-next-line */ }, [debouncedQ])
  useEffect(() => {
    if (activeSlug) loadDoc(activeSlug)
  }, [activeSlug])

  const html = useMemo(() => (doc?.content ? renderMarkdown(doc.content) : ''), [doc?.content])

  return (
    <>
      <Header>
        <h2 className='text-lg font-semibold me-auto flex items-center gap-2'>
          <BookOpen className='h-5 w-5' /> Documentación
        </h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <div className='mb-3 flex items-center gap-2'>
          <div className='relative w-full max-w-md'>
            <Search className='absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Buscar en la documentación...'
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className='ps-8'
            />
          </div>
          <Button variant='outline' size='sm' onClick={() => loadList(q)}>Buscar</Button>
          {q && (
            <Button variant='ghost' size='sm' onClick={() => setQ('')}>Limpiar</Button>
          )}
        </div>

        {error && (
          <div className='mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700'>
            {error}
          </div>
        )}

        <div className='grid gap-4 md:grid-cols-[300px_1fr]'>
          <Card className='h-[calc(100vh-220px)]'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm flex items-center gap-2'>
                <FileText className='h-4 w-4' />
                Documentos {items.length > 0 && <Badge variant='outline'>{items.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className='p-0'>
              <ScrollArea className='h-[calc(100vh-260px)]'>
                <div className='space-y-1 p-2'>
                  {loadingList && <div className='text-xs text-muted-foreground p-2'>Cargando...</div>}
                  {!loadingList && items.length === 0 && (
                    <div className='text-xs text-muted-foreground p-2'>Sin resultados</div>
                  )}
                  {items.map((it) => (
                    <button
                      key={it.slug}
                      onClick={() => setActiveSlug(it.slug)}
                      className={`w-full text-start rounded px-2 py-1.5 text-sm hover:bg-muted ${activeSlug === it.slug ? 'bg-muted font-medium' : ''}`}
                    >
                      <div className='truncate'>{it.title}</div>
                      <div className='text-xs text-muted-foreground truncate'>{it.filename}</div>
                      {it.matches && it.matches.length > 0 && (
                        <div className='mt-1 space-y-0.5'>
                          {it.matches.slice(0, 2).map((m, i) => (
                            <div key={i} className='text-[11px] text-muted-foreground italic line-clamp-1'>
                              L{m.line}: {m.snippet}
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className='h-[calc(100vh-220px)]'>
            <CardContent className='p-0'>
              <ScrollArea className='h-[calc(100vh-220px)]'>
                <div className='p-6'>
                  {loadingDoc && <div className='text-muted-foreground'>Cargando...</div>}
                  {!loadingDoc && doc && (
                    <article
                      className='prose prose-sm max-w-none dark:prose-invert'
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  )}
                  {!loadingDoc && !doc && !error && (
                    <div className='text-muted-foreground'>Selecciona un documento.</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
