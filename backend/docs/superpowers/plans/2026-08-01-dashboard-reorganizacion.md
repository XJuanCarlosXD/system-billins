# Reorganizacion del Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reordenar el Dashboard a Bienvenida → ModuleLauncher → Actividad
reciente, eliminando las 6 secciones que el usuario percibe como ruido
irrelevante, y borrar los 4 archivos huérfanos con datos inventados del
template original.

**Architecture:** Edición de un solo componente (`Dashboard()`), simplificando
su estado y su `load()` a lo que realmente se consume. Sin cambios de
backend ni de otros componentes.

**Tech Stack:** React + TypeScript + Vite.

**Spec de referencia:** `docs/superpowers/specs/2026-08-01-dashboard-reorganizacion-design.md`

**Nota sobre testing:** sin test runner de frontend — se valida con
`npx tsc --noEmit -p tsconfig.app.json` (la config real de la app —
`tsconfig.json` en la raíz de `frontend/` NO sirve, tiene `"files": []` y
no compila nada; usar siempre `tsconfig.app.json` de aquí en adelante) y
smoke real con Playwright (`node <script>.mjs` desde `frontend/`, el
navegador chromium ya está instalado en esta máquina) contra
`https://abregonza.netlify.app`, con login real — no alcanza con curl
porque el bug de la sesión anterior (command-menu leyendo una propiedad
eliminada) solo se manifestaba con la app corriendo en el navegador.

**Antes de tocar la VM:** el frontend real se sirve desde Netlify
(`git push origin main`). La VM 10.0.0.99 solo tiene una copia de respaldo
del frontend, no lo sirve. Bajar la version viva de la VM y diffear contra
el baseline antes de subir, igual que en los dos planes anteriores.

---

### Task 1: Reescribir `Dashboard()`

**Files:**
- Modify: `frontend/src/features/dashboard/index.tsx`

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { History, RefreshCw, ShieldCheck } from 'lucide-react'
import { apiClient, type Me } from '@/lib/api-client'
import { historialMio, type EventoHistorial } from '@/lib/api-client-historial'
import { HistorialTimeline } from '@/features/historial/historial-timeline'
import { ModuleLauncher } from './components/module-launcher'

