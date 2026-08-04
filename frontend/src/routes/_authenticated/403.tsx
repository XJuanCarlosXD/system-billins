import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/403')({
  component: ForbiddenPage,
})

function ForbiddenPage() {
  const nav = useNavigate()
  return (
    <div className="grid place-items-center min-h-[60vh] p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <CardTitle>Acceso denegado</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            No tienes permisos para ver este modulo. Contacta al administrador
            para solicitar acceso.
          </p>
          <Button onClick={() => nav({ to: '/dashboard' })}>Ir al inicio</Button>
        </CardContent>
      </Card>
    </div>
  )
}
