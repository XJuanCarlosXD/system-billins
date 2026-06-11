# Spec — PDFs en frontend con plantillas editables estilo Odoo

- Fecha: 2026-06-10
- Autor: JCABREU + Claude
- Estado: aprobado para implementación
- Alcance: todos los PDFs del clon SIGAFT (FAT, INV, CXC, CXP, CNT, BAN, ODC, CHC, NOM, ACF, ACC, SDN, MAN)

## 1. Problema y motivación

El backend renderiza ~18 PDFs hoy con ReportLab (≈3.500 líneas en `apps/fat/views_print.py` y `apps/legacy/inv_views.py`). Editar header/footer/firmas obliga a tocar Python, redeployar, y los cambios no son configurables por empresa. El objetivo es:

1. Mover el render a frontend (HTML + CSS print + `window.print()` — el patrón Odoo/QWeb).
2. Construir cada documento con bloques reutilizables (Header, Footer, Firmas, etc.).
3. Permitir editar la plantilla desde Settings con un editor visual drag-and-drop (Puck), por empresa.
4. Eliminar ReportLab del backend a medida que cada módulo migre.

## 2. Decisiones técnicas

| # | Decisión | Razón |
|---|---|---|
| D1 | Motor PDF: HTML+CSS+`window.print()` en ruta dedicada `/print/<codigo_doc>/<id>` | Templates 100% editables con CSS/JSX; cero deps pesadas; multi-página automática vía `@page`; mismo patrón que Odoo (QWeb→wkhtmltopdf). |
| D2 | Editor visual: **Puck** | React-first, MIT, ≈50KB, encaja con shadcn/ui. Cada bloque es un componente React con props editables. |
| D3 | Editor scope: WYSIWYG completo (drag-and-drop de bloques + variables `{{ data.x.y }}` + múltiples plantillas guardadas por documento) | Pedido explícito del usuario. |
| D4 | Persistencia: tabla nueva Oracle `FAT.TFAT_PLANTILLA_PDF` + histórico `FAT.TFAT_PLANTILLA_PDF_HIST` | Compartido por empresa, sigue patrón legacy, auditable. |
| D5 | Datos: endpoint dedicado `print-data` por documento que devuelve todo en un JSON | 1 request por PDF; backend hace joins/cálculos una sola vez (NCF DGI compuesto, totales, etc.). |
| D6 | Templating de texto libre: **Handlebars** (sandbox restringido) | Helpers reutilizables (`formatMoney`, `formatDate`); sintaxis familiar. |
| D7 | Permisos: flag `acceso_settings_pdf` en TUSR_USUARIO_FLAGS | Reusa el sistema de permisos ya en producción. |
| D8 | Estrategia de retiro: cada PR migra un botón "Imprimir" y borra el `*_pdf` ReportLab correspondiente en el mismo commit | Cero código muerto; producción nunca rota. |

## 3. Arquitectura

```
FRONTEND (React)
  Settings > Plantillas PDF
    /settings/pdf-plantillas              → listado de plantillas por empresa
    /settings/pdf-plantillas/<codigo_doc> → editor Puck full-screen

  Acción "Imprimir" en cualquier pantalla:
    1. fetch /api/<modulo>/<doc>/<id>/print-data/  → JSON
    2. fetch /api/settings/plantillas-pdf/<codigo_doc>/?no_cia=X
    3. window.open('/print/<codigo_doc>/<id>')
       - Ruta /print/* renderiza el árbol Puck con los datos
       - CSS @page A4, @media print, page-breaks automáticos
       - useEffect dispara window.print() al cargar

BACKEND (Django)
  Endpoints nuevos (JSON puro, sin ReportLab):
    GET /api/<modulo>/<doc>/<id>/print-data/
    GET /api/<modulo>/reportes/<rep>/print-data/?...filtros

  Settings de plantillas:
    GET/PUT/DELETE /api/settings/plantillas-pdf/<codigo_doc>/
    GET /api/settings/plantillas-pdf/<codigo_doc>/historial/
    POST /api/settings/plantillas-pdf/<codigo_doc>/rollback/?version=N

  Se eliminan progresivamente:
    apps/fat/views_print.py (todos los *_pdf)
    apps/legacy/inv_views.py inv_*_pdf
    helpers ReportLab: pdf_helpers.py, logo_helpers.py
```

## 4. Catálogo de bloques Puck

