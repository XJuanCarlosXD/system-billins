# INV — Rediseño Consulta de Documentos + PDF Header

**Fecha:** 2026-06-03
**Módulo:** Inventario (INV)
**Origen:** Usuario reportó que el PDF de "Reporte de Documento" mete `Documento: AF-0001231 Fecha: ... Punto: 01 • Tipo Movimiento: Entrada Tipo Transacción: Ajuste Físico • Almacén: 01 • TOTAL NETO: 130.00` todo en un mismo renglón, muestra códigos sin descripción ("Almacén: 01"), y la vista Consulta de Documentos es un "sancocho" sin jerarquía visual.

## Objetivos

1. PDF `inv_documento_pdf`: header con grilla de 2 columnas + bloque de totales, mostrando descripciones (no códigos crudos).
2. UI `consulta-documentos.tsx`: KPIs arriba, tabla con icono de movimiento, tipo doc con descripción, almacén legible, panel de detalle con info-grid igual al PDF.
3. Backend: enriquecer endpoints para entregar descripciones de punto / almacén / tipo doc cuando falten.

## Decisiones de diseño

- **Layout PDF:** grilla 2 columnas con bloques semánticos (`DOCUMENTO`, `MOVIMIENTO`, `ORIGEN/DESTINO`, `PRODUCCIÓN`, `TOTALES`). Bloque `TOTALES` ocupa ancho completo y destaca `TOTAL NETO`.
- **Layout UI:** KPIs (12 docs / Entradas / Salidas / Total) + tabla compacta con badge de tipo movimiento.
- **Compatibilidad:** mantener `subtitle_lines` en `_render_modern_report_pdf` para no romper otros reportes (Rfat201, Rfat321, Rfat333, Rfat237, Rfat326, etc.). Añadir `info_blocks` opcional.

## Arquitectura

### Backend

#### 1. `apps/fat/views_print.py` — extender `_render_modern_report_pdf`

Nueva firma:

```python
def _render_modern_report_pdf(
    *,
    report_id: str,
    title: str,
    cia,
    subtitle_lines: list[str] | None = None,
    info_blocks: list[dict] | None = None,   # NUEVO
    sections: list[dict],
    signature_labels: list[str] = None,
    ...
):
```

Estructura de `info_blocks`:

```python
[
    {
        'title': 'DOCUMENTO',           # opcional
        'rows': [                       # lista de (label, value)
            ('Punto',     '01 - Principal'),
            ('Almacén',   '01 - General'),
            ('Localidad', '01 - Santo Domingo'),
            ('Fecha',     '03/06/2026'),
        ],
    },
    {
        'title': 'MOVIMIENTO',
        'rows': [
            ('Tipo Movimiento',  'Entrada'),
            ('Tipo Transacción', 'Ajuste Físico'),
            ('Estado',           'Autorizado'),
            ('Usuario',          'JCABREU'),
        ],
    },
    {
        'title': 'TOTALES',
        'span_full': True,              # ocupa ancho completo
        'inline': True,                 # render en una sola fila con separadores
        'rows': [
            ('Total Bruto', '130.00'),
            ('ITBIS',       '0.00'),
            ('TOTAL NETO',  '130.00'),  # último en bold + size+1
        ],
    },
]
```

**Renderer:**
- Si vienen `info_blocks`: arma `Table` con celdas que contienen sub-`Table` de dos columnas (label ancho fijo `~22mm`, valor flex). Bloques `span_full=False` se agrupan de 2 en 2 por fila. `inline=True` los pone como `Label: Valor    Label: Valor    ...` en una sola línea.
- Si vienen `subtitle_lines` (legacy): comportamiento actual.
- Si vienen ambos: `subtitle_lines` primero, luego `info_blocks`.

Estilos:
- Mini-título del bloque: gris oscuro, `bold`, `size 8`, separador horizontal de 0.4pt.
- Pares label/valor: label gris (`#64748B`), valor negro normal.
- `TOTAL NETO` en `#0F172A`, `bold`, size +1.

#### 2. `apps/legacy/repositories/inv_repo.py` — `get_documento_detalle`

Añadir LEFT JOIN a `INV.TINV_PUNTO` y `INV.TINV_ALMACEN`:

