import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { logErrorAutomatico, mensajeDeError, reportarErrorConCaptura } from './report-error'

export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(error)
  }

  let errMsg = 'Something went wrong!'

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = 'No content.'
  }

  if (error instanceof AxiosError) {
    const title = error.response?.data?.title
    if (typeof title === 'string' && title.length > 0) {
      errMsg = title
    }
  }

  const { mensaje, statusHttp, detalle } = mensajeDeError(error)
  // mensajeDeError solo extrae el status de ApiError; AxiosError (usado en
  // otras mutaciones, ver chequeo de arriba) hereda de Error y cae en la
  // rama generica sin status. Lo resolvemos aparte para no perder el 401.
  const status = error instanceof AxiosError ? error.response?.status : statusHttp
  const isSessionExpired = status === 401

  // Un 401 durante una mutacion es expiracion de sesion, no un error real:
  // no lo registramos ni ofrecemos "Reportar" (mismo criterio que
  // queryCache.onError en main.tsx). El toast en si se mantiene igual.
  if (!isSessionExpired) {
    logErrorAutomatico(mensaje || errMsg, { statusHttp: status, detalle })
  }

  toast.error(
    errMsg,
    isSessionExpired
      ? undefined
      : {
          action: {
            label: 'Reportar',
            onClick: () => {
              reportarErrorConCaptura(mensaje || errMsg, detalle)
                .then(() => toast.success('Error reportado. Gracias.'))
                .catch(() => toast.error('No se pudo reportar el error.'))
            },
          },
        }
  )
}
