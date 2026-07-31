# Historial / Auditoría de usuarios — diseño

**Fecha:** 2026-07-31
**Autores:** JCABREU + Claude
**Estado:** Diseño aprobado, listo para plan de implementación

## Objetivo

Dar trazabilidad de quién hizo qué en ZentoryERP: cada vez que un usuario crea,
edita, anula o reversa un documento en cualquier módulo, queda un registro con
quién, cuándo, qué acción y — para ediciones — qué campos cambiaron (valor
anterior → nuevo), al estilo del *chatter* de Odoo. Se expone en tres lugares:

1. **Dashboard** — cada usuario ve un widget "Mi actividad reciente" con sus
   propios últimos movimientos.
2. **Página de administración** — un admin ve TODO lo que hizo TODO el mundo,
   con filtros.
3. **Pestaña "Historial" en cada pantalla de documento** — el historial de un
   documento puntual (ej. la factura FT-0001234), junto al formulario donde se
   edita, igual que el chatter de Odoo al lado de un registro.

## Alcance (decidido en brainstorming)

- **Sistema legado (Forms 6i) ya no escribe en paralelo** — todos los usuarios
  operan solo vía ZentoryERP. Esto habilita auditoría a nivel de aplicación
  (Django) en vez de triggers de base de datos: más simple, y es la única forma
  de capturar el "motivo" que el usuario escribe al anular/reversar.
- **Acciones registradas:** `CREAR`, `EDITAR`, `ANULAR`, `REVERSAR`. No se
  registran impresiones, exportaciones, logins ni lecturas — sería ruido para
  lo que se pidió (saber quién creó/editó/anuló qué).
- **Alcance de módulos: los 11 desde el diseño** — FAT, CXC, CXP, INV, ACC,
  CHC, SDN, ODC, ACF, CNT, MAN. El mecanismo es genérico (una función,
  `log_evento`); el plan de implementación decide el orden de instrumentación
  módulo por módulo (ver "Notas para el plan").
- **Detalle de ediciones: campo por campo con valor anterior/nuevo** — no solo
  "Juan editó la factura", sino "Juan cambió Total: RD$1,500.00 → RD$1,800.00"
  (estilo Odoo tracked fields).
- **Vista por documento: pestaña "Historial" en cada pantalla** (no solo la
  página admin filtrando por número) — más cómodo, consistente con el patrón
  Odoo que pidió el usuario explícitamente.
- **De paso resuelve un gap real ya detectado**: hoy el motivo de anulación de
  una factura FAT no se persiste en ningún lado (`fat_repo.anular_factura`
  recibe `motivo` pero no lo guarda), y en CXP el motivo de reverso solo queda
  enterrado como texto libre dentro del detalle del asiento de ajuste
  (`cxp_repo.reversar_documento`). Con esta tabla, el motivo queda en un solo
  lugar consultable para cualquier módulo.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Browser (React)                                                         │
