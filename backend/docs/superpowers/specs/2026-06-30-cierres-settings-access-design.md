# Estandarización de Cierres, CRUD de Settings y Control de Acceso (ZentoryERP / SIGAFT clone)

Fecha: 2026-06-30
Autor: JCABREU (con Claude Code)

## Contexto y objetivo

El clon de SIGAFT tiene 8 módulos transaccionales con la operación de **cierre de período**,
pero la implementación es heterogénea entre módulos: CxC sigue un patrón claro y completo,
ACC y ACF están bien pero con UI distinta, y FAT / CxP / CHC / INV / CNT tienen
inconsistencias que van desde APIs rotas y errores silenciados hasta funcionalidad faltante.

Adicionalmente:

- ACF, SDN y partes de ACC tienen pantallas de configuración (catálogos) **read-only**:
  no hay CRUD para crear/editar/eliminar registros como sí ocurre en FAT/INV/CxC/CxP.
- El sistema de **control de acceso** existe en backend (`permissions_repo.py`) y tiene una
  UI admin completa (`/sistema/usuarios`), pero **no se enforza** en el frontend: el sidebar
  muestra todos los módulos a todos los usuarios y las rutas no chequean acceso.

Este spec consolida los tres frentes en un solo cuerpo de trabajo. El plan de PRs (en el
documento de plan que acompaña a este spec) sigue el orden por gravedad.

---

## Parte 1 — Estandarización de los Cierres

### Estado actual auditado (2026-06-30)

| Módulo | Ruta | Componente | Estado | Observaciones |
|---|---|---|---|---|
| CxC | `/cxc/asiento-contable`, `/cxc/generar-asiento`, `/cxc/cierre` | `features/cxc/cxc-cierre.tsx` | ✅ Oro | 3 exports: `CxcAsientoContable`, `CxcGenerarAsiento`, `CxcCierre`. React Query + `usePeriodoCxC` + `PeriodoBadge` + alertas + confirm |
| ACC | `/acc/asiento`, `/acc/cierre` | `acc-cierre.tsx` | Bueno (UX distinta) | Dialog para confirmación, status (sin contabilizar / sin reposición). No tiene "Generar Asiento al Mayor" porque ACC no lo tiene en el legado (Facc402 inexistente) |
| ACF | `/acf/depreciacion`, `/acf/cierre` | `acf-cierre.tsx` | Bueno (UX distinta) | Igual a ACC + botón "Imprimir comprobante" usando `/print/comprobante-cierre-acf/<id>` |
| FAT | `/fat/cierre-mensual` | `cierre-mensual.tsx` + duplicado `fat-cierre-mensual.tsx` | ⚠️ Roto | Solo cierra-período. Sin "Asiento Contable" ni "Generar Mayor". `catch {}` silencioso. Archivo duplicado huérfano |
| CxP | `/cxp/cierre` | `cxp-procesos.tsx` → `CxpCierre` | ⚠️ Roto | `CxpAsientoContable` y `CxpGenerarAsiento` existen en el código pero **sin ruta ni sidebar**. Línea 1275 con `\ Backend` (barra invertida → comentario inválido) |
| CHC | `/chc/cierres` | `chc-cierres.tsx` | ❌ Incompleto | Solo listado, **no expone botón** para ejecutar cierre aunque `chcCierreConciliacion` ya está en API |
| INV | `/inv?section=cierre&view=…` | `cierre-mensual.tsx`, `cierre-asiento.tsx`, `cierre-entrada-diario.tsx` | ⚠️ Roto | Bajo shell legado, `fetch('http://10.0.0.99:8000/api/…')` hard-coded, sin React Query, sin `regalGeneralApi.request`, sin `PeriodoBadge`. Hay `.bak` que deben borrarse |
| CNT | (sin ruta dedicada, vive bajo shell) | `cnt/cierre-mensual.tsx` | ⚠️ Estética | Funcional pero `useEffect`+`fetch`, no React Query, sin Card+Badge pattern |
| SDN | — | — | n/a | **Excluido de este plan**. Cierre fiscal de nómina es complejo y se aborda en plan posterior |

### Patrón canónico "Cierre" (heredado de CxC)

#### 1. Estructura de archivos

```
frontend/src/features/<m>/<m>-cierre.tsx   ← 1 archivo con 1-3 exports
frontend/src/routes/_authenticated/<m>/asiento-contable.tsx   ← cuando aplique
frontend/src/routes/_authenticated/<m>/generar-asiento.tsx    ← cuando aplique
frontend/src/routes/_authenticated/<m>/cierre.tsx
```

