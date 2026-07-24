# LIC — Ampliar descubrimiento de licitaciones, catálogo de documentos de empresa y vista de detalle

## Contexto

El módulo LIC (ver `2026-07-22-lic-portal-integracion-design.md` y las fases posteriores ya
implementadas: análisis con IA, documentos de empresa, resumen de documentos) ya tiene en
producción: credenciales por empresa, scraper Playwright del feed autenticado "Oportunidades",
descarga de documentos oficiales, análisis con IA (resumen + requisitos + recomendación +
semáforo de cumplimiento) y un modal de detalle.

Quedaron tres gaps reportados por el usuario:

1. El scraper solo lee el feed autenticado "Oportunidades" (`DO1BusinessLine/Tendering/
   OpportunityDossierWorkspace/Index`), que es **personalizado por empresa** y **no pagina en
   absoluto** — `list_oportunidades` solo cuenta `.ws_rc_wrapper_opportunity` ya renderizados en
   pantalla. Licitaciones reales quedan sin descubrir.
2. Los documentos propios de la empresa (RNC, constancias, actas, etc.) se suben con una
   `descripcion` de texto libre en vez de un tipo real, enterrados dentro de cada tarjeta de
   empresa en `/lic/config` — no hay catálogo de tipos de documento ni forma de administrarlo.
3. El detalle de una oportunidad es un `Dialog` (modal) angosto; falta una sección de
   "productos/servicios" que pide la licitación, y los documentos listados no tienen botón de
   descarga.

### Investigación en vivo (2026-07-24)

Con las credenciales reales de la empresa 01 (`abregonza`, desde `TLIC_CREDENCIAL` vía
`apps/fe/crypto`) se navegó el portal en vivo:

- Existe una pantalla **pública** (no requiere login) `comunidad.comprasdominicana.gob.do/
  Public/Tendering/ContractNoticeManagement/Index` ("Buscar procesos" en el home), con un enlace
  **"(Advanced search)"** que expone un formulario real:
  - Texto libre: todas estas palabras / frase exacta / alguna de estas palabras / ninguna de
    estas palabras.
  - Campos: `Buyer` (autocompletar), `VAT Numbers`, `Request Reference`, `Request Description`,
    `Category` (autocompletar — mismo código UNSPSC que ya guardamos en `TLIC_RUBRO` desde el PDF
    de rubros RPE), `Country`, `Region`, `Legal Framework`, `Procedure Type` (mismo catálogo que
    ya vemos como `tipo_proceso`: Contratación Menor, Licitación Pública Nacional, etc.), `Status`
    (`Published` / `ClosedForReplies` / `Awarded` / `Canceled` / `NonAwarded` /
    `DummyForSearch_Suspended`), y rangos de fecha `Official Publish Date From/To`,
    `Replies Deadline From/To`, `Open Date From/To`.
  - La tabla de resultados trae columnas `Contracting Authority`, `Reference`, `Description`,
    `Official Publish Date`, `Replies Deadline`, **`Base Price`** (el monto, sin tener que abrir
    el Aviso de Contrato) y `Status`.
  - Al pie de la tabla hay un link **"More Items"** (carga más filas del mismo listado, estilo
    Ariba "load more") y **"Change paging style"** (cambia a paginación clásica con tamaño de
    página configurable — el mecanismo real para pedir 1000 resultados de una vez en vez de ir
    dando clic de a poco).
  - Al momento de la prueba el portal reportaba 598 procesos publicados en total — muchos más de
    los que el feed personalizado por empresa expone.
- El feed autenticado "Oportunidades" (usado hoy) sigue siendo necesario para el paso de
  descarga de documentos: la fila se busca por referencia, se hace clic, se abre el "Aviso de
  Contrato" en pestaña nueva y de ahí se lee la tabla de documentos del proceso — ese flujo no
  cambia.

## Decisión de alcance confirmada con el usuario

- El scraper debe traer **todo lo publicado** (sin filtrar por Category/rubro) usando la
  Búsqueda avanzada pública, hasta un tope configurable (1000 por defecto) — el propio análisis
  de IA existente (semáforo verde/amarillo/rojo de cumplimiento) más la nueva sección de
  productos/servicios (ver más abajo) son las que ayudan al usuario a decidir "aplica o no",
  no un filtro previo por categoría.
