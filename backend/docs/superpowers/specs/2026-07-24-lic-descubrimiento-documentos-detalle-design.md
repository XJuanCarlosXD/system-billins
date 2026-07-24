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
  de IA existente (semáforo verde/amarillo/rojo de cumplimiento) más la sección de
  productos/servicios (ver más abajo) son las que ayudan al usuario a decidir "aplica o no",
  no un filtro previo por categoría.
- La IA **solo señala** qué tipos de documento del catálogo faltan o están vencidos para una
  licitación — no redacta ni genera documentos. Los certificados oficiales (DGI, TSS, RNC,
  Registro Mercantil) no los puede generar la IA de todas formas; eso queda fuera de alcance.
- **Corrección 2026-07-24 (segunda vuelta):** los productos/servicios que pide una licitación
  **ya están en la propia página del proceso en el portal** (igual que la descripción completa,
  la unidad de requisición y el presupuesto estimado que ya se extraen sin IA vía
  `_extraer_detalle_aviso_contrato`) — es dato estructurado, no texto libre que haga falta
  interpretar. Por lo tanto **el scraper los extrae directamente (código/parsing), no la IA**.
  La IA no debe usarse para repetir información que la licitación ya trae por sí sola, ni para
  hacer las comparaciones de documentos (eso ya era código puro en `documentos_faltantes()` y
  se mantiene así). El único rol de la IA en este plan queda acotado a la página de detalle,
  con dos funciones: **recomendar precio** y **buscar precio histórico en el sistema** para los
  productos/servicios pedidos — y la búsqueda del histórico también es una consulta de código
  (no IA); la IA solo redacta la recomendación a partir de esos datos ya encontrados.