export function Dashboard() {
  const [me, setMe] = useState<Me | null>(null)
  const [miActividad, setMiActividad] = useState<EventoHistorial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    load()
  }, [])

  return (
    <>
      <Header>
        <h2 className='text-lg font-semibold me-auto'>Dashboard</h2>
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              Bienvenido{me ? `, ${me.username}` : ''}
              {me?.is_admin ? (
                <Badge className='gap-1 align-middle'>
                  <ShieldCheck className='h-3 w-3' />
                  Administrador
                </Badge>
              ) : me ? (
                <Badge variant='secondary' className='align-middle'>Usuario</Badge>
              ) : null}
            </h1>
            <p className='text-sm text-muted-foreground'>
              Selecciona un módulo para comenzar o revisa tu actividad reciente.
            </p>
          </div>
          <Button variant='outline' onClick={load} disabled={loading}>
            <RefreshCw className={`me-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </Button>
        </div>

        {error && (
          <Card className='mb-4 border-red-300 bg-red-50 dark:bg-red-950'>
            <CardContent className='py-3 text-sm text-red-700 dark:text-red-200'>
              {error}
            </CardContent>
          </Card>
        )}

        <div className='mb-4'>
          <ModuleLauncher />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <History className='h-5 w-5' />
              Mi actividad reciente
            </CardTitle>
            <CardDescription>
              Tus últimas acciones registradas en el sistema (crear, editar, anular).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className='h-32 w-full' />
            ) : (
              <HistorialTimeline eventos={miActividad} modo='compacto' />
            )}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
```

- [ ] **Step 2: Verificar tipos con la config correcta**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "features/dashboard/index"`
Expected: sin salida.

- [ ] **Step 3: Confirmar que no queda ninguna referencia a lo eliminado**

Run: `cd frontend && grep -n "NCFAlert\|dashboardVentasMes\|fatNcfAlerts\|VentaDia\|MES_NOMBRES\|fmtCurrency\|severityClass\|empresasActivas\|modulosConAcceso\|modulosUnicos" src/features/dashboard/index.tsx`
Expected: sin salida (0 coincidencias) — confirma que el componente no
quedó con imports o variables muertas de la version anterior.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/dashboard/index.tsx
git commit -m "feat(dashboard): reorganizar a Bienvenida + ModuleLauncher + Actividad reciente"
```

---

### Task 2: Borrar los componentes huérfanos con datos inventados

**Files:**
- Delete: `frontend/src/features/dashboard/components/analytics.tsx`
- Delete: `frontend/src/features/dashboard/components/analytics-chart.tsx`
- Delete: `frontend/src/features/dashboard/components/overview.tsx`
- Delete: `frontend/src/features/dashboard/components/recent-sales.tsx`

- [ ] **Step 1: Confirmar que nada los importa (doble check antes de borrar)**

Run: `cd frontend && grep -rn "from '\.\/components\/analytics\|from '\.\/components\/overview\|from '\.\/components\/recent-sales\|dashboard/components/analytics\|dashboard/components/overview\|dashboard/components/recent-sales" src --include=*.tsx`
Expected: sin salida, o únicamente coincidencias dentro de los propios 4
archivos a borrar (ej. `analytics.tsx` importando `analytics-chart.tsx`).
Si aparece un import desde OTRO archivo fuera de este grupo, detenerse y
avisar — significaría que sí están en uso y no deben borrarse.

- [ ] **Step 2: Borrar los 4 archivos**

```bash
rm frontend/src/features/dashboard/components/analytics.tsx
rm frontend/src/features/dashboard/components/analytics-chart.tsx
rm frontend/src/features/dashboard/components/overview.tsx
rm frontend/src/features/dashboard/components/recent-sales.tsx
```

- [ ] **Step 3: Verificar tipos de todo el proyecto (confirma que borrarlos no rompió nada)**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -iE "analytics|overview\.tsx|recent-sales"`
Expected: sin salida.

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src/features/dashboard/components/
git commit -m "chore(dashboard): eliminar componentes huerfanos del template (datos inventados sin uso)"
```

---

### Task 3: Desplegar y verificar con Playwright real

**Files:** ninguno nuevo — solo despliegue y verificación.

- [ ] **Step 1: Descargar la versión viva de la VM y diffear**

```bash
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  jcabreu@10.0.0.99:facturation-system/frontend/src/features/dashboard/index.tsx /tmp/vm_dashboard_check.tsx
```

Diffear contra el baseline pre-edición de este plan (`git show <SHA previo
a Task 1>:frontend/src/features/dashboard/index.tsx`) para confirmar que
no hay contenido exclusivo de la VM que se vaya a perder — mismo
procedimiento que en los dos planes anteriores de esta sesión.

- [ ] **Step 2: Push a origin/main**

```bash
git push origin main
```

- [ ] **Step 3: Esperar el build de Netlify y verificar el hash del bundle cambió**

```bash
curl -s https://abregonza.netlify.app/ | grep -oE 'src="/assets/index-[^"]+\.js"'
```

Repetir cada 15s hasta que el hash sea distinto al que estaba antes del
push (evidencia de que el nuevo build está sirviéndose).

- [ ] **Step 4: Login real con Playwright y verificar el contenido nuevo**

Desde `frontend/`, ejecutar un script equivalente a los `repro*.mjs` ya
usados en esta sesión (login con usuario `JCABREU` / contraseña
`Temp1234!`, esperar navegación a `/`, leer `page.locator('body').innerText()`).

Verificar en el texto capturado:
- Aparece "Bienvenido, JCABREU" seguido del grid de módulos (nombres de
  módulo como "Facturacion", "Cuentas por Cobrar", etc.) y más abajo "Mi
  actividad reciente".
- **NO** aparecen los textos "Empresas activas", "Módulos con acceso",
  "NCF críticos", "NCF en aviso", "Ventas del mes", "Mis accesos por
  módulo y empresa" — confirma que las 6 secciones fueron removidas.
- `page.on('pageerror', ...)` no captura ningún error (mismo patrón usado
  para detectar el crash de `command-menu.tsx` en la sesión anterior — no
  asumir que "no hay 500 visible" alcanza, confirmar explícitamente cero
  `pageerror` events).

Si aparece cualquier `pageerror`, o si el body text no contiene "Bienvenido"
seguido del grid, detenerse — no reportar como terminado.

---

## Auto-revisión del plan

- **Cobertura del spec:** §2 (nuevo orden) → Task 1 Step 1 (JSX
  reordenado). §3 (`load()` simplificado) → Task 1 Step 1. §4 (limpieza de
  huérfanos) → Task 2. §5 (fuera de alcance) no requiere tareas.
- **Lección aplicada de la sesión anterior:** este plan usa
  `tsconfig.app.json` explícitamente en cada verificación de tipos (no
  `tsconfig.json`, que no compila nada) y exige una verificación real con
  Playwright contra producción antes de dar el trabajo por terminado — no
  solo un `tsc` limpio, dado que el bug anterior era invisible para `tsc`
  con la config equivocada y también invisible para un `curl` estático
  (dependía de ejecución real en el navegador tras login).
- **Sin placeholders:** todos los pasos de código tienen contenido
  completo; Task 3 Step 4 no trae el script `.mjs` completo porque ya
  existen 3 variantes funcionando en `frontend/repro*.mjs` de esta misma
  sesión para adaptar, no hace falta reescribirlo desde cero.
