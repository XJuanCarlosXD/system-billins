import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  createSkill,
  deleteSkill,
  listSkills,
} from '@/lib/api-client-asistente'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'

export function AsistenteAdminSkillsPage() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['asistente', 'skills'],
    queryFn: listSkills,
  })

  const createMut = useMutation({
    mutationFn: (name: string) =>
      createSkill({
        name,
        body: `---\nname: ${name}\ndescription: TODO\nmodules_required: []\ntools_used: []\n---\n\n# ${name}\n\nDescribe el flujo aqui.\n`,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asistente', 'skills'] })
      setShowNew(false)
      setNewName('')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (name: string) => deleteSkill(name),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['asistente', 'skills'] }),
  })

  return (
    <div className='flex flex-col gap-4 p-4'>
      <header className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-semibold'>Asistente — Skills</h1>
          <p className='text-sm text-muted-foreground'>
            Editor de SKILL.md disponibles para el asistente. Solo DBA.
          </p>
        </div>
        <Button onClick={() => setShowNew((s) => !s)}>
          <Plus className='mr-1 h-4 w-4' /> Nueva skill
        </Button>
      </header>

      {showNew && (
        <div className='flex items-end gap-2 rounded-md border p-3'>
          <div className='flex flex-col gap-1'>
            <Label htmlFor='new-name'>Nombre (kebab-case)</Label>
            <Input
              id='new-name'
              value={newName}
              placeholder='ej: anular-factura'
              onChange={(e) => setNewName(e.target.value.toLowerCase())}
              className='w-64'
            />
          </div>
          <Button
            onClick={() => createMut.mutate(newName)}
            disabled={
              !newName || createMut.isPending || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(newName)
            }
          >
            {createMut.isPending ? (
              <Loader2 className='mr-1 h-4 w-4 animate-spin' />
            ) : null}
            Crear
          </Button>
          {createMut.error && (
            <span className='text-xs text-destructive'>
              {(createMut.error as any)?.body?.detail ||
                (createMut.error as Error).message}
            </span>
          )}
        </div>
      )}

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

      {data && (
        <ScrollArea className='max-h-[70vh] rounded-md border'>
          <table className='w-full text-sm'>
            <thead className='sticky top-0 border-b bg-muted/40'>
              <tr>
                <th className='px-3 py-2 text-start text-xs font-medium text-muted-foreground'>
                  Nombre
                </th>
                <th className='px-3 py-2 text-start text-xs font-medium text-muted-foreground'>
                  Descripcion
                </th>
                <th className='px-3 py-2 text-start text-xs font-medium text-muted-foreground'>
                  Modulos
                </th>
                <th className='px-3 py-2 text-start text-xs font-medium text-muted-foreground'>
                  Tools
                </th>
                <th className='w-32 px-3 py-2 text-start text-xs font-medium text-muted-foreground'></th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className='px-3 py-4 text-center text-xs text-muted-foreground'
                  >
                    Sin skills disponibles.
                  </td>
                </tr>
              )}
              {data.map((sk) => (
                <tr key={sk.name} className='border-b last:border-b-0'>
                  <td className='px-3 py-2 font-mono text-xs'>{sk.name}</td>
                  <td className='px-3 py-2'>{sk.description}</td>
                  <td className='px-3 py-2 text-xs text-muted-foreground'>
                    {sk.modules_required?.join(', ') || '—'}
                  </td>
                  <td className='px-3 py-2 text-xs text-muted-foreground'>
                    {sk.tools_used?.length || 0}
                  </td>
                  <td className='px-3 py-2'>
                    <div className='flex gap-1'>
                      <Button asChild size='sm' variant='outline'>
                        <Link
                          to='/admin/asistente/skills/$name/edit'
                          params={{ name: sk.name }}
                        >
                          <FileText className='mr-1 h-3 w-3' /> Editar
                        </Link>
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => {
                          if (
                            confirm(`Eliminar skill "${sk.name}"? Borra el directorio.`)
                          ) {
                            deleteMut.mutate(sk.name)
                          }
                        }}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className='h-3 w-3 text-destructive' />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </div>
  )
}
