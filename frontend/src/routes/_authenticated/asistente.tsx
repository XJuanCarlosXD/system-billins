import { createFileRoute, Outlet } from '@tanstack/react-router'

// Layout shell del asistente. Las paginas hijas (index, admin/skills, etc.)
// renderizan dentro del <Outlet/>. Sin Header global: el asistente usa pantalla
// completa con su propio shell de 3 columnas.
export const Route = createFileRoute('/_authenticated/asistente')({
  component: AsistenteLayout,
})

function AsistenteLayout() {
  return <Outlet />
}