- La IA **solo señala** qué tipos de documento del catálogo faltan o están vencidos para una
  licitación — no redacta ni genera documentos. Los certificados oficiales (DGI, TSS, RNC,
  Registro Mercantil) no los puede generar la IA de todas formas; eso queda fuera de alcance.

## Parte A — Scraper: descubrimiento vía Búsqueda avanzada pública

### Cambios en `apps/lic/services/scraper.py`

- Nuevo método `LicitacionesScraper.buscar_avanzada(filtros: dict, tope: int = 1000) ->
  list[dict]`, independiente de `login()` (no requiere sesión autenticada — es una pantalla
  pública). Navega a `ContractNoticeManagement/Index`, hace clic en "(Advanced search)", llena
  `Status = Published` (alineado con el comportamiento actual de "no traer cerradas" por
  defecto), hace clic en "Go", y luego pagina:
  - Primero intenta "Change paging style" para pasar al modo de paginación clásica; si ese modo
    expone un selector de tamaño de página, se fija al máximo disponible.
  - Si no hay selector de tamaño, cae al fallback de hacer clic en "More Items" repetidamente
    hasta que el link desaparezca o se alcance `tope`.
  - Cada fila se parsea con una función pura `parse_advanced_search_row_html(html) -> dict`
    (mismo patrón testeable que `parse_oportunidad_row_html`), extrayendo: `entidad`
    (Contracting Authority), `referencia` (Reference), `titulo` (Description), `fecha_publicacion`
    (Official Publish Date), `fecha_limite` (Replies Deadline), `presupuesto_estimado` (Base
    Price), `estado_portal` (Status).
- `list_oportunidades` (el feed autenticado) se mantiene tal cual — se sigue usando para
  encontrar la fila por referencia en `download_documentos` (no cambia esa parte del flujo).

### Cambios en `apps/lic/services/orchestrator.py`

- `ejecutar_scrape` gana un paso nuevo antes del login por empresa: una sola llamada a
  `buscar_avanzada()` (no depende de credenciales — se corre una vez por corrida, no por
  empresa) que hace upsert de oportunidades por `(no_cia, referencia)` para **cada** empresa
  activa (mismas oportunidades públicas aplican a todas las empresas del grupo; el filtrado por
  aplicabilidad lo hace el análisis de IA por empresa, no el descubrimiento).
- Las oportunidades nuevas descubiertas así siguen el mismo camino que hoy: login por empresa →
  ubicar la referencia en el feed autenticado → `download_documentos` → análisis IA. Si una
  referencia de la búsqueda avanzada no aparece en el feed autenticado de ninguna empresa (poco
  común, pero posible si DGCP no la hizo matching a ningún rubro registrado), se marca como
  error `"documentos"` con mensaje explícito y no bloquea el resto de la corrida — mismo
  criterio de aislamiento de errores que ya usa el orquestador.

### Modelo de datos

- `TLIC_OPORTUNIDAD` no necesita columnas nuevas para esto (`ENTIDAD`, `REFERENCIA`, `TITULO`,
  `FECHA_PUBLICACION`, `FECHA_LIMITE`, `PRESUPUESTO_ESTIMADO`, `ESTADO_PORTAL` ya existen). El
  upsert desde la búsqueda avanzada puebla estos mismos campos; si luego el flujo autenticado
  encuentra más detalle (unidad de requisición, descripción completa), lo actualiza igual que hoy
  vía `actualizar_detalle_oportunidad`.

## Parte B — Configuración › Licitación: catálogo de tipos de documento + vista dedicada

### Modelo de datos

- Nueva tabla `FAT.TLIC_TIPO_DOCUMENTO` (patrón secuencia+trigger, igual que el resto de `TLIC_*`):
  `ID`, `CODIGO` (VARCHAR2(30), único), `NOMBRE` (VARCHAR2(200)), `ACTIVO` (VARCHAR2(1) S/N,
  default 'S'). Sembrada con: Constancia DGI al día, Constancia TSS al día, Documento RNC, Actas
  (societarias), Registro Mercantil — administrable a futuro desde la UI, no hardcodeado en
  código.
- `TLIC_DOCUMENTO_EMPRESA` gana `TIPO_DOCUMENTO_ID NUMBER` (FK a `TLIC_TIPO_DOCUMENTO`, nullable
  — los documentos ya subidos con `DESCRIPCION` libre no se migran, ese campo se mantiene como
  nota adicional opcional en el formulario, ya no como campo principal).