```sql
LEFT JOIN INV.TINV_PUNTO    pt ON pt.no_cia = r.no_cia AND pt.punto = r.punto
LEFT JOIN INV.TINV_ALMACEN  al ON al.no_cia = r.no_cia AND al.punto = r.punto
                              AND al.almacen = <almacen del header o primera línea>
```

Devolver en `header`:
- `punto_descripcion` (de `TINV_PUNTO.descripcion`)
- `almacen_descripcion` (de `TINV_ALMACEN.descri`)

Si no hay almacén en el header (tipo `AF`/`TA`), tomar el primer almacén distinto de las líneas y resolver.

#### 3. `apps/legacy/inv_views.py` — `inv_documento_pdf`

Reemplazar la construcción de `subtitle = [...]` por `info_blocks = [...]`. Cada campo opcional se agrega como par `(label, value)` sólo si tiene valor (mismo principio que hoy). Mapeo:

- **DOCUMENTO:** Punto, Almacén, Localidad, Fecha, Conduce (si hay).
- **MOVIMIENTO:** Tipo Movimiento, Tipo Transacción, Estado, Usuario, Reimpresión (si aplica).
- **ORIGEN/DESTINO** (sólo si hay proveedor o cliente):
  - Proveedor (`EC`, `DC`): código - nombre, RNC.
  - Cliente (`DV`, `EA`): código - nombre, RNC, Dirección, Vendedor.
  - NCF (si hay).
- **REFERENCIAS** (sólo si aplica): Referencia, Doc. devuelto, Doc. reversado, Motivo reverso.
- **PROYECTO/OP** (sólo si aplica): Componente, Depto, OP, OT, Tipo OP.
- **PRODUCCIÓN** (sólo Finv204): Granulometría, Viscosidad, Peso 1, Peso 2.
- **DETALLE/NOTA** (sólo si hay): `subtitle_lines` por su longitud.
- **TOTALES** (`span_full=True`, `inline=True`): Total Bruto, Descuento, ITBIS, Valor Bienes, Valor Servicio, **TOTAL NETO**.

Llamada final pasa `subtitle_lines=[detalle, nota]` cuando los hay (texto largo) y `info_blocks=[...]` para los bloques estructurados.

#### 4. Endpoint `/inv/documentos/` (lista)

Verificar que cada fila incluya:
- `desc_almacen` (ya existe en el código actual de la UI; confirmar en backend)
- `desc_tipo_docu` (descripción de `TINV_TDOCU.descri`)
- `tipo_movi` ('E' / 'S' / 'T')

Si falta alguno, extender la query del listado con los JOINs equivalentes.

### Frontend (`consulta-documentos.tsx`)

#### Componentes nuevos (mismo archivo)

1. **`<KpiCards rows />`** — 4 tarjetas con `useMemo` sobre `rows`:
   - 📄 **Total docs** — `rows.length`
   - ↓ **Entradas** — count y suma donde `tipo_movi === 'E'`
   - ↑ **Salidas** — count y suma donde `tipo_movi === 'S'`
   - **Total neto** — suma de `total` del período

2. **`<TipoMoviIcon tipo />`** — Ícono lucide-react según `tipo_movi`:
   - `E` → `ArrowDownToLine` verde
   - `S` → `ArrowUpFromLine` naranja
   - `T` → `ArrowLeftRight` azul
   - default → `Minus` gris

3. **`<DocumentoInfoGrid header />`** — clon HTML del info-grid del PDF para el panel lateral. Recibe `header` del endpoint detalle. Renderiza los mismos bloques (DOCUMENTO / MOVIMIENTO / ORIGEN-DESTINO / TOTALES) usando `grid grid-cols-2 gap-x-6 gap-y-1` y mini-títulos `text-xs font-semibold uppercase text-muted-foreground`.

#### Layout principal

```tsx
<div className='space-y-4'>
  <Header />                              {/* título + descripción */}
  <KpiCards rows={rows} />                {/* 4 cards */}
  <Filters ... />                         {/* mismos filtros, sin cambio */}
  <Table>
    {/* columnas:
        - Mov (icono coloreado)
        - Documento (badge tipo + 'Descripción' arriba, 'AF-0001231' mono abajo)
        - Fecha
        - Almacén (descripción)
        - Estado (badge)
        - Total (RD$ con bold)
        - Acciones (ver / PDF)
    */}
  </Table>
  <Sheet>
    <DocumentoInfoGrid header={detalle.header} />
    <PdfButton />
    <LineasTable lineas={detalle.lineas} columnas={CURATED_COLS} />
  </Sheet>
</div>
```

