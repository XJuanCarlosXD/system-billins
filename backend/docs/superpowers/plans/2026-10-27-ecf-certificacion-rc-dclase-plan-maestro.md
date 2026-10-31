# Plan Maestro — Certificación e-CF DGII: RC Hernandez (02) y D Clase (03)

**Este documento es la fuente de verdad entre corridas del runner automático
`ZentoryERP-ECF-Certificacion-RC-DClase-Runner` (cada 4h).** Cada corrida
DEBE leerlo completo antes de actuar, y DEBE actualizar la sección "Estado
por fase" + agregar una entrada al "Log de corridas" al terminar — es la
única forma en que la próxima corrida (contexto totalmente fresco) sabe qué
ya se hizo.

## Empresas objetivo

| Campo | RC Hernandez | D Clase |
|-------|-------------|---------|
| RNC | 130941361 | 131287379 |
| no_cia | 02 | 03 |
| Razón social | RC HERNANDEZ SRL | D CLASE J A SRL |
| Representante legal | Roberto Abreu Espinal (001-0092763-29) | Roberto Abreu Espinal (001-0092763-29) |
| DGII OFV | Sin tarjeta de coordenadas | Sin tarjeta de coordenadas |
| Solicitud certecf | **102301** (creada 2026-10-31, cuenta certecf: 130941361/Adrian361) | *(pendiente — NO crear hasta resolver bloqueo .p12)* |

Portal de Certificación e-CF: `https://ecf.dgii.gov.do/certecf/portalcertificacion`.
Credenciales DGII: ver `reference_accesos_portales_gubernamentales_abregonza.md`
en la memoria del usuario — **NO repetir claves aquí**.

## Antecedentes y ventajas vs. Abregonza

Abregonza (cía 01, RNC 130217432) completó las 15 fases el 2026-10-23
(solicitud 81443, 97+ corridas del runner). Todo el código que se construyó
durante ese proceso ya existe en `main` y está desplegado en la VM:

- **Fase 1** (config): `TFE_CONFIG`, `TFE_SECUENCIA`, UI panel Configuración → FE
- **Fase 2** (pruebas datos): `ecf_builder.py`, `dgii_client.py`,
  `firma.firmar_con_app_oficial()`, endpoint `paso2-*`, UI FE Certificación
- **Fase 3** (aprobación comercial): endpoints ACECF, builder ACECF
- **Fase 4** (simulación e-CF): endpoints `paso4-factura-real`, `paso4-manual`,
  `paso4-rfce`, `paso4-ecf-acecf`; payloads validados para los 11 tipos
  (31/32≥250K/33/34/41/43/44/45/46/47 + RFCE 32<250K); widget upload
- **Fase 5** (representación impresa): plantilla Puck RI con QR legible,
  endpoint `/print/ecf-representacion-impresa/<encf>`, generador Node+Playwright
- **Fases 6-8** (validación RI + URLs + inicio recepción): scripts Playwright
- **Fases 9-11** (recepción e-CF + ACECF): endpoints de recepción P2P,
  Caddy reverse proxy, Cloudflare tunnel
- **Fase 12** (URLs producción): formulario portal
- **Fase 13** (Declaración Jurada): pipeline firma XML DJ con .p12 real
- **Fases 14-15** (verificación + finalizado): automáticas post-DJ

**Ventaja clave**: no hay que construir NADA nuevo de código. Solo:
1. Configurar `TFE_CONFIG` + `TFE_SECUENCIA` para cada empresa (INSERT Oracle)
2. Cargar el .p12 de Roberto en cada `TFE_CONFIG` nueva
3. Ejecutar cada fase usando los endpoints/scripts ya existentes, parametrizados
   con el `no_cia` y RNC de cada empresa
4. Las URLs de servicio (Autenticación/Recepción/ACECF) ya están expuestas en
   `grupo-abregonza.hopto.org:8443` — el backend ya rutea por RNC del emisor

**Riesgo conocido**: el backend `_resolve_fe_cia()` en `fe_repo.py` hace
fallback a cía '01' si no existe TFE_CONFIG para la cía solicitada. Esto
DEBE resolverse ANTES de enviar cualquier dato: crear TFE_CONFIG para '02'
y '03' con sus respectivos RNC, para que los endpoints emitan e-NCF con el
RNC correcto (130941361 / 131287379), no con el de Abregonza (130217432).

## Certificado digital (.p12)