#### 2. Exports por módulo

| Módulo | Asiento Contable | Generar al Mayor | Cierre Mensual |
|---|---|---|---|
| CxC | ✅ | ✅ | ✅ |
| CxP | ✅ | ✅ | ✅ |
| FAT | ✅ (nuevo) | ✅ (nuevo) | ✅ |
| INV | ✅ | ✅ | ✅ |
| CNT | (sub-pantalla de "asientos") | (sub-pantalla "actualizar") | ✅ |
| ACC | ✅ | ❌ (no en legado) | ✅ |
| ACF | (sub-pantalla "comprobante") | ❌ (no en legado) | ✅ |
| CHC | ❌ | ❌ | ✅ |

#### 3. Convenciones obligatorias por vista

Toda vista de cierre debe cumplir:

- **Compañía/punto**: vienen de `useCompany()`. **No editables** en la vista.
- **Hook período**: `use<M>Periodo(noCia, punto)` que lee `T<M>_PUNTO.mes_proceso/ano_proceso` con React Query (`staleTime: 30s`, `enabled: !!noCia`).
- **Componente PeriodoBadge**: muestra "Período activo: Junio 2026" arriba a la derecha del `CardHeader`.
- **React Query**:
  - `useQuery` para todo lo de lectura
  - `useMutation` para ejecutar, con `onSuccess` que llama `qc.invalidateQueries({ queryKey: [...] })`
  - **Nunca** `useEffect + fetch`. **Nunca** `catch {}` silencioso
- **Estados visuales**:
  - Alert ámbar (`border-amber-300 bg-amber-50`) para advertencias de irreversibilidad
  - Alert rojo (`border-red-300 bg-red-50`) para bloqueos ("hay docs sin contabilizar")
  - Alert verde (`border-green-300 bg-green-50`) post-éxito con período resultante
- **Confirmación**: `confirm()` JS con mensaje claro antes de ejecutar
- **Errores**: `toast.error(e?.detail?.error || e?.message || 'Mensaje genérico')`
- **Layout**: `<Card><CardHeader pb-3 + título + PeriodoBadge><CardContent space-y-4>...</CardContent></Card>` envuelto en `<div className="p-6 space-y-4 max-w-2xl mx-auto">`
- **Botón ejecutar**: `variant="destructive"` con `<Lock>` o `<CheckCircle2>`, `disabled` mientras `isPending`

#### 4. Componentes compartidos (PR2)

Para evitar duplicación en 6 módulos:

```
frontend/src/components/cierre/
  periodo-badge.tsx       ← <PeriodoBadge mesProceso={n} anoProceso={n} />
  cierre-card.tsx         ← <CierreCard title="..." periodo={...}> children </CierreCard>
  alert-irreversible.tsx  ← <AlertIrreversible>texto</AlertIrreversible>
```

Los hooks `use<M>Periodo` quedan en cada `features/<m>/hooks.ts` porque consultan tablas
distintas (`TCxC_PUNTO`, `TFAT_PUNTO`, etc.).

### Endpoints backend faltantes

| Endpoint | Método | Módulo | Estado |
|---|---|---|---|
| `/api/fat/asiento-contable/` | GET | FAT | **NUEVO** — read del asiento contable del mes/año/punto (lookups a TFAT_FACTURA + TCXC_DOCUMENTO + TFAT_TDOCU) |
| `/api/fat/generar-asiento/` | POST | FAT | **NUEVO** — marca docs como contabilizados, inserta TCNT_ASIENTO |
| `/api/chc/cierres/` | POST | CHC | **NUEVO** — `chcCierreConciliacion` ya existe en API client pero el endpoint backend hay que verificar (cuenta_banco selector) |

Todos los demás endpoints ya existen y están probados.

---

## Parte 2 — CRUD de pantallas de configuración

### Estado actual auditado

| Módulo | Archivo principal | Estado | Pantallas que necesitan CRUD |
|---|---|---|---|
| **FAT** | `fat-config.tsx`, individuales por catálogo | ✅ Patrón gold | n/a |
| **INV** | varios | ✅ CRUD completo | n/a |
| **CxC** | `cxc-*.tsx` por catálogo | ✅ CRUD completo | n/a |
| **CxP** | `cxp-catalogos.tsx` | ✅ CRUD completo | n/a |
| **ODC** | `odc-config.tsx` (tabs) | ✅ CRUD parcial (Cias OK; verificar tipos-doc, etc.) | Confirmar tabs internas |
| **ACF** | `acf-simple-tables.tsx` | ❌ **READ-ONLY** | Cias, Puntos, Categorías, Grupos, Subgrupos, Marcas, Departamentos, Responsables |
| **ACC** | individuales | ⚠️ Parcial | Cias, Puntos, Tipos-Bene, Tipos-Gasto, Beneficiarios, Cajas — auditar uno por uno |
| **SDN** | individuales | ⚠️ Parcial | Cias, Áreas, Deptos, Gerencias, AFP, ARS, Catálogos — auditar uno por uno |