│  ┌──────────────────────┐   ┌────────────────────────────────────────┐ │
│  │ Dashboard             │   │ Card "Mi actividad reciente"           │ │
│  │ features/dashboard    │ → │ últimos ~10 eventos propios, link al   │ │
│  │                        │   │ documento ← GET /api/historial/mio/    │ │
│  └──────────────────────┘   └────────────────────────────────────────┘ │
│                                                                          │
│  ┌──────────────────────┐   ┌────────────────────────────────────────┐ │
│  │ Sidebar "Sistema"      │   │ /historial (solo admin)                │ │
│  │ → "Historial"          │ → │ tabla paginada + filtros usuario/      │ │
│  │                        │   │ módulo/tipo/no.doc/acción/fechas       │ │
│  │                        │   │ ← GET /api/historial/                  │ │
│  └──────────────────────┘   └────────────────────────────────────────┘ │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Pantalla de documento (Ffat204, Fcxp201, Fcxc201, Finv..., etc.)  │  │
│  │  Tab "Datos"  │  Tab "Historial" ← GET /api/historial/documento/  │  │
│  │               │   eventos de ESE no_documento, diffs incluidos    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Los 3 consumen el mismo componente compartido                          │
│  features/historial/historial-timeline.tsx (modos: compacto/completo)   │
└───────────────────────────────────────┼─────────────────────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Django backend — nueva app apps/historial                               │
│   views.py: MiActividadView, HistorialAdminView, HistorialDocumentoView │
│   repo.py:  bitacora_repo.log_evento(...)  (acceso directo oracledb,    │
│              mismo estilo que apps/asistente/audit.py)                  │
│   diff.py:  diff_campos(antes, despues, etiquetas=None, ignorar=None)   │
│                                                                          │
│  Tablas nuevas (schema ABREGONZA, sinónimo JCABREU):                    │
│    TSYS_BITACORA                                                        │
│    TSYS_BITACORA_DETALLE                                                │
└───────────────────────────────────────┼─────────────────────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Cada repo de escritura ya existente llama log_evento() al final,        │
│ usando el MISMO cursor/conexión de la escritura que audita:             │
│   apps/legacy/repositories/fat_repo.py   (FAT + CXC, viven juntos)      │
│   apps/legacy/repositories/cxp_repo.py                                  │
│   apps/legacy/repositories/inv_repo.py                                  │
│   apps/legacy/repositories/acc_repo.py                                  │
│   apps/legacy/chc_views.py / repositories/*                             │
│   apps/legacy/sdn_views.py, odc_repo.py, acf_*, cnt_*, man_*            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Decisiones clave

- **App Django nueva y aislada** (`apps/historial`), no bajo `apps/legacy` — no
  hay tabla legado equivalente (el Forms original solo tiene "Historial de
  Documentos" por cuenta/cliente, que es un libro de movimientos, no una
  bitácora de quién-hizo-qué). Sigue el estilo de `apps/asistente/audit.py`:
  acceso directo con `oracledb`, sin ORM Django, schema `ABREGONZA`.
- **`log_evento` corre en la MISMA transacción que la escritura que audita.**
  Recibe el cursor/conexión ya abierto por la función que llama (no abre uno
  propio), para que un rollback del documento también deshaga su log — nunca
  puede quedar un evento de "se editó" sin que la edición realmente se haya
  guardado.
- **Diff por denylist, no allowlist.** En vez de mantener una lista de "campos
  trackeados" por cada tipo de documento (frágil: cualquier campo nuevo que no
  se agregue a la lista se pierde en silencio), `diff_campos` compara TODAS
  las claves presentes en `antes` y `despues`, salvo un denylist corto de
  columnas técnicas sin valor para un humano (`no_cia`, `punto`, `usuario`,
  `fecha_sysdate`, ids internos). Etiqueta amigable: se busca en un mapa
  opcional por módulo (`apps/historial/etiquetas.py`); si no existe, se
  autogenera humanizando el nombre técnico (`condicion_pago` → "Condicion
  pago"). El mapa de etiquetas se puede ir completando con el tiempo sin que
  eso bloquee que el diff funcione desde el día uno.
- **NO_DOCUMENTO se guarda crudo** (ej. `"0001234"`), igual que ya se guarda en
  las tablas de documento existentes — el prefijo visible (`FT-0001234`) se
  compone en el frontend con la misma lógica que ya usan las pantallas
  existentes (tabla de prefijos en `sigaft-ui-facturacion`), no se duplica en
  la bitácora.
- **El tab "Historial" de un documento usa el MISMO permiso que ya protege ver
  ese documento** (`permissions_repo.list_user_doc_perms` por módulo/tipo),
  no requiere ser admin — es razonable que cualquier usuario que puede ver una
  factura vea también su historial. Solo la vista cross-usuario
  (`/api/historial/` sin filtrar a un documento) requiere `IsLegacyAdmin`.
- **Naming ZentoryERP**: nada de "SIGAF"/"SIGAFT" visible en la UI. El módulo
  se llama "Historial" en el sidebar.

## Modelo de datos (Oracle)

```sql
CREATE TABLE ABREGONZA.TSYS_BITACORA (
    BITACORA_ID     NUMBER GENERATED ALWAYS AS IDENTITY,
    FECHA           DATE          DEFAULT SYSDATE NOT NULL,
    USUARIO         VARCHAR2(30)  NOT NULL,
    NO_CIA          VARCHAR2(2)   NOT NULL,
    PUNTO           VARCHAR2(2),
    MODULO          VARCHAR2(10)  NOT NULL,   -- FAT/CXC/CXP/INV/ACC/CHC/SDN/ODC/ACF/CNT/MAN
    TIPO_DOCUMENTO  VARCHAR2(10)  NOT NULL,   -- FT/FC/AF/FP/ODC/REQ/CH/... (crudo, sin prefijo)
    NO_DOCUMENTO    VARCHAR2(15)  NOT NULL,   -- crudo, sin prefijo
    ACCION          VARCHAR2(15)  NOT NULL,
    MOTIVO          VARCHAR2(500),
    DESCRIPCION     VARCHAR2(500) NOT NULL,   -- resumen humano autogenerado
    CONSTRAINT PK_TSYS_BITACORA PRIMARY KEY (BITACORA_ID),
    CONSTRAINT CK_TSYS_BITACORA_ACCION CHECK (
        ACCION IN ('CREAR','EDITAR','ANULAR','REVERSAR')
    )
);

CREATE INDEX IX_TSYS_BITACORA_DOC   ON ABREGONZA.TSYS_BITACORA (NO_CIA, MODULO, TIPO_DOCUMENTO, NO_DOCUMENTO, FECHA DESC);
CREATE INDEX IX_TSYS_BITACORA_USR   ON ABREGONZA.TSYS_BITACORA (USUARIO, FECHA DESC);
CREATE INDEX IX_TSYS_BITACORA_FECHA ON ABREGONZA.TSYS_BITACORA (FECHA DESC);

CREATE TABLE ABREGONZA.TSYS_BITACORA_DETALLE (
    DETALLE_ID      NUMBER GENERATED ALWAYS AS IDENTITY,
    BITACORA_ID     NUMBER        NOT NULL,
    CAMPO           VARCHAR2(60)  NOT NULL,   -- nombre técnico
    ETIQUETA        VARCHAR2(60)  NOT NULL,   -- etiqueta amigable
    VALOR_ANTERIOR  VARCHAR2(1000),
    VALOR_NUEVO     VARCHAR2(1000),
    CONSTRAINT PK_TSYS_BITACORA_DETALLE PRIMARY KEY (DETALLE_ID),
    CONSTRAINT FK_TSYS_BITACORA_DETALLE
        FOREIGN KEY (BITACORA_ID) REFERENCES ABREGONZA.TSYS_BITACORA(BITACORA_ID)
        ON DELETE CASCADE
);

CREATE INDEX IX_TSYS_BITACORA_DET_HDR ON ABREGONZA.TSYS_BITACORA_DETALLE (BITACORA_ID);

GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TSYS_BITACORA         TO JCABREU;
GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TSYS_BITACORA_DETALLE TO JCABREU;

CREATE OR REPLACE SYNONYM JCABREU.TSYS_BITACORA         FOR ABREGONZA.TSYS_BITACORA;
CREATE OR REPLACE SYNONYM JCABREU.TSYS_BITACORA_DETALLE FOR ABREGONZA.TSYS_BITACORA_DETALLE;
```

`TSYS_BITACORA_DETALLE` solo tiene filas cuando `ACCION = 'EDITAR'` y hubo
campos con diferencia real entre `antes`/`despues`; `CREAR`/`ANULAR`/
`REVERSAR` solo usan la cabecera (`DESCRIPCION` y, si aplica, `MOTIVO`).

## Backend API

Todas bajo `/api/historial/`, autenticación por sesión existente.

| Método | Ruta | Quién | Descripción |
|--------|------|-------|-------------|
| GET | `/api/historial/mio/?limit=10` | usuario autenticado | Sus propios últimos eventos, para el widget del dashboard. |
| GET | `/api/historial/?usuario=&modulo=&tipo_documento=&no_documento=&accion=&fecha_desde=&fecha_hasta=&page=` | solo admin (`IsLegacyAdmin`) | Todos los eventos, paginado + filtros, para la página de administración. |
| GET | `/api/historial/documento/?no_cia=&modulo=&tipo_documento=&no_documento=` | cualquier usuario con permiso de ver ese tipo de documento (mismo chequeo que la pantalla de detalle) | Eventos de un documento puntual, con el detalle de campos cambiados incluido en cada evento `EDITAR`. |

Respuesta de un evento (usada en los 3 endpoints):

```json
{
  "bitacora_id": 4821,
  "fecha": "2026-07-31T10:32:00",
  "usuario": "JCABREU",
  "modulo": "FAT",
  "tipo_documento": "FT",
  "no_documento": "0001234",
  "accion": "EDITAR",
  "descripcion": "JCABREU editó la factura FT-0001234 (2 campos)",
  "motivo": null,
  "cambios": [
    {"campo": "total", "etiqueta": "Total", "valor_anterior": "1500.00", "valor_nuevo": "1800.00"},
    {"campo": "condicion_pago", "etiqueta": "Condicion pago", "valor_anterior": "CONTADO", "valor_nuevo": "CREDITO"}
  ]
}
```

## Integración con módulos existentes

Cada función de escritura en los repos ya existentes gana una llamada a
`log_evento(...)` al final, antes del commit, usando el mismo cursor:

- **CREAR**: no hay diff — `log_evento(accion="CREAR", cambios=None, descripcion=f"{usuario} creó la {tipo_doc_label} {prefijo}")`.
- **EDITAR**: la función de edición ya hace (o debe hacer) un `SELECT` del
  documento antes de aplicar el `UPDATE` — ese dict "antes" se compara contra
  el payload "después" con `diff_campos`. Si el diff sale vacío (nada cambió
  realmente), no se inserta ningún evento.
- **ANULAR / REVERSAR**: se pasa el `motivo` que ya recibe la función (hoy se
  descarta en FAT, se entierra en el detalle del asiento en CXP) y queda
  persistido en `TSYS_BITACORA.MOTIVO`.

Esto toca, como mínimo, estas funciones (lista de referencia para el plan, no
exhaustiva — el plan de implementación las audita una por una):

`fat_repo.py` (`create_factura`, `anular_factura`, ediciones de factura/
conduce/cotización), `cxp_repo.py` (creación de documentos, `reversar_
documento`), `inv_repo.py` (movimientos de entrada/salida/ajuste), `acc_repo.
py` (reposición/cierre), `chc_*` (emisión/anulación de cheques), `sdn_*`
(movimientos manuales), `odc_repo.py` (orden/requisición), `acf_*` (compra/
retiro/depreciación), `cnt_*`, `man_*`.

## Frontend

- `lib/api-client-historial.ts`: `historialMio(limit)`, `historialAdmin(filtros, page)`, `historialDocumento(params)`.
- `features/historial/historial-timeline.tsx`: componente compartido, recibe
  una lista de eventos y un modo (`compacto` para el widget del dashboard,
  `completo` para admin/documento). Ícono por acción (Plus verde=CREAR,
  Pencil azul=EDITAR, XCircle rojo=ANULAR/REVERSAR), fecha con `fmtDate`,
  `Badge` para la acción, y para `EDITAR` una lista `campo: anterior → nuevo`
  con `tabular-nums` cuando el valor es numérico.
- **Dashboard**: nueva `<Card>` "Mi actividad reciente" en
  `features/dashboard/index.tsx`, React Query `['historial-mio']`, cada fila
  linkea a la pantalla del documento correspondiente.
- **Página admin** `/historial`, nueva hoja en el sidebar bajo el grupo
  "Sistema" (junto a Permisos), oculta si el usuario no es admin. Tabla
  paginada siguiendo `sigaft-crud-pagination` (filtros en fila horizontal,
  `placeholderData` en la paginación, `invalidateQueries` no aplica porque es
  de solo lectura). Fila expandible muestra los `cambios` cuando
  `accion === 'EDITAR'`.
- **Tab "Historial" en pantallas de documento**: se agrega un `<Tabs>` (o
  sección equivalente ya usada en esa pantalla) junto al tab de datos actual
  en las pantallas de edición/detalle existentes (Ffat204 y demás pantallas de
  factura/conduce/cotización, Fcxp201, Fcxc201, pantallas de movimiento de
  INV, etc.), usando `<HistorialTimeline modo="completo" modulo=... tipoDocumento=... noDocumento={...} />`.

## Testing / verificación

No hay pantalla legado equivalente (el "Historial de Documentos" del Forms
original es un libro de cuenta, no una bitácora de usuario) — funcionalidad
100% nueva, `sigaft-legacy-testing` no aplica.

- Backend: tests del repo (`pytest`) para `diff_campos` (denylist, etiquetas,
  autohumanizado, diff vacío no genera evento) y para el scoping de permisos
  de cada endpoint (admin vs. propio vs. por-documento).
- Deploy: `sigaft-deploy-vm` — subir con `pscp`, `docker compose exec backend
  python -m py_compile`, smoke test con `django.test.Client(secure=True)`
  antes de declarar listo.
- Frontend: push a `main` → Netlify; smoke manual (crear/editar/anular un
  documento de prueba en un módulo piloto, verificar que aparece en el widget
  del dashboard, en la página admin, y en el tab del documento con el diff
  correcto).

## Notas para el plan de implementación

El plan debe fasear el rollout aunque el diseño cubra los 11 módulos:

1. **Fase base**: tablas Oracle, `apps/historial` (repo + diff + 3 endpoints),
   componente `historial-timeline`, widget del dashboard, página admin —
   validados con un solo módulo piloto (FAT, que ya tiene el gap de motivo de
   anulación sin persistir, buen caso de prueba real).
2. **Fase de cobertura**: instrumentar `log_evento` en el resto de los repos
   (CXC, CXP, INV, ACC, CHC primero por ser los más transaccionales con
   dinero real; luego SDN, ODC, ACF, CNT, MAN) y agregar el tab "Historial" en
   cada pantalla de documento correspondiente.

## Adición: registro y reporte automático de errores

Pedido del usuario al aprobar el spec: cuando el sistema da un error, que quede
registrado automáticamente, y que el usuario tenga un botón "Reportar este
error" que tome una captura de pantalla y lo mande al módulo de Reportes/
Soporte ya existente (`apps/reportes`, spec `2026-07-22-reportes-soporte-
design.md`) para que se pueda resolver después. Es una extensión de
`apps/reportes`, no de `apps/historial` — se documenta aquí porque se pidió
junto con este spec y se ejecuta en el mismo plan.

**Registro automático (silencioso, sin acción del usuario):**

- Tabla nueva `ABREGONZA.TSYS_ERROR_LOG` (ERROR_ID, FECHA, USUARIO, MODULO,
  URL, STATUS_HTTP, MENSAJE, DETALLE CLOB con stack trace/respuesta del
  backend, REPORTE_ID nullable — se llena si el usuario después decide
  reportarlo).
- Backend: un exception handler global de DRF (`EXCEPTION_HANDLER` en
  settings) inserta en `TSYS_ERROR_LOG` cada 500 no controlado, sin exponer
  detalle interno en la respuesta al cliente (eso ya debería ser el
  comportamiento actual, solo se agrega el insert).
- Frontend: interceptor de `api-client.ts` (axios/fetch) que en cualquier
  respuesta 4xx/5xx llama a un endpoint liviano `POST /api/reportes/error-log/`
  con `{mensaje, url, status_http, modulo}` — cubre errores que el backend no
  ve como excepción (ej. 404, 403) y errores de JS en el browser capturados
  por un `ErrorBoundary` de React a nivel de `App`.

**Botón "Reportar este error" (acción explícita del usuario):**

- Cuando ocurre un error visible (toast de error de una mutación, o la
  pantalla de fallback del `ErrorBoundary`), se muestra un botón secundario
  "Reportar este error" junto al mensaje.
- Al hacer click: captura un screenshot del viewport actual con `html2canvas`
  (dependencia nueva, liviana, no requiere permisos del browser) y llama al
  `POST /api/reportes/` YA EXISTENTE (multipart, mismo endpoint que "Soporte"
  manual) con `titulo` y `descripcion` pre-llenados desde el error técnico,
  `modulo` inferido de la ruta actual, e `imagenes[]` = el screenshot.
- El reporte generado así es indistinguible en la tabla admin de Reportes de
  uno manual — mismo flujo de `ABIERTO → EN_PROGRESO → COMPLETADO/CANCELADO`,
  mismo lightbox de imágenes. Si el `TSYS_ERROR_LOG` original tenía
  `REPORTE_ID` vacío, se actualiza con el `reporte_id` recién creado (permite
  correlacionar "cuántos errores silenciosos terminaron reportados").

**Decisión de diseño**: reutilizar `apps/reportes` en vez de crear un cuarto
sistema de tickets — el módulo de Soporte ya tiene estado, imágenes,
notas de resolución y una pantalla admin funcionando; lo único que falta es
automatizar el llenado del formulario y agregar el log silencioso de errores
que nadie reporta manualmente.

## Fuera de alcance

- Impresiones, exportaciones, logins y accesos de solo lectura — no se
  registran (ver "Alcance").
- Notificaciones en tiempo real de actividad de otros usuarios — no pedido.
- Editar o borrar entradas de la bitácora — es un registro de auditoría, debe
  ser append-only; no se expone ningún endpoint de escritura manual ni de
  borrado.