### Backend (`apps/lic`)

- `GET/POST /api/lic/tipos-documento/` y `PATCH/DELETE /api/lic/tipos-documento/<id>/` — CRUD
  simple del catálogo (activo S/N en vez de borrado físico si ya hay documentos referenciándolo,
  mismo patrón que otros catálogos `tdocu`/`grupo_contable` de INV).
- `documentos_empresa_view` (existente) acepta ahora `tipo_documento_id` en el POST; `list_
  documentos_empresa` hace join a `TLIC_TIPO_DOCUMENTO` para devolver `tipo_documento_nombre`.
- Nuevo `GET /api/lic/documentos-empresa/<id>/descargar/` — sirve el archivo desde
  `RUTA_ARCHIVO` (`FileResponse`, mismo patrón que se use para descargar PDFs en otros módulos).

### Frontend

- Nueva entrada de sidebar bajo Licitaciones › Configuración: **"Documentos de la empresa"**
  (`/lic/config/documentos`), separada de la tarjeta por empresa actual (que se simplifica a solo
  credenciales + rubros RPE).
- Vista: selector de empresa arriba, botón "Nuevo documento" abre un diálogo con:
  - Zona de arrastrar-y-soltar (o seleccionar archivo) — mismo componente de upload reutilizable
    si ya existe uno en el proyecto (si no, uno simple con `onDrop`/`onChange` sobre un
    `<input type="file">` oculto).
  - Select de **Tipo de documento** (del catálogo, con opción de link "Administrar tipos" que
    lleva a la sub-vista de CRUD).
  - Select de **Punto** (igual que hoy).
  - Selector de **fecha de vencimiento**.
  - Descripción libre opcional (ya no obligatoria).
- Tabla de documentos subidos: columnas Tipo, Archivo, Punto, Vencimiento (badge **Vigente**
  outline / **Vencido** destructive, igual convención visual que ya existe en
  `DocumentoEmpresaRow`), botón de descarga.
- Nueva sub-vista **"Tipos de documento"** (`/lic/config/tipos-documento`): tabla CRUD estándar
  (botón Nuevo, editar/activar-desactivar por fila) siguiendo el patrón ya usado en los catálogos
  de INV (`sigaft-crud-pagination`).

## Parte C — Análisis IA: productos/servicios + documentos faltantes (solo señalar)

### `apps/lic/services/analisis_licitacion.py`

- El prompt a Claude en `analizar_licitacion` gana una sección nueva en el JSON de salida:
  `"productos": [{"descripcion": "..."}]` — productos o servicios concretos que la licitación
  pide adquirir/contratar, extraídos del mismo texto que ya se le manda (pliego/TDR), 3-10 ítems,
  mismo criterio de "no inventar" que ya aplica a requisitos.
- El bloque de documentos de empresa que se le pasa a Claude para evaluar requisitos ahora incluye
  el nombre del tipo de documento del catálogo (`tipo_documento_nombre`) además del nombre de
  archivo, para que el matching sea más preciso cuando un requisito menciona un tipo concreto
  ("Registro Mercantil vigente").
- Nueva función pura `documentos_faltantes(requisitos: list[dict], documentos_empresa: list[dict])
  -> list[dict]`: para cada tipo de documento del catálogo (`TLIC_TIPO_DOCUMENTO` activo) que
  aparezca mencionado en algún requisito con estado `no_cumple` o `parcial` y sin
  `documento_empresa_id` resuelto (o con uno vencido), arma una entrada
  `{"tipo_documento": nombre, "motivo": "no subido" | "vencido"}`. Es puro post-procesamiento
  sobre datos ya calculados — no es una llamada adicional a la IA.
- `ejecutar_analisis_oportunidad` guarda este resultado junto con el resto (nueva columna
  `FAT.TLIC_OPORTUNIDAD.DOCUMENTOS_FALTANTES` tipo `VARCHAR2(2000)` con el JSON serializado, mismo
  criterio que `RESUMEN_IA`/`RECOMENDACION_IA` — no se crea tabla aparte para algo derivado y
  pequeño).
- Tabla nueva `FAT.TLIC_PRODUCTO` (mismo patrón hijo que `TLIC_REQUISITO`): `ID`,
  `OPORTUNIDAD_ID` (FK), `DESCRIPCION` (VARCHAR2(500)), `ACTUALIZADO_EN`. `reemplazar_productos`
  en `lic_repo` sigue el mismo patrón que `reemplazar_requisitos` (borra e inserta en cada
  análisis).

