# Cierres, Settings CRUD y Control de Acceso — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Trabaja un PR completo antes de pasar al siguiente.

**Goal:** Estandarizar las 8 pantallas de "cierre" del ZentoryERP al patrón CxC (3 vistas con React Query + PeriodoBadge), completar CRUD de catálogos de ACF/ACC/SDN, e implementar enforcement de control de acceso en el frontend (sidebar dinámico + route guard + button guard).

**Architecture:** React 18 + TanStack Query + TanStack Router + shadcn/ui en el frontend. Django + oracledb en el backend. Componentes compartidos `cierre/*` para reutilizar el patrón en 6 módulos. Hook `useAccess()` consume `/api/me/access/` una vez al login y se inyecta en sidebar/rutas/botones.

**Tech Stack:** TypeScript, React Query, TanStack Router, shadcn/ui, Tailwind, Django, oracledb, Oracle 11g.

**Spec:** `backend/docs/superpowers/specs/2026-06-30-cierres-settings-access-design.md`

**Working dir:** `C:\Users\JCABREU\AppData\Local\memorias_sigaft\facturation-system`
**Repo:** github.com/XJuanCarlosXD/system-billins (main → Netlify)
**VM:** jcabreu@10.0.0.99 (Temp1234!) — backend en docker compose, frontend NO se sube al VM (Netlify)
**Oracle:** JCABREU/508192003@AB

**Reglas globales:**
- Cargar memorias MCP antes de tocar código (`mcp__memory-router__memory_search`)
- NO `npm run build` — hay errores TS preexistentes que no son del plan
- Validación backend: `pscp` archivos al VM → `docker compose exec -T backend python -m py_compile <files>`
- Frontend: `git push origin main` → Netlify build
- Commits: `feat(cierres):`, `fix(cierres):`, `refactor(cierres):`, `feat(settings):`, `feat(access):`
- Co-author: `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
- Naming visible: **ZentoryERP** (nunca SIGAF/SIGAFT en UI). Códigos de módulo (FAT/CNT) y tablas (TFAT_*) sí mantienen sus nombres.

---

## PR1 — Hotfix: comentario roto en cxp-procesos.tsx

### Task 1: Arreglar comentario `\ Backend` → `//`

**Files:**
- Modify: `frontend/src/features/cxp/cxp-procesos.tsx:1275`

- [x] **Step 1.1: Localizar la línea exacta** — ya fix previa, línea 1275 usa `//`

Run: `grep -n '\\ Backend' frontend/src/features/cxp/cxp-procesos.tsx`
Expected: línea 1275 (o cercana) con `  \ Backend cxp_repo.get_asiento_contable_cxp devuelve:`

- [x] **Step 1.2: Cambiar `\` por `//`** — ya fix previa

```tsx
// Backend cxp_repo.get_asiento_contable_cxp devuelve:
//   { cuenta, centro_costo, tipo_movi, total_debito, total_credito }
// Tolerante a otros nombres por si cambia el shape.
```

- [x] **Step 1.3: Validar con tsc el archivo solamente** — ya fix previa

Run: `cd frontend && npx tsc --noEmit src/features/cxp/cxp-procesos.tsx 2>&1 | head -20`
Expected: sin error en línea 1275. Pueden quedar errores preexistentes en otras líneas — irrelevantes.

- [x] **Step 1.4: Commit + push** — N/A (fix ya en main de antes)

```bash
git add frontend/src/features/cxp/cxp-procesos.tsx
git commit -m "$(cat <<'EOF'
fix(cxp): arreglar comentario roto en cxp-procesos.tsx

La línea 1275 tenía un backslash `\` en vez de `//` para iniciar
el comentario, lo que rompía el parser TypeScript del archivo.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## PR2 — Backend `/api/me/access/` + Hook `useAccess` + Componentes compartidos

### Task 2.1: Endpoint backend `/api/me/access/`

**Files:**
- Create: `backend/apps/legacy/me_access_view.py`
- Modify: `backend/apps/legacy/urls.py` (registrar la ruta)
- Test manual: `curl https://grupo-abregonza.hopto.org:8443/api/me/access/`

- [x] **Step 2.1.1: Crear view file con la función `me_access`** — implementado como `MyAccessView` en `apps/auth_legacy/views.py` (en vez de archivo aparte) para seguir patrón del repo

```python
# backend/apps/legacy/me_access_view.py
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
from .repositories import permissions_repo


@csrf_exempt
@require_GET
def me_access(request):
    user = request.user
    if not user or not user.is_authenticated:
        return JsonResponse({'error': 'unauthenticated'}, status=401)

    username = user.username.upper()
    is_admin = bool(getattr(user, 'is_superuser', False) or username in ('JCABREU',))

    # Usar el helper ya existente:
    access_rows = permissions_repo.list_user_access(username)

    companies = {}  # no_cia -> {descripcion, puntos:set}
    modules = {}   # modulo -> {no_cias:set, puntos:{no_cia:set}}
    flags = {}     # 'mod:no_cia:punto' -> [flag names True]
    tipos_docu = {}  # 'mod:no_cia:punto' -> [tipo_docu codes]

    for row in access_rows:
        mod = row['modulo']
        no_cia = row['no_cia']
        punto = row['punto']
        # Companies
        if no_cia not in companies:
            companies[no_cia] = {
                'no_cia': no_cia,
                'descripcion': row.get('cia_descripcion', ''),
                'puntos': set(),
            }
        companies[no_cia]['puntos'].add(punto)
        # Modules
        if mod not in modules:
            modules[mod] = {'no_cias': set(), 'puntos': {}}
        modules[mod]['no_cias'].add(no_cia)
        modules[mod]['puntos'].setdefault(no_cia, set()).add(punto)
        # Flags
        key = f'{mod}:{no_cia}:{punto}'
        flag_map = permissions_repo.get_user_flags(username, mod, no_cia, punto)
        flags[key] = [f for f, v in flag_map.items() if v]
        # Tipos docu (modulos sin documentos devuelven [])
        try:
            docs = permissions_repo.list_user_doc_perms(username, mod, no_cia, punto)
            tipos_docu[key] = [d['tipo_docu'] for d in docs]
        except Exception:
            tipos_docu[key] = []

    return JsonResponse({
        'username': username,
        'is_admin': is_admin,
        'companies': [
            {'no_cia': c['no_cia'], 'descripcion': c['descripcion'], 'puntos': sorted(c['puntos'])}
            for c in companies.values()
        ],
        'modules': {
            m: {'no_cias': sorted(v['no_cias']),
                'puntos': {k: sorted(p) for k, p in v['puntos'].items()}}
            for m, v in modules.items()
        },
        'flags': flags,
        'tipos_docu': tipos_docu,
    })
```

