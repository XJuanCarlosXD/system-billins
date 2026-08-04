import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/_authenticated/403')({
  component: ForbiddenPage,
})

function ForbiddenPage() {
  const nav = useNavigate()
  return (
    <div className='grid min-h-[60vh] place-items-center p-6'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <Lock className='mx-auto mb-2 h-12 w-12 text-muted-foreground' />
          <CardTitle>Acceso denegado</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3 text-center'>
          <p className='text-sm text-muted-foreground'>
            No tienes permisos para ver este modulo. Contacta al administrador
            para solicitar acceso.
          </p>
          <Button onClick={() => nav({ to: '/dashboard' })}>
            Ir al inicio
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
