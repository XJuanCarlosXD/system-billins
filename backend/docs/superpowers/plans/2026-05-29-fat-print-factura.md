# FAT-print: PDF de factura FC/FT — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar endpoint `GET /api/fat/documentos/<tipo>/<no_factura>/pdf/` que genera un PDF imprimible de facturas FC/FT con razón social, NCF B01-B15, nombre de vendedor y descripción de condición de pago — sin IDs internos.

**Architecture:** Mover y extender el helper `_build_pdf_report` (hoy interno de `inv_views.py`) a un módulo compartido `apps/legacy/pdf_helpers.py` agregando parámetros `header_extra` y `footer_extra` para soportar documentos con encabezado/pie (factura) además de los listados actuales (existencia, movimientos, etc.). Crear una nueva view en `apps/fat/views_print.py` que use el helper extendido y `fat_repo.get_factura()` ya existente; agregar lookups secundarios (`get_vendedor_nombre`, `get_condicion_pago_descripcion`) para mostrar descripciones en lugar de códigos.

**Tech Stack:** Django + DRF (existente), `reportlab` (ya instalado, usado por INV), `oracledb` via `apps.legacy.client` (lectura Oracle 11g legacy), React/Vite frontend (`window.open` para abrir el PDF inline).

**Spec de referencia:** `backend/docs/superpowers/specs/2026-05-29-fat-print-factura-design.md`

**Deploy pattern (validado sesión 2026-05-29):** `pscp` + hot reload Django/Vite, sin restart de contenedores. SSH a `jcabreu@10.0.0.99` con `plink/pscp -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw 'Temp1234!'`.

**Testing approach:** El proyecto NO tiene tests Python (no pytest, no `tests/` dir). El patrón establecido es smoke-test con `curl` autenticado + verificación visual con Read nativo del PDF resultante. Cada tarea sigue: (1) smoke previo que falla / produce comportamiento conocido, (2) cambio mínimo, (3) smoke posterior que pasa, (4) commit.

**Authentication for curl smoke tests:** Se asume un archivo `cookies.txt` ya válido en el cwd. Para generarlo:
```bash
curl -s -c cookies.txt -X POST -H "Content-Type: application/json" \
  -d '{"username":"JCABREU","password":"Temp1234!"}' \
  http://10.0.0.99:8000/api/auth/login/
```

---

## File Structure

**Files to create:**
- `backend/apps/legacy/pdf_helpers.py` — helper `build_pdf_report` compartido (movido de `inv_views.py`, extendido con `header_extra`/`footer_extra`/`page_size`).
- `backend/apps/fat/views_print.py` — view `fat_documento_pdf(request, tipo, no_factura)`.

**Files to modify:**
- `backend/apps/legacy/inv_views.py` — eliminar def local de `_build_pdf_report`, importar de `pdf_helpers`. Cambiar todas las llamadas internas de `_build_pdf_report(...)` a `build_pdf_report(...)`.
- `backend/apps/legacy/repositories/fat_repo.py` — agregar `get_vendedor_nombre(no_cia, vendedor)` y `get_condicion_pago_descripcion(no_condicion_pago)`.
- `backend/apps/fat/urls.py` — agregar `path('fat/documentos/<str:tipo>/<str:no_factura>/pdf/', fat_documento_pdf)`.
- `frontend/src/features/fat/components/factura-detail.tsx` — agregar botón "Imprimir / PDF".

**Files used as reference (not modified):**
- `backend/apps/legacy/repositories/fat_repo.py:788` — `get_factura(no_cia, punto, tipo_factura, no_factura)` ya existe y devuelve dict con `lineas` anidadas (incluye: `nombre_cliente`, `vendedor` (código), `ncf`, `codigo_ncf`, `tipo_ncf_fiscal`, `no_condicion_pago`, `total_neto`, `descuento`, `impuesto`, `total_linea`, y lista de líneas).
- `backend/apps/legacy/repositories/inv_repo.py:1047` — `get_compania(no_cia)` devuelve `{descripcion}` (razón social).

---

## Task 1: Crear `pdf_helpers.py` con `build_pdf_report` movido (sin cambios funcionales)

**Files:**
- Create: `backend/apps/legacy/pdf_helpers.py`

- [ ] **Step 1: Baseline smoke test — confirmar comportamiento actual de INV**

Run desde Windows/Git Bash con `cookies.txt` válido en `pdf_audit/`:
```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft/pdf_audit/inv && \
curl -s -b ../cookies.txt -o /tmp/baseline_existencia.pdf -w "HTTP=%{http_code} size=%{size_download}\n" \
  "http://10.0.0.99:8000/api/inv/reportes/existencia/pdf/?no_cia=01&con_existencia=1"
```
Expected: `HTTP=200 size=44027` (aprox., con datos del fix BUG-INV-1 ya en producción).

- [ ] **Step 2: Crear `backend/apps/legacy/pdf_helpers.py` con `build_pdf_report` copiado de `inv_views.py:927-972`**