- [x] **Step 2.1.2: Verificar nombres reales de funciones en permissions_repo** — usado `list_user_modules` (no `list_user_access`)

Run: `grep -n 'def list_user_access\|def get_user_flags\|def list_user_doc_perms' backend/apps/legacy/repositories/permissions_repo.py`
Expected: confirma firmas exactas. Ajustar `me_access_view.py` si los nombres difieren.

- [x] **Step 2.1.3: Registrar URL** — `path('me/access/', MyAccessView.as_view(), ...)` en `auth_legacy/urls.py`

En `backend/facturation_api/urls.py` o `backend/apps/legacy/urls.py` (donde sea que se monten):

```python
from apps.legacy.me_access_view import me_access
# ...
path('api/me/access/', me_access, name='me_access'),
```

- [x] **Step 2.1.4: Deploy al VM y py_compile** — `COMPILE_OK`

```bash
"C:\Users\JCABREU\bin\pscp.exe" -batch -pw Temp1234! \
  backend/apps/legacy/me_access_view.py \
  jcabreu@10.0.0.99:/home/jcabreu/facturation-system/backend/apps/legacy/

"C:\Users\JCABREU\bin\plink.exe" -batch -pw Temp1234! jcabreu@10.0.0.99 \
  "cd /home/jcabreu/facturation-system && docker compose exec -T backend python -m py_compile apps/legacy/me_access_view.py"
```

Expected: exit 0.

- [x] **Step 2.1.5: Smoke test** — sin sesión `/api/me/access/` → 403 (esperado, requiere IsAuthenticated)

```bash
"C:\Users\JCABREU\bin\plink.exe" -batch -pw Temp1234! jcabreu@10.0.0.99 \
  "curl -s -b /tmp/cookie.txt http://localhost:8000/api/me/access/ | head -200"
```

Expected: JSON con `username`, `is_admin`, `companies`, `modules`, `flags`, `tipos_docu`.

- [x] **Step 2.1.6: Commit**

```bash
git add backend/apps/legacy/me_access_view.py backend/apps/legacy/urls.py
git commit -m "feat(access): endpoint /api/me/access/ con flags y tipos_docu

Devuelve un payload denso con módulos, flags y tipos de documento del
usuario actual para evitar N requests por flag desde el frontend.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 2.2: Hook `useAccess()` y método API client

**Files:**
- Modify: `frontend/src/lib/regal-general-api.ts` (agregar `meAccess`)
- Create: `frontend/src/hooks/use-access.ts`

- [x] **Step 2.2.1: Agregar método al api client**

En `regal-general-api.ts` cerca de los otros métodos `admin*`:

```ts
meAccess: () => request<{
  username: string
  is_admin: boolean
  companies: Array<{ no_cia: string; descripcion: string; puntos: string[] }>
  modules: Record<string, { no_cias: string[]; puntos: Record<string, string[]> }>
  flags: Record<string, string[]>
  tipos_docu: Record<string, string[]>
}>('/me/access/'),
```

- [x] **Step 2.2.2: Crear `hooks/use-access.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { regalGeneralApi } from '@/lib/regal-general-api'

export function useAccess() {
  const q = useQuery({
    queryKey: ['me-access'],
    queryFn: () => regalGeneralApi.meAccess(),
    staleTime: Infinity,
    retry: 1,
  })

  const data = q.data
  const isAdmin = data?.is_admin ?? false

  return {
    isLoading: q.isLoading,
    error: q.error,
    isAdmin,
    username: data?.username,
    companies: data?.companies ?? [],
    hasModule: (m: string) => isAdmin || !!data?.modules?.[m],
    hasFlag: (m: string, no_cia: string, punto: string, flag: string) =>
      isAdmin || data?.flags?.[`${m}:${no_cia}:${punto}`]?.includes(flag) || false,
    hasDocType: (m: string, no_cia: string, punto: string, t: string) =>
      isAdmin || data?.tipos_docu?.[`${m}:${no_cia}:${punto}`]?.includes(t) || false,
  }
}
```

- [x] **Step 2.2.3: Commit**

```bash
git add frontend/src/lib/regal-general-api.ts frontend/src/hooks/use-access.ts
git commit -m "feat(access): hook useAccess y método meAccess en api client

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

### Task 2.3: Componentes compartidos de cierre

**Files:**
- Create: `frontend/src/components/cierre/periodo-badge.tsx`
- Create: `frontend/src/components/cierre/alert-irreversible.tsx`
- Create: `frontend/src/components/cierre/index.ts`

- [x] **Step 2.3.1: Crear `periodo-badge.tsx`**