### Endpoints

- `GET /api/lic/oportunidades/<id>/productos/` — igual forma que `requisitos_view`.
- `analizar_oportunidad_view` y el resumen que ya devuelve `AnalisisOportunidad` ganan
  `productos: Producto[]` y `documentos_faltantes: {tipo_documento, motivo}[]`.

## Parte D — Vista de detalle: página completa, orden fijo, descarga real

### Frontend

- Nueva ruta `frontend/src/routes/_authenticated/lic/oportunidades/$oportunidadId.tsx`, hija de
  `lic.tsx` (mismo `Header` fijo del layout — no se toca `lic.tsx`). Nuevo componente
  `LicOportunidadDetalle` en `features/lic/`.
- `lic-oportunidades.tsx`: la fila de la tabla y el botón "Eye" pasan de
  `onClick={() => setSelectedOportunidad(o)}` (que abría el `Dialog`) a un `Link` de TanStack
  Router hacia `/lic/oportunidades/$oportunidadId`. Se elimina el `Dialog` y el estado
  `selectedOportunidad` de esta vista; `AnalisisSeccion` y `DocumentoItem` se mueven tal cual (con
  ajustes) al nuevo componente de detalle.
- Orden fijo de secciones en la página de detalle:
  1. **Descripción** — resumen IA + descripción completa/unidad de requisición/presupuesto
     estimado (lo que hoy está arriba del `AnalisisSeccion` en el modal).
  2. **Requisitos** — tabla existente (estado/descripción/justificación).
  3. **Productos/servicios** — tabla nueva (Parte C), incluye también el bloque "Documentos
     faltantes" como sub-sección aquí (es la contraparte accionable de esta sección: qué falta
     conseguir para poder cumplir).
  4. **Documentos de la licitación** — lista existente de `TLIC_DOCUMENTO`, con botón de
     descarga nuevo por cada uno (nuevo endpoint `GET /api/lic/documentos/<id>/descargar/`, mismo
     patrón `FileResponse` que en la Parte B).
- Breadcrumb/botón "Volver a Oportunidades" arriba del contenido (debajo del `Header`, que ya
  queda fijo por venir del layout `lic.tsx`).

## Manejo de errores

- La búsqueda avanzada pública puede fallar de forma aislada (portal caído, cambio de selectores)
  sin tumbar el resto de la corrida — mismo criterio try/except + `_agregar_error` que ya usa
  `orchestrator.py`, con `contexto="busqueda_avanzada"`.
- Si `buscar_avanzada` no encuentra el link "(Advanced search)" o la tabla de resultados, se
  registra el error y la corrida sigue con lo que ya tenía el feed autenticado (no bloquea todo el
  scraping por un cambio de layout del portal).
- Descargas de archivo (Parte B y D) devuelven 404 claro si `RUTA_ARCHIVO` ya no existe en disco
  en vez de un 500.

## Verificación

- Parseo puro de filas de la búsqueda avanzada: test con fixture de HTML capturado en vivo (mismo
  patrón que `parse_oportunidad_row_html`/`parse_documento_row_html`).
- `documentos_faltantes()`: pruebas unitarias con combinaciones de requisitos/documentos/vencidos.
- CRUD de `TLIC_TIPO_DOCUMENTO`: pruebas del repositorio + smoke HTTP (patrón `sigaft-legacy-
  testing`).
- Scraper de búsqueda avanzada: verificación en vivo contra el portal real (ya se hizo una
  exploración manual para este diseño) antes de dar la Parte A por terminada, igual que la Fase 1
  original.
- Página de detalle: smoke visual en el navegador de la VM confirmando el orden de las 4
  secciones, el header fijo, y que los botones de descarga sí bajan el archivo.

## Fuera de alcance

- Que la IA redacte o genere documentos faltantes (solo se señala qué falta).
- Filtrar el descubrimiento por rubro/categoría (se trae todo lo `Published`; el semáforo de
  cumplimiento + productos/servicios son las señales para decidir "aplica o no").
- Migrar los documentos de empresa ya subidos con `DESCRIPCION` libre a un `TIPO_DOCUMENTO_ID`
  retroactivamente.
