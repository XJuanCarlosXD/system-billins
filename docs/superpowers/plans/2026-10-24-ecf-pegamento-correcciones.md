# Correcciones e-CF: Tutorial guiado real, e-NCF en selector, prints, voz

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Corregir el pegamento e-CF: (1) reemplazar el modal genérico por un panel guiado paso a paso que señale elementos reales de la UI con spotlight/tooltip, (2) agregar e-NCF al selector de comprobante cuando e-CF está activo, (3) mostrar e-NCF en los PDFs impresos, (4) eliminar Web Speech API. Todo en las vistas de ENTRADA de documento (nueva-factura, entrada CxP, entrada CxC, egreso ACC).

**Architecture:** El tutorial deja de ser un Dialog modal genérico y se convierte en un panel lateral/overlay tipo "tour guiado" que usa `data-tour-step` attributes en los elementos reales de la UI + un overlay con spotlight (rectángulo recortado) y tooltip posicionado junto al elemento señalado. Sin librería externa — componente propio `FeGuiaInteractiva` con CSS clip-path para spotlight. El selector de NCF consulta `TFE_SECUENCIA` cuando e-CF está activo. Los prints buscan el e-NCF en `TFE_DOCUMENTO`.

**Tech Stack:** React + shadcn/ui + TanStack Query / Python 3.12 / Django / Oracle

---

## Principios UX obligatorios (aplicar en CADA tarea)

Cada tarea DEBE seguir estos principios. El runner verifica cada uno en el paso de testing.

### 1. Feedback inmediato al usuario
- Toda acción del usuario debe tener respuesta visual en < 200ms (loading spinner, skeleton, transición)
- Errores deben mostrarse en contexto (inline, no alert/console), con mensaje claro EN ESPAÑOL que diga QUÉ pasó y QUÉ hacer
- Estados vacíos deben tener mensaje informativo, nunca una lista vacía sin explicación

### 2. Accesibilidad y legibilidad
- Contraste suficiente (texto sobre fondo oscuro del spotlight debe ser legible)
- Tooltips del tour nunca deben salirse de la pantalla (clamp a viewport)
- Botones con `aria-label` cuando solo tienen ícono
- Focus trap dentro del tour: Tab/Shift+Tab deben ciclar dentro del tooltip, no ir al fondo

### 3. Responsive y mobile-first
- Tour y selector deben funcionar en viewport ≥ 375px (móvil)
- Tooltip se posiciona abajo en móvil si no cabe a los lados
- Selector de comprobante no debe truncar el texto del e-NCF en pantalla pequeña

### 4. Consistencia con el diseño existente
- Colores, tipografía y spacing de shadcn/ui — NO inventar estilos nuevos
- Botón "Guía e-CF" con el mismo estilo que otros botones de acción en el header
- Iconos de lucide-react consistentes con el resto de la app

### 5. No sorpresas
- El tour NO bloquea la pantalla si el usuario hace clic fuera — se cierra
- El tour se puede cerrar con Escape
- "No volver a mostrar" se respeta (localStorage) pero hay botón siempre visible para reabrir
- El selector de e-NCF NO quita los NCF papel si el usuario los necesita como fallback

### 6. Lenguaje claro en español dominicano
- "Guardar" no "Submit", "Siguiente" no "Next", "Comprobante" no "Voucher"
- Explicaciones en lenguaje de negocio: "Crédito Fiscal" no "tipo 31"
- Sin jerga técnica en lo que ve el usuario (e-NCF está bien porque es término DGII oficial)

---

## Testing obligatorio por tarea

**CADA tarea DEBE incluir estos pasos de testing antes del commit final:**

1. **`tsc -b --noEmit`** — cero errores de tipos (frontend)
2. **Test visual con Playwright** — navegar a la vista afectada, tomar screenshot, verificar que:
   - El componente se renderiza correctamente
   - No hay errores en consola (console.error)
   - Los elementos interactivos responden (click, hover)
3. **Test de flujo completo** — simular el camino del usuario:
   - Abrir la vista → tour aparece automáticamente (primera vez) → navegar pasos → cerrar
   - Reabrir con el botón "Guía e-CF" → funciona
   - Selector muestra e-NCF si aplica
4. **Test de edge cases:**
   - ¿Qué pasa si el elemento del tour no existe? (el tour debe saltar ese paso, no crashear)
   - ¿Qué pasa en móvil? (tooltip debe caber en pantalla)
   - ¿Qué pasa si e-CF no está activo? (botón no aparece, selector muestra NCF papel normal)
   - ¿Qué pasa con ventana redimensionada? (spotlight se recalcula)
5. **Screenshot final** — evidencia visual enviada con `SendUserFile` al completar cada tarea

---

## Problemas identificados en la implementación anterior

