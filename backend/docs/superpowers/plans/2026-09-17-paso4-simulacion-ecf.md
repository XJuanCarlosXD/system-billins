# Paso 4 en adelante (Pruebas de Simulación e-CF) — Investigación 2026-09-17

**Estado: SOLO investigación (Task 9 del plan del Panel de Certificación).
No hay tareas con código listo para ejecutar todavía** — el hallazgo
principal de esta pasada es que falta un dato concreto (formato exacto
del contenido del QR) antes de poder escribir un plan con código completo
sin placeholders, siguiendo la misma regla que ya rige este proyecto: no
inventar requisitos de un ente del Estado sin haberlos visto.

## Qué se confirmó en vivo (Playwright, portal real, 2026-09-17)

Login persistente (RNC 130217432) en
`https://ecf.dgii.gov.do/certecf/portalcertificacion/Postulacion/PruebasSimulacion`.

**Texto literal del Paso 4** ("Pruebas de Simulación e-CF"):
> Etapa en la que se comprueba la capacidad de su sistema para generar y
> enviar Comprobantes Fiscales Electrónicos (e-CF) en formato XML a la
> DGII, **a partir de datos de operaciones reales como simulación de su
> actividad comercial**.

Tres reglas explícitas del portal:
1. Para cada tipo de e-CF hay un rango de 1 a 10,000,000 secuencias
   (1 a 50,000,000 para tipo 32) y **NO se pueden reutilizar entre
   reintentos** si se rechaza un comprobante — a diferencia del Paso 2
   (que usaba e-NCF fijos del Excel de la DGII), acá hace falta consumir
   secuencia real vía `fe_repo.consumir_siguiente_encf` en cada intento.
2. Las Facturas de Consumo < RD$250,000 siguen el mismo patrón de dos
   pasos que el Paso 2 (RFCE primero por API, luego el e-CF32 completo
   por el widget manual del portal) — mismo endpoint
   `certificacion_paso2_rfce_view`/patrón reutilizable, solo cambia el
   origen del dato.
3. **Por cada e-CF enviado hay que crear y conservar su representación
   impresa (RI/PDF) "para ser enviada en el siguiente paso"** — el PDF
   con QR NO se sube en el Paso 4, se pide recién en el **Paso 5:
   "Pruebas Simulación Representación Impresa"**. Los pasos 4 y 5 están
   separados; no hace falta resolver el PDF antes de poder avanzar el
   Paso 4.

**Orden de envío (idéntico al Paso 2)**, confirmado en el modal "Orden de
Emisión de Comprobantes Para las Pruebas" del propio portal:
- Primero: 31, 32(≥250Mil), 41, 43, 44, 45, 46, 47
- Segundo: 33, 34
- Tercero: 32 Resumen (RFCE) de Facturas de Consumo <250Mil
- Cuarto: 32 Factura de Consumo <250Mil (subida manual del e-CF32 firmado)

**Contadores del Paso 4** (mismo patrón visual que Paso 2, sujeto al
mismo comportamiento de reconciliación con retraso ya documentado):
0/4 tipo 31, 0/2 tipo 32≥250Mil, 0/1 tipo 33, 0/2 tipo 34, 0/2 tipo 41,
0/2 tipo 43, 0/2 tipo 44, 0/2 tipo 45, 0/2 tipo 46, 0/2 tipo 47,
0/4 tipo 32 RFCE.

**A diferencia del Paso 2, el Paso 4 NO tiene un Excel descargable del
portal** con datos fijos de prueba — no hay botón "Descargar
comprobantes"/"Set de datos a utilizar" en esta pantalla. Esto confirma
que los datos deben salir de operaciones reales de Abregonza
(`TFAT_FACTURA` vía el pipeline de producción `construir_ecf_31/32` de
Fase 1) o de escenarios construidos a mano — no de un archivo que la
DGII entregue.

## Qué YA existe en el código y se puede reutilizar (sin escribir nada nuevo)