#### Columnas curadas para `lineas` en el panel

Reemplazar el `Object.keys(detalle.lineas[0])` actual por:

```ts
const CURATED_COLS = [
  { key: 'no_linea',    label: 'Ln',          align: 'center' },
  { key: 'no_produ',    label: 'Código',      align: 'left',  mono: true },
  { key: 'descripcion', label: 'Descripción', align: 'left' },
  { key: 'unidad',      label: 'Unid.',       align: 'left' },
  { key: 'cantidad',    label: 'Cant.',       align: 'right', format: 'qty' },
  { key: 'costo',       label: 'Costo',       align: 'right', format: 'money' },
  { key: 'impuesto',    label: 'ITBIS',       align: 'right', format: 'money' },
  { key: 'monto_neto',  label: 'Monto Neto',  align: 'right', format: 'money' },
]
```

Tolera ausencia de campos (renderiza `—`).

## Flujo de datos

```
[Filtros] → GET /inv/documentos/?no_cia&tipo_docu&almacen&desde&hasta&estado
         → rows[] con {tipo_docu, no_docu, fecha, desc_tipo_docu, desc_almacen, tipo_movi, estado, total}
         → KpiCards (useMemo) + Tabla principal

[Click fila] → GET /inv/documentos/<tipo>/<no>/?no_cia
            → {header: {... + punto_descripcion + almacen_descripcion}, lineas: [...]}
            → DocumentoInfoGrid + LineasTable

[Click PDF] → Abrir en nueva pestaña /inv/documentos/<tipo>/<no>/pdf/?no_cia
           → PDF con info_blocks renderizado en grilla 2-col
```

## Pruebas

### Backend
1. `python manage.py shell` → llamar `_render_modern_report_pdf` con `info_blocks` mock, escribir PDF a disco, abrir y validar grilla 2-col + bloque TOTALES de ancho completo.
2. Smoke `inv_documento_pdf` con `AF-0001231`, `EC-0000456`, `DV-0000789`, `TA-...` — verificar:
   - Header con descripción de Punto y Almacén (no códigos pelados).
   - Bloque `ORIGEN/DESTINO` aparece sólo cuando hay proveedor/cliente.
   - Bloque `TOTALES` siempre presente.
3. Smoke con multi-empresa (CIA 01/02/03) — verificar guardia 403 sigue funcionando.

### Frontend
1. `npx tsc --noEmit` exit 0.
2. Abrir `/inv/consulta-documentos` en VM, verificar:
   - KPIs reflejan el resumen del período.
   - Tabla muestra ícono ↓/↑ + descripción tipo doc + descripción almacén.
   - Click fila abre panel con info-grid (bloques + líneas).
   - Click 📄 abre PDF nuevo en pestaña.
3. Filtrar por tipo movimiento (entradas/salidas) y verificar KPIs recalculan.

## Riesgos / mitigaciones

- **Riesgo:** Otros reportes que usan `_render_modern_report_pdf` se ven afectados.
  **Mitigación:** `info_blocks` es opcional y aditivo. Si no se pasa, comportamiento idéntico al actual.
- **Riesgo:** Endpoints `/inv/documentos/` y `get_documento_detalle` no tienen `desc_almacen` para todos los tipos.
  **Mitigación:** LEFT JOIN para no romper si el código no existe; fallback `desc_almacen || almacen || '—'` en frontend.
- **Riesgo:** Layout de info-grid no entra en una página A4.
  **Mitigación:** Bloques son condicionales (sólo aparecen si tienen datos). `subtitle_lines` (Detalle/Nota) limitadas a 90 chars.

## Fuera de alcance

- No tocar otros módulos (CXC/CXP/FAT) — mismo patrón puede aplicarse después si el usuario lo pide.
- No tocar lógica de negocio: cálculos, NCF, multi-empresa siguen igual.
- No tocar Impresión de Documentos (`Rinv206/Rinv207`) — eso es otro reporte; el actual sólo aborda el "documento individual" (PDF de Consulta).

## Artefactos

- Backend: `apps/fat/views_print.py`, `apps/legacy/inv_views.py`, `apps/legacy/repositories/inv_repo.py`
- Frontend: `frontend/src/features/inv/consulta-documentos.tsx`
- Sin cambios en rutas, permisos, schema Oracle.
