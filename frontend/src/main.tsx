import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { AxiosError } from 'axios'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { handleServerError } from '@/lib/handle-server-error'
import { ApiError } from '@/lib/regal-general-api'
import { logErrorAutomatico, mensajeDeError, reportarErrorConCaptura } from '@/lib/report-error'
import { DirectionProvider } from './context/direction-provider'
import { FontProvider } from './context/font-provider'
import { ThemeProvider } from './context/theme-provider'
import { CompanyProvider } from './context/company-context'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import './styles/index.css'

// Helper: extrae el status de cualquier error (ApiError de fetch o AxiosError).
function errorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status
  if (error instanceof AxiosError) return error.response?.status
  return undefined
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry mas estricto:
      //  - 0 retries en DEV (feedback rapido)
      //  - 0 retries en 4xx (cliente: no se arregla retentando)
      //  - max 1 retry en 5xx/red en PROD
      // Antes: hacia hasta 3 retries en todo (incluso 401/403 porque chequeaba
      // solo AxiosError y este codigo usa fetch). Resultado: network storm de
      // 4 requests por cada query fallida en /settings.
      retry: (failureCount, error) => {
        if (import.meta.env.DEV) return false
        const status = errorStatus(error)
        if (status !== undefined && status >= 400 && status < 500) return false
        return failureCount < 1
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      refetchOnWindowFocus: false, // antes: true en PROD — disparaba refetch
                                   // masivo de todas las queries activas al
                                   // volver a la pestana, otra fuente de storm.
      staleTime: 2 * 60 * 1000,
    },
    mutations: {
      onError: (error) => {
        handleServerError(error)
        if (errorStatus(error) === 304) {
          toast.error('Content not modified!')
        }
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      const status = errorStatus(error)
      if (status === 401) {
        // Solo redirigir si no estamos ya en sign-in (evita loop).
        const path = router.history.location.pathname
        if (!path.startsWith('/sign-in')) {
          useAuthStore.getState().auth.reset()
          const redirect = router.history.location.href
          router.navigate({ to: '/sign-in', search: { redirect } })
        }
        return
      }
      const { mensaje, statusHttp, detalle } = mensajeDeError(error)
      logErrorAutomatico(mensaje, { statusHttp, detalle })
      if (status === 500 && import.meta.env.PROD) {
        // toast solo, no navegar (la navegacion automatica a /500 saca al
        // usuario de su flujo cuando un endpoint puntual falla).
        toast.error('Error interno del servidor.', {
          action: {
            label: 'Reportar',
            onClick: () => {
              reportarErrorConCaptura(mensaje, detalle)
                .then(() => toast.success('Error reportado. Gracias.'))
                .catch(() => toast.error('No se pudo reportar el error.'))
            },
          },
        })
      }
    },
  }),
})

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FontProvider>
            <DirectionProvider>
              <CompanyProvider>
                <RouterProvider router={router} />
              </CompanyProvider>
            </DirectionProvider>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