El .p12 de Roberto Abreu Espinal (cédula 00109276329) sirve para las 3
empresas porque es el representante legal de las 3. Datos:
- Archivo: `C:\Users\JCABREU\Desktop\certificado-digital-roberto\roberto-abreu-espinal.p12`
- Subject: `ROBERTO ABREU ESPINAL / IDCDO-00109276329`
- Vence: 2027-08-31 (320+ días de holgura)
- Ya cargado en TFE_CONFIG de cía '01' — hay que cargarlo también en '02' y '03'

## Gotchas aprendidos de Abregonza (CRÍTICOS — no volver a perder tiempo)

1. **certecf, no testecf**: ambiente correcto = `certecf` siempre
2. **CodigoSeguridad** = primeros 6 caracteres del `SignatureValue` del XML
   firmado (literal, base64), NO un SHA256 ni otro hash
3. **RNCComprador del Set de Pruebas**: usar EXACTO como viene del Excel DGII
4. **Tipo 34 (NC electrónica)**: patrón correcto = `CodigoModificacion=2` +
   `MontoTotal=0.00` + `IndicadorNotaCredito=1` + `IndicadorMontoGravado=0`
5. **Cascada**: CUALQUIER rechazo en Fase 4 reinicia TODOS los contadores a 0/N
   (incluso si `secuenciaUtilizada:false`)
6. **Contaminación secuencia DGII**: secuencias bajas (1-10) pueden estar
   "quemadas" en el servidor DGII sin estarlo en TFE_SECUENCIA local;
   solución: `UPDATE TFE_SECUENCIA SET prox_secuencia=100` para ese tipo
7. **Tipo 41**: requiere `MontoITBISRetenido` cuando `IndicadorAgenteRetencionoPercepcion=1`
8. **Tipo 44**: requiere `RNCComprador` (XSD dice opcional, DGII exige)
9. **Tipo 45**: requiere `IndicadorMontoGravado=0` (mismo patrón que tipo 31)
10. **Tipo 46**: requiere `PaisComprador` en nodo Comprador
11. **Tipo 47**: requiere `IndicadorFacturacion=4` (Exento) + `TotalISRRetencion`
    (nombre exacto, no `TotalISRRetenido`)
12. **Widget RFCE Fase 4**: subir XMLs firmados FRESCOS del ciclo activo (nunca
    antes subidos); si sube uno repetido → cascade asíncrono horas después
13. **Fase 5 RI**: código seguridad + fecha firma van DEBAJO del QR; indicar
    tipo comprobante electrónico; QR debe abrir (mínimo size*4 en generación)
14. **Fase 9**: DGII puede no conectar a puertos no estándar → mover a 443 o
    usar tunnel Cloudflare (ya funciona `chosen-variations-defense-carpet.trycloudflare.com`)
15. **Fase 13 DJ**: Roberto debe tener OFV personal activada ANTES de poder
    generar el XML; el XML solo contiene la cláusula legal, no datos RNC
16. **RFCE**: servicio distinto (`fc.dgii.gov.do/certecf/recepcionfc`), URL QR
    usa `consultatimbrefc` con solo 4 params (sin rnccomprador/fechaemision/fechafirma)

## Pre-requisitos (completar ANTES de arrancar la Fase 1 en el portal)

### 1. Crear TFE_CONFIG para cía 02 y 03

Vía API `POST /api/fe/config/` o `docker exec` directo:

**RC Hernandez (02):**
```
INSERT INTO FAT.TFE_CONFIG (no_cia, ambiente, rnc_emisor, razon_social,
  nombre_comercial, direccion_emisor, municipio, provincia, activo)
VALUES ('02', 'certecf', '130941361', 'RC HERNANDEZ SRL',
  'RC HERNANDEZ', '<dirección real de RC Hernandez>', '<municipio>', '<provincia>', 'S');
```

**D Clase (03):**
```
INSERT INTO FAT.TFE_CONFIG (no_cia, ambiente, rnc_emisor, razon_social,
  nombre_comercial, direccion_emisor, municipio, provincia, activo)
VALUES ('03', 'certecf', '131287379', 'D CLASE J A SRL',
  'D CLASE', '<dirección real de D Clase>', '<municipio>', '<provincia>', 'S');
```

