import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PasswordInput } from '@/components/password-input'
import { sigafApi, ApiError } from '@/lib/sigaf-api'

const schema = z
  .object({
    current_password: z.string().min(1, 'Contraseña actual requerida'),
    new_password: z
      .string()
      .min(4, 'Mínimo 4 caracteres')
      .max(30, 'Máximo 30 caracteres')
      .regex(/^[A-Za-z0-9_@#$\-\.\+]+$/, 'Caracteres permitidos: A-Z a-z 0-9 _ @ # $ - . +'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    path: ['confirm_password'],
    message: 'No coincide con la nueva contraseña',
  })

export function ChangePasswordPage() {
  const [loading, setLoading] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  })

  async function onSubmit(d: z.infer<typeof schema>) {
    setLoading(true)
    try {
      await sigafApi.changeOwnPassword(d.current_password, d.new_password, d.confirm_password)
      toast.success('Contraseña actualizada')
      form.reset()
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.detail?.detail || 'Error al cambiar contraseña' : 'Error de red'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Header>
        <h2 className='text-lg font-semibold me-auto'>Cambiar contraseña</h2>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <Card className='max-w-md'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <KeyRound className='h-5 w-5' /> Cambiar mi contraseña
            </CardTitle>
            <CardDescription>
              La contraseña se actualiza en Oracle. Aplica para SIGAFPLUS legado y para el clon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className='grid gap-3'>
                <FormField
                  control={form.control}
                  name='current_password'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña actual</FormLabel>
                      <FormControl>
                        <PasswordInput {...field} autoComplete='current-password' />
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
                        <PasswordInput {...field} autoComplete='new-password' />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='confirm_password'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar nueva contraseña</FormLabel>
                      <FormControl>
                        <PasswordInput {...field} autoComplete='new-password' />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button disabled={loading} className='mt-2'>
                  {loading ? <Loader2 className='animate-spin' /> : <KeyRound />}
                  Actualizar
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