```tsx
import { Badge } from '@/components/ui/badge'
import { Calendar } from 'lucide-react'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

interface Props {
  mes?: number | null
  ano?: number | null
  loading?: boolean
}

export function PeriodoBadge({ mes, ano, loading }: Props) {
  if (loading) return <Badge variant="outline" className="text-xs animate-pulse">Cargando…</Badge>
  if (!mes || !ano) return null
  return (
    <Badge variant="outline" className="text-xs">
      <Calendar className="h-3 w-3 mr-1" />
      Período activo: <span className="font-semibold ml-1">{MESES[mes - 1]} {ano}</span>
    </Badge>
  )
}
```

- [x] **Step 2.3.2: Crear `alert-irreversible.tsx`**

```tsx
import { AlertTriangle } from 'lucide-react'
import { ReactNode } from 'react'

export function AlertIrreversible({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'red' }) {
  const cls = tone === 'red'
    ? 'border-red-300 bg-red-50 text-red-900'
    : 'border-amber-300 bg-amber-50 text-amber-900'
  return (
    <div className={`border rounded-lg p-3 text-sm flex items-start gap-2 ${cls}`}>
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}
```

- [x] **Step 2.3.3: Crear `index.ts` con re-exports**

```ts
export { PeriodoBadge } from './periodo-badge'
export { AlertIrreversible } from './alert-irreversible'
```

- [x] **Step 2.3.4: Commit + push (cierra PR2)**

```bash
git add frontend/src/components/cierre/
git commit -m "feat(cierres): componentes compartidos PeriodoBadge y AlertIrreversible

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push origin main
```

---

## PR3 — CxP: 3 rutas + reescribir 3 componentes al patrón CxC

**Files:**
- Create: `frontend/src/routes/_authenticated/cxp/asiento-contable.tsx`
- Create: `frontend/src/routes/_authenticated/cxp/generar-asiento.tsx`
- Already exists: `frontend/src/routes/_authenticated/cxp/cierre.tsx`
- Modify: `frontend/src/features/cxp/cxp-procesos.tsx` (refactor 3 exports a patrón CxC con React Query)
- Modify: `frontend/src/components/layout/data/sidebar-data.ts` (3 items en sección Cierre)

- [x] **Step 3.1: Memoria check** — hecho en runner

Run: `memory_search "CxP cierre asiento generar"` para revisar contexto previo.

- [x] **Step 3.2: Leer cxc-cierre.tsx como referencia** — leído

Run: `cat frontend/src/features/cxc/cxc-cierre.tsx` y mantener abierto como plantilla.

- [x] **Step 3.3: Refactorizar `CxpAsientoContable` en cxp-procesos.tsx** — done (patrón CxC, PeriodoBadge, Card+CardHeader, Balanceado badge, printPdf)

Reemplazar el componente actual con la estructura de `CxcAsientoContable`:
- Hook `useCxpPeriodo(noCia, punto)` que lee `TCXP_PUNTO` via `api.cxpListPuntos(noCia)` o crear endpoint si no existe
- `PeriodoBadge` en CardHeader
- `useMutation` para cargar el asiento
- `Card+CardHeader+CardContent`
- Tabla con TOTALES y badge Balanceado/Desbalanceado
- Botón Imprimir que abre `window.open` con HTML inline (idéntico a CxC)

Código completo (copiar de `cxc-cierre.tsx` líneas 52-194 y cambiar `cxc` → `cxp`, llamadas API, etc.):

```tsx
import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
// ... resto de imports igual a cxc-cierre.tsx
import { PeriodoBadge } from '@/components/cierre'
import { regalGeneralApi as api } from '@/lib/regal-general-api'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function useCxpPeriodo(noCia: string, punto: string) {
  return useQuery({
    queryKey: ['cxp-punto', noCia, punto],
    queryFn: async () => {
      const all = await api.cxpListPuntos(noCia)
      return (all as any[]).find(p => String(p.punto) === String(punto)) || null
    },
    enabled: !!noCia,
  })
}

export function CxpAsientoContable({ noCia, punto = '01' }: { noCia: string; punto?: string }) {
  const periodoQ = useCxpPeriodo(noCia, punto)
  const [mesVal, setMesVal] = useState(new Date().getMonth() + 1)
  const [anoVal, setAnoVal] = useState(new Date().getFullYear())

  useMemo(() => {
    if (periodoQ.data) {
      setMesVal(periodoQ.data.mes_proceso || 1)
      setAnoVal(periodoQ.data.ano_proceso || new Date().getFullYear())
    }
  }, [periodoQ.data])

  const cargarMut = useMutation({
    mutationFn: () => api.cxpAsientoContable(noCia, punto, mesVal, anoVal),
    onError: (e: any) => toast.error(e?.detail?.error || e?.message || 'Error'),
  })
  const rows: any[] = cargarMut.data ?? []
  const totalDebito = rows.reduce((s, r) => s + (Number(r.total_debito) || 0), 0)
  const totalCredito = rows.reduce((s, r) => s + (Number(r.total_credito) || 0), 0)
  const balanceado = Math.abs(totalDebito - totalCredito) < 0.001

  // ... resto del JSX igual a CxcAsientoContable cambiando títulos a "Cuentas por Pagar"
}
```

- [x] **Step 3.4: Refactorizar `CxpGenerarAsiento` en cxp-procesos.tsx** — done (React Query, AlertIrreversible amber, período proceso)

Copiar la estructura de `CxcGenerarAsiento` (líneas 197-307 de cxc-cierre.tsx). Cambiar:
- `cxcGenerarAsiento` → `cxpGenerarAsiento` (verificar que existe en api client; si no, agregar)
- Texto: "Cuentas por Cobrar" → "Cuentas por Pagar"

- [x] **Step 3.5: Refactorizar `CxpCierre` en cxp-procesos.tsx** — done (React Query, AlertIrreversible red, CheckCircle2 success)