- **Pipeline de producción real**: `ecf_builder.construir_ecf_31`/
  `construir_ecf_32` (Fase 1) ya leen `TFAT_FACTURA`/`TFAT_FACTURAL` vía
  `fat_repo` y ya consumen secuencia real con
  `fe_repo.consumir_siguiente_encf` — es exactamente el flujo que el
  Paso 4 exige (secuencias reales, no reutilizables). Los tipos 33/34/41/
  43/44/45/46/47 NO tienen builder desde `TFAT_FACTURA` (Fase 1 solo
  cubrió 31/32, por diseño — ver spec original), así que para esos 8
  tipos hará falta reutilizar `ecf_builder.construir_ecf_generico` con
  datos armados a mano (mismo patrón que `pruebas_enviar_view`/Modo Test
  del Paso 2), no automatizarlos desde facturación real todavía.
- **Bloque QR ya existe en el editor de plantillas PDF**: Puck block
  `QRCode` (`frontend/src/features/pdf/blocks/index.tsx:3072`, usa la
  librería `qrcode` ya instalada) con props `contenido` (string,
  soporta Handlebars) y `size`. Ya se usa en `factura-pos.ts`. Construir
  una plantilla e-CF con QR es, en principio, "otro `defaults/*.ts`" con
  este bloque + el patrón `DocumentoSimple` (`sigaft-pdf-templates`,
  `sigaft-pdf-simple-design`) — NO hace falta escribir infraestructura
  de QR nueva.
- **Endpoint bulk del Paso 2** (`certificacion_paso2_rfce_view`) ya
  resuelve el mismo problema de "RFCE primero, e-CF32 firmado para
  descarga manual después" que pide la regla 2 de arriba — el Paso 4
  puede reutilizar el mismo patrón, solo con un origen de datos distinto
  (factura real en vez de fila de Excel).

## Lo que falta resolver ANTES de poder escribir un plan con código completo

1. **Formato exacto del contenido del QR** — no confirmado todavía. Los
   3 PDF oficiales ya están en el repo
   (`backend/docs/superpowers/reference/2026-08-31-set-pruebas-paso2/`:
   `Formato-e-CF-V1.0.pdf`, `Descripcion-Tecnica-Servicios-DGII.pdf`,
   `Formato-RFCE-v1.0.pdf`) pero esta sesión no pudo renderizarlos
   (`pdftoppm`/`poppler-utils` no está instalado en el entorno de este
   agente) para leer la sección específica de "Representación Impresa"/
   "Código QR". **Siguiente paso real, antes de cualquier código**: leer
   esa sección (con `poppler-utils` instalado, o abriendo el PDF
   directamente) y documentar el formato exacto (típicamente en el
   estándar e-CF dominicano es una URL a
   `ecf.dgii.gov.do/consultatimbrefc?...` con RNC emisor, e-NCF, monto,
   fecha y código de seguridad como query params — pero esto NO está
   confirmado contra el PDF real todavía, no usarlo sin verificar).
2. **Qué "operaciones reales" usar**: decisión de negocio pendiente del
   usuario — ¿usar facturas YA emitidas de Abregonza (cía 01, cualquier
   punto) tal cual están, o el equipo prefiere generar facturas de
   prueba nuevas marcadas de alguna forma para no mezclarlas con el
   historial contable real? Los tipos 31/32 sí tienen de dónde salir
   (facturas de crédito fiscal/consumo reales); los 8 tipos sin builder
   real (33/34/41/43/44/45/46/47) necesitan definirse caso por caso (p.ej.
   34 Nota de Crédito si sale de `TCXC_*`/reversas ya existentes, o se
   arma a mano como el Modo Test).
3. **Paso 5 en adelante** (Representación Impresa, Validación,
   URL Servicios Producción, Declaración Jurada, Verificación Estatus,
   Finalizado) — no explorados todavía, cada uno puede tener su propio
   requisito nuevo; seguir el mismo patrón de este documento (entrar al
   portal, leer el texto literal, no asumir) antes de planear.

## Recomendación

No convertir esto en tareas con código todavía. Próxima sesión:
1. Instalar `poppler-utils` (o pedir al usuario que copie/pegue el texto
   de la sección QR del PDF) y confirmar el formato exacto del contenido
   del QR.
2. Presentarle al usuario la decisión #2 de arriba (qué facturas reales
   usar) como pregunta concreta, no asumirla.
3. Con ambos datos confirmados, recién ahí escribir el plan de
   implementación completo (mismo nivel de detalle que
   `2026-09-17-panel-certificacion-ecf-y-paso4.md`) para el Paso 4, y
   entrar al Paso 5 en el portal para adelantar su investigación también.