### Patrón canónico "CRUD de catálogo"

Tomado de `features/fat/fat-condiciones-pago.tsx` y `features/cxc/cxc-vendedores.tsx`:

```tsx
export function <M>Catalogo() {
  const { selectedCompany } = useCompany()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)

  const listQ = useQuery({ queryKey: ['<m>-catalogo', selectedCompany, search, page], queryFn: ... })
  const saveMut = useMutation({ mutationFn: ..., onSuccess: () => { qc.invalidate; setOpen(false); toast.success } })
  const delMut  = useMutation({ mutationFn: ..., onSuccess: () => { qc.invalidate; toast.success } })

  return (
    <div className="space-y-4">
      <header>
        <h3>...</h3>
        <Button onClick={() => { setEditing(null); setOpen(true) }}>
          <Plus/> Nuevo
        </Button>
      </header>
      <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
      <Table>...</Table>  // con paginación
      <Dialog open={open}>...</Dialog>  // form con Zod opcional
      <ConfirmDelete onConfirm={() => delMut.mutate(id)} />
    </div>
  )
}
```

**Reglas:**
- Cada pantalla tiene `Nuevo`, `Editar` (lápiz por fila), `Eliminar` (basura por fila con `confirm()`).
- Búsqueda y paginación cuando hay >50 filas.
- Validación: longitud máxima por columna Oracle real (consultar `all_tab_columns`).
- Antes de delete: chequear FKs (ej. no se puede borrar empresa si tiene puntos asociados).
- Mensajes de error backend respetados: `toast.error(e?.detail?.error || ...)`.

### Endpoints backend faltantes

Inventario por módulo (lo confirma cada PR):

- ACF: `POST/PUT/DELETE /api/acf/categorias/`, `…/grupos/`, `…/subgrupos/`, `…/marcas/`, `…/departamentos/`, `…/responsables/`, `…/puntos/`, `…/cias/`
- ACC: confirmar qué tiene CRUD y qué solo lectura
- SDN: confirmar qué tiene CRUD y qué solo lectura

Hay que **inspeccionar** `apps/legacy/acf_urls.py`, `acc_urls.py`, `sdn_urls.py` y completar los que falten.

---

## Parte 3 — Control de acceso (enforcement)

### Estado actual

**Backend** (`permissions_repo.py`):
- ✅ `_MODULES` de 4-tuple por módulo
- ✅ `list_user_doc_perms`, `grant_doc_access`, `revoke_doc_access`
- ✅ Endpoints `/api/admin/users/{u}/access/...` completos
- ✅ Triggers `VALIDA_USUARIO_<MOD>` en Oracle
- ✅ Vistas backend rechazan cuando no hay acceso (`_check_fat_access` y equivalentes)

**Frontend admin** (`features/auth-mgmt/`):
- ✅ `users-admin.tsx` lista/crea/lock usuarios
- ✅ `user-access-page.tsx` asigna módulos + flags (~50 banderas) + tipos de documento
- ✅ Ruta `/sistema/usuarios`
- ✅ Entrada en `settings-catalog.tsx`

**Frontend enforcement** ❌ **no existe**:
- El sidebar muestra todos los módulos a todos los usuarios
- Las rutas no chequean acceso (si vas manualmente a `/sdn/empleados` y no tienes acceso a SDN, ves la UI vacía; el backend rechaza pero la UI no lo dice)
- Los botones críticos (Cierre, Eliminar, Imprimir) no chequean flags (`HACER_CIERRE`, `IMPRIMIR_DOCU`, etc.)

### Endpoints backend necesarios

#### `GET /api/me/access/`

Devuelve lo que el usuario actual puede ver. Llamado **una vez al login** (`staleTime: ∞` hasta logout/refresh):

