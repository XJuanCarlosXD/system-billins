# Correcciones e-CF: Tutorial guiado real, e-NCF en selector, prints, voz

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir el pegamento e-CF: (1) reemplazar el modal genérico por un panel guiado paso a paso que señale elementos reales de la UI con spotlight/tooltip, (2) agregar e-NCF al selector de comprobante cuando e-CF está activo, (3) mostrar e-NCF en los PDFs impresos, (4) eliminar Web Speech API y usar síntesis de voz de calidad en español o eliminar voz. Todo en las vistas de ENTRADA de documento (nueva-factura, entrada CxP, entrada CxC, egreso ACC).

**Architecture:** El tutorial deja de ser un Dialog modal genérico y se convierte en un panel lateral/overlay tipo "tour guiado" que usa `data-tour-step` attributes en los elementos reales de la UI + un overlay con spotlight (rectángulo recortado) y tooltip posicionado junto al elemento señalado. Sin librería externa — componente propio `FeGuiaInteractiva` con CSS clip-path para spotlight. El selector de NCF consulta `TFE_SECUENCIA` cuando e-CF está activo. Los prints buscan el e-NCF en `TFE_DOCUMENTO`.

**Tech Stack:** React + shadcn/ui + TanStack Query / Python 3.12 / Django / Oracle

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

- [ ] **Step 1: Crear `fe-guia-pasos.ts` — definición de pasos por módulo**

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

- [ ] **Step 2: Crear `fe-guia-interactiva.tsx` — componente de tour con spotlight**

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

- [ ] **Step 3: Correr `tsc -b` para verificar tipos**

```bash
cd frontend && npx tsc -b --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/fe/fe-guia-interactiva.tsx frontend/src/features/fe/fe-guia-pasos.ts
git commit -m "feat(fe): componente tour guiado con spotlight — reemplaza modal genérico"
```

---

### Task 2: Reescribir FeTutorialButton y eliminar archivos obsoletos

**Files:**
- Rewrite: `frontend/src/features/fe/fe-tutorial-button.tsx`
- Delete: `frontend/src/features/fe/fe-tutorial-dialog.tsx`
- Delete: `frontend/src/features/fe/fe-tutorial-voice.ts`

- [ ] **Step 1: Reescribir `fe-tutorial-button.tsx`**

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

- [ ] **Step 2: Eliminar `fe-tutorial-dialog.tsx` y `fe-tutorial-voice.ts`**

```bash
git rm frontend/src/features/fe/fe-tutorial-dialog.tsx
git rm frontend/src/features/fe/fe-tutorial-voice.ts
```

- [ ] **Step 3: Buscar y eliminar todos los imports de los archivos borrados**

```bash
grep -rn 'fe-tutorial-dialog\|fe-tutorial-voice\|FeTutorialDialog\|useTTS' frontend/src/ --include='*.tsx' --include='*.ts'
```

Limpiar cada import encontrado.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(fe): reescribir tutorial como tour guiado, eliminar modal y voz"
```

---

### Task 3: Agregar e-NCF al selector de comprobante (backend)

**Files:**
- Modify: `backend/apps/legacy/repositories/fe_repo.py`
- Modify: `backend/apps/fat/views.py` (endpoint `/fat/ncf/`)

Cuando e-CF está activo, el selector de Comprobante debe mostrar las secuencias e-NCF de `TFE_SECUENCIA` en lugar de los NCF papel de `TCNT_NCF`.

- [ ] **Step 1: Agregar `list_secuencias_como_ncf()` en `fe_repo.py`**

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

- [ ] **Step 2: Modificar endpoint `/fat/ncf/` para incluir e-NCF si activo**

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

- [ ] **Step 3: Test — verificar que `/fat/ncf/` devuelve e-NCF**

```bash
curl -s "https://grupo-abregonza.hopto.org:8443/api/fat/ncf/?no_cia=01&punto=01" | python -m json.tool | head -30
```

- [ ] **Step 4: Commit**

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

- [ ] **Step 1: Actualizar el display del selector y el próximo NCF**

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

- [ ] **Step 2: Agregar `data-tour-step` a los elementos para el tour**

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

- [ ] **Step 3: Agregar `FeTutorialButton` en nueva-factura**

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

- [ ] **Step 4: Quitar FeTutorialButton de facturas.tsx (consulta)**

Eliminar el import y uso de `FeTutorialButton` de `facturas.tsx` — el tutorial pertenece en las vistas de entrada.

- [ ] **Step 5: Commit**

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

- [ ] **Step 1: CxP — agregar `data-tour` + tutorial en entrada documento**

```tsx
import { FeTutorialButton } from '@/features/fe/fe-tutorial-button'
import { GUIA_CXP_ENTRADA } from '@/features/fe/fe-guia-pasos'

