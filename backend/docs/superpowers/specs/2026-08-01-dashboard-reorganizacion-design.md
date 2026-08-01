# Spec — Reorganizar el Dashboard alrededor del ModuleLauncher

- Fecha: 2026-08-01
- Autor: JCABREU + Claude
- Estado: aprobado para implementación
- Alcance: `frontend/src/features/dashboard/index.tsx` y limpieza de
  `frontend/src/features/dashboard/components/`. No toca `ModuleLauncher`
  (ya construido y funcionando), ni ninguna otra pantalla.

## 0. Motivación

El `ModuleLauncher` (grid estilo Odoo) quedó insertado arriba del Dashboard
existente, pero el resto de la página sigue mostrando las mismas 7
secciones de antes (KPIs de empresas/módulos/NCF, card de Alertas NCF, card
de Empresas, gráfico de Ventas del mes, "Mis accesos por módulo y
empresa"). El usuario las percibe como ruido irrelevante frente al
launcher — quiere una página enfocada: bienvenida, launcher, actividad
reciente, y nada más. De paso, el directorio `features/dashboard/components/`
tiene 4 archivos del template shadcn-admin original (`analytics.tsx`,
`analytics-chart.tsx`, `overview.tsx`, `recent-sales.tsx`) con datos
inventados ("Total Clicks: 1,248", "Bounce Rate: 42%", "Referrers: Product
Hunt") que no se usan en ninguna ruta — confirmado por grep, cero imports
fuera de sí mismos.

## 1. Qué ya existe (no se toca)

- `ModuleLauncher` (`features/dashboard/components/module-launcher.tsx`) —
  construido y verificado end-to-end en la sesión anterior. No cambia.
- `HistorialTimeline` (`features/historial/historial-timeline.tsx`) y
  `historialMio()` (`lib/api-client-historial.ts`) — la card "Mi actividad
  reciente" se reutiliza tal cual, solo cambia su posición en la página.
- `apiClient.me()` — sigue siendo necesario para el saludo "Bienvenido,
  {username}" y el badge Administrador/Usuario.
- Los endpoints que se dejan de llamar (`apiClient.fatNcfAlerts`,
  `apiClient.dashboardVentasMes`) no se tocan ni se eliminan del backend —
  simplemente el Dashboard deja de invocarlos. Siguen disponibles para
  quien los necesite (ej. la pantalla `/ncf-alerts` completa).

## 2. Nuevo orden de contenido en `Dashboard()`

De arriba a abajo, dentro de `<Main>`:

1. Encabezado de bienvenida (sin cambios de contenido): "Bienvenido,
   {username}" + badge Administrador/Usuario + descripción + botón
   Refrescar. Se mantiene arriba de todo — es lo primero que se ve.
2. `<ModuleLauncher />` — el grid de módulos + fila de shortcuts.
3. Card "Mi actividad reciente" (`HistorialTimeline`) — se mueve de ser la
   última sección a ser la segunda, justo debajo del launcher.

Todo lo demás desaparece de esta página:
- Las 4 KPI cards (Empresas activas, Módulos con acceso, NCF críticos, NCF
  en aviso).
- La card "Alertas NCF" con el detalle de rangos por vencer.
- La card "Empresas" con el listado de compañías activas.
- La card "Ventas del mes" (gráfico de barras).
- La card "Mis accesos por módulo y empresa".

El botón "Refrescar" se mantiene (ahora solo re-dispara `me()` +
`historialMio()`), y el manejo de `error` (banner rojo) se mantiene igual
por si esas dos llamadas fallan.

## 3. Simplificación de `load()`

```ts
async function load() {
  setLoading(true)
  setError(null)
  try {
    const [meRes, historialRes] = await Promise.all([
      apiClient.me(),
      historialMio(8).catch(() => ({ items: [] })),
    ])
    setMe(meRes)
    setMiActividad(historialRes.items)
  } catch (e: any) {
    setError(e.message ?? 'Error al cargar dashboard')
  } finally {
    setLoading(false)
  }
}
```

Se eliminan del componente: el estado `alerts`, el estado `ventas`, las
constantes/helpers que solo servían para esas secciones (`VentaDia`,
`MES_NOMBRES`, `fmtCurrency`, `severityClass`), y los imports que quedan
sin uso (`AlertTriangle`, `Building2`, `CheckCircle2`, `TrendingUp`,
`Receipt`, los componentes de `recharts`, `NCFAlert` de `api-client`, y los
componentes de `Card`/`Badge` que ya no apliquen — `Card` sigue haciendo
falta para "Mi actividad reciente"; `Badge` sigue haciendo falta para el
badge Administrador/Usuario).

## 4. Limpieza de archivos huérfanos

Eliminar (confirmado sin ningún import fuera de sí mismos):
- `frontend/src/features/dashboard/components/analytics.tsx`
- `frontend/src/features/dashboard/components/analytics-chart.tsx`
- `frontend/src/features/dashboard/components/overview.tsx`
- `frontend/src/features/dashboard/components/recent-sales.tsx`

## 5. Fuera de alcance

- Auditar/agregar secciones "Configuración" faltantes por módulo (ej.
  Facturación no tiene una en su sidebar aunque las pantallas —
  Companias, Puntos, Tipos Documento, Listas Precio — ya existen y
  funcionan). Confirmado con el usuario: es un spec aparte, después de
  este.
- Corregir el hardcoding a `no_cia='01'` de `dashboardVentasMes` — queda
  sin efecto porque la card que lo usaba se elimina, no porque se arregle.
  Si en el futuro se quiere traer de vuelta un widget de ventas, ese fix
  se retoma en ese momento.
- Cambiar `ModuleLauncher` — ya está construido y verificado, este spec
  solo reordena lo que va alrededor de él.
- Tocar el backend (`DashboardVentasMesView`, `fatNcfAlerts`) — endpoints
  intactos, solo dejan de tener un caller en esta pantalla.