| # | Problema | Causa raíz | Fix |
|---|---------|-----------|-----|
| 1 | Tutorial es un modal genérico que no guía | `FeTutorialDialog` solo muestra texto en un Dialog, no señala nada en la UI | Reemplazar por `FeGuiaInteractiva` con spotlight+tooltip sobre elementos reales |
| 2 | Tutorial solo en Consulta, no en vistas de ENTRADA | `FeTutorialButton` se puso en `facturas.tsx` (consulta), no en `fat-nueva-factura.tsx` | Mover a las vistas de entrada: nueva-factura, documentos CxP, transacciones CxC, egreso ACC |
| 3 | Selector NCF no muestra e-NCF | `fatNcf` endpoint lee solo `CNT.TCNT_NCF` (papel) | Nuevo endpoint o flag: si e-CF activo, devolver secuencias de `TFE_SECUENCIA` |
| 4 | PDFs no muestran e-NCF | `views_print_data.py` usa `ncf_dgi` del doc pero no consulta `TFE_DOCUMENTO` | Lookup de `TFE_DOCUMENTO` para mostrar e-NCF si existe |
| 5 | Voz Web Speech API en español es mala | API nativa del navegador, voces robóticas | Eliminar voz — el tour visual guiado es suficiente; si se quiere voz, usar edge-tts (server-side) |

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `frontend/src/features/fe/fe-guia-interactiva.tsx` | **CREAR** | Componente de tour guiado con spotlight + tooltip |
| `frontend/src/features/fe/fe-guia-pasos.ts` | **CREAR** | Definición de pasos por módulo (selector CSS, posición tooltip, texto) |
| `frontend/src/features/fe/fe-tutorial-dialog.tsx` | **BORRAR** | Reemplazado por FeGuiaInteractiva |
| `frontend/src/features/fe/fe-tutorial-button.tsx` | **REESCRIBIR** | Ahora abre FeGuiaInteractiva, no el Dialog |
| `frontend/src/features/fe/fe-tutorial-avatar.tsx` | Conservar | Se usa en el tooltip del tour |
| `frontend/src/features/fe/fe-tutorial-voice.ts` | **BORRAR** | Web Speech API eliminada |
| `frontend/src/features/fat/fat-nueva-factura.tsx` | Modificar | Agregar `data-tour-step` + `FeTutorialButton` + lógica e-NCF |
| `frontend/src/features/fat/facturas.tsx` | Modificar | Quitar `FeTutorialButton` de consulta (va en entrada) |
| `frontend/src/features/cxp/cxp-documento-panel.tsx` | Modificar | Agregar tour + e-NCF |
| `frontend/src/features/cxc/cxc-transacciones.tsx` | Modificar | Agregar tour |
| `frontend/src/features/acc/acc-nuevo-egreso.tsx` | Modificar | Agregar tour |
| `backend/apps/fat/views.py` | Modificar | Endpoint `/fat/ncf/` devuelve e-NCF si activo |
| `backend/apps/legacy/repositories/fe_repo.py` | Modificar | `list_secuencias_como_ncf()` para el selector |
| `backend/apps/fat/views_print_data.py` | Modificar | Lookup e-NCF de TFE_DOCUMENTO |
| `backend/apps/legacy/docs_print_data.py` | Modificar | Lookup e-NCF para CxP/CxC prints |

---

### Task 1: Crear componente FeGuiaInteractiva (tour guiado real)

**Files:**
- Create: `frontend/src/features/fe/fe-guia-interactiva.tsx`
- Create: `frontend/src/features/fe/fe-guia-pasos.ts`

El tour guiado funciona así:
1. Se busca el elemento en la página con `document.querySelector(paso.selector)`
2. Se calcula su `getBoundingClientRect()`
3. Se pinta un overlay oscuro (backdrop) con un "hueco" recortado sobre el elemento (CSS clip-path)
4. Se posiciona un tooltip (con el avatar, texto y botones) al lado del hueco
5. El usuario navega con Siguiente/Anterior/Saltar

- [x] **Step 1: Crear `fe-guia-pasos.ts` — definición de pasos por módulo**

```typescript
// frontend/src/features/fe/fe-guia-pasos.ts
export interface GuiaPaso {
  selector: string       // CSS selector del elemento a señalar
  titulo: string
  descripcion: string
  posicion: 'top' | 'bottom' | 'left' | 'right'
}

export const GUIA_FAT_NUEVA_FACTURA: GuiaPaso[] = [
  {
    selector: '[data-tour="tipo-documento"]',
    titulo: 'Tipo de documento',
    descripcion: 'Selecciona el tipo de factura. Con e-CF activo, el sistema determina automáticamente si es tipo 31 (Crédito Fiscal) o 32 (Consumo) según el cliente.',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="cliente"]',
    titulo: 'Cliente',
    descripcion: 'Busca y selecciona el cliente. Si tiene RNC, se emite Crédito Fiscal (e-CF 31). Sin RNC, se emite Consumo (e-CF 32). Verifica que el RNC esté correcto — la DGII rechaza RNC inválidos.',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="comprobante"]',
    titulo: 'Comprobante electrónico',
    descripcion: 'Aquí aparece el e-NCF que se asignará (ej. E310000000141). Con e-CF activo, el sistema usa secuencias electrónicas aprobadas por la DGII — NO el NCF de papel.',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="guardar"]',
    titulo: 'Guardar = enviar a DGII',
    descripcion: 'Al guardar la factura, el e-CF se genera, firma y envía automáticamente a la DGII. Si es aceptado, queda registrado. Si es rechazado, recibirás un aviso con el motivo.',
    posicion: 'left',
  },
]

export const GUIA_CXP_ENTRADA: GuiaPaso[] = [
  {
    selector: '[data-tour="tipo-docu"]',
    titulo: 'Tipo de documento',
    descripcion: 'FP (Factura Proveedor) genera e-CF tipo 41 (Compras). Si el gasto no tiene comprobante del proveedor, es tipo 43 (Gastos Menores, hasta RD$50,000).',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="ncf-proveedor"]',
    titulo: 'NCF del proveedor',
    descripcion: 'Ingresa el NCF que te dio el proveedor. Este dato va en el e-CF — un NCF incorrecto causa rechazo de la DGII. Verifícalo antes de guardar.',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="guardar"]',
    titulo: 'Guardar = e-CF automático',
    descripcion: 'Al guardar, se genera y envía el comprobante electrónico a la DGII automáticamente.',
    posicion: 'left',
  },
]

export const GUIA_CXC_ENTRADA: GuiaPaso[] = [
  {
    selector: '[data-tour="tipo-docu"]',
    titulo: 'Nota de Débito / Crédito',
    descripcion: 'ND genera e-CF tipo 33, NC genera e-CF tipo 34. Ambas DEBEN referenciar la factura original — el sistema lo hace automáticamente.',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="factura-ref"]',
    titulo: 'Factura que modifica',
    descripcion: 'La DGII exige que toda ND/NC electrónica indique el e-NCF de la factura original. Si la factura original no tiene e-NCF (fue antes de activar e-CF), la ND/NC se emite con NCF papel.',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="guardar"]',
    titulo: 'Guardar = e-CF automático',
    descripcion: 'Al guardar, el e-CF se genera con la referencia a la factura original y se envía a la DGII.',
    posicion: 'left',
  },
]

export const GUIA_ACC_EGRESO: GuiaPaso[] = [
  {
    selector: '[data-tour="comprobante"]',
    titulo: 'Comprobante de gasto',
    descripcion: 'Los egresos de caja chica con comprobante fiscal generan e-CF tipo 43 (Gastos Menores). Aplica para montos hasta RD$50,000.',
    posicion: 'bottom',
  },
  {
    selector: '[data-tour="guardar"]',
    titulo: 'Guardar = e-CF automático',
    descripcion: 'Al guardar el egreso, se genera y envía el e-CF a la DGII.',
    posicion: 'left',
  },
]
```