Contenido nuevo de `pdf_helpers.py`:
```python
"""Helpers de generación de PDF compartidos entre módulos legacy (INV, FAT).

`build_pdf_report` es la función central. Recibe título, columnas, filas y
genera un PDF tabular usando reportlab. Soporta opcionalmente `header_extra`
y `footer_extra` (lista de strings con HTML-like markup de reportlab) para
documentos con encabezado/pie (ej. facturas FAT) además de listados (INV).
"""
from __future__ import annotations

import io


def build_pdf_report(
    title: str,
    columns: list[str],
    rows: list[dict],
    col_widths: list | None = None,
    *,
    header_extra: list[str] | None = None,
    footer_extra: list[str] | None = None,
    page_size=None,
) -> bytes:
    """Construye un PDF simple con título + tabla.

    - `header_extra`: párrafos a insertar antes de la tabla (formato reportlab
      Paragraph, acepta tags `<b>`, `<i>`, `<br/>`).
    - `footer_extra`: párrafos a insertar después de la tabla y del "Total
      registros" (o en su lugar si rows está vacío).
    - `page_size`: por defecto `landscape(letter)` (listados). Para documentos
      portrait (facturas) pasar `letter`.
    """
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    from reportlab.lib.units import inch

    if page_size is None:
        page_size = landscape(letter)

    buffer = io.BytesIO()
    doc_pdf = SimpleDocTemplate(buffer, pagesize=page_size,
                                leftMargin=0.5*inch, rightMargin=0.5*inch,
                                topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    elements = [Paragraph(title, styles['Title']), Spacer(1, 8)]

    if header_extra:
        for line in header_extra:
            elements.append(Paragraph(line, styles['Normal']))
        elements.append(Spacer(1, 8))

    if rows:
        header_row = [c.upper() for c in columns]
        data = [header_row]
        for r in rows[:500]:
            row_data = []
            for c in columns:
                val = r.get(c.lower(), r.get(c.upper(), ''))
                if isinstance(val, float):
                    val = f"{val:,.2f}"
                row_data.append(str(val or ''))
            data.append(row_data)

        t = Table(data, colWidths=col_widths)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#DCE6F1')]),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.grey),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(f"Total registros: {len(rows)}", styles['Normal']))
    else:
        elements.append(Paragraph("Sin datos.", styles['Normal']))

    if footer_extra:
        elements.append(Spacer(1, 8))
        for line in footer_extra:
            elements.append(Paragraph(line, styles['Normal']))

    doc_pdf.build(elements)
    buffer.seek(0)
    return buffer.read()
```

- [ ] **Step 3: Verificar sintaxis Python con import compile**

Run desde el repo (local, no VM):
```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend && \
python -c "import ast; ast.parse(open('apps/legacy/pdf_helpers.py').read()); print('OK')"
```
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system && \
git add backend/apps/legacy/pdf_helpers.py && \
git commit -m "feat(legacy): add pdf_helpers.py with build_pdf_report

Movido (copia) desde inv_views.py para preparar reuso entre INV y FAT.
Agrega parametros opcionales header_extra/footer_extra/page_size con
defaults que preservan el comportamiento de los reportes INV existentes.