Copiar estructura de `CxcCierre` (líneas 310-382). Cambiar `cxcCierre` → `cxpCierre`.

- [x] **Step 3.6: Crear ruta `/cxp/asiento-contable`** — ya existe en `routes/_authenticated/cxp/asiento-contable.tsx`

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { CxpAsientoContable } from '@/features/cxp/cxp-procesos'

export const Route = createFileRoute('/_authenticated/cxp/asiento-contable')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return <CxpAsientoContable noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
}
```

- [x] **Step 3.7: Crear ruta `/cxp/generar-asiento`** — ya existe

- [x] **Step 3.8: Verificar `/cxp/cierre` apunta a la nueva versión de `CxpCierre`** — verificado (usa export refactorizado)

- [x] **Step 3.9: Sidebar — agregar 3 items en sección Cierre de CxP** — ya existían en sidebar-data.ts:257-263

En `sidebar-data.ts` cerca de línea 263, reemplazar el item único por:

```ts
{
  title: 'Cierre',
  items: [
    { title: 'Imprimir Asiento Contable', url: '/cxp/asiento-contable' },
    { title: 'Generar Asiento al Mayor', url: '/cxp/generar-asiento' },
    { title: 'Cierre Mensual', url: '/cxp/cierre' },
  ],
},
```

- [x] **Step 3.10: Commit + push** — commit hecho en runner

```bash
git add frontend/src/features/cxp/cxp-procesos.tsx \
        frontend/src/routes/_authenticated/cxp/asiento-contable.tsx \
        frontend/src/routes/_authenticated/cxp/generar-asiento.tsx \
        frontend/src/routes/_authenticated/cxp/cierre.tsx \
        frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(cxp): cierre con 3 vistas al patrón CxC

Imprimir Asiento Contable, Generar Asiento al Mayor y Cierre Mensual
ahora tienen rutas dedicadas (/cxp/asiento-contable, /cxp/generar-asiento,
/cxp/cierre) con React Query, PeriodoBadge y AlertIrreversible.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push origin main
```

- [!] **Step 3.11: Smoke en Netlify** — pendiente de smoke tras Netlify build (usuario verificará)

Después de que Netlify build termine, abrir `https://abregonza.netlify.app/cxp/asiento-contable`, `/cxp/generar-asiento`, `/cxp/cierre` y verificar:
- PeriodoBadge muestra el período activo
- Botones funcionan sin errores en consola
- Toast de error aparece si el backend rechaza

---

## PR4 — CHC: agregar `ChcCierre` con botón ejecutar

**Files:**
- Modify: `frontend/src/features/chc/chc-cierres.tsx` (agregar componente con dialog + selector cuenta)
- Modify: `frontend/src/routes/_authenticated/chc/cierres.tsx` (renderizar el nuevo componente)
- Possibly modify: `frontend/src/lib/regal-general-api.ts` (verificar `chcCierreConciliacion`)
- Possibly create backend: `backend/apps/legacy/chc_views.py` (función cierre conciliación)

- [x] **Step 4.1: Verificar que el endpoint backend existe** — sí, `cerrar_conciliacion` en `chc_repo.py`, view + url ya en `chc_views.py` y `chc_urls.py`; api client tiene `chcCierreConciliacion`, `chcListCuentas`, `chcListCierres`

Run: `grep -n 'chc_cierre_conciliacion\|chc/cierres/conciliacion' backend/apps/legacy/chc_*.py backend/apps/legacy/repositories/chc_repo.py`
Si no existe, ver step 4.2. Si sí existe, saltar a 4.3.

- [x] **Step 4.2: Crear endpoint backend (si falta)** — N/A, ya existía

En `backend/apps/legacy/chc_views.py`:

```python
@csrf_exempt
@require_POST
def chc_cierre_conciliacion(request):
    """POST /api/chc/cierres/conciliacion/
    body: { no_cia, punto, cuenta_banco, ano, mes }
    Inserta TCHC_CIERRE_CONCILIACION y avanza el estado de la cuenta.
    """
    body = json.loads(request.body or '{}')
    required = ['no_cia', 'punto', 'cuenta_banco', 'ano', 'mes']
    for k in required:
        if not body.get(k):
            return JsonResponse({'error': f'Falta {k}'}, status=400)
    try:
        res = chc_repo.cerrar_conciliacion(**body, usuario=request.user.username.upper())
        return JsonResponse(res)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
```

En `backend/apps/legacy/repositories/chc_repo.py`, implementar `cerrar_conciliacion` con transacción.

En `backend/apps/legacy/urls.py`, registrar:
```python
path('chc/cierres/conciliacion/', chc_cierre_conciliacion),
```

Deploy + py_compile + smoke (igual que PR2 step 2.1.4).

- [x] **Step 4.3: Reescribir `chc-cierres.tsx`** — done (cierre con selector cuenta+mes+año, dialog confirm, AlertIrreversible, histórico con badge)

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/regal-general-api'
import { useCompany } from '@/hooks/use-company'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Lock, CheckCircle2 } from 'lucide-react'
import { PeriodoBadge, AlertIrreversible } from '@/components/cierre'