```json
{
  "username": "JCABREU",
  "is_admin": false,
  "companies": [
    { "no_cia": "01", "descripcion": "...", "puntos": ["01", "02"] }
  ],
  "modules": {
    "fat": { "no_cias": ["01"], "puntos": { "01": ["01"] } },
    "cxc": { "no_cias": ["01"], "puntos": { "01": ["01", "02"] } }
  },
  "flags": {
    "fat:01:01": ["PERMITE_FACTURAR", "IMPRIMIR_DOCU", "HACER_CIERRE", "..."],
    "cxc:01:01": ["HACER_TRANSACCIONES", "..."]
  },
  "tipos_docu": {
    "fat:01:01": ["FC", "FT", "CO", "CT"]
  }
}
```

`is_admin = true` salta toda validación y desbloquea todo (para JCABREU y admins).

### Implementación frontend

#### 3.1 Hook `useAccess()`

```ts
// hooks/use-access.ts
export function useAccess() {
  const q = useQuery({
    queryKey: ['me-access'],
    queryFn: () => api.meAccess(),
    staleTime: Infinity,
  })
  const data = q.data
  return {
    isLoading: q.isLoading,
    isAdmin: data?.is_admin ?? false,
    hasModule: (m: string) => data?.is_admin || !!data?.modules[m],
    hasFlag: (m: string, no_cia: string, punto: string, flag: string) =>
      data?.is_admin || data?.flags[`${m}:${no_cia}:${punto}`]?.includes(flag) || false,
    hasDocType: (m: string, no_cia: string, punto: string, t: string) =>
      data?.is_admin || data?.tipos_docu[`${m}:${no_cia}:${punto}`]?.includes(t) || false,
    companies: data?.companies ?? [],
  }
}
```

Invalidar con `qc.invalidateQueries(['me-access'])` después de `adminGrantAccess` etc., en
la admin UI.

#### 3.2 Sidebar dinámico

`components/layout/data/sidebar-data.ts` ya emite un árbol estático. En lugar de tocarlo,
en el componente `<AppSidebar>` filtramos al render:

```tsx
const { hasModule, isLoading } = useAccess()
if (isLoading) return <SidebarSkeleton />

const visibleGroups = sidebarData.navGroups.map(group => ({
  ...group,
  items: group.items.filter(item => {
    const moduleCode = inferModuleFromUrl(item.url ?? item.items?.[0]?.url)
    return !moduleCode || hasModule(moduleCode)
  })
})).filter(g => g.items.length > 0)
```

`inferModuleFromUrl('/fat/...')` → `'fat'`. URLs sin prefijo de módulo (settings, admin)
se dejan visibles siempre.

#### 3.3 Guard de rutas

Componente envoltura para rutas de módulo:

```tsx
// components/access/require-module.tsx
export function RequireModule({ modulo, children }: { modulo: string; children: ReactNode }) {
  const { hasModule, isLoading } = useAccess()
  if (isLoading) return <Skeleton />
  if (!hasModule(modulo)) return <Navigate to="/403" />
  return <>{children}</>
}
```

Uso en cada `routes/_authenticated/<m>/<vista>.tsx`:

```tsx
function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  return (
    <RequireModule modulo="cxc">
      <CxcCierre noCia={selectedCompany ?? ''} punto={selectedPoint ?? ''} />
    </RequireModule>
  )
}
```

Alternativa más limpia: en el layout del módulo (`cxc.tsx`, `fat.tsx`) envolver el `<Outlet/>`
así todas las hijas heredan el guard sin tocar cada archivo.

#### 3.4 Botones bloqueados por flag

Helper componente:

```tsx
// components/access/guarded-button.tsx
export function GuardedButton({
  modulo, flag, children, ...props
}: { modulo: string; flag: string } & ButtonProps) {
  const { selectedCompany, selectedPoint } = useCompany()
  const { hasFlag } = useAccess()
  if (!hasFlag(modulo, selectedCompany ?? '', selectedPoint ?? '', flag)) return null
  return <Button {...props}>{children}</Button>
}
```

Uso:

```tsx
<GuardedButton modulo="cxc" flag="HACER_CIERRE" onClick={ejecutar} variant="destructive">
  Ejecutar Cierre
</GuardedButton>
```

Para FAT/CxC/CxP/INV/CHC los flags ya están todos definidos en `FLAG_LABELS` en
`user-access-page.tsx`. Acción por PR: documentar qué flag protege qué botón en cada vista.

### Página 403

Crear `routes/_authenticated/403.tsx`:

```tsx
export const Route = createFileRoute('/_authenticated/403')({
  component: () => (
    <div className="grid place-items-center min-h-screen">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Acceso denegado</CardTitle>
        </CardHeader>
        <CardContent>
          <p>No tienes permisos para ver este módulo. Contacta al administrador.</p>
          <Button onClick={() => navigate({ to: '/' })}>Volver</Button>
        </CardContent>
      </Card>
    </div>
  )
})
```

