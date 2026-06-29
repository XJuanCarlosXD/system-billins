import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/asistente')({
  component: AsistentePage,
})

function AsistentePage() {
  return (
    <div className='flex h-svh flex-col items-center justify-center gap-4 px-6 text-center'>
      <h1 className='text-2xl font-semibold'>Asistente</h1>
      <p className='max-w-md text-sm text-muted-foreground'>
        El chat del asistente estará disponible en la próxima entrega. Por
        ahora puedes abrir esta página y los endpoints del backend ya están en
        línea para hacer smoke tests.
      </p>
    </div>
  )
}
