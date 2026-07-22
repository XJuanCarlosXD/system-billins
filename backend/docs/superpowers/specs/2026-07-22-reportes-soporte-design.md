# Reportes de problemas ("Soporte") — diseño

**Fecha:** 2026-07-22
**Autores:** JCABREU + Claude
**Estado:** Diseño aprobado, listo para plan de implementación

## Objetivo

Dar a cualquier usuario logueado de ZentoryERP una forma de reportar un problema del
sistema (con hasta 3 imágenes de evidencia) desde cualquier página, y dar a un admin
una tabla donde revisar esos reportes y cambiar su estado
(`ABIERTO → EN_PROGRESO → COMPLETADO` o `CANCELADO`).

Este spec cubre **solo** la captura y gestión de reportes (Módulo 1). La
automatización que lee reportes `ABIERTO`, intenta arreglarlos y los prueba con
Claude Code es un proyecto separado — implica decisiones de autonomía (rama vs push
directo, presupuesto, qué hacer si no puede arreglarlo) que se van a diseñar en su
propio spec una vez este módulo esté funcionando y haya reportes reales que probar.

## Alcance (decidido en brainstorming)

- **Quién reporta:** cualquier usuario logueado, sin gate de ACLASE.
- **Quién cambia estado:** admin siempre; el autor puede cancelar su propio reporte
  mientras siga `ABIERTO` o `EN_PROGRESO`.
- **Estado inicial:** `ABIERTO` (no "en progreso" directo) — así el cron futuro sabe
  qué todavía nadie tomó.
- **Imágenes:** hasta 3 por reporte, ~5MB c/u, solo `image/*`, guardadas como BLOB en
  Oracle (mismo enfoque de persistencia que el resto del sistema — todo cubierto por
  el backup de la BD, sin dependencias nuevas de almacenamiento).
- **Alcance de datos:** tabla global, sin `NO_CIA` — es sobre bugs del sistema, no
  datos de negocio por compañía.
- **Campo módulo:** select con el módulo relacionado (FAT/INV/CXC/CXP/CNT/ACC/ACF/
  CHC/SDN/ODC/MAN/FE/ASISTENTE/OTRO) — ayuda a priorizar y, más adelante, al cron a
  ubicar el código relevante.
- **Nota de resolución:** campo de texto visible al usuario cuando su reporte pasa a
  `COMPLETADO` o `CANCELADO` (necesario para cuando el cron cierre reportes solo).
- **Ubicación UI:** "Soporte" vive en el menú de usuario (header), no en el sidebar de
  módulos de negocio — es una función transversal, no un módulo FAT/INV/etc. La tabla
  admin vive como pestaña nueva dentro de Configuración.

## Arquitectura

```
┌───────────────────────────────────────────────────────────────────┐
│ Browser (React)                                                   │
│  ┌─────────────────┐   ┌───────────────────────────────────────┐  │
│  │ Menú usuario     │ → │ Dialog "Reportar problema"            │  │
│  │ (header)         │   │  título + módulo + descripción +      │  │
│  │ "Soporte"        │   │  dropzone hasta 3 imágenes             │  │
│  └─────────────────┘   └───────────────┬───────────────────────┘  │
│                                        │ POST /api/reportes/       │
│  ┌─────────────────┐                   ▼                          │
│  │ "Mis reportes"  │ ← GET /api/reportes/?mine=1                  │
│  │ (mismo menú)    │   (estado + nota_resolucion, botón cancelar) │
│  └─────────────────┘                                              │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Configuración → pestaña "Reportes" (solo admin)              │  │
│  │  tabla con filtros (estado/módulo) ← GET /api/reportes/      │  │
│  │  detalle: imágenes (lightbox) + selector estado +            │  │
│  │  textarea nota_resolucion → PATCH /api/reportes/<id>/        │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────┼───────────────────────────┘
                                        ▼
┌───────────────────────────────────────────────────────────────────┐
│ Django backend — nueva app apps/reportes                          │
│   views.py: ReporteListCreateView, ReporteDetailView,              │
│              ReporteImagenView (sirve el BLOB)                     │
│   repo.py:   acceso directo oracledb (mismo estilo que asistente/  │
│              persist.py — sin ORM, esquema ABREGONZA)              │
│                                                                    │
│  Tablas nuevas (schema ABREGONZA, sinónimo JCABREU):               │
│    TREP_PROBLEMA                                                  │
│    TREP_IMAGEN                                                    │
└───────────────────────────────────────────────────────────────────┘
```

