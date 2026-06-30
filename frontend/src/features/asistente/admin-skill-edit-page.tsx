import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { AlertCircle, ArrowLeft, Loader2, Save } from 'lucide-react'
import { getSkill, updateSkill } from '@/lib/api-client-asistente'
import { Button } from '@/components/ui/button'

export function AsistenteAdminSkillEditPage() {
  const { name } = useParams({
    from: '/_authenticated/admin/asistente/skills/$name/edit',
  })
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const [dirty, setDirty] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['asistente', 'skill', name],
    queryFn: () => getSkill(name),
  })

  useEffect(() => {
    if (data && !dirty) setBody(data.body)
  }, [data, dirty])

  const saveMut = useMutation({
    mutationFn: () => updateSkill(name, body),
    onSuccess: () => {
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['asistente', 'skill', name] })
      qc.invalidateQueries({ queryKey: ['asistente', 'skills'] })
    },
  })

  return (
    <div className='flex h-full flex-col gap-3 p-4'>
      <header className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <Button asChild size='sm' variant='ghost'>
            <Link to='/admin/asistente/skills'>
              <ArrowLeft className='mr-1 h-4 w-4' /> Volver
            </Link>
          </Button>
          <div>
            <h1 className='text-lg font-semibold'>Editar skill</h1>
            <p className='text-xs text-muted-foreground'>
              <code className='font-mono'>{name}</code>
              {dirty && (
                <span className='ml-2 text-amber-600 dark:text-amber-400'>
                  · sin guardar
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          onClick={() => saveMut.mutate()}
          disabled={!dirty || saveMut.isPending}
        >
          {saveMut.isPending ? (
            <Loader2 className='mr-1 h-4 w-4 animate-spin' />
          ) : (
            <Save className='mr-1 h-4 w-4' />
          )}
          Guardar
        </Button>
      </header>

      {isLoading && (
        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
          <Loader2 className='h-4 w-4 animate-spin' /> Cargando...
        </div>
      )}

      {error && (
        <div className='flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
          <AlertCircle className='h-4 w-4' />
          {(error as any)?.body?.detail || (error as Error).message}
        </div>
      )}

      {saveMut.error && (
        <div className='flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
          <AlertCircle className='h-4 w-4' />
          {(saveMut.error as any)?.body?.detail ||
            (saveMut.error as Error).message}
        </div>
      )}

      {data && (
        <div className='grid flex-1 grid-cols-1 gap-3 lg:grid-cols-2'>
          <section className='flex flex-col'>
            <div className='border-b bg-muted/40 px-3 py-2 text-xs font-medium'>
              Markdown
            </div>
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value)
                setDirty(true)
              }}
              spellCheck={false}
              className='h-[60vh] flex-1 resize-none rounded-b-md border border-t-0 bg-card p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring'
            />
          </section>
          <section className='flex flex-col'>
            <div className='border-b bg-muted/40 px-3 py-2 text-xs font-medium'>
              Preview
            </div>
            <div className='h-[60vh] flex-1 overflow-auto rounded-b-md border border-t-0 bg-card p-3'>
              <pre className='whitespace-pre-wrap font-sans text-sm leading-relaxed'>
                {body}
              </pre>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
