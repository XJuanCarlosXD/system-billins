# LIC Fase 1 — Integración con el Portal DGCP (Sistema Electrónico de Contrataciones Públicas)

## Contexto

ZentoryERP va a incorporar un módulo nuevo, **LIC (Licitaciones)**, para que la empresa pueda
descubrir, evaluar y eventualmente participar en procesos de compras públicas del portal de la
Dirección General de Contrataciones Públicas (DGCP) — `comunidad.comprasdominicana.gob.do` /
`portal.comprasdominicana.gob.do` (sistema basado en SAP Ariba, marca "DO1Marketplace" /
"DO1BusinessLine").

El proyecto completo (scraping, análisis de PDFs con IA, panel de preparación de propuestas,
envío automatizado con Playwright, monitoreo diario, análisis de competencia) se dividió en 6
fases independientes. Este documento cubre **solo la Fase 1: integración con el portal** — la
base sobre la que se construyen las demás.

Se validó manualmente con Playwright que:
- El login (`/STS/DGCP/Login.aspx`) es un formulario usuario/contraseña simple, sin CAPTCHA.
- Tras autenticar, el portal redirige a un dashboard Ariba personalizado por empresa
  (`portal.comprasdominicana.gob.do/DO1Marketplace/`).
- Existe un feed **"Oportunidades"** (`DO1BusinessLine/Tendering/OpportunityDossierWorkspace/Index`)
  que ya viene filtrado/matched por DGCP según los rubros/categorías registrados de la empresa
  (RPE) — con pestañas Recibidas/Con interés/En respuesta/Respondidas/Seleccionadas/Perdidas/
  Expiradas-Canceladas/Favoritas/Proceso desierto, y filtros Todos/Nuevo/Visualizadas/Invitado/
  Activo/Sin ofertas/Con ofertas.
- Cada oportunidad expone: referencia OD (ej. `HPDEF-DAF-CM-2026-0021`), tipo de proceso,
  entidad contratante, título, # ofertas presentadas/creadas, fecha de publicación, fecha límite,
  y al expandir: lugar de entrega, unidad de requisición, código UNSPSC, fecha de firma de
  contrato, y las ofertas propias ya creadas (si existen).

## Alcance de la Fase 1

Solo cubre: credenciales por empresa, login automatizado, scraping del feed de oportunidades,
descarga de los documentos adjuntos, y un PDF de rubros RPE por empresa como respaldo/validación
del matching que ya hace DGCP. **No** cubre análisis de requisitos con IA (Fase 2), preparación/
envío de propuestas (Fases 3-4), monitoreo de resultados (Fase 5) ni análisis de competencia
(Fase 6).

Multi-empresa desde el día 1: cada empresa (ya modeladas vía `TACF_CIAS`) tiene su propio usuario
del portal DGCP.

## Modelo de datos (Oracle, prefijo `TLIC_`)

- **`TLIC_CREDENCIAL`** — una fila por empresa: código empresa (referencia a `TACF_CIAS`), usuario
  del portal, password (cifrado con Fernet, mismo patrón que `apps/fe/crypto.py`), estado
  (activo / error_login), último login exitoso, último mensaje de error.
- **`TLIC_RUBRO_PDF`** — certificado RPE por empresa: archivo, fecha de carga, estado de
  extracción (pendiente/hecho/error).
- **`TLIC_RUBRO`** — rubros extraídos del PDF (tabla hija de `TLIC_RUBRO_PDF`): código, descripción,
  editable manualmente si la IA se equivocó en la extracción.
- **`TLIC_OPORTUNIDAD`** — una fila por oportunidad detectada: empresa, referencia OD (única por
  empresa), tipo de proceso, entidad contratante, título, estado en el portal, fecha de
  publicación, fecha límite de ofertas, fecha de firma de contrato, unidad de requisición, código
  UNSPSC, lugar de entrega, timestamps de creación/actualización en nuestro sistema.
- **`TLIC_DOCUMENTO`** — documentos descargados por oportunidad: tipo (pliego, TDR, anexo, etc.),
  nombre de archivo, ruta (`MEDIA_ROOT/lic/<empresa>/<referencia>/...`), fecha de descarga, estado
  (ok/error).
- **`TLIC_SCRAPE_JOB`** — corrida de scraping: empresa (nulo = todas), estado
  (corriendo/completado/completado_con_errores/error), iniciado_en, terminado_en, resumen
  (oportunidades nuevas, documentos descargados, errores por empresa).

## Componentes backend (`apps/lic`)

- **`services/scraper.py`** — clase `LicitacionesScraper` sobre Playwright (Chromium headless):
  `login(credencial)`, `list_oportunidades(tabs=[...])`, `open_detalle(referencia)`,
  `download_documentos(referencia)`. Una sesión de navegador por empresa, secuencial (no
  paralelo) y con pausas entre acciones para no parecer tráfico de bot contra un sistema del
  Estado.