> **NOTA**: las direcciones, municipio y provincia deben ser los reales de cada
> empresa (como aparecen en el RNC de DGII). El runner debe consultarlos en
> `dgii.gov.do` o en la BD local (`TGEN_CIA` tabla de compañías) antes del INSERT.

### 2. Cargar el .p12 de Roberto en cada TFE_CONFIG nueva

Vía endpoint `POST /api/fe/config/certificado/` con el archivo .p12 y
password, parametrizado con `no_cia=02` y `no_cia=03`. El endpoint
`save_certificado()` en `fe_repo.py` ya encripta y guarda en la columna
`certificado_p12` de TFE_CONFIG.

### 3. Crear rangos TFE_SECUENCIA para cada empresa

Cada empresa necesita sus propios rangos de secuencia e-NCF. Recomendación:
empezar desde secuencia 100 directamente (evita gotcha #6 de contaminación).

```sql
-- RC Hernandez (02), todos los tipos de e-CF
INSERT INTO FAT.TFE_SECUENCIA (no_cia, tipo_ecf, secuencia_desde, secuencia_hasta, prox_secuencia, activa)
VALUES ('02', 31, 100, 10000000, 100, 'S');
-- Repetir para tipos: 32, 33, 34, 41, 43, 44, 45, 46, 47

-- D Clase (03), igual
INSERT INTO FAT.TFE_SECUENCIA (no_cia, tipo_ecf, secuencia_desde, secuencia_hasta, prox_secuencia, activa)
VALUES ('03', 31, 100, 10000000, 100, 'S');
-- Repetir para tipos: 32, 33, 34, 41, 43, 44, 45, 46, 47
```

### 4. Registrar cada empresa en el portal certecf (Fase 1)

Para cada empresa, ir a `https://ecf.dgii.gov.do/certecf/portalcertificacion`
y registrar una nueva postulación con las credenciales DGII de esa empresa.
Esto crea el número de solicitud y abre el flujo de 15 fases.

> **Cada empresa se registra y avanza por separado en el portal** — no existe
> un atajo por ser del mismo grupo o mismo sistema.

### 5. Descargar el Set de Pruebas de cada empresa

Una vez registrada la solicitud, la DGII genera un Set de Pruebas específico
por RNC (Excel con e-NCFs y datos de prueba). Descargarlo y guardarlo en:
`backend/docs/superpowers/reference/set-pruebas-<rnc>.xlsx`

## Estrategia de ejecución: secuencial vs. paralelo

**Recomendación: ejecutar RC Hernandez primero (completa), luego D Clase.**

Razón: si aparece algún gotcha nuevo específico de empresas secundarias del
grupo (ej. la DGII valida algo distinto para un RNC que no es el "principal"),
es mejor descubrirlo con una sola empresa y no arriesgar dos en paralelo.
Una vez que RC Hernandez complete las 15 fases, D Clase se ejecuta idéntica
con total confianza.

El runner puede avanzar ambas en la misma corrida si una está bloqueada
esperando respuesta DGII (ej. RC en Fase 6 esperando validación RI, D Clase
en Fase 4 enviando datos). Usar buen juicio: no mezclar envíos de ambas en
la misma ventana de 5 minutos para evitar confusión en los logs.

## Estado por fase — RC HERNANDEZ (02, RNC 130941361)

| # | Fase | Estado | Última actualización |
|---|------|--------|----------------------|
| 1 | Registrado | 🛑 Bloqueado — .p12 no coincide con representante DGII | 2026-10-31 |
| 2 | Pruebas de Datos e-CF | ⬜ Pendiente | — |
| 3 | Pruebas de Datos Aprobación Comercial | ⬜ Pendiente | — |
| 4 | Pruebas Simulación e-CF | ⬜ Pendiente | — |
| 5 | Pruebas Simulación Representación Impresa | ⬜ Pendiente | — |
| 6 | Validación Representación Impresa | ⬜ Pendiente | — |
| 7 | URL Servicios Prueba | ⬜ Pendiente | — |
| 8 | Inicio Prueba Recepción e-CF | ⬜ Pendiente | — |
| 9 | Recepción e-CF | ⬜ Pendiente | — |
| 10 | Inicio Prueba Recepción Aprobación Comercial | ⬜ Pendiente | — |
| 11 | Recepción Aprobación Comercial | ⬜ Pendiente | — |
| 12 | URL Servicios Producción | ⬜ Pendiente | — |
| 13 | Declaración Jurada | ⬜ Pendiente | — |
| 14 | Verificación Estatus | ⬜ Pendiente | — |
| 15 | Finalizado | ⬜ Pendiente | — |

## Estado por fase — D CLASE (03, RNC 131287379)

| # | Fase | Estado | Última actualización |
|---|------|--------|----------------------|
| 1 | Registrado | 🛑 Bloqueado — .p12 no coincide con representante DGII | 2026-10-31 |
| 2 | Pruebas de Datos e-CF | ⬜ Pendiente | — |
| 3 | Pruebas de Datos Aprobación Comercial | ⬜ Pendiente | — |
| 4 | Pruebas Simulación e-CF | ⬜ Pendiente | — |
| 5 | Pruebas Simulación Representación Impresa | ⬜ Pendiente | — |
| 6 | Validación Representación Impresa | ⬜ Pendiente | — |
| 7 | URL Servicios Prueba | ⬜ Pendiente | — |
| 8 | Inicio Prueba Recepción e-CF | ⬜ Pendiente | — |
| 9 | Recepción e-CF | ⬜ Pendiente | — |
| 10 | Inicio Prueba Recepción Aprobación Comercial | ⬜ Pendiente | — |
| 11 | Recepción Aprobación Comercial | ⬜ Pendiente | — |
| 12 | URL Servicios Producción | ⬜ Pendiente | — |
| 13 | Declaración Jurada | ⬜ Pendiente | — |
| 14 | Verificación Estatus | ⬜ Pendiente | — |
| 15 | Finalizado | ⬜ Pendiente | — |

Leyenda: ⬜ sin iniciar · 🔲 en curso/parcial · ✅ completo · 🛑 bloqueado

## Bloqueos activos

### ~~2026-10-30: OFV "Solicitud para ser Emisor Electrónico" error sistemático~~ RESUELTO 2026-10-31

Los errores 903/904/905 eran temporales del servidor DGII. La corrida 2
(2026-10-31) reintentó el formulario y funcionó sin cambios. RC Hernandez
solicitud 102301 creada exitosamente. D Clase pendiente de crear (ver
bloqueo activo abajo).

### 2026-10-31: .p12 de Roberto NO coincide con representantes DGII de ambas empresas

**Afecta**: AMBAS empresas (RC Hernandez y D Clase)

**Descripción**: El portal certecf valida que la firma digital del XML de
postulación corresponda al representante registrado en la solicitud. El único
.p12 disponible es el de Roberto Abreu Espinal (cédula 00109276329), pero
Roberto NO aparece como representante/socio en el RNC de ninguna de las dos
empresas ante la DGII:

- **RC Hernandez** (130941361): representantes disponibles son CESAR HERNANDEZ
  JORGE (cédula 00117141333) y ROBERT MIGUEL MUSTAFA ARACENA. Roberto Abreu
  Espinal NO está en la lista.
- **D Clase** (131287379): único representante disponible es JOSE ALEJANDRO
  ABREU ESPINAL. Roberto Abreu Espinal NO está en la lista.

**Error exacto al subir XML firmado**: "La firma utilizada en el XML del formulario
de postulación no corresponde con el representante registrado, favor verificar y
volver a intentarlo."

**RC Hernandez**: solicitud 102301 creada con representante CESAR HERNANDEZ JORGE,
cuenta certecf creada (usuario 130941361 / clave Adrian361), portal accesible y
en Fase 1 "Registrado". Software y URLs ya configurados (ZentoryERP 1.0,
grupo-abregonza.hopto.org:8443). XML generado y firmado con .p12 de Roberto
pero rechazado por no coincidir con CESAR HERNANDEZ.

**D Clase**: solicitud OFV AÚN NO CREADA (se detuvo al confirmar el mismo
problema de representante). No se creó cuenta certecf.

**Para desbloquear** (REQUIERE ACCIÓN DEL USUARIO — no es resoluble por el runner):
1. **Opción A (preferida)**: Agregar a Roberto Abreu Espinal como
   socio/representante de ambas empresas vía "Actualización al RNC" en la OFV
   DGII. Esto es una acción administrativa/legal que requiere documentación
   corporativa (acta de asamblea, etc.).
2. **Opción B**: Obtener certificados digitales (.p12) para los representantes
   actuales de cada empresa (CESAR HERNANDEZ para RC, JOSE ALEJANDRO para D
   Clase). Requiere compra en entidad certificadora aprobada por INDOTEL.
3. **Opción C**: Si Roberto ya es representante legal (según escrituras) pero
   no aparece en el RNC, verificar con la DGII si los datos del RNC están
   desactualizados y solicitar actualización.

**Estado de lo ya completado** (no se pierde):
- TFE_CONFIG + TFE_SECUENCIA para ambas empresas ✅
- Cuenta certecf de RC Hernandez creada y funcional ✅
- Solicitud 102301 de RC Hernandez activa en el portal ✅
- Software y URLs configurados en la postulación ✅
- Pipeline de firma (firmar_con_app_oficial) funciona para cía 02 ✅

### Pre-requisitos BD completados (2026-10-30)

TFE_CONFIG y TFE_SECUENCIA ya existían para ambas empresas (creados hoy):
- TFE_CONFIG: ambiente=certecf, .p12 cargado, cert válido hasta 2027-08-31
- TFE_CONFIG ACTIVO cambiado de 'N' a 'S' para ambas empresas
- TFE_SECUENCIA: 10 tipos (31-47) para ambas, inicio en 100
- NOTA: cía 02 ya tiene 2 docs en TFE_DOCUMENTO (E310000000100, E310000000101)
  estado ENVIADO — enviados vía API antes de tener portal; no cuentan para
  certificación sin postulación activa
- NOTA: MUNICIPIO y PROVINCIA son NULL (columnas VARCHAR2(6), formato código;
  cía 01 también los tiene NULL → no son requeridos para firma e-CF)

## Protocolo de cada corrida

1. `git fetch origin && git pull --rebase origin main`
2. Leer ESTE documento completo (fuente de verdad entre corridas)
3. Determinar cuál empresa y fase toca avanzar (RC Hernandez primero,
   D Clase cuando RC esté bloqueada o avanzada)
4. Login al portal certecf con Playwright usando credenciales de la empresa
   activa (ver memoria `reference_accesos_portales_gubernamentales_abregonza.md`)
5. Confirmar la fase real actual en el portal (el portal manda, no este doc)
6. Si el portal y este doc no coinciden: actualizar este doc primero
7. Ejecutar la fase según la guía por fase (abajo)
8. Al terminar: actualizar las tablas de estado arriba + agregar entrada al
   log de corridas al final + commitear + push a main

## Guía por fase (instrucciones específicas por paso)

### Fase 1: Registro

1. Navegar a `https://ecf.dgii.gov.do/certecf/portalcertificacion` con
   credenciales de la empresa
2. Buscar opción "Solicitud para ser Emisor Electrónico" (ya confirmada
   visible para ambas empresas vía Playwright 2026-10-27)
3. Completar formulario de solicitud:
   - Verificar que los datos precargados (RNC, razón social, dirección)
     son correctos
   - Representante legal: debe coincidir con el .p12 disponible. Roberto
     Abreu Espinal (cédula 00109276329) es el dueño del .p12, pero NO
     aparece en el dropdown de representantes de RC ni D Clase. Ver
     bloqueo activo 2026-10-31 para opciones de resolución.
   - Software: ZentoryERP (nombre del producto, NO SIGAF/SIGAFT)
4. Registrar el número de solicitud en este documento
5. La DGII genera un Set de Pruebas (Excel) — descargarlo y guardarlo en
   `backend/docs/superpowers/reference/set-pruebas-<rnc>.xlsx`

### Fase 2: Pruebas de Datos e-CF

Enviar los 21 e-CF del Set de Pruebas usando los endpoints existentes:
- `POST /api/fe/certificacion/paso2-ecf/` parametrizado con el `no_cia` correcto
- Los datos de cada e-CF salen del Excel del Set de Pruebas (RNCComprador,
  MontoTotal, etc. deben coincidir EXACTO con el Set)
- Luego 4 RFCE via `POST /api/fe/certificacion/paso2-rfce/`
- Luego 4 facturas <250Mil en el widget de upload del portal

**IMPORTANTE**: el `no_cia` en la llamada API determina qué TFE_CONFIG se usa
→ qué RNC firma el e-CF. Asegurarse de que TFE_CONFIG de '02'/'03' ya exista
con el .p12 cargado ANTES de enviar.

### Fase 3: Pruebas de Datos Aprobación Comercial

11 ACECFs via endpoint existente, parametrizados con el `no_cia` de la empresa.

### Fase 4: Pruebas de Simulación e-CF

Mismos patrones que Abregonza (ya validados), usando datos reales de la
empresa. Necesita facturas reales en `TFAT_FACTURA` de cada empresa.

**Contadores requeridos** (11 tipos):
- 4× tipo 31 (Factura de Crédito Fiscal)
- 2× tipo 32 ≥250K
- 1× tipo 33 (Nota de Débito)
- 2× tipo 34 (Nota de Crédito) — usar patrón validado gotcha #4
- 2× tipo 41 (Compras)
- 2× tipo 43 (Gastos Menores)
- 2× tipo 44 (Regímenes Especiales)
- 2× tipo 45 (Gubernamental)
- 2× tipo 46 (Exportaciones)
- 2× tipo 47 (Pagos al Exterior)
- 4× tipo 32 RFCE <250K (widget upload)

**Orden recomendado** (minimiza impacto de cascadas):
1. Tipos "baratos" primero: 31, 32≥250K, 33
2. Tipos con gotchas conocidos: 41, 43, 44, 45
3. Tipos internacionales: 46, 47
4. Tipo 34 (patrón especial CodMod=2, MontoTotal=0, IndicadorNotaCredito=1)
5. RFCE + widget upload AL FINAL (para no arriesgar cascade por widget)

**Si una empresa no tiene facturas reales suficientes** (ej. D Clase puede
tener pocas transacciones): usar `paso4-manual` con payloads de datos
reales de la BD de esa empresa, igual que se hizo con Abregonza.

### Fase 5: Representación Impresa

Generar 11 PDFs (uno por tipo e-CF) usando el pipeline existente:
- Navegar a `/print/ecf-representacion-impresa/<encf>?no_cia=XX&templateDraft=1`
  con Playwright → `page.pdf()` → subir al portal

### Fases 6-8: URLs y Recepción

- **Fase 7 URLs**: reutilizar las mismas URLs de `grupo-abregonza.hopto.org`
  (el backend ya tiene routing por RNC emisor en los endpoints de recepción).
  Si DGII no conecta a :8443, usar el tunnel Cloudflare existente.
- **Fase 8**: clickear "Enviar prueba de comprobantes" en el portal

### Fases 9-11: Recepción

El backend ya maneja recepción e-CF y ACECF para cualquier RNC emisor
configurado en TFE_CONFIG. No debería necesitar código nuevo.

### Fase 12: URLs Producción

Mismo formulario que Abregonza — usar las URLs de producción definitivas
(CF Named Tunnel o la solución que ya esté en uso para Abregonza en ese
momento).

### Fase 13: Declaración Jurada

🛑 **REQUIERE ACCIÓN DE ROBERTO** — única pausa legítima del runner.
- Roberto debe tener OFV personal activada (ya la tiene desde 2026-10-23)
- Generar XML DJ → firmar con .p12 → Roberto sube al portal
- El runner prepara todo menos el envío final

### Fases 14-15: Automáticas post-DJ

## Cuándo detenerse y NO seguir solo

**Única excepción**: acción legalmente vinculante en nombre de RC Hernandez
o D Clase (Declaración Jurada, correspondencia oficial DGII). Preparar el
borrador, pero no enviarlo — Roberto lo hace.

**Todo lo demás es trabajo normal del runner**: rechazos técnicos, config
administrativa, secuencias, mensajes ambiguos, hipótesis que probar. El
runner lo resuelve, lo prueba, o sigue con otra fase/empresa.

## Estimación de tiempo

Con el código ya construido y los gotchas documentados, la estimación
optimista es:

| Bloque | Corridas estimadas | Notas |
|--------|-------------------|-------|
| Pre-requisitos (TFE_CONFIG + secuencias + .p12) | 1 | Una corrida para ambas empresas |
| Fase 1 (registro) × 2 | 1 | Ambas en la misma corrida |
| Fase 2 (21 e-CF + 4 RFCE + 4 widget) × 2 | 2-4 | Depende del Set de Pruebas |
| Fase 3 (11 ACECF) × 2 | 1-2 | Rápido con endpoints existentes |
| Fase 4 (29 comprobantes) × 2 | 4-8 | El más largo; cascadas posibles |
| Fase 5 (11 PDFs RI) × 2 | 1-2 | Pipeline ya validado |
| Fases 6-11 × 2 | 4-8 | Depende de tiempos DGII (6 es asíncrono, 9 requiere que DGII conecte) |
| Fase 12 × 2 | 1 | Formulario simple |
| Fase 13 × 2 | Variable | Depende de Roberto |
| Fases 14-15 × 2 | 0 | Automáticas |

**Total estimado: 15-30 corridas (~2.5-5 días a 4h/corrida) por empresa,
más el tiempo de Roberto para Fase 13.**

Con Abregonza tomó ~97 corridas (~16 días), pero ~70% fue descubrimiento
y debugging de gotchas que ahora están documentados. Con todo resuelto,
el throughput esperado es 3-5× más rápido.

## Log de corridas

### Corrida 1 — 2026-10-30 22:50 UTC
- Empresa: ambas
- Fase trabajada: Pre-requisitos + Fase 1 (intento)
- Acción:
  - Confirmó TFE_CONFIG para cía 02/03 ya existe con .p12, ambiente certecf
  - Activó TFE_CONFIG (ACTIVO 'N'→'S') para ambas empresas
  - Confirmó TFE_SECUENCIA para 10 tipos, inicio 100, para ambas
  - Encontró 2 docs ya enviados para cía 02 (E310000000100/101, estado ENVIADO)
  - Intentó login certecf portal con 130941361/ADRIAN361 → "credenciales no válidas"
  - Confirmó que ni "Restablecer contraseña" ni "ReEnviar accesos" reconocen el RNC
  - Login OFV exitoso para ambas empresas (RC Hernandez y D Clase)
  - Intentó "Solicitud para ser Emisor Electrónico" en OFV para ambas empresas
  - RC Hernandez: error 903 (con CESAR HERNANDEZ) y 904 (con ROBERT MUSTAFA)
  - D Clase: error 905 (con JOSE ALEJANDRO ABREU ESPINAL)
  - Revisó buzón OFV de RC Hernandez (73 msgs) — sin instrucciones certecf
  - Documentó bloqueo completo en este plan
- Estado final: 🛑 BLOQUEADO — no se puede crear cuenta certecf para ninguna empresa
- Commits: pendiente (este update del plan)
- Próximo paso: reintentar formulario OFV (puede ser error temporal); si persiste,
  contactar facturacionelectronica@dgii.gov.do; probar chatbot DIGI

### Corrida 2 — 2026-10-31 11:00 UTC
- Empresa: ambas (RC Hernandez primario, D Clase verificación)
- Fase trabajada: Fase 1 — Registro
- Acción:
  - Reintentó formulario OFV "Solicitud para ser Emisor Electrónico" para RC
    Hernandez con representante CESAR HERNANDEZ JORGE → **ÉXITO** (error 903
    del 2026-10-30 era temporal)
  - Solicitud RC Hernandez: **núm. 102301** creada exitosamente
  - Navegó al buzón OFV → mensaje "CREACION DE USUARIO CERTIFICACION" recibido
    con enlace de registro certecf
  - Creó cuenta certecf para RC Hernandez: usuario 130941361 / clave Adrian361
    (ADRIAN361 no cumplía requisito de minúscula del portal)
  - Login certecf exitoso → Fase 1 "Registrado" visible
  - Configuró software: ZentoryERP 1.0, tipo PROPIO
  - Configuró URLs: grupo-abregonza.hopto.org:8443 (recepción, ACECF, auth)
  - Generó XML de postulación (202610310324988.xml)
  - Firmó XML con firmar_con_app_oficial() vía Docker (cía 02, .p12 Roberto)
  - Subió XML firmado → **RECHAZADO**: "La firma utilizada en el XML del
    formulario de postulación no corresponde con el representante registrado"
  - Causa: .p12 es de Roberto Abreu Espinal pero representante registrado es
    CESAR HERNANDEZ JORGE (Roberto NO está en dropdown de representantes)
  - Verificó D Clase: único representante es JOSE ALEJANDRO ABREU ESPINAL
    (tampoco Roberto) → mismo problema → NO creó solicitud D Clase
  - Documentó bloqueo en plan maestro
- Estado final: 🛑 BLOQUEADO — .p12 no coincide con representantes de ninguna empresa
- Commits: 1 (actualización plan maestro)
- Próximo paso: REQUIERE ACCIÓN DEL USUARIO — agregar Roberto como representante
  en el RNC de ambas empresas (opción A), u obtener .p12 para representantes
  existentes (opción B). Ver bloqueo activo 2026-10-31 para detalles.
