# Historial de documentos multi-módulo (INV, CxC, ODC, FAT) — Design

2026-08-14

## Contexto

En CxP (Consulta de Documentos) existe un botón "Ver historial" que muestra quién
creó/editó/anuló un documento: un componente `DocumentoHistorial` (definido
localmente en `frontend/src/features/cxp/documentos.tsx`) que llama a
`historialDocumento()` (`/api/historial/documento/`, `HistorialDocumentoView`) y
pinta `HistorialTimeline`. Si no hay eventos de bitácora (documento migrado o
creado antes de que existiera el logging), cae a un fallback: "Creado por
{usuario}", usando la columna `usuario` que el documento ya trae en su detalle.

El backend de este endpoint ya es genérico (recibe `modulo` como parámetro) y el
permiso ya es el mismo que protege ver el documento (asignación de `tipo_docu`
por módulo/empresa/punto vía `permissions_repo.list_user_doc_perms`), sin
requerir admin.

FAT ya tiene una versión de esto en `factura-detalle-dialog.tsx`
(`FacturaHistorialTab`), pero **sin el fallback de `usuario`** — y
`fat_repo.get_factura()` ni siquiera selecciona esa columna, así que en FAT
nunca se puede saber quién creó una factura si falta el evento de bitácora.
Este es un bug real reportado por el usuario, no solo un gap de cobertura.

INV, CxC y ODC no tienen ningún botón de historial en sus pantallas de
"Consulta de Documentos" / "Consulta de Órdenes". Además, sus repositorios
(`inv_repo.py`, `cxc_repo.py`, `odc_repo.py`) nunca llaman a
`historial_repo.log_evento(...)` — solo `cxp_repo.py` y `fat_repo.py` lo hacen
hoy. Sin esa llamada, el timeline de esos módulos estaría siempre vacío (solo
fallback), aunque se agregue el botón.

Se pidió extender el mismo patrón a Inventario (INV), Cuentas por Cobrar
(CxC), Órdenes de Compra (ODC) y arreglar Facturación (FAT), reutilizando un
componente compartido, de solo lectura (sin acciones de edición).

## Objetivo

1. Extraer el patrón de historial de documento a un componente reutilizable.
2. Arreglar el gap real de FAT (no se ve quién creó la factura).
3. Agregar el botón "Ver historial" a las pantallas de consulta de INV, CxC y
   ODC.
4. Instrumentar `log_evento` en los puntos de escritura de INV/CxC/ODC para
   que el timeline tenga eventos reales (CREAR/EDITAR/ANULAR/REVERSAR), no
   solo el fallback.

Fuera de alcance: backfill retroactivo de bitácora para documentos ya
existentes (se quedan con el fallback "Creado por X", igual que hoy en
CxP/FAT). Módulos no mencionados por el usuario (CHC, ACC, SDN, ACF) no se
tocan en esta ronda.

## 1. Componente compartido `DocumentoHistorial`

Nuevo archivo `frontend/src/features/historial/documento-historial.tsx`,
extraído tal cual de `cxp/documentos.tsx` (líneas ~471-503) pero parametrizando
`modulo`:

```tsx
export function DocumentoHistorial({
  modulo, noCia, punto, tipoDocumento, noDocumento, usuarioDoc,
}: {
  modulo: string; noCia: string; punto: string
  tipoDocumento: string; noDocumento: string; usuarioDoc?: string | null
}) { /* mismo cuerpo que hoy, con modulo dinámico en vez de 'CXP' fijo */ }
```

Comportamiento (sin cambios respecto al de CxP hoy):
- `useQuery` sobre `historialDocumento({ no_cia, punto, modulo, tipo_documento, no_documento })`.
- Si `items.length === 0`: fallback "Creado por {usuarioDoc}" o "Sin actividad
  registrada" si no hay `usuarioDoc`.
- Si hay eventos: `<HistorialTimeline eventos={items} modo="completo" />`.
- Sin botones de edición/borrado ni mutaciones — es un panel de solo lectura.

`cxp/documentos.tsx` y `fat/factura-detalle-dialog.tsx` se migran a importar
este componente en vez de mantener su propia copia.

## 2. Fix del gap en FAT

`fat_repo.get_factura()`:
- Agregar `f.usuario` al `SELECT` de `FAT.TFAT_FACTURA`.
- Agregar `'usuario': (r['usuario'] or '').strip()` al dict de retorno.