Ref: docs/superpowers/specs/2026-05-29-fat-print-factura-design.md"
```

---

## Task 2: Actualizar `inv_views.py` para usar el helper compartido

**Files:**
- Modify: `backend/apps/legacy/inv_views.py`

- [ ] **Step 1: Reemplazar la definición de `_build_pdf_report` por un import**

En `backend/apps/legacy/inv_views.py`, localizar la definición que comienza con `def _build_pdf_report(title: str, columns: list[str], rows: list[dict],` (aprox. línea 927) y termina antes de la siguiente función decorada con `@login_required` (aprox. línea 974).

**Eliminar** completamente esa función (incluyendo el docstring "Helper: construye un PDF simple con título y tabla.").

**Agregar** al inicio del archivo (después de `from apps.legacy.repositories import inv_repo`):
```python
from apps.legacy.pdf_helpers import build_pdf_report
```

- [ ] **Step 2: Renombrar todas las llamadas `_build_pdf_report(` → `build_pdf_report(` en el archivo**

Usar replace_all en el editor. Hay 5 sitios de llamada (verificar con grep):
```bash
grep -n "_build_pdf_report\|build_pdf_report" \
  /c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend/apps/legacy/inv_views.py
```
Expected después del cambio: 1 línea de import + 5 llamadas como `build_pdf_report(...)`. **Cero ocurrencias de `_build_pdf_report`.**

- [ ] **Step 3: Verificar sintaxis Python**

```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend && \
python -c "import ast; ast.parse(open('apps/legacy/inv_views.py').read()); print('OK')"
```
Expected: `OK`.

- [ ] **Step 4: Deploy a la VM (pscp)**

```bash
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw 'Temp1234!' \
  "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend/apps/legacy/pdf_helpers.py" \
  jcabreu@10.0.0.99:facturation-system/backend/apps/legacy/pdf_helpers.py
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw 'Temp1234!' \
  "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend/apps/legacy/inv_views.py" \
  jcabreu@10.0.0.99:facturation-system/backend/apps/legacy/inv_views.py
```
Expected: dos transferencias `100%`.

- [ ] **Step 5: Smoke test regresión INV — el PDF de existencia debe seguir funcionando idéntico**

Esperar 5 segundos de Django hot reload, luego:
```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft/pdf_audit/inv && \
curl -s -b ../cookies.txt -o /tmp/post_task2_existencia.pdf \
  -w "HTTP=%{http_code} size=%{size_download}\n" \
  "http://10.0.0.99:8000/api/inv/reportes/existencia/pdf/?no_cia=01&con_existencia=1"
```
Expected: `HTTP=200 size=44027` (±200 bytes — timestamps internos varían).

- [ ] **Step 6: Smoke test regresión Movimientos / Valorización / Entrada-Diario**

```bash
for ep in "movimientos" "valorizacion"; do
  curl -s -b /c/Users/JCABREU/AppData/Local/memorias_sigaft/pdf_audit/cookies.txt \
    -o /dev/null -w "${ep}: HTTP=%{http_code} size=%{size_download}\n" \
    "http://10.0.0.99:8000/api/inv/reportes/${ep}/pdf/?no_cia=01"
done
```
Expected: ambos `HTTP=200` y `size > 30000` bytes.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system && \
git add backend/apps/legacy/inv_views.py && \
git commit -m "refactor(inv): use build_pdf_report from shared pdf_helpers

Elimina la def local _build_pdf_report en inv_views.py y la sustituye
por un import desde apps.legacy.pdf_helpers. Cero cambios funcionales
para los 4 reportes INV existentes (verificado con smoke curl).

Prepara reuso del helper en apps/fat/ para el sprint FAT-print."
```

---

## Task 3: Agregar lookups en `fat_repo.py` (vendedor y condición de pago)

**Files:**
- Modify: `backend/apps/legacy/repositories/fat_repo.py`

- [ ] **Step 1: Verificar smoke previo — la función `get_vendedor_nombre` no existe aún**

```bash
grep -n "def get_vendedor_nombre\|def get_condicion_pago_descripcion" \
  /c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend/apps/legacy/repositories/fat_repo.py
```
Expected: sin output (las funciones no existen).

- [ ] **Step 2: Agregar las dos funciones al final del archivo `fat_repo.py`**

Append al final de `backend/apps/legacy/repositories/fat_repo.py`:
```python


# ── Lookups secundarios usados por views_print (FAT-print sprint) ─────────────

def get_vendedor_nombre(no_cia: str, vendedor: str) -> str:
    """Devuelve el nombre del vendedor o '' si no se encuentra.

    Tabla: CXC.TCXC_VENDEDOR (mismo schema usado por list_vendedores arriba).
    """
    if not vendedor:
        return ''
    row = client.fetch_one(
        "SELECT NOMBRE FROM CXC.TCXC_VENDEDOR WHERE NO_CIA = :1 AND VENDEDOR = :2",
        [no_cia, vendedor.strip().upper()])
    return (row[0] or '').strip() if row else ''


def get_condicion_pago_descripcion(no_condicion_pago: str) -> str:
    """Devuelve la descripción de la condición de pago o '' si no se encuentra.

    Tabla: FAT.TFAT_CONDICION_PAGO (mismo schema usado por list_condiciones_pago).
    """
    if not no_condicion_pago:
        return ''
    row = client.fetch_one(
        "SELECT descripcion FROM FAT.TFAT_CONDICION_PAGO "
        "WHERE no_condicion_pago = :1",
        [no_condicion_pago])
    return (row[0] or '').strip() if row else ''
```

- [ ] **Step 3: Verificar sintaxis**

```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend && \
python -c "import ast; ast.parse(open('apps/legacy/repositories/fat_repo.py').read()); print('OK')"
```
Expected: `OK`.

- [ ] **Step 4: Deploy + smoke test SQL via Django shell**

```bash
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw 'Temp1234!' \
  "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend/apps/legacy/repositories/fat_repo.py" \
  jcabreu@10.0.0.99:facturation-system/backend/apps/legacy/repositories/fat_repo.py
```

Smoke (via plink shell — verifica que las queries Oracle no exploten):
```bash
plink -ssh -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw 'Temp1234!' jcabreu@10.0.0.99 \
  "cd facturation-system && docker compose exec -T backend python manage.py shell -c \"from apps.legacy.repositories import fat_repo; print('cp:', repr(fat_repo.get_condicion_pago_descripcion('01'))); print('v_empty:', repr(fat_repo.get_vendedor_nombre('01', '')))\""
```
Expected: no traceback. Las dos llamadas devuelven strings (puede ser `''` si no hay datos pero NO debe lanzar excepción).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system && \
git add backend/apps/legacy/repositories/fat_repo.py && \
git commit -m "feat(fat): add lookup helpers get_vendedor_nombre / get_condicion_pago_descripcion

Necesarios para resolver código→descripción en el PDF de factura
(spec FAT-print). El usuario debe ver 'Juan Pérez' y 'Contado',
no '001' y '1'."
```

---

## Task 4: Crear `apps/fat/views_print.py` con la view `fat_documento_pdf`

**Files:**
- Create: `backend/apps/fat/views_print.py`

- [ ] **Step 1: Smoke previo — el endpoint no existe**

```bash
curl -s -b /c/Users/JCABREU/AppData/Local/memorias_sigaft/pdf_audit/cookies.txt \
  -o /dev/null -w "HTTP=%{http_code}\n" \
  "http://10.0.0.99:8000/api/fat/documentos/FC/1/pdf/?no_cia=01&punto=01"
```
Expected: `HTTP=404` (URL no registrada todavía).

- [ ] **Step 2: Crear `backend/apps/fat/views_print.py`**

Contenido completo:
```python
"""View de impresión/PDF de documentos FAT (facturas FC/FT).

Endpoint: GET /api/fat/documentos/<tipo>/<no_factura>/pdf/?no_cia=01&punto=01

Patrón establecido en spec 2026-05-29-fat-print-factura-design.md:
- Razón social en lugar de "Empresa 01" (lookup inv_repo.get_compania).
- NCF formato fiscal DGI B01-B15 (validado).
- Nombre de vendedor (no código).
- Descripción de condición de pago (no código).
- Sin IDs internos.
"""
from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_http_methods

from apps.legacy.pdf_helpers import build_pdf_report
from apps.legacy.repositories import fat_repo, inv_repo, cxc_repo

TIPOS_DOCUMENTO_SOPORTADOS = {'FC', 'FT'}

TIPOS_NCF_VALIDOS_FISICOS = {
    'B01', 'B02', 'B03', 'B04',
    'B11', 'B12', 'B13', 'B14', 'B15',
}

NCF_DESCRIPCION = {
    'B01': 'Crédito Fiscal',
    'B02': 'Consumo',
    'B03': 'Nota de Débito',
    'B04': 'Nota de Crédito',
    'B11': 'Compras',
    'B12': 'Registro Único de Ingresos',
    'B13': 'Gastos Menores',
    'B14': 'Regímenes Especiales',
    'B15': 'Gubernamental',
}


@login_required
@require_http_methods(["GET"])
def fat_documento_pdf(request, tipo: str, no_factura: str):
    """GET /api/fat/documentos/<tipo>/<no_factura>/pdf/?no_cia=01&punto=01

    Devuelve el PDF de una factura existente para impresión.
    """
    try:
        from reportlab.lib.pagesizes import letter  # probe
    except ImportError:
        return JsonResponse({"error": "reportlab no instalado"}, status=500)

    tipo = (tipo or '').strip().upper()
    if tipo not in TIPOS_DOCUMENTO_SOPORTADOS:
        return JsonResponse(
            {"error": f"Tipo de documento '{tipo}' no soportado en este sprint (solo FC, FT)"},
            status=400)

    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')

    try:
        factura = fat_repo.get_factura(no_cia, punto, tipo, no_factura)
    except Exception as e:
        return JsonResponse({"error": f"Error consultando factura: {e}"}, status=500)

    if factura is None:
        return JsonResponse({"error": "Factura no encontrada"}, status=404)

    tipo_ncf = (factura.get('tipo_ncf_fiscal') or '').strip().upper()
    if tipo_ncf not in TIPOS_NCF_VALIDOS_FISICOS:
        return JsonResponse(
            {"error": f"NCF tipo '{tipo_ncf}' no es válido DGI (debe ser B01..B15)"},
            status=422)

    # ── Resolver lookups (código → descripción) ──────────────────────────────
    cia = inv_repo.get_compania(no_cia) or {}
    razon_social = (cia.get('descripcion') or no_cia).strip()

    cliente = cxc_repo.get_cliente(no_cia, factura['no_cliente']) or {}
    rnc_cliente = (cliente.get('rnc') or '').strip()
    direccion_cliente = (cliente.get('direccion') or '').strip()

    nombre_vendedor = fat_repo.get_vendedor_nombre(no_cia, factura.get('vendedor', ''))
    descripcion_cond_pago = fat_repo.get_condicion_pago_descripcion(
        factura.get('no_condicion_pago', ''))

    try:
        pdf_bytes = _render_factura_pdf(
            factura=factura,
            razon_social=razon_social,
            rnc_cliente=rnc_cliente,
            direccion_cliente=direccion_cliente,
            nombre_vendedor=nombre_vendedor,
            descripcion_cond_pago=descripcion_cond_pago,
            tipo_ncf=tipo_ncf,
        )
    except Exception as e:
        return JsonResponse({"error": f"Error generando PDF: {e}"}, status=500)

    resp = HttpResponse(pdf_bytes, content_type='application/pdf')
    resp['Content-Disposition'] = (
        f'inline; filename="FAT_{tipo}_{no_factura}.pdf"'
    )
    return resp


def _render_factura_pdf(*, factura, razon_social, rnc_cliente, direccion_cliente,
                         nombre_vendedor, descripcion_cond_pago, tipo_ncf) -> bytes:
    """Arma header_extra + footer_extra y llama a build_pdf_report."""
    from reportlab.lib.pagesizes import letter

    tipo = factura.get('tipo_factura', '')
    no_factura = factura.get('no_factura', '')
    fecha = factura.get('fecha', '') or ''
    codigo_ncf = (factura.get('codigo_ncf') or '').strip()
    nombre_cliente = (factura.get('nombre_cliente') or '').strip() or '(sin nombre)'
    vendedor_codigo = (factura.get('vendedor') or '').strip()
    vendedor_display = (
        f"{vendedor_codigo} — {nombre_vendedor}" if nombre_vendedor else vendedor_codigo
    )
    cond_pago_display = descripcion_cond_pago or 'N/A'
    ncf_descripcion = NCF_DESCRIPCION.get(tipo_ncf, '')
    ncf_display = (
        f"<b>NCF:</b> {codigo_ncf} ({tipo_ncf} — {ncf_descripcion})"
        if codigo_ncf else
        f"<b>NCF:</b> (no asignado, tipo {tipo_ncf})"
    )

    header_extra = [
        f"<b>{razon_social}</b>",
        f"<b>Cliente:</b> {nombre_cliente}",
        f"<b>RNC/Cédula:</b> {rnc_cliente or 'N/A'}",
        f"<b>Dirección:</b> {direccion_cliente or 'N/A'}",
        f"<b>Fecha:</b> {fecha}  <b>Vendedor:</b> {vendedor_display or 'N/A'}",
        f"<b>Condición de pago:</b> {cond_pago_display}",
        ncf_display,
    ]

    # Construir filas de líneas (sólo líneas no anuladas)
    lineas = [
        {
            'linea': l['no_linea'],
            'codigo': l['no_produ'],
            'descripcion': l['descripcion'],
            'cant': l['cantidad'],
            'precio': l['precio'],
            'dscto': l['descuento'],
            'itbis': l['impuesto'],
            'total': l['monto_neto'],
        }
        for l in factura.get('lineas', [])
        if (l.get('st_anulado') or 'N') == 'N'
    ]

    columns = ['LINEA', 'CODIGO', 'DESCRIPCION', 'CANT', 'PRECIO', 'DSCTO', 'ITBIS', 'TOTAL']
    col_widths = None  # default reportlab

    subtotal = float(factura.get('total_linea') or 0)
    descuento_total = float(factura.get('descuento') or 0)
    impuesto_total = float(factura.get('impuesto') or 0)
    total_general = float(factura.get('total_neto') or 0)

    footer_extra = [
        f"<b>Subtotal:</b> {subtotal:,.2f}",
        f"<b>Descuento:</b> {descuento_total:,.2f}",
        f"<b>ITBIS:</b> {impuesto_total:,.2f}",
        f"<b>TOTAL:</b> {total_general:,.2f}",
    ]

    nota = (factura.get('nota') or '').strip()
    if nota:
        footer_extra.append(f"<i>Nota:</i> {nota}")

    return build_pdf_report(
        title=f"Factura {tipo}-{no_factura}",
        columns=columns,
        rows=lineas,
        col_widths=col_widths,
        header_extra=header_extra,
        footer_extra=footer_extra,
        page_size=letter,  # portrait
    )
```

- [ ] **Step 3: Verificar sintaxis**

```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend && \
python -c "import ast; ast.parse(open('apps/fat/views_print.py').read()); print('OK')"
```
Expected: `OK`.

- [ ] **Step 4: Commit (sin deployar todavía — falta la URL)**

```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system && \
git add backend/apps/fat/views_print.py && \
git commit -m "feat(fat): add views_print.py with fat_documento_pdf

Genera PDF de factura FC/FT con razon social, NCF B01-B15 validado,
nombre de vendedor y descripcion de condicion de pago. Sin IDs internos.
Usa build_pdf_report de apps.legacy.pdf_helpers con header_extra y
footer_extra (factura tiene encabezado de cliente y pie de totales,
distinto a los listados INV planos).

URL routing en task siguiente."
```

---

## Task 5: Registrar la URL en `apps/fat/urls.py`

**Files:**
- Modify: `backend/apps/fat/urls.py`

- [ ] **Step 1: Editar `backend/apps/fat/urls.py`**

En el `from .views import (...)` final, agregar al final una nueva línea de import:
```python
from .views_print import fat_documento_pdf
```

Y agregar al final de `urlpatterns` (justo antes del `]`):
```python
    path('fat/documentos/<str:tipo>/<str:no_factura>/pdf/', fat_documento_pdf),
```

- [ ] **Step 2: Verificar sintaxis**

```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend && \
python -c "import ast; ast.parse(open('apps/fat/urls.py').read()); print('OK')"
```
Expected: `OK`.

- [ ] **Step 3: Deploy ambos archivos a la VM**

```bash
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw 'Temp1234!' \
  "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend/apps/fat/views_print.py" \
  jcabreu@10.0.0.99:facturation-system/backend/apps/fat/views_print.py
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw 'Temp1234!' \
  "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/backend/apps/fat/urls.py" \
  jcabreu@10.0.0.99:facturation-system/backend/apps/fat/urls.py
```
Expected: dos transferencias `100%`.

- [ ] **Step 4: Smoke test del endpoint con tipo inválido**

```bash
sleep 5  # esperar hot reload
curl -s -b /c/Users/JCABREU/AppData/Local/memorias_sigaft/pdf_audit/cookies.txt \
  -w "\nHTTP=%{http_code}\n" \
  "http://10.0.0.99:8000/api/fat/documentos/XX/1/pdf/?no_cia=01&punto=01"
```
Expected: `HTTP=400` + body JSON con error sobre tipo no soportado.

- [ ] **Step 5: Smoke test con factura inexistente**

```bash
curl -s -b /c/Users/JCABREU/AppData/Local/memorias_sigaft/pdf_audit/cookies.txt \
  -w "\nHTTP=%{http_code}\n" \
  "http://10.0.0.99:8000/api/fat/documentos/FC/99999999/pdf/?no_cia=01&punto=01"
```
Expected: `HTTP=404` + body `{"error": "Factura no encontrada"}`.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system && \
git add backend/apps/fat/urls.py && \
git commit -m "feat(fat): register /api/fat/documentos/<tipo>/<no>/pdf/

Registra fat_documento_pdf. Smoke: 400 con tipo invalido, 404 con
factura inexistente."
```

---

## Task 6: Smoke E2E con una factura real

**Files:** ninguno modificado — solo verificación.

- [ ] **Step 1: Identificar una factura FC real en empresa 01**

```bash
curl -s -b /c/Users/JCABREU/AppData/Local/memorias_sigaft/pdf_audit/cookies.txt \
  "http://10.0.0.99:8000/api/fat/facturas/?no_cia=01&punto=01&tipo_factura=FC&page_size=3" \
  | python -m json.tool | head -50
```
Expected: respuesta JSON con `items` o `results`. **Anotar** el primer `no_factura` de la lista. Llamarlo `<FACTURA>` en los pasos siguientes.

Si la respuesta no tiene facturas FC, repetir con `FT`. Anotar tipo + número.

- [ ] **Step 2: Descargar el PDF de esa factura**

Reemplazar `<TIPO>` y `<FACTURA>` con los valores reales del paso 1:
```bash
mkdir -p /c/Users/JCABREU/AppData/Local/memorias_sigaft/pdf_audit/fat && \
curl -s -b /c/Users/JCABREU/AppData/Local/memorias_sigaft/pdf_audit/cookies.txt \
  -o /c/Users/JCABREU/AppData/Local/memorias_sigaft/pdf_audit/fat/factura_<TIPO>_<FACTURA>.pdf \
  -w "HTTP=%{http_code} size=%{size_download}\n" \
  "http://10.0.0.99:8000/api/fat/documentos/<TIPO>/<FACTURA>/pdf/?no_cia=01&punto=01"
```
Expected: `HTTP=200 size > 3000` bytes.

Si la respuesta es `HTTP=422`, significa NCF inválido en esa factura particular. Probar con otra factura del paso 1.

- [ ] **Step 3: Leer el PDF y verificar contenido**

Usar la herramienta Read sobre el archivo descargado.

**Checklist visual del PDF** (todas deben ser ✓):
- [ ] Aparece la razón social de la empresa (no "Empresa 01" pelado, sino el nombre real ej. "ABREGONZA, SRL")
- [ ] Aparece el nombre del cliente (no solo número)
- [ ] Aparece el RNC del cliente (puede decir "N/A" si el cliente no tiene)
- [ ] Aparece el NCF con su tipo, formato `B0100012345 (B01 — Crédito Fiscal)` o similar
- [ ] Aparece el nombre del vendedor (no solo código)
- [ ] Aparece la condición de pago con descripción (no solo número)
- [ ] La tabla de líneas tiene datos reales (cantidades, precios, totales)
- [ ] Aparecen subtotal, descuento, ITBIS y TOTAL en el pie
- [ ] **NO** aparece ningún número que parezca un ID interno (PK numérica sin contexto, como una columna "id" o "fk")

- [ ] **Step 4: Si algún checkbox falla, documentar el gap antes de continuar**

Crear `pdf_audit/REPORTE_GAPS_FAT.md` con un breve resumen de qué falló y por qué (campo NULL en BD, JOIN sin coincidencia, etc.). No bloquear el sprint — anotar para sprint siguiente.

- [ ] **Step 5: Commit (solo si se generó el reporte de gaps)**

```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft && \
git add pdf_audit/REPORTE_GAPS_FAT.md 2>/dev/null && \
git commit -m "docs(fat): document FAT-print gaps from E2E smoke" 2>/dev/null || \
  echo "Sin gaps — nada que commitear."
```

---

## Task 7: Frontend — botón "Imprimir / PDF" en detalle de factura

**Files:**
- Modify: `frontend/src/features/fat/components/factura-detail.tsx`

- [ ] **Step 1: Localizar dónde se renderiza el detalle de factura y dónde van los botones de acción**

```bash
grep -n "factura\|imprimir\|anular\|Button" \
  "/c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/frontend/src/features/fat/components/factura-detail.tsx" \
  | head -30
```
Anotar la línea donde están los demás botones de acción (probablemente Anular, Editar). El botón Imprimir va al lado.

- [ ] **Step 2: Agregar el botón "Imprimir / PDF"**

Abrir `frontend/src/features/fat/components/factura-detail.tsx`. Localizar el grupo de botones (probablemente envuelto en un `<div className="flex gap-2">` o `<CardFooter>`). Agregar un `Button` nuevo:

```tsx
<Button
  variant="secondary"
  size="sm"
  onClick={() => {
    const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://10.0.0.99:8000/api'
    const tipo = factura.tipo_factura  // ajustar nombre de variable si difiere
    const noFactura = factura.no_factura
    const noCia = factura.no_cia
    const punto = factura.punto
    const qs = new URLSearchParams({ no_cia: noCia, punto })
    window.open(`${API_BASE}/fat/documentos/${tipo}/${noFactura}/pdf/?${qs}`, '_blank')
  }}
>
  <Printer className="size-4 mr-2" />
  Imprimir / PDF
</Button>
```

Si `Printer` no está importado, agregar al import desde `lucide-react`:
```tsx
import { Printer } from 'lucide-react'  // junto a los iconos existentes
```

**Importante**: el nombre exacto de las props/variables (`factura.tipo_factura`, `factura.no_factura`) puede diferir según el shape del objeto en este componente. Revisar con grep cómo se accede a otros campos como `total_neto` antes de copiar literal.

- [ ] **Step 3: Verificar sintaxis local (lint frontend)**

```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/frontend && \
npx tsc --noEmit src/features/fat/components/factura-detail.tsx 2>&1 | head -20
```
Expected: sin errores TS. Si hay error de "Cannot find module" o "Property does not exist", ajustar los nombres de campos según lo que use el resto del componente.

- [ ] **Step 4: Deploy a la VM**

```bash
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw 'Temp1234!' \
  "C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/frontend/src/features/fat/components/factura-detail.tsx" \
  jcabreu@10.0.0.99:facturation-system/frontend/src/features/fat/components/factura-detail.tsx
```
Expected: transferencia `100%`. Vite HMR recarga automáticamente (~3 segundos).

- [ ] **Step 5: Test visual con Playwright**

Mediante MCP Playwright:
1. `browser_navigate` a `http://10.0.0.99:5173/sign-in`, login si no está logueado.
2. Navegar a la pantalla de facturas (Operacion → Facturacion (FAT) → consultar / detalle de la factura usada en Task 6).
3. `browser_snapshot` para confirmar que el botón "Imprimir / PDF" aparece.
4. `browser_click` sobre el botón.
5. `browser_tabs` action=list para confirmar que se abrió una pestaña nueva con URL terminada en `/pdf/?...`.

Si alguno falla, ajustar el código según el snapshot y reintentar.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system && \
git add frontend/src/features/fat/components/factura-detail.tsx && \
git commit -m "feat(fat-ui): add 'Imprimir / PDF' button to factura detail

Abre el endpoint /api/fat/documentos/<tipo>/<no>/pdf/ en una nueva
pestaña. El usuario imprime desde el visor PDF del navegador (Ctrl+P)."
```

---

## Task 8: Verificación visual end-to-end con Playwright (regresión + nuevo)

**Files:** ninguno modificado — solo verificación interactiva.

Esta tarea valida con un navegador real (no solo curl) que:
- Los reportes INV siguen visibles y bien renderizados (regresión cero).
- El nuevo botón "Imprimir / PDF" del detalle de factura abre un PDF legible.
- Las vistas internas del módulo INV → Reportes y FAT → Facturas se renderizan sin errores de consola.

- [ ] **Step 1: Iniciar Playwright + login**

Mediante MCP Playwright:
1. `browser_navigate` → `http://10.0.0.99:5173/sign-in`.
2. `browser_fill_form` con usuario `JCABREU` / contraseña `Temp1234!`.
3. `browser_click` en "Entrar".
4. `browser_snapshot` para confirmar landing en el dashboard.

Expected: URL termina en `/`, sidebar visible con módulos.

- [ ] **Step 2: Validación visual INV — reportes existentes no se rompieron**

1. `browser_click` sidebar → "Inventario (INV)" → submenu "Reportes" → "Existencia".
2. `browser_snapshot` confirma que el formulario de filtros aparece (combos almacén/grupo/línea/sublínea, radio de variantes legacy, botón "Generar Reporte PDF").
3. `browser_click` en "Generar Reporte PDF".
4. `browser_tabs` action=list → confirma que se abrió pestaña nueva.
5. Repetir pasos 1-4 para "Movimientos" (verificar que también abre PDF en nueva tab).

Expected: ambos reportes abren PDFs sin errores. Console errors permitido `<= los previos a este sprint`.

- [ ] **Step 3: Validación visual FAT — botón nuevo funcional**

1. `browser_click` sidebar → "Facturacion (FAT)" → ruta al listado de facturas (probablemente bajo "Operacion" o submenu equivalente).
2. `browser_snapshot` para confirmar listado y localizar la factura usada en Task 6 (mismo `<TIPO>/<FACTURA>`).
3. `browser_click` para abrir el detalle.
4. `browser_snapshot` para confirmar que el botón "Imprimir / PDF" aparece junto a los demás botones de acción.
5. `browser_click` en "Imprimir / PDF".
6. `browser_tabs` action=list → confirma pestaña nueva con URL `http://10.0.0.99:8000/api/fat/documentos/<TIPO>/<FACTURA>/pdf/?...`.

Expected: pestaña nueva. URL contiene el path del endpoint y los query params.

- [ ] **Step 4: Capturar screenshot del PDF abierto y leer**

1. `browser_tabs` action=select → cambiar a la pestaña del PDF.
2. `browser_take_screenshot` → archivo `pdf_audit/fat/factura_<TIPO>_<FACTURA>_visual.png`.
3. Inspeccionar el screenshot (Read del PNG) para confirmar que se ve la factura como tal: razón social arriba, datos del cliente, NCF con descripción, tabla de líneas, totales abajo.

Expected: el visor PDF del navegador muestra el documento correctamente.

- [ ] **Step 5: Console errors check**

Mediante MCP Playwright `browser_console_messages` revisar errores acumulados durante la sesión completa.

Expected: cero errores de React/Vite/runtime nuevos atribuibles a este sprint. Errores históricos (e.g. 403 inicial pre-login) son aceptables.

- [ ] **Step 6: Cerrar el browser para liberar el contexto**

`browser_close`.

- [ ] **Step 7: Documentar el screenshot en el reporte**

Mover el screenshot capturado al reporte de auditoría y referenciarlo:

```bash
# El screenshot ya está en pdf_audit/fat/. Agregar referencia.
echo "" >> /c/Users/JCABREU/AppData/Local/memorias_sigaft/pdf_audit/REPORTE_GAPS_INV.md
echo "**Validación visual final:** ver \`pdf_audit/fat/factura_<TIPO>_<FACTURA>_visual.png\`" >> \
  /c/Users/JCABREU/AppData/Local/memorias_sigaft/pdf_audit/REPORTE_GAPS_INV.md
```

- [ ] **Step 8: Commit**

```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft && \
git add pdf_audit/fat/ pdf_audit/REPORTE_GAPS_INV.md && \
git commit -m "test(fat): visual e2e validation with Playwright

Confirma que el boton 'Imprimir / PDF' del detalle de factura abre
una pestana nueva con el PDF rendereado. Screenshot adjunto.
Regresion INV: reportes Existencia y Movimientos siguen funcionando."
```

---

## Task 9: Final wrap-up — actualizar reporte de auditoría y limpiar tasks

**Files:**
- Modify: `pdf_audit/REPORTE_GAPS_INV.md` (agregar sección "TODO FAT cerrado")

- [ ] **Step 1: Anexar sección al reporte de auditoría**

Append al final de `pdf_audit/REPORTE_GAPS_INV.md`:
```markdown

---

## Sprint FAT-print cerrado (2026-05-29)

- ✅ Endpoint `/api/fat/documentos/<tipo>/<no_factura>/pdf/` operativo.
- ✅ Soporta FC y FT con NCF validado B01-B15.
- ✅ PDF muestra razón social, nombre del cliente, RNC, nombre del vendedor, descripción de condición de pago, tabla de líneas y totales.
- ✅ Botón "Imprimir / PDF" en el detalle de factura del frontend.
- ✅ Helper `build_pdf_report` movido a `apps/legacy/pdf_helpers.py` y compartido con INV (cero regresión).
- ✅ TODO original en `backend/fat/views.py:177` queda obsoleto (era el sistema Django paralelo, no usado en producción).

Pendientes para sprint siguiente:
- Tipos CO (Conduce) y CT (Cotización).
- E-CF (E31, E32, E41, etc.) para emisión electrónica DGII.
- Logo de empresa en el PDF.
- Notas de pie de factura por empresa (`TFAT_NOTAS_PIE` si existe).
- Si la auditoría visual reveló gaps específicos → escalados al ticket de housekeeping FAT.
```

- [ ] **Step 2: Commit final**

```bash
cd /c/Users/JCABREU/AppData/Local/memorias_sigaft && \
git add pdf_audit/REPORTE_GAPS_INV.md && \
git commit -m "docs(audit): close FAT-print sprint in audit report"
```

- [ ] **Step 3: Marcar tarea #2 del task list como completada**

Usar `TaskUpdate` con `taskId: "2"` y `status: "completed"`.

---

## Roll-back plan (por si algo sale mal en producción)

Si después del deploy los reportes INV existentes se rompen:

```bash
plink -ssh -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw 'Temp1234!' jcabreu@10.0.0.99 \
  "cd facturation-system && git checkout HEAD~N -- backend/apps/legacy/inv_views.py backend/apps/legacy/pdf_helpers.py"
```
(Donde `N` es el número de commits a revertir.)

Django hace hot reload — recuperación en ~5 segundos.

---

## Métricas de cierre

- [ ] Los 4 reportes INV siguen devolviendo HTTP 200 con tamaño esperado (regresión = 0).
- [ ] El endpoint nuevo `/api/fat/documentos/FC|FT/<no>/pdf/` devuelve HTTP 200 con PDF válido para al menos 1 factura real de empresa 01.
- [ ] El botón "Imprimir / PDF" aparece en el detalle de factura y abre una pestaña nueva.
- [ ] El PDF generado muestra razón social, NCF B01/B02 con descripción, nombre de vendedor, descripción de condición de pago — verificado leyendo el PDF con Read.
- [ ] No hay IDs internos visibles en el PDF.
- [ ] Tarea #2 marcada como completada en el task tracker.
