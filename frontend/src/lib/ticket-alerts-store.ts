// Almacenamiento "reconocido" para la alerta global de tickets propios
// (Reportes de Problemas). Un ticket queda pendiente de alerta mientras su
// fecha_actualizacion no coincida con la última que el usuario aceptó.
// Cerrar la alerta sin aceptar (X / Escape / clic afuera) solo la oculta por
// el resto de esta pestaña — vuelve a aparecer en la próxima carga.
const ACK_PREFIX = 'zerp.ticketalert.ack.'
const DISMISSED_SESSION_KEY = 'zerp.ticketalert.dismissedSession'
const BASELINED_KEY = 'zerp.ticketalert.baselined'

/**
 * Antes de este feature ya existían tickets resueltos/cancelados/en HOLD.
 * En el primer polling de cada navegador los marcamos como reconocidos sin
 * mostrarlos, para no volcarle al usuario todo el historial de una vez —
 * solo se alerta sobre cambios de estado que ocurran de ahora en adelante.
 */
export function hasBaseline() {
  try {
    return localStorage.getItem(BASELINED_KEY) === '1'
  } catch {
    return true // si localStorage falla, mejor no alertar sobre el historial
  }
}

export function setBaselined() {
  try {
    localStorage.setItem(BASELINED_KEY, '1')
  } catch {
    /* ignore */
  }
}

function ackKey(reporteId: string) {
  return `${ACK_PREFIX}${reporteId}`
}

export function isAcknowledged(reporteId: string, fechaActualizacion: string) {
  try {
    return localStorage.getItem(ackKey(reporteId)) === fechaActualizacion
  } catch {
    return false
  }
}

export function acknowledge(reporteId: string, fechaActualizacion: string) {
  try {
    localStorage.setItem(ackKey(reporteId), fechaActualizacion)
  } catch {
    /* ignore */
  }
}

function dismissedSetThisSession(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_SESSION_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function dismissToken(reporteId: string, fechaActualizacion: string) {
  return `${reporteId}:${fechaActualizacion}`
}

export function isDismissedThisSession(
  reporteId: string,
  fechaActualizacion: string
) {
  return dismissedSetThisSession().has(dismissToken(reporteId, fechaActualizacion))
}

export function dismissThisSession(reporteId: string, fechaActualizacion: string) {
  try {
    const set = dismissedSetThisSession()
    set.add(dismissToken(reporteId, fechaActualizacion))
    sessionStorage.setItem(DISMISSED_SESSION_KEY, JSON.stringify([...set]))
  } catch {
    /* ignore */
  }
}
