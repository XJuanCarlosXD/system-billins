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
  logErrorAutomatico(mensaje || errMsg, { statusHttp, detalle })

  toast.error(errMsg, {
    action: {
      label: 'Reportar',
      onClick: () => {
        reportarErrorConCaptura(mensaje || errMsg, detalle)
          .then(() => toast.success('Error reportado. Gracias.'))
          .catch(() => toast.error('No se pudo reportar el error.'))
      },
    },
  })
}