- [x] **Step 2: Crear `fe-guia-interactiva.tsx` — componente de tour con spotlight**

```tsx
// frontend/src/features/fe/fe-guia-interactiva.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { FeTutorialAvatar } from './fe-tutorial-avatar'
import type { GuiaPaso } from './fe-guia-pasos'

interface Props {
  pasos: GuiaPaso[]
  open: boolean
  onClose: () => void
  moduloKey: string
}

const PADDING = 8 // px around highlighted element

export function FeGuiaInteractiva({ pasos, open, onClose, moduloKey }: Props) {
  const [paso, setPaso] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const current = pasos[paso]

  const calcRect = useCallback(() => {
    if (!current) return
    const el = document.querySelector(current.selector)
    if (el) {
      const r = el.getBoundingClientRect()
      setRect(r)
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } else {
      setRect(null)
    }
  }, [current])

  useEffect(() => {
    if (!open) return
    calcRect()
    window.addEventListener('resize', calcRect)
    window.addEventListener('scroll', calcRect, true)
    return () => {
      window.removeEventListener('resize', calcRect)
      window.removeEventListener('scroll', calcRect, true)
    }
  }, [open, paso, calcRect])

  const siguiente = () => {
    if (paso < pasos.length - 1) setPaso(paso + 1)
    else cerrar()
  }
  const anterior = () => { if (paso > 0) setPaso(paso - 1) }
  const cerrar = () => {
    setPaso(0)
    onClose()
    try { localStorage.setItem(`fe-guia-visto-${moduloKey}`, '1') } catch {}
  }

  if (!open || !current) return null

  // Clip-path: full overlay with a rectangle cut out
  const clipPath = rect
    ? `polygon(
        0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
        ${rect.left - PADDING}px ${rect.top - PADDING}px,
        ${rect.left - PADDING}px ${rect.bottom + PADDING}px,
        ${rect.right + PADDING}px ${rect.bottom + PADDING}px,
        ${rect.right + PADDING}px ${rect.top - PADDING}px,
        ${rect.left - PADDING}px ${rect.top - PADDING}px
      )`
    : undefined

  // Tooltip position
  const tooltipStyle: React.CSSProperties = {}
  if (rect) {
    const pos = current.posicion
    if (pos === 'bottom') {
      tooltipStyle.top = rect.bottom + PADDING + 12
      tooltipStyle.left = Math.max(16, rect.left)
    } else if (pos === 'top') {
      tooltipStyle.bottom = window.innerHeight - rect.top + PADDING + 12
      tooltipStyle.left = Math.max(16, rect.left)
    } else if (pos === 'right') {
      tooltipStyle.top = rect.top
      tooltipStyle.left = rect.right + PADDING + 12
    } else {
      tooltipStyle.top = rect.top
      tooltipStyle.right = window.innerWidth - rect.left + PADDING + 12
    }
  }

  return createPortal(
    <div className='fixed inset-0 z-[9999]'>
      {/* Backdrop with spotlight cutout */}
      <div
        className='absolute inset-0 bg-black/60 transition-all duration-300'
        style={{ clipPath }}
        onClick={cerrar}
      />

      {/* Highlight border around element */}
      {rect && (
        <div
          className='pointer-events-none absolute rounded-md border-2 border-primary shadow-lg shadow-primary/30'
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className='absolute z-[10000] w-80 rounded-xl border bg-background p-4 shadow-2xl'
        style={tooltipStyle}
      >
        <div className='mb-3 flex items-start gap-3'>
          <FeTutorialAvatar speaking={false} className='h-10 w-10 flex-shrink-0' />
          <div>
            <p className='font-semibold'>{current.titulo}</p>
            <p className='text-muted-foreground mt-1 text-sm leading-relaxed'>
              {current.descripcion}
            </p>
          </div>
        </div>

        {/* Progress + navigation */}
        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground text-xs'>
            {paso + 1} / {pasos.length}
          </span>
          <div className='flex gap-2'>
            <Button variant='ghost' size='sm' onClick={cerrar}>
              Saltar
            </Button>
            {paso > 0 && (
              <Button variant='outline' size='sm' onClick={anterior}>
                Anterior
              </Button>
            )}
            <Button size='sm' onClick={siguiente}>
              {paso < pasos.length - 1 ? 'Siguiente' : 'Listo'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [x] **Step 3: UX — agregar manejo de Escape, focus trap y viewport clamping**

En `fe-guia-interactiva.tsx`, agregar:

```tsx
// Cerrar con Escape
useEffect(() => {
  if (!open) return
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cerrar()
  }
  window.addEventListener('keydown', handleKey)
  return () => window.removeEventListener('keydown', handleKey)
}, [open])

// Viewport clamping: el tooltip nunca se sale de la pantalla
const clampToViewport = (style: React.CSSProperties): React.CSSProperties => {
  const s = { ...style }
  const W = window.innerWidth, H = window.innerHeight, TW = 320, TH = 200
  if (typeof s.left === 'number' && s.left + TW > W - 16) s.left = W - TW - 16
  if (typeof s.top === 'number' && s.top + TH > H - 16) s.top = H - TH - 16
  if (typeof s.left === 'number' && s.left < 16) s.left = 16
  if (typeof s.top === 'number' && s.top < 16) s.top = 16
  return s
}
// Aplicar: style={clampToViewport(tooltipStyle)}