// data-tour="tipo-docu" en select tipo documento
// data-tour="ncf-proveedor" en input NCF
// data-tour="guardar" en botón guardar

<FeTutorialButton moduloKey='cxp-entrada' pasos={GUIA_CXP_ENTRADA} feActivo={feActivo} />
```

- [ ] **Step 2: CxC — agregar `data-tour` + tutorial en entrada ND/NC**

```tsx
import { GUIA_CXC_ENTRADA } from '@/features/fe/fe-guia-pasos'

// data-tour="tipo-docu" en select tipo
// data-tour="factura-ref" en campo de factura referencia
// data-tour="guardar" en botón guardar

<FeTutorialButton moduloKey='cxc-entrada' pasos={GUIA_CXC_ENTRADA} feActivo={feActivo} />
```

- [ ] **Step 3: ACC — agregar `data-tour` + tutorial en egreso**

```tsx
import { GUIA_ACC_EGRESO } from '@/features/fe/fe-guia-pasos'

// data-tour="comprobante" en campo NCF/comprobante
// data-tour="guardar" en botón guardar

<FeTutorialButton moduloKey='acc-egreso' pasos={GUIA_ACC_EGRESO} feActivo={feActivo} />
```

- [ ] **Step 4: Quitar FeTutorialButton de las vistas de consulta (si existen)**

```bash
grep -rn 'FeTutorialButton' frontend/src/features/cxp/ frontend/src/features/cxc/ frontend/src/features/acc/ frontend/src/features/inv/
```

Eliminar de las vistas de consulta, dejar solo en las de entrada.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: tour guiado e-CF en vistas de entrada CxP, CxC, ACC"
```

---

### Task 6: e-NCF en PDFs impresos (backend)

**Files:**
- Modify: `backend/apps/fat/views_print_data.py`
- Modify: `backend/apps/legacy/docs_print_data.py`

Los PDFs deben mostrar el e-NCF si existe en `TFE_DOCUMENTO`, no el NCF papel.

- [ ] **Step 1: Crear helper `_lookup_encf()` en `fe_repo.py`**

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

- [ ] **Step 2: Modificar `views_print_data.py` para FAT**

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

- [ ] **Step 3: Modificar `docs_print_data.py` para CxP/CxC**

Mismo patrón: buscar e-NCF en TFE_DOCUMENTO antes de usar ncf_dgi del documento.

- [ ] **Step 4: Test — reimprimir una factura que tiene e-CF**

```bash
curl -s "https://grupo-abregonza.hopto.org:8443/api/fat/print/data/?no_cia=01&punto=01&tipo=FT&no=41233" | python -c "import json,sys; d=json.load(sys.stdin); print(d.get('ncf_dgi'))"
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(print): mostrar e-NCF en PDFs si existe en TFE_DOCUMENTO"
```

---

### Task 7: Deploy a VM + Netlify y test E2E visual

**Files:**
- Ninguno nuevo — deploy y verificación

- [ ] **Step 1: Deploy backend a VM**

Archivos modificados:
- `backend/apps/legacy/repositories/fe_repo.py`
- `backend/apps/fat/views.py`
- `backend/apps/fat/views_print_data.py`
- `backend/apps/legacy/docs_print_data.py`

```bash
pscp -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" <archivos> jcabreu@10.0.0.99:/tmp/
# docker cp + restart
```

- [ ] **Step 2: Push frontend a main (Netlify)**

```bash
git push origin main
```

- [ ] **Step 3: Verificar E2E en el navegador**

1. Ir a `/fat/nueva-factura` → debe aparecer el tour guiado automáticamente
2. El tour debe señalar con spotlight el Tipo Documento → Cliente → Comprobante → Guardar
3. El selector Comprobante debe mostrar `⚡ E31 - CREDITO FISCAL`
4. El "Proximo NCF" debe mostrar `E310000000141` (no `B0200043422`)
5. Botón "Guía e-CF" siempre visible para reabrir el tour
6. No hay voz robótica
7. Ir a CxP entrada → tour con sus pasos
8. Reimprimir una factura → PDF muestra e-NCF
9. Probar skip en cualquier momento

- [ ] **Step 4: Screenshot de cada vista para verificación**

Tomar screenshot de:
- Tour paso 1 en nueva-factura (spotlight sobre Tipo Documento)
- Tour paso 3 (spotlight sobre Comprobante con e-NCF visible)
- CxP entrada con tour
- PDF de factura con e-NCF

---

## Resumen de dependencias

```
Task 1 (componente tour) → Task 2 (reescribir button, borrar obsoletos)
  → Task 4 (tour en FAT nueva-factura + selector e-NCF frontend)
  → Task 5 (tour en CxP/CxC/ACC)
Task 3 (e-NCF backend endpoint) → Task 4 (frontend lo consume)
Task 6 (e-NCF en prints) — independiente del tour
Task 7 (deploy + E2E) — después de todos
```
