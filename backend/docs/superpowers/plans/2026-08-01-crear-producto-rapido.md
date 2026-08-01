# Crear Producto Rápido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar crear un producto nuevo sin salir del documento en curso (Entrada de Compras, Entrada/Salida de Mercancía, y las pantallas de FAT que comparten el buscador de productos), con un modal mínimo que solo pide lo que el backend exige.

**Architecture:** Un componente nuevo `CrearProductoModal` (React) que llama al endpoint ya existente `POST /api/inv/productos/`. Se engancha en dos puntos de entrada: el "sin resultados" del `BuscarProductoModal` compartido, y el dropdown de búsqueda inline de la grilla en `entrada-compras.tsx`/`entrada-mercancia.tsx`. Los defaults de clasificación (línea/sub-línea/grupo/grupo contable) se guardan en `localStorage` por usuario+compañía.

**Tech Stack:** React + TypeScript + Vite, shadcn/ui (Dialog/Select/Checkbox), fetch directo con CSRF (mismo patrón que el resto del módulo INV), Django backend sin cambios.

**Spec de referencia:** `docs/superpowers/specs/2026-08-01-crear-producto-rapido-design.md`

**Nota sobre testing:** este repo no tiene test runner de frontend (jest/vitest) — el proyecto valida con `tsc --noEmit`, `npm run build` puntual (no como gate rutinario, hay errores TS preexistentes en otras partes) y smoke manual/Playwright contra la VM 10.0.0.99. Cada tarea usa esas herramientas en vez de tests unitarios.

**Antes de tocar la VM:** este plan solo modifica el frontend. Al desplegar, seguir el flujo de `sigaft-deploy-vm` (pscp de los archivos tocados + reload) y smoke-test según `sigaft-legacy-testing`. La VM 10.0.0.99 es producción real — no ejecutar nada destructivo, solo crear un producto de prueba con prefijo reconocible si se necesita validar end-to-end, y anotar si hace falta limpiarlo.

---

### Task 1: Crear el componente `CrearProductoModal`

**Files:**
- Create: `frontend/src/features/fat/components/crear-producto-modal.tsx`

- [ ] **Step 1: Escribir el componente completo**