### Decisiones clave

- **App Django nueva y aislada** (`apps/reportes`), no bajo `apps/legacy` — no hay
  tabla legado equivalente en el Oracle Forms original, así que no aplica el patrón
  de repos de `legacy/repositories/*`. Sigue el estilo de `apps/asistente` (acceso
  directo con `oracledb`, sin ORM Django).
- **BLOB en Oracle, no filesystem**: consistente con que todo el sistema vive en la
  BD y un solo backup (`expdp`) lo cubre todo. Cada imagen es una fila propia en
  `TREP_IMAGEN` (no una columna repetida en `TREP_PROBLEMA`), así el límite de 3 es
  una regla de aplicación, no de esquema, y servirlas es un endpoint simple por
  `IMAGEN_ID`.
- **Sin `NO_CIA`**: reportes son sobre el sistema, no sobre datos de una compañía.
  Rompe el patrón de casi todas las demás tablas del sistema a propósito.
- **Nombre visible "Soporte"**: en el menú de usuario, no el sidebar — para no
  mezclar una función transversal (reportar bugs) con los módulos de negocio
  (FAT/INV/CxC/...). Internamente el código puede llamarse `reportes` sin problema.
- **Naming ZentoryERP**: como siempre, nada de "SIGAF"/"SIGAFT" visible al usuario en
  textos de la UI (toasts, labels, nota de resolución por defecto, etc.).

## Modelo de datos (Oracle)

```sql
CREATE TABLE ABREGONZA.TREP_PROBLEMA (
    REPORTE_ID           VARCHAR2(36)  NOT NULL,
    USUARIO              VARCHAR2(30)  NOT NULL,
    MODULO               VARCHAR2(20)  NOT NULL,
    TITULO               VARCHAR2(200) NOT NULL,
    DESCRIPCION          CLOB,
    ESTADO               VARCHAR2(15)  DEFAULT 'ABIERTO' NOT NULL,
    NOTA_RESOLUCION      CLOB,
    RESUELTO_POR         VARCHAR2(30),
    FECHA_CREACION       DATE DEFAULT SYSDATE NOT NULL,
    FECHA_ACTUALIZACION  DATE DEFAULT SYSDATE NOT NULL,
    FECHA_RESOLUCION     DATE,
    CONSTRAINT PK_TREP_PROBLEMA PRIMARY KEY (REPORTE_ID),
    CONSTRAINT CK_TREP_PROB_ESTADO CHECK (
        ESTADO IN ('ABIERTO','EN_PROGRESO','COMPLETADO','CANCELADO')
    )
);

CREATE INDEX IX_TREP_PROB_ESTADO ON ABREGONZA.TREP_PROBLEMA (ESTADO, FECHA_CREACION);
CREATE INDEX IX_TREP_PROB_USR    ON ABREGONZA.TREP_PROBLEMA (USUARIO, FECHA_CREACION DESC);

CREATE TABLE ABREGONZA.TREP_IMAGEN (
    IMAGEN_ID       VARCHAR2(36)  NOT NULL,
    REPORTE_ID      VARCHAR2(36)  NOT NULL,
    NOMBRE_ARCHIVO  VARCHAR2(200),
    MEDIA_TYPE      VARCHAR2(50)  NOT NULL,
    CONTENIDO       BLOB          NOT NULL,
    TAMANO_BYTES    NUMBER(10)    NOT NULL,
    FECHA_CREACION  DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_TREP_IMAGEN PRIMARY KEY (IMAGEN_ID),
    CONSTRAINT FK_TREP_IMG_REPORTE
        FOREIGN KEY (REPORTE_ID) REFERENCES ABREGONZA.TREP_PROBLEMA(REPORTE_ID)
        ON DELETE CASCADE
);

CREATE INDEX IX_TREP_IMG_REPORTE ON ABREGONZA.TREP_IMAGEN (REPORTE_ID);

GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TREP_PROBLEMA TO JCABREU;
GRANT SELECT, INSERT, UPDATE, DELETE ON ABREGONZA.TREP_IMAGEN   TO JCABREU;

CREATE OR REPLACE SYNONYM JCABREU.TREP_PROBLEMA FOR ABREGONZA.TREP_PROBLEMA;
CREATE OR REPLACE SYNONYM JCABREU.TREP_IMAGEN   FOR ABREGONZA.TREP_IMAGEN;
```

`ESTADO` usa `VARCHAR2` con nombres legibles en vez de un `CHAR(1)` como en tablas
legado, porque esta tabla es nueva y no necesita parear un esquema Forms existente.