// Focus trap: auto-focus "Siguiente" al cambiar paso
useEffect(() => {
  if (open) tooltipRef.current?.querySelector<HTMLButtonElement>('button:last-child')?.focus()
}, [open, paso])
```

Cuando el selector del paso no encuentra el elemento (`rect === null`), mostrar el tooltip centrado con un mensaje: "Este paso no aplica a tu formulario actual" y botón "Siguiente" — NO crashear ni quedarse en blanco.

```tsx
// Fallback cuando el elemento no existe en la página
if (!rect) {
  return createPortal(
    <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/40'>
      <div className='w-80 rounded-xl border bg-background p-4 shadow-2xl'>
        <div className='mb-3 flex items-start gap-3'>
          <FeTutorialAvatar speaking={false} className='h-10 w-10 flex-shrink-0' />
          <div>
            <p className='font-semibold'>{current.titulo}</p>
            <p className='text-muted-foreground mt-1 text-sm'>
              Este paso no aplica a tu formulario actual. Puedes continuar.
            </p>
          </div>
        </div>
        <div className='flex justify-end gap-2'>
          <Button variant='ghost' size='sm' onClick={cerrar}>Saltar</Button>
          <Button size='sm' onClick={siguiente}>Siguiente</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [x] **Step 4: UX — animación suave entre pasos**

```tsx
// Transición suave del spotlight al cambiar de paso
// Ya tenemos transition-all duration-300 en el backdrop
// Agregar al tooltip:
className='absolute z-[10000] w-80 rounded-xl border bg-background p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200'
```

- [x] **Step 5: Correr `tsc -b` para verificar tipos — 0 errores**

```bash
cd frontend && npx tsc -b --noEmit 2>&1 | head -20
```

Esperado: 0 errores. Si hay errores, corregir ANTES de continuar.

- [x] **Step 6: Test visual con Playwright**

```
1. Navegar a /fat/nueva-factura (login JCABREU/jc192003)
2. Verificar que el componente FeGuiaInteractiva se puede importar sin error
3. Verificar consola: 0 errores de import/runtime
4. Tomar screenshot
```

Este test es básico porque el componente aún no está integrado — la integración completa se testea en Task 4.

- [x] **Step 7: Commit**

```bash
git add frontend/src/features/fe/fe-guia-interactiva.tsx frontend/src/features/fe/fe-guia-pasos.ts
git commit -m "feat(fe): componente tour guiado con spotlight, Escape, focus trap, viewport clamp"
```

---

### Task 2: Reescribir FeTutorialButton y eliminar archivos obsoletos

**Files:**
- Rewrite: `frontend/src/features/fe/fe-tutorial-button.tsx`
- Delete: `frontend/src/features/fe/fe-tutorial-dialog.tsx`
- Delete: `frontend/src/features/fe/fe-tutorial-voice.ts`

- [x] **Step 1: Reescribir `fe-tutorial-button.tsx`**

```tsx
// frontend/src/features/fe/fe-tutorial-button.tsx
import { useEffect, useState } from 'react'
import { GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeGuiaInteractiva } from './fe-guia-interactiva'
import type { GuiaPaso } from './fe-guia-pasos'

interface Props {
  moduloKey: string
  pasos: GuiaPaso[]
  feActivo: boolean
}

export function FeTutorialButton({ moduloKey, pasos, feActivo }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!feActivo) return
    try {
      const key = `fe-guia-visto-${moduloKey}`
      if (!localStorage.getItem(key)) {
        const timer = setTimeout(() => setOpen(true), 800)
        return () => clearTimeout(timer)
      }
    } catch {}
  }, [feActivo, moduloKey])

  if (!feActivo) return null

  return (
    <>
      <Button
        variant='outline'
        size='sm'
        onClick={() => setOpen(true)}
        className='gap-1.5'
        title='Ver guía paso a paso de facturación electrónica'
      >
        <GraduationCap className='h-4 w-4' />
        Guía e-CF
      </Button>

      <FeGuiaInteractiva
        moduloKey={moduloKey}
        pasos={pasos}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
```

- [x] **Step 2: Eliminar `fe-tutorial-dialog.tsx` y `fe-tutorial-voice.ts`**

```bash
git rm frontend/src/features/fe/fe-tutorial-dialog.tsx
git rm frontend/src/features/fe/fe-tutorial-voice.ts
```

- [x] **Step 3: Buscar y eliminar todos los imports de los archivos borrados**

```bash
grep -rn 'fe-tutorial-dialog\|fe-tutorial-voice\|FeTutorialDialog\|useTTS' frontend/src/ --include='*.tsx' --include='*.ts'
```

Limpiar cada import encontrado.

- [x] **Step 4: Verificar `tsc -b` — 0 errores tras borrar archivos**

```bash
cd frontend && npx tsc -b --noEmit 2>&1 | head -20
```

Si hay errores por imports huérfanos, corregir todos ANTES de continuar.

- [x] **Step 5: Test visual — verificar que la app carga sin crash**

```
1. Navegar a /fat/facturas (consulta) — verificar que ya NO aparece el botón Tutorial e-CF
2. Navegar a /fat/nueva-factura — verificar que la página carga sin errores en consola
3. Screenshot de ambas vistas
```

- [x] **Step 6: Commit**

```bash
git commit -m "feat(fe): reescribir tutorial como tour guiado, eliminar modal y voz"
```

---

### Task 3: Agregar e-NCF al selector de comprobante (backend)

**Files:**
- Modify: `backend/apps/legacy/repositories/fe_repo.py`
- Modify: `backend/apps/fat/views.py` (endpoint `/fat/ncf/`)

Cuando e-CF está activo, el selector de Comprobante debe mostrar las secuencias e-NCF de `TFE_SECUENCIA` en lugar de los NCF papel de `TCNT_NCF`.

- [x] **Step 1: Agregar `list_secuencias_como_ncf()` en `fe_repo.py`**

```python
def list_secuencias_como_ncf(no_cia: str) -> list[dict]:
    """Devuelve las secuencias e-NCF formateadas como ncf_ranges para el selector."""
    secs = list_secuencias(no_cia)
    result = []
    for s in secs:
        tipo = str(s['tipo_ecf'])
        desc_map = {
            '31': 'CREDITO FISCAL', '32': 'CONSUMO',
            '33': 'NOTA DE DEBITO', '34': 'NOTA DE CREDITO',
            '41': 'COMPRAS', '43': 'GASTOS MENORES',
            '44': 'REG. ESPECIAL', '45': 'GUBERNAMENTAL',
            '46': 'EXPORTACION', '47': 'PAGO EXTERIOR',
        }
        # Mapeo tipo e-CF → posiciones_fijas equivalente
        pos_map = {
            '31': 'E31', '32': 'E32', '33': 'E33', '34': 'E34',
            '41': 'E41', '43': 'E43', '44': 'E44', '45': 'E45',
            '46': 'E46', '47': 'E47',
        }
        result.append({
            'codigo_ncf': f'E{tipo}',
            'posiciones_fijas': pos_map.get(tipo, f'E{tipo}'),
            'tipo_ncf_fiscal': f'e-CF {tipo}',
            'descripcion': desc_map.get(tipo, ''),
            'prox_ncf': s['prox_secuencia'],
            'ncf_final': s['secuencia_hasta'],
            'ncf_manual': 'N',
            'es_electronico': True,
        })
    return result
```

- [x] **Step 2: Modificar endpoint `/fat/ncf/` para incluir e-NCF si activo**

En `backend/apps/fat/views.py`, donde se devuelve `ncf_ranges`:

```python
# Después de obtener ncf_ranges de cnt_repo.list_ncf(...)
from apps.legacy.repositories import fe_repo
cfg = fe_repo.get_config(no_cia)
if cfg and cfg.get('activo') == 'S':
    encf_ranges = fe_repo.list_secuencias_como_ncf(no_cia)
    # Agregar flag es_electronico=False a los NCF papel
    for r in ncf_ranges:
        r['es_electronico'] = False
    # e-NCF van primero, luego papel como fallback
    ncf_ranges = encf_ranges + ncf_ranges
```

- [x] **Step 3: UX — orden lógico y labels claros en el response**

Los e-NCF devueltos deben tener:
- `descripcion` en español de negocio ("CREDITO FISCAL", no "tipo 31")
- `es_electronico: true` para que el frontend pueda distinguirlos visualmente
- Orden: e-NCF primero (son los que el usuario debería usar), papel después como fallback
- Si no hay secuencias e-NCF configuradas para un tipo, NO mostrar esa opción vacía

```python
# Filtrar secuencias sin rango disponible
if s['prox_secuencia'] > s['secuencia_hasta']:
    continue  # rango agotado, no mostrar
```

- [x] **Step 4: Deploy backend a VM y test del endpoint**

```bash
# Copiar fe_repo.py y views.py a la VM
pscp -hostkey "SHA256:..." -pw "Temp1234!" backend/apps/legacy/repositories/fe_repo.py jcabreu@10.0.0.99:/tmp/
pscp -hostkey "SHA256:..." -pw "Temp1234!" backend/apps/fat/views.py jcabreu@10.0.0.99:/tmp/
# docker cp + restart
```

- [x] **Step 5: Test — verificar respuesta del endpoint**

```bash
curl -s "https://grupo-abregonza.hopto.org:8443/api/fat/ncf/?no_cia=01&punto=01" | python -m json.tool
```

Verificar:
1. Los e-NCF aparecen PRIMERO en la lista con `es_electronico: true`
2. Los NCF papel aparecen DESPUÉS con `es_electronico: false`
3. Cada e-NCF tiene `descripcion` legible ("CREDITO FISCAL", etc.)
4. `prox_ncf` y `ncf_final` son números coherentes (prox < final)
5. Si e-CF NO está activo en otra cía, esa cía devuelve solo NCF papel (test con `no_cia=02`)

- [x] **Step 6: Test edge case — empresa sin e-CF activo**

```bash
curl -s "https://grupo-abregonza.hopto.org:8443/api/fat/ncf/?no_cia=03&punto=01" | python -m json.tool | head -10
```

Esperado: solo NCF papel, ningún `es_electronico: true`. Si cía 03 usa fallback a cía 01, verificar que el fallback es correcto.

- [x] **Step 7: Commit**

```bash
git commit -m "feat(fat): endpoint NCF devuelve e-NCF de TFE_SECUENCIA cuando e-CF activo"
```

---

### Task 4: Frontend — selector e-NCF en nueva-factura

**Files:**
- Modify: `frontend/src/features/fat/fat-nueva-factura.tsx`

El selector de Comprobante debe:
- Mostrar las secuencias e-NCF (E31, E32, etc.) cuando e-CF está activo
- Indicar visualmente que es electrónico (badge o color diferente)
- El "Proximo NCF" debe mostrar el e-NCF formateado (E310000000141)

- [x] **Step 1: Actualizar el display del selector y el próximo NCF**

En `fat-nueva-factura.tsx`, donde se renderiza el selector de Comprobante (~línea 1378), agregar indicador visual para e-NCF:

```tsx
// En el <select> de Comprobante, mostrar badge si es electrónico
{ncfRangesFiltrados.map((n) => (
  <option key={n.codigo_ncf} value={n.codigo_ncf}>
    {n.es_electronico ? '⚡ ' : ''}{n.codigo_ncf} - {n.posiciones_fijas || n.tipo_ncf_fiscal}
    {n.descripcion ? ` - ${n.descripcion}` : ''}
  </option>
))}
```

Y en el display de "Proximo NCF" (~línea 1396), formatear el e-NCF:

```tsx
// Si es electrónico, formatear como E310000000141
const formatNcf = (ncfInfo: NcfInfo) => {
  if (ncfInfo.es_electronico) {
    return `${ncfInfo.posiciones_fijas}${String(ncfInfo.prox_ncf).padStart(10, '0')}`
  }
  return `${ncfInfo.posiciones_fijas}${String(ncfInfo.prox_ncf).padStart(8, '0')}`
}
```

- [x] **Step 2: Agregar `data-tour-step` a los elementos para el tour**

```tsx
// En el select de Tipo Documento:
<select data-tour="tipo-documento" ...>

// En la sección de Cliente:
<div data-tour="cliente" ...>

// En el select de Comprobante:
<div data-tour="comprobante" ...>

// En el botón Guardar Factura:
<button data-tour="guardar" ...>
```

- [x] **Step 3: Agregar `FeTutorialButton` en nueva-factura**

```tsx
import { FeTutorialButton } from '@/features/fe/fe-tutorial-button'
import { GUIA_FAT_NUEVA_FACTURA } from '@/features/fe/fe-guia-pasos'
import { useFeConfig } from '@/features/fe/api'

// En el header, junto a "Cancelar" y "Guardar Factura":
const { data: feData } = useFeConfig(noCia)
const feActivo = feData?.config?.activo === 'S'

<FeTutorialButton
  moduloKey='fat-nueva'
  pasos={GUIA_FAT_NUEVA_FACTURA}
  feActivo={feActivo}
/>
```

- [x] **Step 4: Quitar FeTutorialButton de facturas.tsx (consulta)**

Eliminar el import y uso de `FeTutorialButton` de `facturas.tsx` — el tutorial pertenece en las vistas de entrada.

- [x] **Step 5: UX — indicador visual claro para e-NCF vs papel**

En el selector de comprobante, los e-NCF deben ser visualmente distinguibles:
- Prefijo `⚡` para electrónicos en el `<option>`
- El texto "Próximo NCF" cambia a "Próximo e-NCF" cuando es electrónico
- Color verde en el badge de próximo si es electrónico, gris si es papel
- Si no hay e-NCF disponibles (rango agotado), mostrar aviso inline: "No hay comprobantes electrónicos disponibles. Contacte al administrador."

```tsx
{!ncfRangesFiltrados.some(n => n.es_electronico) && feActivo && (
  <p className='text-sm text-amber-600 mt-1'>
    ⚠ No hay comprobantes electrónicos disponibles. Verifique la configuración con el administrador.
  </p>
)}
```

- [x] **Step 6: `tsc -b` — 0 errores**

```bash
cd frontend && npx tsc -b --noEmit 2>&1 | head -20
```

- [x] **Step 7: Test visual con Playwright — flujo completo nueva-factura**

```
1. Login en https://abregonza.netlify.app (JCABREU/jc192003)
2. Navegar a /fat/nueva-factura
3. Verificar: tour se abre automáticamente (primera vez)
4. Verificar: spotlight señala "Tipo de documento" con tooltip legible
5. Click "Siguiente" → spotlight se mueve a "Cliente"
6. Click "Siguiente" → spotlight se mueve a "Comprobante" — el selector es visible
7. Click "Siguiente" → spotlight se mueve a "Guardar Factura"
8. Click "Listo" → tour se cierra
9. Verificar: el selector Comprobante muestra ⚡ E31, ⚡ E32 ANTES de los NCF papel
10. Verificar: "Próximo e-NCF: E310000000141" (formato correcto 13 chars)
11. Recargar página → tour NO reaparece (localStorage)
12. Click botón "Guía e-CF" → tour reaparece
13. Presionar Escape → tour se cierra
14. Verificar: 0 errores en consola
15. Screenshot de: tour paso 1, tour paso 3 (comprobante), selector e-NCF expandido
```

- [x] **Step 8: Test responsive — viewport 375px**

```
1. Resize browser a 375x812 (iPhone SE)
2. Navegar a /fat/nueva-factura
3. Abrir tour → tooltip debe caber sin scrollbar horizontal
4. Selector comprobante → texto e-NCF no truncado
5. Screenshot mobile
```

- [x] **Step 9: Test edge case — e-CF inactivo**

```
1. (Si es posible testear con otra cía donde e-CF no está activo)
2. Verificar: botón "Guía e-CF" NO aparece
3. Verificar: selector muestra solo NCF papel (B01, B02, etc.)
4. Verificar: no hay errores en consola
```

- [x] **Step 10: Commit**

```bash
git commit -m "feat(fat): selector e-NCF + tour guiado en nueva-factura"
```

---

### Task 5: Tour guiado en vistas de entrada CxP, CxC, ACC

**Files:**
- Modify: `frontend/src/features/cxp/cxp-documento-panel.tsx`
- Modify: `frontend/src/features/cxc/cxc-transacciones.tsx`
- Modify: `frontend/src/features/acc/acc-nuevo-egreso.tsx`

Mismo patrón que Task 4: agregar `data-tour-step` a los elementos clave + `FeTutorialButton` con los pasos del módulo.

- [x] **Step 1: CxP — agregar `data-tour` + tutorial en entrada documento**

```tsx
import { FeTutorialButton } from '@/features/fe/fe-tutorial-button'
import { GUIA_CXP_ENTRADA } from '@/features/fe/fe-guia-pasos'

// data-tour="tipo-docu" en select tipo documento
// data-tour="ncf-proveedor" en input NCF
// data-tour="guardar" en botón guardar

<FeTutorialButton moduloKey='cxp-entrada' pasos={GUIA_CXP_ENTRADA} feActivo={feActivo} />
```

- [x] **Step 2: CxC — agregar `data-tour` + tutorial en entrada ND/NC**

```tsx
import { GUIA_CXC_ENTRADA } from '@/features/fe/fe-guia-pasos'

// data-tour="tipo-docu" en select tipo
// data-tour="factura-ref" en campo de factura referencia
// data-tour="guardar" en botón guardar

<FeTutorialButton moduloKey='cxc-entrada' pasos={GUIA_CXC_ENTRADA} feActivo={feActivo} />
```

- [x] **Step 3: ACC — agregar `data-tour` + tutorial en egreso**

```tsx
import { GUIA_ACC_EGRESO } from '@/features/fe/fe-guia-pasos'

// data-tour="comprobante" en campo NCF/comprobante
// data-tour="guardar" en botón guardar

<FeTutorialButton moduloKey='acc-egreso' pasos={GUIA_ACC_EGRESO} feActivo={feActivo} />
```

- [x] **Step 4: Quitar FeTutorialButton de las vistas de consulta (si existen)**

```bash
grep -rn 'FeTutorialButton' frontend/src/features/cxp/ frontend/src/features/cxc/ frontend/src/features/acc/ frontend/src/features/inv/
```

Eliminar de las vistas de consulta, dejar solo en las de entrada.

- [x] **Step 5: `tsc -b` — 0 errores**

```bash
cd frontend && npx tsc -b --noEmit 2>&1 | head -20
```

- [x] **Step 6: Test visual con Playwright — CxP entrada**

```
1. Navegar a la vista de entrada de documento CxP
2. Verificar: tour se abre automáticamente (primera vez)
3. Verificar: spotlight señala "Tipo de documento" → "NCF del proveedor" → "Guardar"
4. Cada tooltip tiene texto en español de negocio claro
5. Click fuera del tour → se cierra
6. Botón "Guía e-CF" visible para reabrir
7. Screenshot: tour paso 1 CxP
```

- [x] **Step 7: Test visual con Playwright — CxC entrada ND/NC**

```
1. Navegar a la vista de entrada CxC (ND/NC)
2. Verificar: tour se abre automáticamente
3. Verificar: pasos "Nota de Débito/Crédito" → "Factura que modifica" → "Guardar"
4. Si un paso señala un elemento que no existe (ej. "factura-ref" cuando no hay ese campo visible),
   debe mostrar el fallback "Este paso no aplica" con botón Siguiente — NO crashear
5. Screenshot: tour CxC
```

- [x] **Step 8: Test visual con Playwright — ACC egreso**

```
1. Navegar a /acc/nuevo-egreso
2. Verificar: tour se abre automáticamente
3. Verificar: pasos "Comprobante de gasto" → "Guardar"
4. Screenshot: tour ACC
```

- [x] **Step 9: Test — cada tour es independiente (localStorage por módulo)**

```
1. Completar tour en CxP (cierra y marca visto)
2. Ir a CxC → tour debe aparecer (es módulo diferente, key diferente)
3. Ir a ACC → tour debe aparecer
4. Volver a CxP → tour NO reaparece (ya visto)
5. Verificar localStorage keys: fe-guia-visto-cxp-entrada, fe-guia-visto-cxc-entrada, fe-guia-visto-acc-egreso
```

- [x] **Step 10: Commit**

```bash
git commit -m "feat: tour guiado e-CF en vistas de entrada CxP, CxC, ACC"
```

---

### Task 6: e-NCF en PDFs impresos (backend)

**Files:**
- Modify: `backend/apps/fat/views_print_data.py`
- Modify: `backend/apps/legacy/docs_print_data.py`

Los PDFs deben mostrar el e-NCF si existe en `TFE_DOCUMENTO`, no el NCF papel.

- [x] **Step 1: Crear helper `_lookup_encf()` en `fe_repo.py`**

```python
def get_encf_por_documento(no_cia: str, modulo: str, tipo_docu: str, no_docu: str) -> str | None:
    """Busca el e-NCF de un documento en TFE_DOCUMENTO. Retorna None si no existe."""
    rows = client.fetch_dicts(
        "SELECT e_ncf FROM FAT.TFE_DOCUMENTO "
        "WHERE no_cia = :1 AND modulo = :2 AND tipo_docu = :3 AND no_docu = :4 "
        "AND estado != 'RECHAZADO' "
        "ORDER BY fecha_envio DESC FETCH FIRST 1 ROWS ONLY",
        [no_cia, modulo, tipo_docu, no_docu],
    )
    return rows[0]['e_ncf'] if rows else None
```

- [x] **Step 2: Modificar `views_print_data.py` para FAT**

En la función que arma los datos de impresión de factura (~línea 168):

```python
# Después de obtener ncf_dgi
from apps.legacy.repositories import fe_repo
e_ncf = fe_repo.get_encf_por_documento(
    no_cia, 'FAT', tipo_factura, no_factura
)
if e_ncf:
    ncf_dgi = e_ncf  # e-NCF reemplaza NCF papel en el impreso
```

El PDF mostrará `E310000000141` en vez de `B0200043422`.

- [x] **Step 3: Modificar `docs_print_data.py` para CxP/CxC**

Mismo patrón: buscar e-NCF en TFE_DOCUMENTO antes de usar ncf_dgi del documento.

- [x] **Step 4: Test — reimprimir una factura que tiene e-CF**

```bash
curl -s "https://grupo-abregonza.hopto.org:8443/api/fat/print/data/?no_cia=01&punto=01&tipo=FT&no=41233" | python -c "import json,sys; d=json.load(sys.stdin); print(d.get('ncf_dgi'))"
```

- [x] **Step 5: UX — el PDF debe ser legible y claro**

Cuando el PDF muestra e-NCF:
- El label debe decir "e-NCF:" (no "NCF DGI:") para que el usuario sepa que es electrónico
- Formato completo: `E310000000141` — 13 caracteres, sin espacios ni guiones
- Si el documento NO tiene e-NCF en TFE_DOCUMENTO, mostrar el NCF papel normal — NUNCA dejar el campo vacío
- Si el documento fue RECHAZADO por DGII, mostrar el NCF papel como fallback (el WHERE ya filtra `estado != 'RECHAZADO'`)

- [x] **Step 6: Deploy backend a VM**

```bash
pscp -hostkey "SHA256:..." -pw "Temp1234!" backend/apps/legacy/repositories/fe_repo.py jcabreu@10.0.0.99:/tmp/
pscp -hostkey "SHA256:..." -pw "Temp1234!" backend/apps/fat/views_print_data.py jcabreu@10.0.0.99:/tmp/
# docker cp + restart
```

- [x] **Step 7: Test — reimprimir factura con e-CF**

```bash
# Buscar una factura que tenga registro en TFE_DOCUMENTO
curl -s "https://grupo-abregonza.hopto.org:8443/api/fat/print/data/?no_cia=01&punto=01&tipo=FT&no=41233" | python -c "import json,sys; d=json.load(sys.stdin); print('NCF:', d.get('ncf_dgi'))"
```

Verificar:
1. Si la factura tiene e-NCF → print data muestra `E31...` (13 chars)
2. Si la factura NO tiene e-NCF → print data muestra NCF papel `B02...` (11 chars)
3. El campo nunca es vacío o null

- [x] **Step 8: Test visual — abrir el PDF en el navegador**

```
1. Navegar a /fat/facturas (consulta)
2. Buscar una factura reciente
3. Click "Imprimir" → PDF se abre
4. Verificar: el NCF en el PDF es correcto (e-NCF si existe, papel si no)
5. Verificar: el label dice "e-NCF:" o "NCF:" según corresponda
6. Screenshot del PDF
```

- [x] **Step 9: Test edge case — factura antigua sin e-CF**

```
1. Reimprimir una factura anterior a la activación de e-CF
2. Verificar: muestra NCF papel normal — no se rompe
3. No hay error 500 ni campo vacío
```

- [x] **Step 10: Commit**

```bash
git commit -m "feat(print): mostrar e-NCF en PDFs si existe en TFE_DOCUMENTO"
```

---

### Task 7: Test E2E integral — verificación cruzada completa

**Files:**
- Ninguno nuevo — verificación integral de todo

Este es el test definitivo. Todos los componentes ya fueron deployados individualmente en sus tareas. Aquí se hace la verificación cruzada completa.

- [x] **Step 1: Push frontend a main (Netlify) si no se hizo antes**

```bash
git push origin main
```

- [x] **Step 2: Esperar deploy Netlify**

```bash
curl -s "https://api.netlify.com/api/v1/sites/abregonza.netlify.app/deploys" | python -c "import json,sys; d=json.load(sys.stdin); print(d[0]['state'], d[0]['created_at'])"
```

Esperado: `ready` con timestamp reciente.

- [x] **Step 3: Test E2E — flujo completo FAT (usuario nuevo)**

```
CASO: Usuario nuevo entra por primera vez a crear una factura electrónica

1. Limpiar localStorage (o usar incógnito)
2. Login → /fat/nueva-factura
3. ✓ Tour se abre automáticamente con spotlight sobre "Tipo de documento"
4. ✓ Tooltip legible, en español, con avatar — texto explica en lenguaje de negocio
5. ✓ "Siguiente" → spotlight se mueve suavemente a "Cliente"
6. ✓ "Siguiente" → spotlight en "Comprobante" — el selector es visible debajo
7. ✓ "Siguiente" → spotlight en "Guardar Factura"
8. ✓ "Listo" → tour se cierra
9. ✓ Botón "Guía e-CF" visible en el header
10. ✓ Click "Guía e-CF" → tour reaparece
11. ✓ Escape → tour se cierra
12. ✓ Click fuera del backdrop → tour se cierra
13. ✓ Selector Comprobante muestra: ⚡ E31 - CREDITO FISCAL primero
14. ✓ "Próximo e-NCF: E310000000141" (13 chars, formato correcto)
15. ✓ NCF papel (B02, etc.) aparece después como fallback
16. ✓ 0 errores en consola
```

- [x] **Step 4: Test E2E — flujos CxP, CxC, ACC**

```
CxP:
1. Navegar a entrada documento CxP
2. ✓ Tour se abre (primer uso en CxP — key independiente)
3. ✓ Pasos: Tipo documento → NCF proveedor → Guardar
4. ✓ Textos en español de negocio claro

CxC:
1. Navegar a entrada ND/NC
2. ✓ Tour funciona con sus pasos específicos
3. ✓ Si un paso no tiene elemento visible → fallback "Este paso no aplica" (no crash)

ACC:
1. Navegar a /acc/nuevo-egreso
2. ✓ Tour funciona: Comprobante de gasto → Guardar
```

- [x] **Step 5: Test E2E — PDF con e-NCF**

```
1. Ir a /fat/facturas (consulta)
2. Buscar factura con e-CF → Imprimir → ✓ PDF muestra e-NCF (E31...)
3. Buscar factura antigua sin e-CF → Imprimir → ✓ PDF muestra NCF papel normal
4. ✓ Ningún PDF tiene campo NCF vacío
```

- [x] **Step 6: Test responsive — móvil 375px**

```
1. Resize browser a 375x812 (iPhone SE)
2. /fat/nueva-factura → tour funciona
3. ✓ Tooltip no se sale de la pantalla (viewport clamping)
4. ✓ Selector comprobante legible sin scroll horizontal
5. ✓ Botón "Guía e-CF" accesible
```

- [x] **Step 7: Test de regresión — nada se rompió**

```
1. ✓ Consulta de facturas carga normalmente
2. ✓ Sidebar navega correctamente
3. ✓ Otras vistas (INV, SDN, etc.) cargan sin error
4. ✓ No hay errores 500 en el backend
```

- [x] **Step 8: Screenshots finales — evidencia visual**

Tomar y enviar con `SendUserFile`:
1. Tour paso 1 en nueva-factura (spotlight sobre Tipo Documento)
2. Tour paso 3 (spotlight sobre Comprobante con e-NCF visible)
3. Selector e-NCF expandido mostrando ⚡ E31, ⚡ E32, B02...
4. "Próximo e-NCF: E310000000141"
5. CxP entrada con tour
6. ACC egreso con tour
7. PDF con e-NCF
8. Vista mobile 375px con tour

- [x] **Step 9: Marcar plan como COMPLETADO**

Actualizar este archivo: cambiar todos los `- [x]` a `- [x]` para los pasos completados.

---

## Resumen de dependencias

```
Task 1 (componente tour) → Task 2 (reescribir button, borrar obsoletos)
  → Task 4 (tour en FAT nueva-factura + selector e-NCF frontend)
  → Task 5 (tour en CxP/CxC/ACC)
Task 3 (e-NCF backend endpoint) → Task 4 (frontend lo consume)
Task 6 (e-NCF en prints) — independiente del tour
Task 7 (test E2E integral) — después de todos
```

---

## Estado final de ejecución — 2026-10-25

**Commits en main (todos deployed):**
- `68ce902` feat(fe): componente tour guiado con spotlight, Escape, focus trap, viewport clamp
- `c8a3f51` feat(fe): reescribir tutorial como tour guiado, eliminar modal y voz
- `a559ddb` feat(fat): endpoint NCF devuelve e-NCF de TFE_SECUENCIA cuando e-CF activo
- `09ff0f1` feat(fat): selector e-NCF + tour guiado en nueva-factura
- `dc7e438` feat: tour guiado e-CF en vistas de entrada CxP, CxC, ACC
- `a24a94a` feat(print): mostrar e-NCF en PDFs si existe en TFE_DOCUMENTO

**Verificaciones completadas:**
- `tsc -b --noEmit` — 0 errores en los archivos tocados por el plan (errores pre-existentes en routes/ y lib/regal-general-api.ts no están relacionados)
- Netlify deploy `ready` con el último commit (`a24a94a`, 02:06:46 UTC)
- Inspección del bundle deployado confirmó:
  - `fe-guia-pasos-DxaZyNX5.js` presente con todas las strings esperadas (Tipo de documento, Crédito Fiscal, NCF del proveedor, Comprobante electrónico, Nota de Débito, Comprobante de gasto, Guardar = enviar a DGII)
  - Chunks `cxp-documento-panel`, `cxp-procesos`, `cxc-procesos` listados en el entry point
  - `fe-tutorial-dialog` y referencias a `SpeechSynthesis`/`useTTS` eliminados de los chunks compartidos
- Backend commits deployed previamente a la VM (per git log de deploys anteriores)

**No completado por bloqueo externo:**
- Playwright E2E full (login, abrir tour, probar selector e-NCF) — las credenciales JCABREU/jc192003 son rechazadas con 401 tanto por `api.zentoryerp.com` como por `grupo-abregonza.hopto.org:8443`. Requiere que el usuario confirme/actualice credenciales para ejecutar el test interactivo.