```tsx
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrentUsername } from '@/hooks/use-me'

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'

export interface CrearProductoModalResult {
  no_produ: string
  descri: string
  costo: number
  porciento_impuesto: number
}

interface Props {
  open: boolean
  onClose: () => void
  /** Se llama tras crear el producto con éxito. El caller decide qué hacer
   * con él (seleccionarlo en una fila, en el modal de búsqueda, etc). */
  onCreated: (producto: CrearProductoModalResult) => void
  noCia: string
  /** Prefill de descripción con el texto que el usuario ya había tecleado
   * en el buscador que disparó este modal. */
  descripcionInicial?: string
}

interface CatalogItem {
  [key: string]: unknown
}

interface DefaultsClasificacion {
  linea: string
  sub_linea: string
  grupo_produ: string
  grupo_contable: string
}

function defaultsKey(usuario: string, noCia: string) {
  return `inv.crearProductoDefaults.${usuario}.${noCia}`
}

function readDefaults(
  usuario: string,
  noCia: string
): DefaultsClasificacion | null {
  if (!usuario) return null
  try {
    const raw = localStorage.getItem(defaultsKey(usuario, noCia))
    return raw ? (JSON.parse(raw) as DefaultsClasificacion) : null
  } catch {
    return null
  }
}

function saveDefaults(
  usuario: string,
  noCia: string,
  d: DefaultsClasificacion
) {
  if (!usuario) return
  try {
    localStorage.setItem(defaultsKey(usuario, noCia), JSON.stringify(d))
  } catch {
    // localStorage no disponible (modo privado, cuota llena) — no es crítico
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Distintos catálogos INV usan distintas claves para su código (grupo_produ
 * vs grupo vs codigo, etc). Este helper prueba varias en orden. */
function catalogCode(item: CatalogItem, ...keys: string[]): string {
  for (const k of keys) {
    const v = item[k]
    if (v !== undefined && v !== null && v !== '') return String(v)
  }
  return ''
}

export function CrearProductoModal({
  open,
  onClose,
  onCreated,
  noCia,
  descripcionInicial = '',
}: Props) {
  const usuario = useCurrentUsername()

  const [codigoPreview, setCodigoPreview] = useState('')
  const [loadingCodigo, setLoadingCodigo] = useState(false)

  const [descripcion, setDescripcion] = useState(descripcionInicial)
  const [linea, setLinea] = useState('')
  const [subLinea, setSubLinea] = useState('')
  const [grupoProdu, setGrupoProdu] = useState('')
  const [grupoContable, setGrupoContable] = useState('')
  const [costo, setCosto] = useState('')
  const [tieneImpuesto, setTieneImpuesto] = useState(true)
  const [porcientoImpuesto, setPorcientoImpuesto] = useState('18')

  const [lineas, setLineas] = useState<CatalogItem[]>([])
  const [sublineas, setSublineas] = useState<CatalogItem[]>([])
  const [grupos, setGrupos] = useState<CatalogItem[]>([])
  const [gruposContables, setGruposContables] = useState<CatalogItem[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Al abrir: reset del formulario, preview de código y catálogos.
  useEffect(() => {
    if (!open) return
    setDescripcion(descripcionInicial)
    setCosto('')
    setTieneImpuesto(true)
    setPorcientoImpuesto('18')
    setError('')

    setLoadingCodigo(true)
    apiFetch<{ siguiente?: string }>('/inv/productos/next-codigo/')
      .then((r) => setCodigoPreview(r.siguiente ?? ''))
      .catch(() => setCodigoPreview(''))
      .finally(() => setLoadingCodigo(false))

    apiFetch<any>(`/inv/lineas/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) =>
        setLineas(Array.isArray(data) ? data : (data.items ?? data.results ?? []))
      )
      .catch(() => setLineas([]))

    apiFetch<any>(`/inv/sublineas/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) =>
        setSublineas(Array.isArray(data) ? data : (data.items ?? data.results ?? []))
      )
      .catch(() => setSublineas([]))

    apiFetch<any>(`/inv/grupos/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) =>
        setGrupos(Array.isArray(data) ? data : (data.items ?? data.results ?? []))
      )
      .catch(() => setGrupos([]))

    apiFetch<any>(`/inv/grupos-contables/?no_cia=${encodeURIComponent(noCia)}`)
      .then((data) =>
        setGruposContables(
          Array.isArray(data) ? data : (data.items ?? data.results ?? [])
        )
      )
      .catch(() => setGruposContables([]))
  }, [open, noCia, descripcionInicial])

  // Defaults por usuario+compañía — en efecto separado para no re-disparar
  // los 5 fetches de catálogo cuando `usuario` llega después (useMe async).
  useEffect(() => {
    if (!open) return
    const defaults = readDefaults(usuario, noCia)
    setLinea(defaults?.linea ?? '')
    setSubLinea(defaults?.sub_linea ?? '')
    setGrupoProdu(defaults?.grupo_produ ?? '')
    setGrupoContable(defaults?.grupo_contable ?? '')
  }, [open, noCia, usuario])

  const sublineasFiltradas = linea
    ? sublineas.filter((s) => String(s.linea) === String(linea))
    : sublineas

  const handleCrear = async () => {
    setError('')
    if (!descripcion.trim()) return setError('La descripción es requerida')
    if (descripcion.trim().length > 40)
      return setError('La descripción supera los 40 caracteres')
    if (!linea) return setError('Seleccione la línea')
    if (!subLinea) return setError('Seleccione la sub-línea')
    if (!grupoProdu) return setError('Seleccione el grupo')
    if (!grupoContable) return setError('Seleccione el grupo contable')

    setSaving(true)
    try {
      const csrf =
        (
          document.cookie.split('; ').find((c) => c.startsWith('csrftoken=')) ||
          ''
        ).split('=')[1] || ''
      const res = await fetch(`${API_BASE}/inv/productos/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        body: JSON.stringify({
          descripcion: descripcion.trim(),
          linea,
          sub_linea: subLinea,
          grupo_produ: grupoProdu,
          grupo_contable: grupoContable,
          costo: parseFloat(costo) || 0,
          tiene_impuesto: tieneImpuesto ? 'S' : 'N',
          porciento_impuesto: tieneImpuesto ? parseFloat(porcientoImpuesto) || 0 : 0,
          codigo_auto: 'S',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? data.detail ?? `HTTP ${res.status}`)
        return
      }
      const noProdu: string = data?.data?.no_produ ?? codigoPreview
      saveDefaults(usuario, noCia, {
        linea,
        sub_linea: subLinea,
        grupo_produ: grupoProdu,
        grupo_contable: grupoContable,
      })
      toast.success(`Producto ${noProdu} creado`)
      onCreated({
        no_produ: noProdu,
        descri: descripcion.trim(),
        costo: parseFloat(costo) || 0,
        porciento_impuesto: tieneImpuesto ? parseFloat(porcientoImpuesto) || 0 : 0,
      })
    } catch (err: any) {
      setError(err?.message ?? 'Error desconocido al crear el producto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Crear Producto</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-1'>
            <Label htmlFor='cp-codigo'>No. Producto</Label>
            <Input
              id='cp-codigo'
              className='h-9 font-mono'
              value={loadingCodigo ? 'Generando...' : codigoPreview}
              readOnly
              disabled
            />
            <p className='text-[11px] text-muted-foreground'>
              Código autogenerado por el sistema.
            </p>
          </div>

          <div className='space-y-1'>
            <Label htmlFor='cp-descripcion'>
              Descripción <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='cp-descripcion'
              className='h-9'
              placeholder='Nombre del producto'
              value={descripcion}
              maxLength={40}
              onChange={(e) => setDescripcion(e.target.value)}
              autoFocus
            />
            <p className='text-right text-[11px] text-muted-foreground'>
              {descripcion.length}/40
            </p>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1'>
              <Label htmlFor='cp-grupo'>
                Grupo <span className='text-destructive'>*</span>
              </Label>
              <Select value={grupoProdu} onValueChange={setGrupoProdu}>
                <SelectTrigger id='cp-grupo' className='h-9'>
                  <SelectValue placeholder='Seleccionar...' />
                </SelectTrigger>
                <SelectContent>
                  {grupos.map((g) => {
                    const code = catalogCode(g, 'grupo_produ', 'grupo', 'codigo')
                    return (
                      <SelectItem key={code} value={code}>
                        {code} — {String(g.descripcion ?? '')}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='cp-gc'>
                Grupo Contable <span className='text-destructive'>*</span>
              </Label>
              <Select value={grupoContable} onValueChange={setGrupoContable}>
                <SelectTrigger id='cp-gc' className='h-9'>
                  <SelectValue placeholder='Seleccionar...' />
                </SelectTrigger>
                <SelectContent>
                  {gruposContables.map((g) => {
                    const code = catalogCode(g, 'grupo_contable', 'codigo')
                    return (
                      <SelectItem key={code} value={code}>
                        {code} — {String(g.descripcion ?? '')}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='cp-linea'>
                Línea <span className='text-destructive'>*</span>
              </Label>
              <Select
                value={linea}
                onValueChange={(v) => {
                  setLinea(v)
                  setSubLinea('')
                }}
              >
                <SelectTrigger id='cp-linea' className='h-9'>
                  <SelectValue placeholder='Seleccionar...' />
                </SelectTrigger>
                <SelectContent>
                  {lineas.map((l) => {
                    const code = catalogCode(l, 'linea', 'codigo')
                    return (
                      <SelectItem key={code} value={code}>
                        {code} — {String(l.descripcion ?? '')}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label htmlFor='cp-subl'>
                Sub-Línea <span className='text-destructive'>*</span>
              </Label>
              <Select value={subLinea} onValueChange={setSubLinea} disabled={!linea}>
                <SelectTrigger id='cp-subl' className='h-9'>
                  <SelectValue placeholder={linea ? 'Seleccionar...' : 'Elija línea primero'} />
                </SelectTrigger>
                <SelectContent>
                  {sublineasFiltradas.map((s) => {
                    const code = catalogCode(s, 'sub_linea', 'codigo')
                    return (
                      <SelectItem key={code} value={code}>
                        {code} — {String(s.descripcion ?? '')}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='grid grid-cols-2 items-end gap-4'>
            <div className='space-y-1'>
              <Label htmlFor='cp-costo'>Costo referencial</Label>
              <Input
                id='cp-costo'
                type='number'
                min={0}
                step='0.01'
                className='h-9 text-right tabular-nums'
                placeholder='0.00'
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
              />
            </div>
            <div className='flex items-center gap-2 pb-2'>
              <Checkbox
                id='cp-itbis'
                checked={tieneImpuesto}
                onCheckedChange={(v) => setTieneImpuesto(v === true)}
              />
              <Label htmlFor='cp-itbis' className='cursor-pointer'>
                Aplica ITBIS
              </Label>
              {tieneImpuesto && (
                <Input
                  type='number'
                  min={0}
                  max={100}
                  step='0.01'
                  className='h-8 w-20 text-right tabular-nums'
                  value={porcientoImpuesto}
                  onChange={(e) => setPorcientoImpuesto(e.target.value)}
                />
              )}
            </div>
          </div>

          {error && <p className='text-sm text-destructive'>{error}</p>}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCrear} disabled={saving || loadingCodigo}>
            {saving ? 'Creando...' : 'Crear y continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep crear-producto-modal`
Expected: sin salida (0 errores en el archivo nuevo). Si el proyecto tiene errores TS preexistentes en otros archivos, ignóralos — solo importa que este archivo nuevo no agregue ninguno.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/fat/components/crear-producto-modal.tsx
git commit -m "feat(inv): componente CrearProductoModal reutilizable"
```

---

### Task 2: Enganchar en `BuscarProductoModal`

**Files:**
- Modify: `frontend/src/features/fat/components/buscar-producto-modal.tsx`

- [ ] **Step 1: Importar el componente nuevo**

Agregar junto a los demás imports (después de la línea `import { MovimientosProductoModal } from './movimientos-producto-modal'`):

```tsx
import { CrearProductoModal } from './crear-producto-modal'
```

- [ ] **Step 2: Agregar el prop `permitirCrear` a la interfaz `Props`**

Ubicar el bloque `interface Props { ... }` (contiene `defaultSoloExistencia?: boolean` como último campo) y agregar debajo:

```tsx
  /** Permite crear un producto nuevo desde "sin resultados". Default true —
   * solo se desactivaría explícitamente si algún caller decide que no debe
   * ofrecerse ahí (ninguno lo hace hoy). */
  permitirCrear?: boolean
```

- [ ] **Step 3: Recibir el prop con default y agregar estado `crearOpen`**

En la destructuración de `export function BuscarProductoModal({ ... }: Props) {`, agregar `permitirCrear = true,` después de `defaultSoloExistencia = true,`.

Justo debajo de la declaración de `moviModal` (`const [moviModal, setMoviModal] = useState<...>(null)`), agregar:

```tsx
  const [crearOpen, setCrearOpen] = useState(false)
```

- [ ] **Step 4: Agregar el botón "Crear producto" al bloque de sin-resultados**

Ubicar (dentro del `<TableBody>`):

```tsx
                {!isLoading && !errorMsg && results.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className='py-12 text-center text-base text-gray-400'
                    >
                      {debouncedSearch
                        ? `No se encontraron productos para "${debouncedSearch}"`
                        : 'Ingrese un término de búsqueda'}
                    </TableCell>
                  </TableRow>
                )}
```

Reemplazar por:

```tsx
                {!isLoading && !errorMsg && results.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className='py-12 text-center text-base text-gray-400'
                    >
                      <p>
                        {debouncedSearch
                          ? `No se encontraron productos para "${debouncedSearch}"`
                          : 'Ingrese un término de búsqueda'}
                      </p>
                      {permitirCrear && debouncedSearch && (
                        <Button
                          variant='link'
                          className='mt-2'
                          onClick={() => setCrearOpen(true)}
                        >
                          Crear producto "{debouncedSearch}" →
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )}
```

- [ ] **Step 5: Renderizar `CrearProductoModal` y reusar `handleSelect`**

Ubicar el bloque de retorno que empieza con:

```tsx
  return (
    <>
      {moviModal && (
        <MovimientosProductoModal
```

Justo después del cierre de ese bloque `{moviModal && ( ... )}` (antes del `<Dialog open={open} ...>`), agregar:

```tsx
      {crearOpen && (
        <CrearProductoModal
          open={crearOpen}
          onClose={() => setCrearOpen(false)}
          noCia={noCia}
          descripcionInicial={debouncedSearch}
          onCreated={(p) => {
            setCrearOpen(false)
            handleSelect({
              no_produ: p.no_produ,
              descri: p.descri,
              precio: p.costo,
              porciento_impuesto: p.porciento_impuesto,
              unidad_empaque: 'UND',
              existencia: 0,
            })
          }}
        />
      )}
```

`handleSelect` ya existe (usa `cantidades[p.no_produ]`, que será `undefined` para el producto recién creado y cae al default `1` — no requiere cambios).

- [ ] **Step 6: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep buscar-producto-modal`
Expected: sin salida.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/fat/components/buscar-producto-modal.tsx
git commit -m "feat(inv): boton 'Crear producto' en BuscarProductoModal sin resultados"
```

---

### Task 3: Enganchar en el buscador inline de `entrada-compras.tsx`

**Files:**
- Modify: `frontend/src/features/inv/entrada-compras.tsx`

- [ ] **Step 1: Importar el componente nuevo**

Agregar junto a los demás imports de `features/fat/components`:

```tsx
import { CrearProductoModal } from '@/features/fat/components/crear-producto-modal'
```

- [ ] **Step 2: Agregar estado del modal de creación**

Ubicar el bloque de estado de búsqueda inline:

```tsx
  // Product search (legacy inline, conservado)
  const [searchIdx, setSearchIdx] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<ProductoResult[]>([])
  const [searching, setSearching] = useState(false)
```

Agregar debajo:

```tsx

  // Modal "Crear Producto" — disparado desde el dropdown de búsqueda inline
  // cuando no hay resultados para el texto tecleado.
  const [crearProductoOpen, setCrearProductoOpen] = useState(false)
  const [crearProductoIdx, setCrearProductoIdx] = useState<number | null>(null)
  const [crearProductoTerm, setCrearProductoTerm] = useState('')

  const abrirCrearProducto = (idx: number, term: string) => {
    setCrearProductoIdx(idx)
    setCrearProductoTerm(term)
    setCrearProductoOpen(true)
    setSearchIdx(null)
    setSearchResults([])
  }
```

- [ ] **Step 3: Agregar la opción "Crear producto" al dropdown inline**

Ubicar:

```tsx
                            {isSearching && searchResults.length > 0 && (
                              <div className='absolute z-50 top-full left-0 mt-1 w-[280px] rounded-md border bg-popover shadow-md text-xs'>
                                {searching && <div className='px-3 py-2 text-muted-foreground'>Buscando...</div>}
                                {searchResults.map((p) => {
                                  const code = p.no_produ ?? p.codigo ?? ''
                                  return (
                                    <div
                                      key={code}
                                      className='px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground'
                                      onMouseDown={(e) => { e.preventDefault(); selectProducto(idx, p) }}
                                    >
                                      <span className='font-mono font-medium'>{code}</span>
                                      {' — '}
                                      <span className='text-muted-foreground'>{p.descripcion ?? p.nombre ?? ''}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
```

Reemplazar por:

```tsx
                            {isSearching && (searching || searchResults.length > 0 || searchTerm.trim()) && (
                              <div className='absolute z-50 top-full left-0 mt-1 w-[280px] rounded-md border bg-popover shadow-md text-xs'>
                                {searching && <div className='px-3 py-2 text-muted-foreground'>Buscando...</div>}
                                {!searching && searchResults.map((p) => {
                                  const code = p.no_produ ?? p.codigo ?? ''
                                  return (
                                    <div
                                      key={code}
                                      className='px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground'
                                      onMouseDown={(e) => { e.preventDefault(); selectProducto(idx, p) }}
                                    >
                                      <span className='font-mono font-medium'>{code}</span>
                                      {' — '}
                                      <span className='text-muted-foreground'>{p.descripcion ?? p.nombre ?? ''}</span>
                                    </div>
                                  )
                                })}
                                {!searching && searchResults.length === 0 && searchTerm.trim() && (
                                  <div
                                    className='px-3 py-2 cursor-pointer text-blue-600 hover:bg-accent hover:underline'
                                    onMouseDown={(e) => { e.preventDefault(); abrirCrearProducto(idx, searchTerm) }}
                                  >
                                    + Crear producto "{searchTerm}" →
                                  </div>
                                )}
                              </div>
                            )}
```

- [ ] **Step 4: Renderizar `CrearProductoModal`**

Ubicar el cierre del `<BuscarProductoModal ... />` al final del archivo (justo antes de `</TooltipProvider>`), y agregar después de su `/>`:

```tsx

      <CrearProductoModal
        open={crearProductoOpen}
        onClose={() => { setCrearProductoOpen(false); setCrearProductoIdx(null) }}
        noCia={noCia}
        descripcionInicial={crearProductoTerm}
        onCreated={(p) => {
          if (crearProductoIdx == null) return
          const idx = crearProductoIdx
          updateRow(idx, { noProdu: p.no_produ, nombre: p.descri, costo: String(p.costo) })
          cargarEmpaques(idx, p.no_produ, p.costo)
          setCrearProductoOpen(false)
          setCrearProductoIdx(null)
        }}
      />
```

- [ ] **Step 5: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep entrada-compras`
Expected: sin salida.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/inv/entrada-compras.tsx
git commit -m "feat(inv): crear producto rapido desde buscador inline de Entrada de Compras"
```

---

### Task 4: Enganchar en el buscador inline de `entrada-mercancia.tsx`

**Files:**
- Modify: `frontend/src/features/inv/entrada-mercancia.tsx`

Mismo patrón que Task 3, aplicado a este archivo (Entrada/Salida de Mercancía genérica, FINV210/211).

- [ ] **Step 1: Importar el componente**

```tsx
import { CrearProductoModal } from '@/features/fat/components/crear-producto-modal'
```

- [ ] **Step 2: Agregar estado**

Ubicar:

```tsx
  // Product search (legacy inline, conservado para compatibilidad)
  const [searchIdx, setSearchIdx] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<ProductoResult[]>([])
  const [searching, setSearching] = useState(false)
```

Agregar debajo:

```tsx

  // Modal "Crear Producto" — disparado desde el dropdown de búsqueda inline
  // cuando no hay resultados para el texto tecleado.
  const [crearProductoOpen, setCrearProductoOpen] = useState(false)
  const [crearProductoIdx, setCrearProductoIdx] = useState<number | null>(null)
  const [crearProductoTerm, setCrearProductoTerm] = useState('')

  const abrirCrearProducto = (idx: number, term: string) => {
    setCrearProductoIdx(idx)
    setCrearProductoTerm(term)
    setCrearProductoOpen(true)
    setSearchIdx(null)
    setSearchResults([])
  }
```

- [ ] **Step 3: Agregar la opción "Crear producto" al dropdown inline**

Ubicar (dentro del `<TableCell className='px-2 py-1'>` del código de producto):

```tsx
                            {isSearching && searchResults.length > 0 && (
                              <div className='absolute top-full left-0 z-50 mt-1 w-[280px] rounded-md border bg-popover text-xs shadow-md'>
                                {searching && (
                                  <div className='px-3 py-2 text-muted-foreground'>
                                    Buscando...
                                  </div>
                                )}
                                {searchResults.map((p) => {
                                  const code = p.no_produ ?? p.codigo ?? ''
                                  return (
                                    <div
                                      key={code}
                                      className='cursor-pointer px-3 py-2 hover:bg-accent hover:text-accent-foreground'
                                      onMouseDown={(e) => {
                                        e.preventDefault()
                                        selectProducto(idx, p)
                                      }}
                                    >
                                      <span className='font-mono font-medium'>
                                        {code}
                                      </span>
                                      {' — '}
                                      <span className='text-muted-foreground'>
                                        {p.descripcion ?? p.nombre ?? ''}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
```

Reemplazar por:

```tsx
                            {isSearching && (searching || searchResults.length > 0 || searchTerm.trim()) && (
                              <div className='absolute top-full left-0 z-50 mt-1 w-[280px] rounded-md border bg-popover text-xs shadow-md'>
                                {searching && (
                                  <div className='px-3 py-2 text-muted-foreground'>
                                    Buscando...
                                  </div>
                                )}
                                {!searching && searchResults.map((p) => {
                                  const code = p.no_produ ?? p.codigo ?? ''
                                  return (
                                    <div
                                      key={code}
                                      className='cursor-pointer px-3 py-2 hover:bg-accent hover:text-accent-foreground'
                                      onMouseDown={(e) => {
                                        e.preventDefault()
                                        selectProducto(idx, p)
                                      }}
                                    >
                                      <span className='font-mono font-medium'>
                                        {code}
                                      </span>
                                      {' — '}
                                      <span className='text-muted-foreground'>
                                        {p.descripcion ?? p.nombre ?? ''}
                                      </span>
                                    </div>
                                  )
                                })}
                                {!searching && searchResults.length === 0 && searchTerm.trim() && (
                                  <div
                                    className='cursor-pointer px-3 py-2 text-blue-600 hover:bg-accent hover:underline'
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      abrirCrearProducto(idx, searchTerm)
                                    }}
                                  >
                                    + Crear producto "{searchTerm}" →
                                  </div>
                                )}
                              </div>
                            )}
```

- [ ] **Step 4: Renderizar `CrearProductoModal`**

Justo después del cierre `/>` del `<BuscarProductoModal ... />` al final del archivo (antes de `</TooltipProvider>`):

```tsx

      <CrearProductoModal
        open={crearProductoOpen}
        onClose={() => { setCrearProductoOpen(false); setCrearProductoIdx(null) }}
        noCia={noCia}
        descripcionInicial={crearProductoTerm}
        onCreated={(p) => {
          if (crearProductoIdx == null) return
          const idx = crearProductoIdx
          updateRow(idx, { noProdu: p.no_produ, nombre: p.descri, costo: String(p.costo) })
          cargarEmpaques(idx, p.no_produ, p.costo)
          setCrearProductoOpen(false)
          setCrearProductoIdx(null)
        }}
      />
```

- [ ] **Step 5: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep entrada-mercancia`
Expected: sin salida.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/inv/entrada-mercancia.tsx
git commit -m "feat(inv): crear producto rapido desde buscador inline de Entrada/Salida de Mercancia"
```

---

### Task 5: Desplegar a la VM y smoke test

**Files:** ninguno nuevo — solo despliegue y verificación.

- [ ] **Step 1: Subir los 4 archivos tocados/creados a la VM**

Seguir el flujo de la skill `sigaft-deploy-vm` (pscp) para:
- `frontend/src/features/fat/components/crear-producto-modal.tsx`
- `frontend/src/features/fat/components/buscar-producto-modal.tsx`
- `frontend/src/features/inv/entrada-compras.tsx`
- `frontend/src/features/inv/entrada-mercancia.tsx`

Antes de subir `buscar-producto-modal.tsx`, bajar primero la versión viva de la VM y aplicar el diff de Task 2 sobre esa versión — la memoria del proyecto advierte que la VM puede estar adelantada respecto a git en archivos compartidos (`feedback_vm_compartida_otros_worktrees`, `deploy/vm-source-of-truth-2026-05-25`).

- [ ] **Step 2: Smoke visual en la VM (Playwright)**

Navegar a `http://10.0.0.99:5173/inv?section=procesos&view=entrada-compras`:
1. Escribir en el buscador inline un código que seguro no existe (ej. `ZZTEST01`) — debe aparecer "+ Crear producto "ZZTEST01" →".
2. Click — debe abrir el modal con descripción prefilled `ZZTEST01`, código autogenerado visible, y los 4 selects vacíos (o con el último default si ya se usó antes).
3. Completar Línea/Sub-línea/Grupo/Grupo Contable con cualquier valor real, click "Crear y continuar".
4. Verificar: toast de éxito, el modal se cierra, la fila de la grilla queda con el nuevo código/descripción, y el costo/UM se cargan.
5. Repetir la búsqueda del mismo `crearProductoTerm` una segunda vez en otra fila — los 4 selects deben venir prellenados con la clasificación usada en el paso 3 (confirma que el default de `localStorage` funciona).
6. Repetir el mismo flujo abriendo el modal de "Buscar Producto" (lupa) en vez del buscador inline, para confirmar el punto de entrada de Task 2.
7. Producto de prueba `ZZTEST01`: si el smoke crea este producto en la base de producción, dejar anotado para que el usuario decida si lo desactiva/limpia después (no eliminar productos sin confirmación — puede haber movimientos ya asociados).

- [ ] **Step 3: Confirmar que Nueva Factura de FAT también lo heredó**

Navegar a `http://10.0.0.99:5173/fat?section=procesos&view=nueva-factura`, abrir el buscador de productos, buscar un texto sin resultados, confirmar que aparece el mismo botón "Crear producto" (viene gratis de Task 2, sin cambios en `fat-nueva-factura.tsx`).

---

## Auto-revisión del plan

- **Cobertura del spec:** puntos 1-8 del spec cubiertos — componente nuevo (Task 1), punto de entrada `BuscarProductoModal` (Task 2, incluye el prop `permitirCrear` del punto 3), punto de entrada inline (Tasks 3-4, punto 4), FAT hereda gratis (Task 5 paso 3, punto 5), defaults por usuario+compañía (Task 1, punto 6), validaciones cliente-side (Task 1 `handleCrear`, punto 7). Punto 8 (fuera de alcance) no requiere tareas — se confirma que ningún task agrega empaques/almacenes/permisos nuevos.
- **Consistencia de tipos:** `CrearProductoModalResult` (Task 1) es el mismo shape que consumen `onCreated` en Task 2 (mapeado a `BuscarProductoModalProducto`) y Tasks 3-4 (usado directo contra `ProductoRow`). Nombres de campos (`no_produ`, `descri`, `costo`, `porciento_impuesto`) son consistentes en las 3 integraciones.
- **Sin placeholders:** todos los steps de código tienen el snippet completo, no hay "TODO"/"similar a Task N" sin contenido.