### 4.A — Bloques comunes (documentos)
| Bloque | Datasource | Props editables |
|---|---|---|
| `HeaderEmpresa` | `data.cia` | logo on/off, alineación logo, color primario, mostrar RNC/tel/email, tamaño razón social |
| `HeaderDocumento` | `data.doc` | mostrar NCF, mostrar fecha venc, etiqueta IMPRESA/REIMPRESA, color recuadro |
| `WatermarkAnulada` | `data.doc.anulada` | texto, opacidad, ángulo, color |
| `BloqueCliente` | `data.cliente` | columnas a mostrar, 1 o 2 columnas |
| `TablaLineas` | `data.lineas` | columnas visibles + orden + ancho %, zebra, color header, fuente |
| `BloqueTotales` | `data.totales` | mostrar subtotal/desc/ITBIS/propina, mostrar "monto en letras", alineación |
| `NotaDetalle` | `data.doc.nota` | mostrar si vacío, título |
| `Firmas` | (estático) | número (1/2/3), labels, ancho de línea |
| `FooterEmpresa` | `data.cia` + estático | texto libre, mostrar paginación, mostrar fecha generación |
| `QRCode` | `data.doc.ncf_dgi` o expr | contenido, tamaño, posición |
| `TextoLibre` | — | rich text con Handlebars |
| `Imagen` | URL | url o `data.cia.logo`, tamaño, alineación |
| `Spacer` / `SeparadorHR` | — | altura/grosor/color |

### 4.B — Bloques para reportes
| Bloque | Datasource | Props |
|---|---|---|
| `HeaderReporte` | `data.reporte` | título, mostrar filtros, fecha generación |
| `TablaReporte` | `data.filas` | columnas + agrupación + subtotales, formato moneda/% |
| `FooterReporte` | `data.totales` | totales generales |

### 4.C — Bloque especial POS
- `TicketPOS` — contenedor 80mm con sub-bloques compactos.

### 4.D — Cobertura por módulo legacy

| Módulo | `codigo_doc` planificados |
|---|---|
| **FAT** | factura, factura-pos, conduce, cotizacion, nota-credito, nota-debito, devolucion, listado-facturas, listado-conduces, ncf-nulos, facturas-rnc, margen-bruto, ncf-607, lista-precios, cuadre-caja, ventas-productos |
| **INV** | inv-documento, inv-existencia, inv-movimientos, inv-kardex, inv-valorizacion, inv-cierre-entrada, inv-toma-fisica, inv-conteo, inv-rotacion |
| **CXC** | recibo-cobro, estado-cuenta-cliente, aging-cxc, nota-cobro, cadenas-cobro, relacion-cxc, comisiones-vendedor |
| **CXP** | comprobante-pago, estado-cuenta-proveedor, aging-cxp, relacion-cxp, retencion-impuesto |
| **CNT** | comprobante-contable, libro-diario, libro-mayor, balance-comprobacion, balance-general, estado-resultados, cierre-mensual, cierre-anual, flujo-efectivo |
| **BAN** | cheque-impreso, conciliacion-bancaria, extracto-bancario, movimiento-bancario |
| **ODC** | orden-compra, listado-odc, seguimiento-odc |
| **CHC** | cheque-caja-chica, reembolso-caja-chica, arqueo-caja-chica |
| **NOM** | volante-pago, recibo-nomina, reporte-nomina, ts-nomina, tss, isr-empleado |
| **ACF** | acta-activo, reporte-depreciacion, ficha-activo, inventario-activos |
| **ACC** | acc-documento, acc-reporte |
| **SDN** | sdn-documento, sdn-reporte |
| **MAN** | man-orden-trabajo, man-reporte |

### 4.E — Patrón de extensión (cómo añadir un `codigo_doc` nuevo)
1. Backend: implementar `GET /api/<modulo>/<doc>/<id>/print-data/` siguiendo el shape estándar.
2. Frontend: registrar el `codigo_doc` en `features/pdf/registry.ts` con su shape TS + plantilla default JSON Puck.
3. Insertar fila en `FAT.TFAT_PLANTILLA_PDF` con `DEFINICION_JSON = NULL` (usa default del registry).
4. La pantalla origen llama `usePrintDoc("nota-credito", id)`.

## 5. Editor en Settings

### Rutas
- `/settings/pdf-plantillas` — listado por empresa
- `/settings/pdf-plantillas/<codigo_doc>` — editor Puck full-screen

### Listado
Tabla shadcn con columnas: Código doc, Módulo, Nombre, Personalizada (sí/no), Última edición, Estado. Acciones por fila: Editar, Vista previa con datos reales, Restaurar default, Duplicar como variante. Botones Importar/Exportar JSON.