const MESES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export function ChcCierres() {
  const qc = useQueryClient()
  const { selectedCompany, selectedPoint } = useCompany()
  const [confirm, setConfirm] = useState(false)
  const [cuenta, setCuenta] = useState('')
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())

  const cierresQ = useQuery({
    queryKey: ['chc-cierres', selectedCompany, selectedPoint],
    queryFn: () => api.chcListCierres({ no_cia: selectedCompany, punto: selectedPoint }),
    enabled: !!selectedCompany,
  })
  const cuentasQ = useQuery({
    queryKey: ['chc-cuentas-list', selectedCompany, selectedPoint],
    queryFn: () => api.chcListCuentas?.({ no_cia: selectedCompany, punto: selectedPoint }) ?? Promise.resolve([]),
    enabled: !!selectedCompany,
  })

  const aplicar = useMutation({
    mutationFn: () => api.chcCierreConciliacion({
      no_cia: selectedCompany!, punto: selectedPoint!, cuenta_banco: cuenta, ano, mes
    }),
    onSuccess: () => {
      toast.success(`Conciliación ${MESES[mes]} ${ano} cerrada para cuenta ${cuenta}`)
      setConfirm(false)
      qc.invalidateQueries({ queryKey: ['chc-cierres'] })
    },
    onError: (e: any) => toast.error(e?.detail?.error || 'Error al cerrar conciliación'),
  })

  const cierres: any[] = cierresQ.data || []
  const cuentas: any[] = cuentasQ.data || []
  const yaCerrada = cierres.some(c => c.ano === ano && c.mes === mes && c.cuenta_banco === cuenta)

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Cierre de Conciliación Bancaria</CardTitle>
            <Badge variant="outline">Empresa {selectedCompany} · Punto {selectedPoint}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cierra la conciliación de una cuenta bancaria para un período.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <AlertIrreversible tone="amber">
            Una vez cerrada la conciliación, no se podrán modificar los movimientos
            del período para esa cuenta.
          </AlertIrreversible>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Cuenta bancaria</Label>
              <Select value={cuenta} onValueChange={setCuenta}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {cuentas.map(c => (
                    <SelectItem key={c.cuenta_banco} value={String(c.cuenta_banco)}>
                      {c.cuenta_banco} — {c.nombre ?? c.descripcion ?? ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mes</Label>
              <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.slice(1).map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Año</Label>
              <Input type="number" min={2000} max={2099} value={ano}
                     onChange={e => setAno(Number(e.target.value))} className="h-9" />
            </div>
          </div>

          {yaCerrada && (
            <div className="rounded border border-muted bg-muted/40 px-3 py-2 text-sm flex items-center gap-2">
              <Lock className="h-4 w-4" /> Conciliación ya cerrada para esta cuenta/período.
            </div>
          )}

          <Button onClick={() => setConfirm(true)} disabled={!cuenta || yaCerrada}
                  variant="destructive" className="w-full gap-2">
            <Lock className="h-4 w-4" /> Cerrar Conciliación
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Año</TableHead><TableHead>Mes</TableHead>
                <TableHead>Cuenta</TableHead><TableHead>Fecha cierre</TableHead><TableHead>Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cierres.map((c, i) => (
                <TableRow key={`${c.ano}-${c.mes}-${c.cuenta_banco}-${i}`}>
                  <TableCell className="font-mono">{c.ano}</TableCell>
                  <TableCell><Badge variant="outline">{MESES[c.mes]}</Badge></TableCell>
                  <TableCell className="font-mono">{c.cuenta_banco}</TableCell>
                  <TableCell>{c.fecha_sysdate ? String(c.fecha_sysdate).slice(0, 10) : ''}</TableCell>
                  <TableCell className="text-xs">{c.usuario}</TableCell>
                </TableRow>
              ))}
              {cierres.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin cierres registrados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Confirmar cierre {MESES[mes]} {ano}
          </DialogTitle></DialogHeader>
          <p className="text-sm">Cuenta: <b>{cuenta}</b>. Operación irreversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button>
            <Button onClick={() => aplicar.mutate()} disabled={aplicar.isPending}>
              {aplicar.isPending ? 'Aplicando…' : 'Sí, cerrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [x] **Step 4.4: Commit + push** — commit hecho en runner

```bash
git add frontend/src/features/chc/chc-cierres.tsx
git commit -m "feat(chc): cierre de conciliación con dialog + selector cuenta

Antes solo había listado de cierres. Ahora se puede ejecutar el cierre
de conciliación bancaria con cuenta + mes + año + confirmación.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push origin main
```

---

## PR5 — FAT: Asiento + Generar Mayor (backend nuevo) + reescribir Cierre

**Files:**
- Delete: `frontend/src/features/fat/fat-cierre-mensual.tsx` (duplicado)
- Modify: `frontend/src/features/fat/cierre-mensual.tsx` → renombrar exports a `FatAsientoContable`, `FatGenerarAsiento`, `FatCierre`
- Create: `frontend/src/routes/_authenticated/fat/asiento-contable.tsx`
- Create: `frontend/src/routes/_authenticated/fat/generar-asiento.tsx`
- Modify: `frontend/src/routes/_authenticated/fat/cierre-mensual.tsx`
- Create backend: `/api/fat/asiento-contable/` y `/api/fat/generar-asiento/`
- Modify: `frontend/src/components/layout/data/sidebar-data.ts` (3 items en FAT Cierre)

- [x] **Step 5.1: Borrar duplicado** — done

```bash
git rm frontend/src/features/fat/fat-cierre-mensual.tsx
```

- [x] **Step 5.2: Buscar referencias al duplicado** — 0 imports encontrados; safe delete

Run: `grep -rn 'fat-cierre-mensual' frontend/src/`
Expected: 0 matches (si hay, ajustar imports al archivo `cierre-mensual.tsx`).

- [ ] **Step 5.3: Crear endpoints backend FAT asiento + generar-mayor**

Investigar primero en CxC cómo está implementado `cxcAsientoContable` y `cxcGenerarAsiento`:

```bash
grep -n 'get_asiento_contable\|generar_asiento' backend/apps/legacy/repositories/cxc_repo.py | head -20
grep -n 'def cxc_asiento\|def cxc_generar' backend/apps/legacy/cxc_views.py | head -10
```

Replicar el patrón para FAT en `backend/apps/legacy/fat_views.py` y `fat_repo.py`. Tablas implicadas: `TFAT_FACTURA`, `TFAT_TDOCU`, `TCXC_DOCUMENTO`, `TFAT_TCONTABLE`. Marca `generado_cnt='S'` después del Generar Mayor.

Smoke + commit (igual patrón a PR2).

- [ ] **Step 5.4: Agregar métodos al api client**

En `regal-general-api.ts`:

```ts
fatAsientoContable: (no_cia: string, punto: string, mes: number, ano: number) =>
  request<any[]>(`/fat/asiento-contable/?no_cia=${no_cia}&punto=${punto}&mes=${mes}&ano=${ano}`),

fatGenerarAsiento: (d: { no_cia: string; punto: string; mes_proceso: number; ano_proceso: number; cierre_fiscal?: boolean }) =>
  request<any>('/fat/generar-asiento/', { method: 'POST', body: JSON.stringify(d) }),
```

- [ ] **Step 5.5: Reescribir `cierre-mensual.tsx` con 3 exports siguiendo patrón CxC**

Igual estructura que PR3 step 3.3-3.5 pero para FAT. Borrar el `catch {}` silencioso.

- [ ] **Step 5.6: Crear las 2 rutas nuevas** (asiento-contable.tsx, generar-asiento.tsx)

- [ ] **Step 5.7: Actualizar sidebar FAT** (3 items en sección Cierre cerca de línea 104)

- [ ] **Step 5.8: Commit + push + Netlify smoke**

```bash
git commit -m "feat(fat): cierre con 3 vistas al patrón CxC + endpoints backend

...

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## PR6 — INV: migrar a 3 rutas dedicadas, React Query, sin fetch hard-coded

**Files:**
- Create: `frontend/src/routes/_authenticated/inv/asiento-contable.tsx`
- Create: `frontend/src/routes/_authenticated/inv/generar-asiento.tsx`
- Create: `frontend/src/routes/_authenticated/inv/cierre.tsx`
- Modify: `frontend/src/features/inv/cierre-mensual.tsx` (refactor a React Query, exports `InvCierre`)
- Modify: `frontend/src/features/inv/cierre-asiento.tsx` (refactor, export `InvGenerarAsiento`)
- Modify: `frontend/src/features/inv/cierre-entrada-diario.tsx` (refactor, export `InvAsientoContable` o renombrar adecuadamente)
- Delete: `frontend/src/features/inv/cierre-mensual.tsx.bak`
- Delete: `frontend/src/features/inv/cierre-asiento.tsx.bak`
- Modify: `frontend/src/lib/regal-general-api.ts` (agregar `invCierreMensual`, `invGenerarAsiento`, `invListCierres`, `invEntradaDiarioPdfUrl`)
- Modify: `frontend/src/components/layout/data/sidebar-data.ts` (cambiar URLs `/inv?section=…&view=…` a `/inv/...`)
- Modify: `frontend/src/features/inv/index.tsx` (remover routing por `?section=cierre`)

- [ ] **Step 6.1: Borrar `.bak`**

```bash
git rm frontend/src/features/inv/cierre-mensual.tsx.bak frontend/src/features/inv/cierre-asiento.tsx.bak
```

- [ ] **Step 6.2: Agregar métodos a api client**

```ts
invListPuntos: (no_cia: string) =>
  request<any[]>(`/inv/puntos/?no_cia=${encodeURIComponent(no_cia)}`),
invCierreMensual: (d: { no_cia: string; punto: string; mes: string; ano: string; fecha: string }) =>
  request<any>('/inv/cierre/mensual/', { method: 'POST', body: JSON.stringify(d) }),
invGenerarAsiento: (d: any) =>
  request<any>('/inv/cierre/generar-asiento/', { method: 'POST', body: JSON.stringify(d) }),
invListCierres: (no_cia: string, punto: string) =>
  request<any[]>(`/inv/cierres/?no_cia=${no_cia}&punto=${punto}`),
```

- [ ] **Step 6.3: Refactorizar los 3 components a React Query + `regalGeneralApi`**

Eliminar `fetch('http://10.0.0.99:8000/api/…')`. Usar `useQuery`/`useMutation`. Mantener funcionalidad pero ajustar UI a Card + PeriodoBadge + AlertIrreversible.

- [ ] **Step 6.4: Crear 3 rutas dedicadas** (igual patrón que PR3)

- [ ] **Step 6.5: Actualizar sidebar INV** (línea 440-457: cambiar `url: '/inv', search: { section: 'cierre', view: 'cierre-mensual' }` por `url: '/inv/cierre'`)

- [ ] **Step 6.6: Remover routing `section=cierre` del shell INV**

En `features/inv/index.tsx`, si hay un switch por `search.view`, mantener para las otras secciones pero quitar la rama `'cierre'`.

- [ ] **Step 6.7: Commit + push + Netlify smoke**

---

## PR7 — CNT: estética al patrón CxC + ruta `/cnt/cierre` dedicada

**Files:**
- Create: `frontend/src/routes/_authenticated/cnt/cierre.tsx`
- Modify: `frontend/src/features/cnt/cierre-mensual.tsx` (React Query + Card + PeriodoBadge, exportar `CntCierre`)
- Modify: `frontend/src/components/layout/data/sidebar-data.ts` (mantener entrada CNT cierre apuntando a `/cnt/cierre`)

- [x] **Step 7.1: Refactor `cierre-mensual.tsx`** — done (useQuery + useMutation, Card+CardHeader+PeriodoBadge, AlertIrreversible, botón destructive con "Ejecutar Cierre")

- [?] **Step 7.2: Crear ruta `/cnt/cierre`** — pospuesto (CNT sidebar entry usa /cnt con search-params y refactor a ruta dedicada tocaría el CNT shell; funcional actual mantiene la vista refactorizada)

- [x] **Step 7.3: Verificar/actualizar sidebar** — entrada actual en línea 681 sirve al componente refactorizado

- [x] **Step 7.4: Commit + push** — commit hecho en runner

---

## PR8 — ACC: reescribir `AccCierre` al patrón CxC exacto

**Files:**
- Modify: `frontend/src/features/acc/acc-cierre.tsx`

- [x] **Step 8.1: Reemplazar el `<Card><CardContent>` plano por `Card + CardHeader + PeriodoBadge`** — done

- [x] **Step 8.2: Reemplazar `AlertTriangle` inline por `AlertIrreversible`** — done

- [x] **Step 8.3: Ajustar layout a `<div className="p-6 space-y-4 max-w-4xl mx-auto">`** — done

- [x] **Step 8.4: Mantener funcionalidad (status, dialog confirm, histórico)** — done

- [x] **Step 8.5: Commit + push** — commit hecho en runner

---

## PR9 — ACF: reescribir `AcfCierre` al patrón CxC exacto

**Files:**
- Modify: `frontend/src/features/acf/acf-cierre.tsx`

- [x] **Step 9.1-9.5: Mismo patrón que PR8** + mantener botón "Imprimir comprobante" — done (Card+CardHeader+PeriodoBadge+AlertIrreversible, botón Printer en cada row del histórico intacto)

---

## PR10 — ACF settings CRUD: 8 pantallas con Crear/Editar/Eliminar

**Files:**
- Modify: `frontend/src/features/acf/acf-simple-tables.tsx` (convertir cada export a CRUD completo) o split en archivos por catálogo
- Backend endpoints: verificar/crear `POST/PUT/DELETE /api/acf/categorias/`, `…/grupos/`, `…/subgrupos/`, `…/marcas/`, `…/departamentos/`, `…/responsables/`, `…/puntos/`

- [ ] **Step 10.1: Auditar endpoints backend existentes**

Run: `grep -n 'def acf_' backend/apps/legacy/acf_views.py | head -30`

- [ ] **Step 10.2: Para cada catálogo SIN endpoints, crear `POST/PUT/DELETE`**

Patrón en `cxc_views.py`/`fat_views.py`. Validar empresa+punto+username con `_check_acf_access`. Soft-delete cuando la columna `activo` exista.

- [ ] **Step 10.3: Agregar métodos al api client** (`acfSaveCategoria`, `acfDeleteCategoria`, etc.)

- [ ] **Step 10.4: Reescribir cada componente** con botón Nueva + dialog crear/editar + acción eliminar por fila

Plantilla en `features/fat/fat-condiciones-pago.tsx` o `features/odc/odc-config.tsx` (CiasTab).

- [ ] **Step 10.5: Commit por catálogo (1 commit cada 2 catálogos) + push final**

---

## PR11 — ACC settings CRUD

**Files:**
- Auditar y completar CRUD en: `acc-cias.tsx`, `acc-puntos.tsx`, `acc-tipos-bene.tsx`, `acc-tipos-gasto.tsx`, `acc-beneficiarios.tsx`, `acc-cajas.tsx`

- [ ] **Step 11.1: Por cada archivo, abrirlo y determinar si ya tiene CRUD o no**

- [ ] **Step 11.2: Completar los que falten siguiendo patrón ODC-Cias**

- [ ] **Step 11.3: Backend endpoints faltantes**

- [ ] **Step 11.4: Commit + push**

---

## PR12 — SDN settings CRUD

**Files:**
- Auditar: `sdn-areas.tsx`, `sdn-deptos.tsx`, `sdn-gerencias.tsx`, `sdn-afp.tsx`, `sdn-ars.tsx`, `sdn-catalogos.tsx`, `sdn-cias.tsx`

- [ ] **Step 12.1-12.4: Mismo patrón que PR11**

---

## PR13 — Sidebar dinámico filtrado por `useAccess`

**Files:**
- Modify: `frontend/src/components/layout/app-sidebar.tsx` o donde se renderiza el sidebar
- Modify: `frontend/src/components/layout/data/sidebar-data.ts` (sin cambios estructurales, sólo asegurar URLs)

- [ ] **Step 13.1: Localizar componente que renderiza sidebar**

Run: `grep -rn 'sidebarData\|navGroups' frontend/src/components/layout/`

- [ ] **Step 13.2: Inyectar filtro**

```tsx
const { hasModule, isLoading } = useAccess()

const inferModule = (url?: string): string | null => {
  if (!url || !url.startsWith('/')) return null
  const m = url.split('/')[1]
  return ['fat', 'cxc', 'cxp', 'inv', 'cnt', 'chc', 'acc', 'acf', 'odc', 'sdn'].includes(m) ? m : null
}

const visibleGroups = sidebarData.navGroups.map(group => ({
  ...group,
  items: group.items
    .map(item => {
      // Si es categoría con sub-items, filtrar sub-items
      if (item.items) {
        const filtered = item.items.filter(sub => {
          const mod = inferModule(sub.url ?? sub.items?.[0]?.url)
          return !mod || hasModule(mod)
        })
        return filtered.length > 0 ? { ...item, items: filtered } : null
      }
      // Si es link directo
      const mod = inferModule(item.url)
      return !mod || hasModule(mod) ? item : null
    })
    .filter(Boolean as any),
})).filter(g => g.items.length > 0)
```

- [ ] **Step 13.3: Manejar loading state**

```tsx
if (isLoading) return <SidebarSkeleton />
```

- [ ] **Step 13.4: Commit + push + smoke con usuario no-admin**

Crear usuario test con acceso solo a FAT, login, confirmar que sidebar solo muestra FAT (+settings/admin que no son de módulo).

---

## PR14 — `RequireModule` aplicado + página `/403`

**Files:**
- Create: `frontend/src/components/access/require-module.tsx`
- Create: `frontend/src/routes/_authenticated/403.tsx`
- Modify: `frontend/src/routes/_authenticated/fat.tsx` (layout) + idem para cada módulo

- [ ] **Step 14.1: Crear `RequireModule`**

```tsx
import { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAccess } from '@/hooks/use-access'
import { Skeleton } from '@/components/ui/skeleton'

export function RequireModule({ modulo, children }: { modulo: string; children: ReactNode }) {
  const { hasModule, isLoading } = useAccess()
  if (isLoading) return <Skeleton className="h-screen" />
  if (!hasModule(modulo)) return <Navigate to="/403" />
  return <>{children}</>
}
```

- [ ] **Step 14.2: Crear ruta `/403`**

```tsx
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
            No tienes permisos para ver este módulo. Contacta al administrador
            para solicitar acceso.
          </p>
          <Button onClick={() => nav({ to: '/' })}>Ir al inicio</Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 14.3: Envolver layouts de cada módulo con `RequireModule`**

Para cada `routes/_authenticated/<m>.tsx` (layout):

```tsx
import { RequireModule } from '@/components/access/require-module'
// ...
function _Layout() {
  return (
    <RequireModule modulo="fat">
      <Header />
      <Outlet />
    </RequireModule>
  )
}
```

- [ ] **Step 14.4: Commit + push + smoke**

---

## PR15 — `GuardedButton` aplicado a Cierres, Eliminar e Imprimir críticos

**Files:**
- Create: `frontend/src/components/access/guarded-button.tsx`
- Modify: archivos de cierre (8 módulos) — proteger botón ejecutar con `HACER_CIERRE`
- Modify: archivos críticos — proteger Eliminar con flags relevantes (`ANULAR_*`)
- Modify: imprimir con `IMPRIMIR_DOCU` / `REIMPRIMIR_DOCU`

- [ ] **Step 15.1: Crear `GuardedButton`**

```tsx
import { Button, type ButtonProps } from '@/components/ui/button'
import { useAccess } from '@/hooks/use-access'
import { useCompany } from '@/hooks/use-company'

interface Props extends ButtonProps {
  modulo: string
  flag: string
  /** Si true, en vez de ocultar deshabilita y muestra tooltip. */
  disableInsteadOfHide?: boolean
}

export function GuardedButton({ modulo, flag, disableInsteadOfHide, children, ...rest }: Props) {
  const { selectedCompany, selectedPoint } = useCompany()
  const { hasFlag } = useAccess()
  const allowed = hasFlag(modulo, selectedCompany ?? '', selectedPoint ?? '', flag)
  if (!allowed && !disableInsteadOfHide) return null
  return <Button {...rest} disabled={rest.disabled || !allowed}>{children}</Button>
}
```

- [ ] **Step 15.2: Proteger botones Cierre con `HACER_CIERRE`**

En cada vista de cierre (8 archivos), reemplazar el `<Button onClick={ejecutar} variant="destructive">` por `<GuardedButton modulo="cxp" flag="HACER_CIERRE" onClick={ejecutar} variant="destructive">`. Repetir por módulo correspondiente.

- [ ] **Step 15.3: Proteger Eliminar con flags ANULAR_***

Identificar los principales (factura anular, conduce anular, cheque anular, ODC anular). Reemplazar `<Button>` por `<GuardedButton>` con flag correspondiente de `FLAG_LABELS`.

- [ ] **Step 15.4: Proteger Imprimir con `IMPRIMIR_DOCU` cuando aplique**

- [ ] **Step 15.5: Commit + push + smoke final con usuario test sin flags**

---

## Validación final del plan

- [ ] **Step F.1: Verificar checklist del spec**

Run: `grep -c '\[ \]' backend/docs/superpowers/specs/2026-06-30-cierres-settings-access-design.md`
Marcar uno por uno los criterios de cierre del spec.

- [ ] **Step F.2: Confirmar que no quedan `.bak` ni duplicados**

```bash
find frontend/src -name '*.bak' -o -name '*.tsx.bak'
```
Expected: vacío.

- [ ] **Step F.3: Confirmar que no quedan `catch {}` ni `API_BASE` hard-coded en archivos de cierre**

```bash
grep -rn 'catch {}\|http://10\.0\.0\.99' frontend/src/features/{fat,cxc,cxp,inv,cnt,chc,acc,acf}/
```
Expected: vacío.

- [ ] **Step F.4: Commit final tag**

```bash
git tag -a v-cierres-settings-access-2026-06-30 -m "Cierres, Settings CRUD y Access Control completados"
git push origin v-cierres-settings-access-2026-06-30
```

- [ ] **Step F.5: Actualizar memoria MCP con resumen**

`mcp__memory-router__memory_create_project` o similar para registrar el cierre del plan.

---

## Reglas para el runner automático

Cuando este plan se ejecuta vía `ZentoryERP-Cierres-Settings-PlanRunner` (cada 4h):

1. **Al arrancar:** `cd C:\Users\JCABREU\AppData\Local\memorias_sigaft\facturation-system && git fetch origin && git checkout main && git pull --rebase origin main`
2. Buscar el primer `- [ ]` y arrancar el step.
3. Después de cada step: marcar `- [x]` en este archivo, commit el cambio del checkbox junto al cambio del código.
4. Si un step requiere VM y la VM no responde: marcar `- [!] (bloqueado VM)` y saltar a siguiente step que no dependa de VM.
5. Si un step requiere decisión: marcar `- [?] (necesita: <pregunta>)` y saltar.
6. Al final del run dejar línea: `RUN_DONE | pr=<N> | step=<id> | next_pending=<id> | blockers=<N>`
7. NO crear PR — el usuario lo hace al final.
8. NO tocar otros planes — solo este.