## Backend API

Todas bajo `/api/reportes/`, autenticación por sesión existente (misma que el resto
del sistema).

| Método | Ruta                              | Quién                          | Descripción |
|--------|------------------------------------|---------------------------------|-------------|
| POST   | `/api/reportes/`                   | cualquier usuario autenticado    | Crea reporte. `multipart/form-data`: `titulo`, `modulo`, `descripcion`, `imagenes[]` (0-3 archivos). Valida tipo/tamaño server-side (no confiar solo en el input `accept` del browser). |
| GET    | `/api/reportes/?mine=1`            | el usuario autenticado           | Lista solo los reportes propios. |
| GET    | `/api/reportes/`                   | solo admin                       | Lista todos, filtros query `estado`, `modulo`. |
| GET    | `/api/reportes/<id>/`              | admin, o autor si es suyo        | Detalle con metadata de imágenes (no el binario). |
| GET    | `/api/reportes/<id>/imagen/<img_id>/` | admin, o autor si es suyo     | Sirve el BLOB con el `MEDIA_TYPE` guardado. |
| PATCH  | `/api/reportes/<id>/`              | admin (cualquier estado); autor (solo a `CANCELADO`, solo si estaba `ABIERTO`/`EN_PROGRESO`) | Body: `{estado, nota_resolucion?}`. Setea `RESUELTO_POR`, `FECHA_RESOLUCION` cuando estado pasa a `COMPLETADO`/`CANCELADO`. |

Reglas de validación en el backend (no solo frontend):
- Rechazar más de 3 imágenes o payload > 5MB por imagen con 400 claro.
- Rechazar transición de estado inválida (ej. `CANCELADO → EN_PROGRESO`) con 400.
- Un usuario no-admin que intente `PATCH` un reporte ajeno, o poner un estado que no
  sea `CANCELADO` en el suyo, recibe 403.

## Frontend

- **Botón "Soporte"** en el dropdown del usuario (header), junto a Perfil/Config.
  Abre un dialog con: input título, `Select` de módulo, `Textarea` descripción,
  dropzone reutilizando el componente de adjuntos ya usado en el chat del Asistente
  (mismo look & feel, mismo límite de tipo `image/*`). React Query mutation →
  invalida `['reportes','mine']` al éxito, toast de confirmación.
- **"Mis reportes"** en el mismo dropdown: lista simple (React Query `['reportes',
  'mine']`), cada item con badge de estado, nota de resolución si aplica, botón
  "Cancelar" visible solo si `ABIERTO`/`EN_PROGRESO`.
- **Configuración → pestaña "Reportes"** (solo visible si el usuario tiene acceso
  admin — reusar el mecanismo de control de acceso ya existente en las demás
  pantallas de Configuración/Control de Acceso; la pieza exacta de wiring —
  bandera ACLASE vs. entrada de permiso por módulo — se resuelve en el plan de
  implementación revisando `apps/legacy/repositories/permissions_repo.py` y
  `hooks/use-access.ts`). Tabla paginada con el patrón `sigaft-crud-pagination`:
  columnas estado (badge), módulo, título, usuario, fecha; filtros por estado y
  módulo; click en fila abre drawer de detalle con imágenes (lightbox simple),
  selector de estado y textarea de nota de resolución, botón guardar → `PATCH`.

## Testing / verificación

No hay pantalla legado equivalente (Oracle Forms) que auditar — es funcionalidad
100% nueva, así que `sigaft-legacy-testing` no aplica aquí. Verificación:

- Backend: tests unitarios del repo (`pytest`) para transiciones de estado válidas/
  inválidas, límites de imagen, scoping admin vs autor.
- Deploy: seguir `sigaft-deploy-vm` — subir con `pscp`, `docker compose exec backend
  python -m py_compile`, smoke test con `django.test.Client(secure=True)` antes de
  declarar listo (no hay frontend en la VM, solo backend).
- Frontend: push a `main` → Netlify build; smoke manual en el sitio desplegado
  (crear reporte con imagen, verificar en tabla admin, cambiar estado, verificar
  nota de resolución visible para el reportante).

## Fuera de alcance

- El cron/automatización que consume reportes `ABIERTO` y los arregla con Claude
  Code — spec separado, pendiente.
- Notificaciones (email/push) al cambiar estado — no pedido, se puede agregar
  después si hace falta.
- Comentarios/hilo de conversación en un reporte (más allá de la nota de
  resolución) — no pedido.
