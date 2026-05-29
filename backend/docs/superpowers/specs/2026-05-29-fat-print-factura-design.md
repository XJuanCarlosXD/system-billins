# FAT — Print: PDF de factura fiscal FC/FT con NCF B01-B15

**Fecha:** 2026-05-29
**Autor:** Claude + JCABREU (brainstorming)
**Estado:** Aprobado, pendiente de plan de implementación
**Tickets relacionados:** Cierra el `TODO: Generar PDF` original (`backend/fat/views.py:177` — sistema Django paralelo, no usado en producción)
**Spec hermano:** `2026-05-29-inv-rinv70x-reportes-design.md` (mismo patrón helper compartido)

## Contexto

El módulo de Facturación legacy SIGAFT (sistema Oracle, accedido vía `apps/legacy/repositories/fat_repo.py`) no genera PDFs de las facturas. Los usuarios necesitan poder imprimir las facturas — esto se traduce a "generar un PDF que se abra en el navegador y desde ahí se imprima" (mismo patrón que se aplicó en INV: `Content-Disposition: inline`, `reportlab`, sin drivers matriciales).

Durante el diseño el usuario aclaró requisitos no obvios:
- Las facturas deben mostrar la **razón social** de la empresa (ej. "ABREGONZA, SRL"), no el código numérico ("01").
- Los campos `tipo_pago`, `vendedor`, etc. deben mostrarse con su **descripción**, no el código crudo.
- El NCF debe mostrarse en formato fiscal DGI **B01-B15** (o E-CF si aplica), nunca formatos inventados.
- Los IDs internos de base de datos (`id_factura`, PK numérica) NO deben aparecer en el PDF.

## Objetivos

- Implementar un endpoint `GET /api/fat/documentos/<tipo>/<no_factura>/pdf/` que retorne el PDF de una factura existente en Oracle (`FAT.TFAT_FACTURA`).
- Tipos soportados en este sprint: **FC** (Factura Crédito → NCF B01) y **FT** (Factura Contado → NCF B02).
- Validar que `tipo_ncf_fiscal` esté en el set DGI válido antes de generar el PDF; rechazar si no.
- Helper PDF reutilizable entre INV y FAT (extender `_build_pdf_report` con `header_extra`/`footer_extra`, mover a módulo compartido).
- Wire button "Imprimir" del detalle de factura en el frontend para abrir el PDF en nueva pestaña.

## Out of scope

- Tipos `CO` (Conduce) y `CT` (Cotización) → sprint siguiente.
- Notas de crédito (B04) y notas de débito (B03) → otro flujo.
- Comprobantes electrónicos E-CF (E31, E32, E41, etc.) — modelar después; este sprint sólo soporta NCF físicos B01-B15.
- Impresión a impresora matricial / formato pre-impreso fiscal con posiciones absolutas — Fase 3 según `docs/13_impresion_pendiente.md`.
- Recibos de cobro, cheques, órdenes de compra — son otros módulos.
- TODO huérfano en `backend/fat/views.py:177` (sistema Django paralelo): se marca obsoleto pero no se borra en este sprint (ticket separado de housekeeping).

## Arquitectura

### Mismo approach que INV (validado en sesión 2026-05-29)

| Componente | Archivo | Responsabilidad |
|---|---|---|
| URL routing | `backend/apps/fat/urls.py` | 1 nueva línea `path('documentos/<str:tipo>/<str:no_factura>/pdf/', ...)` |
| View | `backend/apps/fat/views_print.py` (nuevo módulo) | `fat_documento_pdf(request, tipo, no_factura)` |
| Repositorio SQL | `backend/apps/legacy/repositories/fat_repo.py` | Reusar `get_factura()` existente + nueva `get_factura_lineas()`, `get_condicion_pago()`, `get_cliente()` |
| Helper PDF compartido | `backend/apps/legacy/pdf_helpers.py` (mover de `inv_views.py:_build_pdf_report`) | Extender firma con `header_extra`, `footer_extra`, `page_size`. Cero impacto a calls existentes (defaults preservan comportamiento). |
| Cía resolver | `inv_repo.get_compania(no_cia)` | Ya existe. Devuelve dict con `descripcion`. |
| Frontend trigger | `frontend/src/features/fat/factura-detail.tsx` (donde sea que esté el detalle) | Botón "Imprimir" → `window.open('/api/fat/documentos/FC/12345/pdf/?no_cia=01&punto=01')` |

### Helper compartido — `_build_pdf_report` extendido

Firma nueva (defaults preservan comportamiento INV actual):
```python
def _build_pdf_report(
    title: str,
    columns: list[str],
    rows: list[dict],
    col_widths: list | None = None,
    *,
    header_extra: list[str] | None = None,   # Paragraph antes de la tabla
    footer_extra: list[str] | None = None,   # Paragraph después de la tabla
    page_size=None,                          # default: landscape(letter); FAT pasa letter portrait
) -> bytes:
```