- **`services/pdf_rubros.py`** — extracción de texto del PDF de RPE con una librería ligera
  (`pypdf`/`pdfplumber`, nueva dependencia) y estructuración de ese texto (no el PDF crudo) vía
  Claude, usando la config de Anthropic ya existente — más barato en tokens que mandar el PDF
  completo.
- **`management/commands/scrape_licitaciones.py`** — orquesta: por cada empresa con credencial
  activa, login → listar oportunidades → upsert por `(empresa, referencia)` → para oportunidades
  nuevas, descargar documentos → registrar resumen de la corrida. Es el mismo código que usan
  tanto la tarea programada como el botón manual.
- **Tarea de Windows** `ZentoryERP-Lic-Runner` (diaria, temprano en la mañana) ejecutando el
  comando anterior — mismo patrón que las tareas `zentoryerp-*-runner` ya existentes, logueando a
  `bin/logs/zentoryerp-lic/`.
- **Endpoints (`apps/lic/views.py`)**:
  - `GET /api/lic/oportunidades/` — lista, filtrable por empresa/estado.
  - `GET /api/lic/oportunidades/<id>/documentos/` — documentos de una oportunidad.
  - `POST /api/lic/credenciales/` — crear/actualizar credencial de empresa; dispara un login de
    prueba.
  - `POST /api/lic/rubros-pdf/` — subir PDF de rubros RPE; dispara la extracción.
  - `POST /api/lic/scrape/` — dispara "Buscar ahora" (una empresa o todas). Crea un
    `TLIC_SCRAPE_JOB`, lanza la corrida en un hilo en segundo plano (`threading.Thread` — el
    proyecto no tiene Celery/RQ y no se justifica añadirlo solo para esto) y responde con el
    `job_id`.
  - `GET /api/lic/scrape/<job_id>/` — estado del job, para que el frontend haga polling.

## Frontend (`frontend/src/features/lic`, nueva entrada de sidebar "Licitaciones")

- **Configuración**: tarjeta por empresa — usuario/password del portal (con botón "Probar
  conexión"), carga del PDF de rubros RPE con los rubros extraídos (editables).
- **Oportunidades**: tabla paginada con las mismas pestañas/filtros del portal, columnas
  referencia/tipo de proceso/entidad/título/fecha límite/estado/# documentos. Botón "Buscar
  ahora" (por empresa o todas) que muestra progreso vía polling de `TLIC_SCRAPE_JOB`. Click en
  una fila abre el detalle con los documentos descargados.

## Manejo de errores

- Login fallido (credencial incorrecta, cuenta bloqueada, portal caído) → se marca esa empresa
  como `error_login` con el mensaje, se salta esa empresa en la corrida (sin reintentos
  agresivos, para no arriesgar un bloqueo de cuenta), se sigue con las demás, y se muestra un
  banner en el panel.
- Cambios en la estructura del portal (selectores rotos) → se captura por empresa, se loguea con
  contexto completo, no tumba toda la corrida; el job termina como
  `completado_con_errores` si algunas empresas sí funcionaron.
- Falla al descargar un documento → un reintento, si vuelve a fallar se marca ese documento como
  `error` y se continúa.
- Idempotencia: las oportunidades se hacen upsert por `(empresa, referencia)` — correr de nuevo
  actualiza estado/fechas en vez de duplicar filas.

## Seguridad

- Password cifrado en reposo (Fernet, mismo patrón que `apps/fe/crypto.py`), nunca se devuelve
  por la API (campo de solo escritura; la UI solo muestra "configurado ✓").
- Documentos y oportunidades están acotados por empresa y protegidos por la misma autorización
  multi-compañía que ya usan FAT/CXC/CXP.

## Verificación

La automatización de navegador no se presta a pruebas unitarias significativas, así que:
- Pruebas unitarias cubren la lógica de upsert/diff y el parseo de la extracción de rubros
  contra datos de fixture.
- El scraper en sí se verifica con una corrida real (smoke) contra el portal, con el mismo
  enfoque que ya usa `sigaft-legacy-testing`, antes de dar la Fase 1 por terminada — es la única
  forma de confirmar que DGCP no cambió su página.

## Fuera de alcance (fases futuras)

- Fase 2: análisis de requisitos de los PDFs descargados con IA.
- Fase 3: panel de preparación de propuestas, recomendación de precios con fuentes.
- Fase 4: envío automatizado de propuestas con Playwright — requiere su propio diseño con
  aprobación humana explícita antes de cualquier envío real, dado el riesgo legal/financiero de
  someter una oferta vinculante a un sistema del Estado.
- Fase 5: monitoreo diario de resultados (adjudicada/perdida/sigue abierta).
- Fase 6: análisis de ofertas de la competencia para estimar probabilidad de ganar.
