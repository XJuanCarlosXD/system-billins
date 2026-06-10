import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Eye, EyeOff, KeyRound, UserCircle } from 'lucide-react'
import { useMe } from '@/hooks/use-me'
import { regalGeneralApi } from '@/lib/regal-general-api'

const schema = z
  .object({
    current_password: z.string().min(1, 'Ingresa tu contraseña actual.'),
    new_password: z.string().min(6, 'Mínimo 6 caracteres.'),
    confirm_password: z.string().min(1, 'Repite la nueva contraseña.'),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    path: ['confirm_password'],
    message: 'Las contraseñas no coinciden.',
  })

type FormValues = z.infer<typeof schema>

export function AccountForm() {
  const { data: me, isLoading } = useMe()
  const [submitting, setSubmitting] = useState(false)
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  })

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    try {
      const res = await regalGeneralApi.changeOwnPassword(
        values.current_password,
        values.new_password,
        values.confirm_password
      )
      toast.success(res.detail || 'Contraseña actualizada.')
      form.reset()
    } catch (e: any) {
      const msg = e?.body?.detail ?? e?.message ?? 'No se pudo cambiar la contraseña.'
      toast.error(typeof msg === 'string' ? msg : 'Error al cambiar contraseña.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <UserCircle className='h-4 w-4' /> Sesión actual
          </CardTitle>
        </CardHeader>
        <CardContent className='text-sm'>
          {isLoading ? (
            <Skeleton className='h-6 w-40' />
          ) : (
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Usuario conectado</span>
              <span className='font-mono font-medium'>{me?.username ?? '—'}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <KeyRound className='h-4 w-4' /> Cambiar contraseña
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <FormField
                control={form.control}
                name='current_password'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña actual</FormLabel>
                    <FormControl>
                      <div className='relative'>
                        <Input
                          type={showCur ? 'text' : 'password'}
                          autoComplete='current-password'
                          {...field}
                        />
                        <button
                          type='button'
                          onClick={() => setShowCur((s) => !s)}
                          className='absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground'
                          tabIndex={-1}
                          aria-label='Mostrar/ocultar'
                        >
                          {showCur ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='new_password'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nueva contraseña</FormLabel>
                    <FormControl>
                      <div className='relative'>
                        <Input
                          type={showNew ? 'text' : 'password'}
                          autoComplete='new-password'
                          {...field}
                        />
                        <button
                          type='button'
                          onClick={() => setShowNew((s) => !s)}
                          className='absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground'
                          tabIndex={-1}
                          aria-label='Mostrar/ocultar'
                        >
                          {showNew ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                        </button>
                      </div>
                    </FormControl>
                    <FormDescription>Mínimo 6 caracteres.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='confirm_password'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar contraseña</FormLabel>
                    <FormControl>
                      <Input type='password' autoComplete='new-password' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type='submit' disabled={submitting}>
                {submitting ? 'Actualizando…' : 'Cambiar contraseña'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