Migración: mover de `apps/legacy/inv_views.py` a `apps/legacy/pdf_helpers.py`. `inv_views.py` hace `from apps.legacy.pdf_helpers import build_pdf_report`. `apps/fat/views_print.py` hace lo mismo.

## Datos mostrados en el PDF

### Header empresa (header_extra párrafos 1-3)

| Campo | Origen | Notas |
|---|---|---|
| Razón social | `inv_repo.get_compania(no_cia).descripcion` | **No mostrar `no_cia` como label**, sólo el nombre. |
| RNC empresa | `cia.rnc` (verificar columna; si no existe, omitir línea) | Para que la factura sea fiscalmente válida |
| Dirección empresa | `cia.direccion` (verificar) | Si no existe campo, omitir |

### Header documento (header_extra párrafos 4-7)

| Campo | Origen | Display |
|---|---|---|
| No. Factura | `f.no_factura` | Ej. `"Factura No. 12345"` (título grande) |
| Fecha | `f.fecha` | `dd/mm/yyyy` |
| Vendedor | `f.codigo_vendedor` + JOIN `TFAT_VENDEDOR.descripcion` | `"V001 — Juan Pérez"`. **No mostrar sólo el código.** |
| Condición de pago | `f.cond_pago` + JOIN `TFAT_CONDICION_PAGO.descripcion` | `"30 días"`, **NO `"Tipo pago: 1"`** |
| NCF | `f.codigo_ncf` (número físico ej. `B0100012345`) | Si está vacío, mostrar "(sin NCF)" — algunas FT pueden no tener NCF según política |
| Tipo NCF | `f.tipo_ncf_fiscal` | `B01` (Crédito Fiscal), `B02` (Consumo). Mostrar también descripción humana entre paréntesis. |

### Header cliente (header_extra párrafos 8-10)

| Campo | Origen |
|---|---|
| Nombre cliente | `f.no_cliente` → JOIN `TCXC_CLIENTE.descripcion` |
| RNC/Cédula cliente | `cli.rnc` |
| Dirección cliente | `cli.direccion` |

### Tabla líneas (columns + rows)

Columnas: `LINEA | CODIGO | DESCRIPCION | CANT | PRECIO | DSCTO | ITBIS | TOTAL`.

Filas: `fat_repo.get_factura_lineas(no_cia, punto, tipo_factura, no_factura)`. SQL ya existe parcialmente en `fat_repo.py` (sección líneas). Verificar columnas reales en `TFAT_FACTURAL`.

### Footer totales (footer_extra párrafos)

| Campo | Origen |
|---|---|
| Subtotal | `f.subtotal` o `sum(linea.monto_neto)` |
| Descuento total | `f.descuento_total` o `sum(linea.descuento)` |
| ITBIS 18% | `f.impuesto` |
| **Total general** | `f.total_neto` |
| Notas de pie | `TFAT_NOTAS_PIE` por empresa (texto libre, ej. "Esta factura no tiene devolución después de 7 días") |

### Lo que NO se muestra (whitelist negativo)

- `id` (PK Django) o cualquier número interno
- `f.no_cia` como string crudo ("01")
- `f.cond_pago` como código ("1", "2")
- `f.codigo_vendedor` solo (sin nombre)
- `f.tipo_ncf_fiscal` formatos no DGI (`"CG-004"`, `"AB-1"`, etc.)
- Cualquier columna `*_id` o `*_pk`

## Validación NCF

Constante en `apps/fat/views_print.py`:
```python
TIPOS_NCF_VALIDOS_FISICOS = {
    'B01', 'B02', 'B03', 'B04', 'B11', 'B12', 'B13', 'B14', 'B15',
}
# E-CF (E31, E32, E41, etc.) — sprint siguiente
```

Al inicio de la view:
```python
if (f.tipo_ncf_fiscal or '').strip().upper() not in TIPOS_NCF_VALIDOS_FISICOS:
    return JsonResponse({
        'error': f"NCF tipo '{f.tipo_ncf_fiscal}' no es válido DGI (debe ser B01..B15)"
    }, status=422)
```

(Excepción: si `tipo_factura == 'CT'` cotización en sprint siguiente, no se valida NCF porque cotizaciones no llevan.)

## Frontend (mínimo viable)

En el componente que muestra el detalle de una factura (probablemente `frontend/src/features/fat/factura-detail.tsx` o similar — confirmar antes de implementar), agregar:

```tsx
<Button
  variant="secondary"
  onClick={() => {
    const qs = new URLSearchParams({ no_cia, punto })
    const url = `${API_BASE}/fat/documentos/${tipoFactura}/${noFactura}/pdf/?${qs}`
    window.open(url, '_blank')
  }}
>
  <Printer className="size-4 mr-2" />
  Imprimir / PDF
</Button>
```