### Editor (layout 3 columnas)
```
┌──────────────┬─────────────────────────────┬──────────────┐
│  Bloques     │       Lienzo A4             │  Propiedades │
│  (catálogo)  │  [HeaderEmpresa]            │  del bloque  │
│              │  [HeaderDocumento]          │  + Variables │
│              │  [BloqueCliente]            │  disponibles │
│              │  [TablaLineas]              │              │
│              │  [BloqueTotales]            │              │
│              │  [Firmas]                   │              │
│              │  [FooterEmpresa]            │              │
└──────────────┴─────────────────────────────┴──────────────┘
Top:    [< Volver]  Plantilla: Factura A4  [Vista previa] [Restaurar default] [Guardar]
Bottom: Datos demo: factura FT-0039350 (cambiar)  [↻ Recargar preview]
```

### Características
- Vista previa en vivo con payload demo del último documento real de la empresa.
- Variables explorer (árbol clickeable que inserta `{{ data.x.y }}`).
- Toggle A4 portrait/landscape/Carta/80mm POS.
- Atajos: Cmd+S, Cmd+Z/Y, Cmd+P.
- Vista previa con datos reales: abre `/print/<codigo_doc>/<id>?templateDraft=1` con el JSON no guardado.
- Restaurar por defecto vuelve al registry (con confirmación).
- Versión incremental + snapshot en `TFAT_PLANTILLA_PDF_HIST` por cada Guardar.

### Permisos
Flag `acceso_settings_pdf` en TUSR_USUARIO_FLAGS. Por defecto solo administradores.

## 6. Contrato `print-data`

### Familia "documento"
```ts
{
  cia: { no_cia, razon_social, rnc, direccion, telefono, email, logo_url, color_primario },
  doc: { tipo, no, fecha, fecha_venc, ncf, ncf_dgi, tipo_ncf, estado, anulada, impresion,
         condicion_pago, vendedor, nota, moneda, tasa, ...campos_propios_modulo },
  cliente?: { no, nombre, rnc, direccion, telefono, email, tipo_ncf },
  proveedor?: { ... },
  lineas: [{ codigo, descripcion, cantidad, unidad, precio, descuento, itbis, total, ...extra }],
  totales: { subtotal, descuento, itbis, propina, otros, total, monto_letras },
  extra?: { ... }
}
```

### Familia "reporte"
```ts
{
  cia: { ...mismo },
  reporte: { codigo, titulo, fecha_generacion, filtros: { desde, hasta, ...etiquetas_legibles } },
  filas: [{ ...columnas_planas }] | [{ grupo, filas: [...], subtotales }],
  totales: { ...sumarios }
}
```

## 7. Motor de templating

- **Handlebars** (≈22KB) sobre `TextoLibre`.
- Helpers en `frontend/src/features/pdf/handlebars-helpers.ts`: `formatMoney`, `formatDate`, `upper`, `pad`, `if`, `each`.
- Sandbox: solo Handlebars puro; no `{{{raw}}}` salvo whitelist explícita.
- Catálogo de variables en el editor lee `registry[codigo_doc].schema`.

## 8. Persistencia (Oracle)

```sql
CREATE TABLE FAT.TFAT_PLANTILLA_PDF (
  NO_CIA            NUMBER(2)     NOT NULL,
  CODIGO_DOC        VARCHAR2(40)  NOT NULL,
  NOMBRE            VARCHAR2(100) NOT NULL,
  DEFINICION_JSON   CLOB,
  PAGE_SIZE         VARCHAR2(10)  DEFAULT 'A4',
  PAGE_ORIENTATION  VARCHAR2(10)  DEFAULT 'P',
  ACTIVO            CHAR(1)       DEFAULT 'S',
  VERSION           NUMBER(4)     DEFAULT 1,
  FECHA_MOD         DATE          DEFAULT SYSDATE,
  USUARIO_MOD       VARCHAR2(30),
  PRIMARY KEY (NO_CIA, CODIGO_DOC)
);

CREATE TABLE FAT.TFAT_PLANTILLA_PDF_HIST (
  NO_CIA            NUMBER(2)     NOT NULL,
  CODIGO_DOC        VARCHAR2(40)  NOT NULL,
  VERSION           NUMBER(4)     NOT NULL,
  DEFINICION_JSON   CLOB,
  PAGE_SIZE         VARCHAR2(10),
  PAGE_ORIENTATION  VARCHAR2(10),
  FECHA_MOD         DATE,
  USUARIO_MOD       VARCHAR2(30),
  PRIMARY KEY (NO_CIA, CODIGO_DOC, VERSION)
);
```

Repo backend: `apps/legacy/plantillas_pdf_repo.py` (patrón `fat_repo.py`, oracledb thick).

## 9. Plan de migración por fases