- **Corrección 2026-07-24 (tercera vuelta):** tres ajustes más pedidos por el usuario:
  1. La recomendación de precio **no es una llamada de IA por producto** — es UNA sola llamada
     que recibe TODOS los productos de la oportunidad (con su historial ya buscado por código,
     uno por uno) y devuelve la recomendación de todos a la vez. Ver Parte C actualizada.
  2. El detalle de una licitación debe mostrar un **badge de modalidad de entrega** (física /
     virtual / ambas) cuando el portal lo especifica — algunas licitaciones exigen entregar la
     oferta/documentos en físico, otras aceptan virtual, otras cualquiera de las dos. Es dato
     que el propio proceso expone (se extrae por código, mismo criterio que el resto del
     detalle scrapeado), no algo que la IA deba inferir.
  3. Nueva **Parte E**: botón en la página de detalle para que el scraper prepare y adjunte los
     documentos de la oferta (documento por documento, según lo que pida cada tipo requerido) y
     la deje lista en el portal — pero el **envío final es un paso separado con confirmación
     humana explícita** (no autonomático), dado que es una oferta vinculante ante un sistema del
     Estado. Mismo criterio de cautela que ya estaba documentado desde la Fase 1 de este módulo
     (`2026-07-22-lic-portal-integracion-design.md`, sección "Fuera de alcance": "Fase 4...
     requiere su propio diseño con aprobación humana explícita antes de cualquier envío real").

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

### Extracción de productos/servicios por código (sin IA)

`LicitacionesScraper._extraer_detalle_aviso_contrato` (mismo método que ya lee
`descripcion_completa`/`unidad_requisicion`/`presupuesto_estimado` del Aviso de Contrato, sin
IA) gana un campo más: `productos`, una lista de `{"descripcion": str, "cantidad": str | None}`
leída de la sección de ítems/rubros solicitados que el propio Aviso de Contrato ya expone como
tabla estructurada (mismo tipo de tabla que `#grdGridDocumentList_tbl` para documentos, pero
para los renglones de la solicitud). El selector exacto de esa tabla se confirma en vivo durante
la verificación del Task 4 del plan (igual que se hizo para el resto de `_extraer_detalle_aviso_
contrato`) — si el nombre/estructura real difiere de lo documentado aquí, se ajusta con el mismo
criterio conservador que el resto del scraper (un campo que no se puede leer queda en `None`/
lista vacía, sin abortar la descarga de documentos que ya se completó). Se guarda en la tabla
`TLIC_PRODUCTO` (ver Parte C) vía `lic_repo.reemplazar_productos`, igual que el resto del detalle
scrapeado — no vía IA.

### Modelo de datos

- `TLIC_OPORTUNIDAD` no necesita columnas nuevas para esto (`ENTIDAD`, `REFERENCIA`, `TITULO`,
  `FECHA_PUBLICACION`, `FECHA_LIMITE`, `PRESUPUESTO_ESTIMADO`, `ESTADO_PORTAL` ya existen). El
  upsert desde la búsqueda avanzada puebla estos mismos campos; si luego el flujo autenticado
  encuentra más detalle (unidad de requisición, descripción completa, productos), lo actualiza
  igual que hoy vía `actualizar_detalle_oportunidad`.

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

## Parte C — Documentos faltantes (código puro) + IA acotada a precio en el detalle

Esta parte cambió de alcance respecto a la primera versión del spec: la IA **no** extrae
productos/servicios (eso lo hace el scraper, Parte A) y **no** hace las comparaciones contra el
catálogo de documentos (eso ya era y sigue siendo código puro). El único uso de IA que agrega esta
parte es una recomendación de precio en la página de detalle, a partir de datos que ya trajo una
consulta de código — la IA nunca busca ni compara por su cuenta, solo redacta la recomendación.

### `apps/lic/services/analisis_licitacion.py` — solo documentos faltantes (sin tocar el prompt)

- El bloque de documentos de empresa que se le pasa a Claude para evaluar **requisitos** (lo que
  ya existía en Fase 2, sin cambios de alcance aquí) incluye el nombre del tipo de documento del
  catálogo (`tipo_documento_nombre`) además del nombre de archivo, para que el matching sea más
  preciso cuando un requisito menciona un tipo concreto ("Registro Mercantil vigente"). El prompt
  de `analizar_licitacion` NO gana una sección de productos.
- Función pura `documentos_faltantes(requisitos: list[dict], tipos_catalogo: list[dict],
  documentos_empresa: list[dict]) -> list[dict]`: para cada tipo de documento del catálogo
  (`TLIC_TIPO_DOCUMENTO` activo) que aparezca mencionado en algún requisito con estado
  `no_cumple` o `parcial` y sin `documento_empresa_id` resuelto (o con uno vencido), arma una
  entrada `{"tipo_documento": nombre, "motivo": "no subido" | "vencido"}`. Es puro
  post-procesamiento sobre datos ya calculados por el análisis de requisitos existente — no es
  una llamada adicional a la IA.
- `ejecutar_analisis_oportunidad` guarda este resultado junto con el resto (nueva columna
  `FAT.TLIC_OPORTUNIDAD.DOCUMENTOS_FALTANTES` tipo `VARCHAR2(2000)` con el JSON serializado, mismo
  criterio que `RESUMEN_IA`/`RECOMENDACION_IA`).
- Tabla nueva `FAT.TLIC_PRODUCTO` (mismo patrón hijo que `TLIC_REQUISITO`): `ID`,
  `OPORTUNIDAD_ID` (FK), `DESCRIPCION` (VARCHAR2(500)), `CANTIDAD` (VARCHAR2(50)),
  `ACTUALIZADO_EN`. `reemplazar_productos` en `lic_repo` la puebla el **scraper** (vía
  `actualizar_detalle_oportunidad`/orquestador, Parte A) cada vez que descubre/actualiza una
  oportunidad — no el análisis de IA.

### Precio: búsqueda histórica (código) + recomendación (IA), solo en la página de detalle

- `apps/legacy/repositories/lic_repo.py` gana `buscar_precio_historico(no_cia: str,
  texto_producto: str) -> list[dict]`: búsqueda de código (`LIKE` sobre la descripción del
  producto, sin IA) contra `FAT.TFAT_FACTURAL` + `FAT.TFAT_FACTURA` (join por no_cia/punto/
  tipo_factura/no_factura, mismo patrón que otros joins de `fat_repo`), devolviendo
  `{no_produ, descripcion, precio, fecha}` ordenado por fecha descendente — el precio más
  reciente al que se facturó/cotizó algo con nombre parecido. No requiere IA; es una consulta SQL.
- `apps/lic/services/recomendar_precio.py` (nuevo): una función `recomendar_precios(productos:
  list[dict], historiales: dict[int, list[dict]]) -> dict[int, dict]` con **una única llamada** a
  Claude para TODA la oportunidad (no una por producto) — recibe la lista completa de productos
  con su descripción y el historial ya encontrado por `buscar_precio_historico` para cada uno
  (puede venir vacío por producto), y devuelve `{producto_id: {"precio_sugerido": str | None,
  "justificacion": str}}` para todos a la vez. La IA no busca nada por su cuenta ni repite las
  descripciones como si fueran un hallazgo — solo recomienda con base en lo que se le entrega.
- Endpoint nuevo `POST /api/lic/oportunidades/<id>/recomendar-precios/`: lista los productos de la
  oportunidad, llama `buscar_precio_historico` por cada uno (código, en un loop — sigue sin ser
  IA), arma el dict de historiales, y hace UNA llamada a `recomendar_precios` con todo junto.
  Se dispara bajo demanda desde un botón único en la página de detalle (Parte D, sección 3), no
  automáticamente en cada scrape — mismo criterio que "Generar resumen con IA" ya usa para
  documentos.

### Modalidad de entrega (física / virtual / ambas)

- `_extraer_detalle_aviso_contrato` gana un campo más: `modalidad_entrega` (`"fisica" | "virtual"
  | "ambas" | None`), leído del campo del Aviso de Contrato donde el portal indica cómo debe
  entregarse la oferta/documentación (selector exacto a confirmar en vivo, mismo criterio de
  verificación que el resto del detalle scrapeado). `TLIC_OPORTUNIDAD` gana la columna
  `MODALIDAD_ENTREGA VARCHAR2(10)`.
- La página de detalle (Parte D, sección 1 - Descripción) muestra un badge según el valor:
  "Entrega física requerida" (con énfasis, para que no se pase por alto) / "Entrega virtual" /
  "Física o virtual" / sin badge si el portal no lo especificó para ese proceso.

### Endpoints

- `GET /api/lic/oportunidades/<id>/productos/` — lista los productos que el scraper guardó para
  esa oportunidad (no requiere análisis de IA previo, están desde que se descubrió la
  oportunidad).
- `analizar_oportunidad_view` sigue devolviendo `AnalisisOportunidad` (resumen, requisitos,
  recomendación) sin `productos` — productos se consulta aparte porque no depende de análisis IA.
- `analizar_oportunidad_view` y `list_oportunidades` ganan `documentos_faltantes:
  {tipo_documento, motivo}[]` y `modalidad_entrega`.

## Parte E — Aplicar a la licitación desde la página (preparar oferta + envío con confirmación)

Botón "Preparar oferta" en la página de detalle (sección 4, junto a documentos) que dispara al
scraper para que arme la oferta en el portal DGCP con los documentos que correspondan — pero el
envío final queda como un paso aparte, con confirmación humana explícita.

### Backend

- `LicitacionesScraper.preparar_oferta(referencia: str, no_cia: str, documentos: list[dict]) ->
  dict`: hace login, ubica la oportunidad en el feed autenticado (mismo patrón que
  `download_documentos`), hace clic en "Crear oferta" (botón ya confirmado en vivo el
  2026-07-24 en la vista de detalle de una oportunidad: "Todavía no ha comenzado a crear la
  oferta. Puede empezar cuando desee." + botón "Crear oferta"), y por cada documento requerido
  (cruce entre `TLIC_REQUISITO`/catálogo de tipos y `TLIC_DOCUMENTO_EMPRESA` vigente, igual
  criterio que `documentos_faltantes()`) lo sube **documento por documento**, registrando por
  cada uno si se adjuntó bien o falló — sin hacer clic en el botón final de envío del portal.
  Retorna `{"documentos_adjuntados": [...], "documentos_faltantes": [...], "estado":
  "listo_para_enviar" | "faltan_documentos"}`.
- Reutiliza el patrón `ScrapeJob`/hilo en segundo plano ya existente (nuevo modelo
  `OfertaJob` o reutilizar `ScrapeJob` con un campo `tipo` — decisión de implementación libre,
  documentar la elegida) para no bloquear la request mientras Playwright trabaja.
- Endpoint `POST /api/lic/oportunidades/<id>/preparar-oferta/` — dispara el job, devuelve
  `job_id`; `GET /api/lic/oferta-jobs/<job_id>/` para polling (mismo patrón que scrape).
- **Envío final** (`confirmar_envio_oferta`, método aparte en `LicitacionesScraper`) es una
  función y un endpoint (`POST /api/lic/oportunidades/<id>/confirmar-envio-oferta/`)
  **completamente separados** de `preparar_oferta` — nunca se llaman en cadena automáticamente.
  Solo hace clic en el botón real de envío del portal cuando el usuario lo confirma
  explícitamente desde el frontend, y solo si el job de preparación terminó en
  `"listo_para_enviar"` (si quedaron `documentos_faltantes`, el botón de confirmar queda
  deshabilitado con una advertencia).

### Frontend

- En la sección 4 (Documentos) de la página de detalle: botón "Preparar oferta" → polling de
  `OfertaJob` (igual patrón que "Buscar ahora") → al terminar, muestra un resumen: documentos
  adjuntados (✓) y documentos que faltaron (✗, con el tipo de documento). Si quedó
  `"listo_para_enviar"`, aparece un botón separado **"Confirmar y enviar oferta"** con un diálogo
  de confirmación explícito (texto claro: "Esto somete una oferta vinculante ante el portal DGCP,
  no se puede deshacer") antes de disparar `confirmar-envio-oferta`.

### Seguridad y verificación

- **Nunca** se ejecuta un envío real contra una licitación real durante el desarrollo/pruebas de
  esta parte — los tests de `confirmar_envio_oferta` mockean la llamada a Playwright, igual que
  el resto del scraper no tiene pruebas de navegador real automatizadas. La verificación en vivo
  de `preparar_oferta` (adjuntar documentos) se puede probar contra una oportunidad real sin
  riesgo porque no dispara el envío; la verificación en vivo de `confirmar_envio_oferta` en
  cambio **no se debe correr contra una licitación real** sin que el usuario lo pida
  explícitamente en el momento (mismo criterio que "Fase 4" ya documentaba desde el diseño
  original de este módulo).

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
  3. **Productos/servicios** — tabla con lo que el scraper ya extrajo de la licitación (Parte A),
     con un botón "Recomendar precio" por fila que dispara `POST /api/lic/productos/<id>/
     recomendar-precio/` (Parte C) y muestra el historial encontrado + la recomendación de la IA
     inline. Incluye también el bloque "Documentos faltantes" como sub-sección aquí (es la
     contraparte accionable de esta sección: qué falta conseguir para poder cumplir).
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
- Que la IA extraiga productos/servicios o compare documentos — eso es código (scraper +
  `documentos_faltantes()`), la IA solo recomienda precio con datos ya encontrados.
- Filtrar el descubrimiento por rubro/categoría (se trae todo lo `Published`; el semáforo de
  cumplimiento + productos/servicios son las señales para decidir "aplica o no").
- Migrar los documentos de empresa ya subidos con `DESCRIPCION` libre a un `TIPO_DOCUMENTO_ID`
  retroactivamente.
- Matching difuso avanzado (fuzzy/embeddings) entre la descripción del producto de la licitación
  y el catálogo interno — `buscar_precio_historico` usa `LIKE` simple sobre texto; mejorarlo
  queda para una iteración futura si el `LIKE` resulta insuficiente en la práctica.
- Envío automático/desatendido de ofertas sin confirmación humana — la Parte E siempre requiere
  un clic explícito separado para el envío final, sin excepción.
- Editar/retirar una oferta ya enviada, o dar seguimiento post-envío (eso seguiría siendo la
  Fase 5 "monitoreo de resultados" del diseño original, no cubierta aquí).