---

## Plan de PRs (orden por gravedad)

Ver documento de plan acompañante. Resumen:

| # | Tipo | Alcance |
|---|---|---|
| 1 | Hotfix | `cxp-procesos.tsx:1275` (`\ Backend` → `//`). Validar `tsc`. |
| 2 | Feat | Componentes compartidos `cierre/*` + `useAccess` hook + endpoint `/api/me/access/` |
| 3 | Feat | CxP cierre: 3 rutas, 3 sidebar items, reescribir 3 componentes al patrón CxC |
| 4 | Feat | CHC cierre: agregar botón `ChcCierre` con `chcCierreConciliacion` + selector cuenta_banco |
| 5 | Feat+backend | FAT cierre: borrar duplicado, agregar `FatAsientoContable`+`FatGenerarAsiento` con endpoints nuevos |
| 6 | Refactor | INV cierre: 3 rutas dedicadas, migrar de `fetch` a `request<T>`, borrar `.bak` |
| 7 | Refactor | CNT cierre: re-stylear a Card+PeriodoBadge+React Query, crear ruta `/cnt/cierre` dedicada |
| 8 | Refactor | ACC: reescribir `AccCierre` al patrón CxC exacto |
| 9 | Refactor | ACF: reescribir `AcfCierre` al patrón CxC exacto |
| 10 | Feat+backend | ACF settings CRUD: las 8 pantallas de `acf-simple-tables.tsx` |
| 11 | Feat+backend | ACC settings CRUD: auditar y completar lo que falte |
| 12 | Feat+backend | SDN settings CRUD: auditar y completar lo que falte |
| 13 | Feat | Sidebar dinámico filtrado por `useAccess` |
| 14 | Feat | `RequireModule` aplicado a layouts de módulo + página `/403` |
| 15 | Feat | `GuardedButton` aplicado a Cierres, Eliminar, Imprimir críticos |

Total estimado: 15 PRs, ~3-4 semanas.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper enforcement existente (backend ya rechaza, podría doblar lógica) | El `useAccess` solo bloquea **antes de** llamar al backend. Si pasa, backend sigue siendo última línea de defensa |
| Admins quedan bloqueados de algún módulo durante deploy | `is_admin=true` salta toda validación. Verificar antes de cada PR que JCABREU sigue siendo admin |
| `RequireModule` causa redirect loop | Test: usuario sin acceso → /sdn → /403 → click "Volver" → / → debe quedarse en home, no re-redirigir |
| Sidebar dinámico se queda vacío y rompe layout | `if (visibleGroups.length === 0) return <EmptySidebar />` con mensaje "Sin módulos asignados, contacta al admin" |
| CRUD delete borra datos críticos del cliente | Toda eliminación con doble confirmación + el backend chequea FKs antes de DELETE. Empezar todos los CRUDs con soft-delete (`activo = 'N'`) cuando la tabla lo soporte |
| INV migración rompe URLs guardadas | Mantener redirect 301 desde `/inv?section=cierre&view=cierre-mensual` a `/inv/cierre` por una semana |

---

## Criterios de cierre del spec

- [ ] Todos los cierres tienen las 3 vistas cuando aplica (FAT, CxP, INV)
- [ ] Todos los cierres usan React Query con `invalidateQueries`
- [ ] Todos los cierres muestran período activo con `PeriodoBadge`
- [ ] Toda mutación tiene `toast.error` con el mensaje real del backend
- [ ] ACF, ACC, SDN: cada catálogo permite Crear/Editar/Eliminar
- [ ] Sidebar se filtra por `useAccess`
- [ ] Rutas de módulo se bloquean con `RequireModule` → `/403`
- [ ] Botones críticos protegidos con `GuardedButton`
- [ ] `JCABREU` y usuarios `is_admin` ven todo siempre
- [ ] No quedan archivos `.bak` ni duplicados huérfanos
- [ ] No quedan `catch {}` silenciosos ni `fetch` hard-coded

---

## Fuera de alcance (post-plan)

- SDN cierre fiscal/anual de nómina (complejo, plan dedicado)
- Migración del shell INV/CNT `?section=&view=` a rutas dedicadas para vistas que NO son cierre
- Reescritura de `routes/clerk/_authenticated/user-management.tsx` (no se usa)
- Cambios en triggers Oracle `VALIDA_USUARIO_<MOD>` (la fuente de verdad)