| Fase | Alcance | Entregable |
|---|---|---|
| **Fase 0 — Base** | DDL + endpoints settings + repo + registry frontend + catálogo Puck (14 bloques) + ruta `/print/*` + editor `/settings/pdf-plantillas` + plantillas default JSON para factura/conduce/cotización/listado-facturas | Sistema funcionando con 4 PDFs FAT migrados como prueba |
| **Fase 1 — FAT** | print-data para los 12 docs FAT restantes + cableado + smoke + borrar `views_print.py` | FAT completo en frontend |
| **Fase 2 — INV** | print-data para los 6 docs/reportes INV + cableado + borrar `inv_*_pdf` | INV completo |
| **Fase 3 — CXC + CXP** | recibos, estados de cuenta, aging, retenciones | CXC/CXP completos |
| **Fase 4 — CNT + BAN** | comprobantes, libros, balances, cheques, conciliaciones | CNT/BAN completos |
| **Fase 5 — Resto** | ODC, CHC, NOM, ACF, ACC, SDN, MAN | Cobertura total |

Cada fase es un spec + plan + PR(s) independientes.

### Compatibilidad
- Endpoints `*_pdf` actuales viven hasta que la fase del módulo termina.
- Cada PR migra un botón "Imprimir" y borra el `*_pdf` correspondiente en el mismo commit.

## 10. Entregables auxiliares

### 10.A — Skill `sigaft-pdf-templates`
Ubicación: `C:\Users\JCABREU\.claude\skills\sigaft-pdf-templates\SKILL.md`

Contenido:
1. Arquitectura del sistema (ruta `/print/*`, registry, Puck, Handlebars, tabla Oracle).
2. Cómo añadir un bloque nuevo a Puck (componente React + schema de props + registrar en `blocks/index.ts`).
3. Cómo añadir un `codigo_doc` nuevo (registry + print-data + plantilla default + smoke).
4. Reglas de paginación A4 (`@page { size: A4; margin: 15mm }`, `page-break-inside: avoid`, `thead` repetido).
5. Debug (por qué `window.print()` rompe estilos, cómo forzar refresco con `?templateDraft=1`).
6. Deploy (pscp + smoke, según `sigaft-deploy-vm`).
7. Patrón de retiro de ReportLab (matar `*_pdf` en el mismo PR).

Triggers en description: "PDF", "plantilla", "imprimir", "print-data", "Puck", "/print/", "TFAT_PLANTILLA_PDF".

### 10.B — Agente `sigaft-pdf-builder`
Registrado vía `memory_register_agent`.

- **Trigger**: "Migrar un PDF concreto del backend ReportLab al sistema /print del frontend, end-to-end: print-data + plantilla default + cableado del botón + smoke en VM 10.0.0.99 + borrar el `*_pdf` viejo."
- **Carga automática**: skills `sigaft-pdf-templates`, `sigaft-deploy-vm`, `sigaft-legacy-testing`.
- **Dispatch**: `memory_dispatch("sigaft-pdf-builder", task="Migrar fat_documento_pdf (factura A4)")`.
- **Retorna**: commit hash, archivos tocados, smoke result, URL del PDF en navegador VM.

## 11. Criterios de éxito

- [ ] Tabla `TFAT_PLANTILLA_PDF` + `TFAT_PLANTILLA_PDF_HIST` creadas en Oracle.
- [ ] Editor `/settings/pdf-plantillas` permite editar y guardar la plantilla de Factura para empresa 01.
- [ ] La Factura `FT-0039350` se imprime correctamente desde `/print/factura/FT-0039350` (visualmente equivalente al ReportLab actual).
- [ ] Editar el HeaderEmpresa (cambiar color primario y subir logo) impacta el PDF inmediatamente en siguientes impresiones.
- [ ] `views_print.py` y `inv_views.py` quedan **vacíos de renderers ReportLab** al final de Fase 2 (excepto FAT-cuadre-caja u otros aún pendientes que se cierran en fases posteriores).
- [ ] Skill `sigaft-pdf-templates` instalada y verificable con `Skill` tool.
- [ ] Agente `sigaft-pdf-builder` registrado y respondiendo a `memory_dispatch`.

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Paginación de `TablaLineas` con muchas líneas rompe en `window.print()` entre navegadores | Forzar `thead` repetido, `tr { page-break-inside: avoid }`, tests visuales en Chrome (es el navegador soportado del proyecto) |
| Plantilla rota en producción deja una empresa sin poder imprimir | `Restaurar default` siempre disponible; el render cae automáticamente al default del registry si el JSON falla al parsear o referencia bloques inexistentes |
| Variables Handlebars con expresiones malformadas | Catch en runtime, mostrar `{{ error }}` en el slot y log; no rompe la página |
| Logo grande revienta tamaño del PDF | Validación en upload: max 200KB, redimensionar a 300px ancho en cliente antes de subir |
| Múltiples versiones de plantilla acumulan CLOBs en HIST | Job periódico (futuro) que limita a últimas 20 versiones por (no_cia, codigo_doc) |