`factura-detalle-dialog.tsx`: pasar `usuarioDoc={detalle.usuario}` al
componente compartido en el tab de Historial. Con esto, cualquier factura sin
bitácora (vieja o de un flujo que no logueó el evento) muestra quién la creó.

## 3. Botón "Ver historial" en INV / CxC / ODC

Todas estas pantallas ya devuelven `usuario` en el detalle del documento —
no requieren cambio de backend para el fallback, solo UI:

- **INV** — `features/inv/consulta-documentos.tsx`: agregar botón + panel en
  el `Sheet` de detalle existente (mismo lugar donde ya se muestra
  `h.usuario`), pasando `modulo="INV"`.
- **CxC** — `features/cxc/cxc-procesos.tsx` (`CxcDocumentos`): agregar botón +
  panel en el `Dialog` de detalle, pasando `modulo="CXC"`. `get_documento` ya
  selecciona `d.usuario`.
- **ODC** — pantallas "Consulta de Órdenes" y "Consulta de Requisiciones":
  agregar botón + panel, pasando `modulo="ODC"`. `TODC_ORDEN.usuario` ya
  existe y `get_orden`/`get_requisicion` ya lo devuelven (`SELECT o.*`).

## 4. Permiso de historial en ODC (sin tabla de tipo-documento)

ODC no tiene `TODC_TDOCU` (no maneja permisos finos por tipo de documento).
`HistorialDocumentoView` (backend) se ajusta: cuando `modulo == 'ODC'`
(o, en general, un módulo sin tabla de tipo-documento en
`permissions_repo._MODULES`), el chequeo de permiso deja de intentar
`list_user_doc_perms` y en su lugar reutiliza el mismo chequeo de acceso a
módulo que ya protege ver la orden/requisición hoy (acceso por módulo, no por
tipo de documento). DBA sigue viendo todo, igual que en el resto de módulos.

## 5. Bitácora real: instrumentar `log_evento` en INV/CxC/ODC

Se agrega `historial_repo.log_evento(cur, usuario=..., no_cia=..., punto=...,
modulo=..., tipo_documento=..., no_documento=..., accion=...)` en los mismos
puntos donde CxP/FAT ya lo hacen (justo antes del commit de la transacción):

- **INV** (`inv_repo.py`):
  - `create_movimiento_documento` / `create_movimiento_from_payload` → `CREAR`
  - función de reversar documento de INV → `REVERSAR`
- **CxC** (`cxc_repo.py`):
  - `save_documento` → `CREAR`
  - `crear_recibo_cobro` → `CREAR`
  - `reversar_documento` → `REVERSAR`
  - `corregir_ncf` → `EDITAR`
  - `crear_dv_mirror` (espejo de una factura FAT en CxC) → `CREAR` bajo
    `modulo="CXC"`, para que el documento espejo tenga su propio evento en vez
    de depender del historial de FAT.
- **ODC** (`odc_repo.py`):
  - `create_orden` / `create_requisicion` → `CREAR`
  - flujo de editar orden (ya existente, agregado 2026-08-10) → `EDITAR`
  - flujo de anular orden/requisición → `ANULAR`

El motivo/detalle de cada evento sigue el mismo formato ya usado por
`historial_repo.log_evento` en CxP/FAT (no se cambia su firma ni su tabla).

## Testing

- Sin servidor de desarrollo local (Node local no cumple `engines` de
  vite@8 — ver gotcha de memoria). Verificación vía:
  - Backend: subir con `pscp` a la VM 10.0.0.99 y `py_compile` +
    smoke con `django.test.Client`.
  - Frontend: push a `main` → build de Netlify, luego smoke visual con
    Playwright/Chrome MCP en la URL pública (crear/editar/reversar un
    documento de prueba por módulo — usar convención `ZZTEST` y
    revertir/anular al final — y confirmar que aparece en su historial).
- Confirmar caso FAT: abrir una factura vieja sin bitácora y una nueva creada
  en la sesión de prueba; la vieja debe mostrar "Creado por X", la nueva debe
  mostrar el evento `CREAR` real.
- Confirmar ODC: usuario sin acceso al módulo ODC recibe 403 en
  `/api/historial/documento/?modulo=ODC...`; usuario con acceso lo ve sin
  necesitar ser admin.