El navegador abre el PDF inline; el usuario presiona Ctrl+P o el botón de impresión del visor para imprimir.

## Manejo de errores

| Caso | HTTP | Body |
|---|---|---|
| Factura no encontrada | 404 | `{"error": "Factura no encontrada"}` |
| Tipo NCF inválido (no B01..B15) | 422 | `{"error": "NCF tipo 'X' no es válido DGI"}` |
| Tipo factura no soportado (no FC/FT) | 400 | `{"error": "Tipo de documento 'X' no soportado en este sprint"}` |
| reportlab no instalado | 500 | `{"error": "reportlab no instalado"}` |
| Excepción genérica | 500 | `{"error": "<str(e)>"}` |
| Empresa sin razón social | OK | Fallback: mostrar el `no_cia` como nombre |

## Plan de pruebas

### Smoke (curl autenticado)

1. `GET /api/fat/documentos/FC/{numero_real}/pdf/?no_cia=01&punto=01` → HTTP 200 + Content-Type `application/pdf` + size > 5 KB.
2. `GET /api/fat/documentos/FC/9999999/pdf/?no_cia=01&punto=01` → HTTP 404.
3. `GET /api/fat/documentos/FT/{numero_real}/pdf/?no_cia=01&punto=01` → HTTP 200.
4. `GET /api/fat/documentos/CO/123/pdf/?no_cia=01&punto=01` → HTTP 400 ("CO no soportado este sprint").

### Visual (Playwright + lectura PDF)

1. Login → navegar al detalle de una factura existente FC en empresa 01.
2. Click botón "Imprimir / PDF" → verifica que se abra pestaña con PDF.
3. Descargar el PDF y leerlo con Read nativo de Claude Code.
4. **Verificar literalmente**:
   - Aparece "ABREGONZA, SRL" (no "Empresa 01")
   - Aparece el NCF físico formato `B01XXXXXXXXXX` con el tipo entre paréntesis "(B01 — Crédito Fiscal)"
   - Aparece el nombre del vendedor (no solo el código)
   - Aparece "Condición: Contado" o "Condición: 30 días" (no "Cond.pago: 1")
   - NO aparece ningún `id=` ni PK interna
   - El RNC del cliente aparece
   - Totales: Subtotal, ITBIS 18%, Total general — coinciden con la suma de las líneas

### Validación de negocio con datos reales (empresa 01)

- Tomar una factura B01 real, generar PDF, comparar con la versión Oracle Forms original (captura legacy en `capturas/facturacion/`).
- Si hay discrepancia de columnas o totales, escalar antes de cerrar el sprint.

## Plan de deploy

1. `pscp pdf_helpers.py` nuevo a `apps/legacy/pdf_helpers.py`.
2. `pscp inv_views.py` modificado (import desde pdf_helpers, mismo comportamiento).
3. Probar reportes INV siguen funcionando (smoke con `curl`).
4. `pscp views_print.py` nuevo a `apps/fat/`.
5. `pscp urls.py` (apps/fat) con nueva ruta.
6. Hot reload Django (~5 s) — smoke test factura PDF.
7. `pscp` archivos frontend modificados.
8. Vite HMR — refrescar navegador, probar botón "Imprimir / PDF".

Sin restart de contenedores.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Campos asumidos (`cia.rnc`, `cia.direccion`, `f.codigo_vendedor`) podrían no existir en el schema real | Antes de implementar, hacer DESCRIBE de `CXC.TCXC_CIAS` y `FAT.TFAT_FACTURA` vía `apps/legacy/client.py` y ajustar |
| Notas de pie no estandarizadas por empresa | Si no hay tabla, omitir notas en este sprint y dejar TODO documentado |
| Factura sin NCF (caso real cuando `tipo_factura='CT'` cotización) | Cotizaciones no entran este sprint; FC/FT siempre deben tener NCF — validación 422 cubre |
| `inv_repo.get_compania()` no devuelve `descripcion` esperado | El código actual (`inv_repo.py:list_companias`) ya devuelve `descripcion`; verificado |
| `_build_pdf_report` movido a `pdf_helpers.py` rompe imports en otro archivo no listado | Buscar con grep antes de mover: `grep -r "_build_pdf_report" backend/` |

## Métricas de éxito

- Endpoint devuelve PDF válido HTTP 200 para una factura FC real de empresa 01.
- El PDF muestra razón social, NCF B01/B02, nombre del vendedor, descripción de condición de pago, RNC del cliente, totales correctos.
- El usuario abre el PDF desde el navegador, presiona Ctrl+P y obtiene impresión legible en impresora láser/inkjet común.
- Sin alteraciones al comportamiento de los reportes INV (regresión = 0).
- Cierra el flag de "FAT no genera impresión" en el dashboard del proyecto.
