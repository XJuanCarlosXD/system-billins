# Facturación Electrónica DGII (e-CF) — Diseño

Fecha: 2026-07-07 · Estado: PROPUESTO (esperando OK para ejecutar Fase 1)

## 1. Contexto y obligación legal

La **Ley 32-23** (16-may-2023) hace obligatorio el Comprobante Fiscal Electrónico (e-CF)
para todos los contribuyentes de República Dominicana, con calendario escalonado:

| Categoría DGII | Fecha límite |
|---|---|
| Grandes contribuyentes nacionales | 15-may-2024 (ya vencido) |
| Grandes locales y medianos | 15-nov-2025 (ya vencido) |
| **Pequeños, micro y no clasificados** | **15-may-2026** (prórrogas anunciadas hasta 15-nov-2026 según categoría — confirmar la fecha exacta de cada RNC en el listado oficial DGII) |

Las 5 compañías reales del negocio caen previsiblemente en la última categoría.
Incumplir = multas de 5 a 50 salarios mínimos y pérdida de validez fiscal de los comprobantes.

Hoy ZentoryERP emite únicamente NCF de papel serie B (`TCNT_NCF` +
`TCNT_HNCF`, NCF DGI = `POSICIONES_FIJAS_NCF || LPAD(NCF,8,'0')`, 11 chars).
El e-CF es un formato distinto: **e-NCF de 13 caracteres** (`E` + 2 dígitos de
tipo + 10 de secuencial), XML firmado digitalmente y transmitido a la DGII en
tiempo real.

## 2. Resumen técnico DGII (investigado 2026-07-07)

### Ambientes

Base URL: `https://ecf.dgii.gov.do/{ambiente}` con `ambiente` ∈:

| Clave | Uso |
|---|---|
| `testecf` | desarrollo / pruebas libres |
| `certecf` | certificación (set de pruebas oficial) |
| `ecf` | producción |

Las facturas de consumo < RD$250,000 (RFCE) usan host aparte:
`https://fc.dgii.gov.do/{ambiente}`.

### Autenticación (por empresa; token dura ~1 hora)

1. `GET /autenticacion/api/autenticacion/semilla` → XML "semilla".
2. Firmar la semilla con el certificado digital de la empresa (XMLDSig
   enveloped, RSA-SHA256, certificado X.509 en `.p12`).
3. `POST /autenticacion/api/autenticacion/validarsemilla` (multipart con el XML
   firmado) → JSON `{token, expira, expedido}`.
4. Todas las llamadas siguientes: `Authorization: Bearer {token}`.

### Servicios web

| Servicio | Endpoint | Nota |
|---|---|---|
| Recepción e-CF | `POST /recepcion/api/facturaselectronicas` | multipart, archivo `{RNCEmisor}{eNCF}.xml`; devuelve `trackId` |
| Consulta resultado | `GET /consultaresultado/api/consultas/estado?trackId=` | estado del envío |
| Consulta trackIds | `GET /consultatrackids/api/trackids/consulta?rncemisor=&encf=` | |
| Consulta estado/validez | `GET /consultaestado/api/consultas/estado?rncEmisor=&ncfElectronico=&rncComprador=&codigoSeguridad=` | validación pública de un e-CF |
| RFCE (consumo <250k) | `POST https://fc.dgii.gov.do/{amb}/recepcionfc/api/recepcion/ecf` | resumen; respuesta síncrona sin trackId |
| Aprobación comercial | `POST /aprobacioncomercial/api/aprobacioncomercial` | ACECF firmado |
| Anulación de rangos | `POST /anulacionrangos/api/operaciones/anulacionsecuencias` | ANECF firmado |
| Directorio | `GET /consultadirectorio/api/consultas/listado` | receptores electrónicos y sus URLs |

Estados DGII: `1=Aceptado, 2=Rechazado, 3=En Proceso, 4=Aceptado Condicional, 0=No encontrado`.

### Tipos de e-CF

31 Crédito Fiscal · 32 Consumo · 33 Nota de Débito · 34 Nota de Crédito ·
41 Compras · 43 Gastos Menores · 44 Regímenes Especiales · 45 Gubernamental ·
46 Exportaciones · 47 Pagos al Exterior.

Las secuencias e-NCF se solicitan en la Oficina Virtual de la DGII (igual que
hoy los NCF de papel) y vencen el 31-dic del año siguiente.

### Firma, código de seguridad y QR

- Certificado X.509 `.p12/.pfx` emitido por certificadora aprobada por
  **INDOTEL** (Digifirma/Cámara de Comercio de SD, Avansi/Viafirma), propósito
  "Procedimientos Tributarios".
- El **código de seguridad** = primeros 6 dígitos del hash del `SignatureValue`
  del XML firmado. Va impreso en la Representación Impresa (RI) y en el QR.
- QR de la RI apunta a
  `.../consultatimbre?rncemisor=&rnccomprador=&encf=&fechaemision=&montototal=&fechafirma=&codigoseguridad=`
  (`consultatimbrefc` para RFCE).

### Proceso de certificación por empresa (trámite ante la DGII)

1. Obtener certificado digital + usuario administrador de FE.
2. Postulación en el portal de Certificación FE (el representante debe
   coincidir con el registrado en el RNC).
3. Set de pruebas en `certecf`: pruebas de datos, de **simulación** (facturas
   representativas de la operación real) y de comunicación.
4. Declaración jurada → autorización como **Emisor Electrónico**.

Alternativa de negocio: contratar un Proveedor de Servicios FE certificado
(Alanube, DGMax, FacturaHKA…) y delegar firma/transmisión — certificación
abreviada, pero costo recurrente por documento. **Decisión pendiente del
usuario**; este diseño asume **emisión directa** (el ERP es el facturador),
que es lo que la DGII llama "desarrollo propio".

Fuentes: [documentación e-CF DGII](https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/documentacionSobreE-CF.aspx),
Descripción Técnica FE v1.6, Formato e-CF v1.0 (oct-2025), SDKs de referencia
`victors1681/dgii-ecf` (Node) y `SSD-Smart-Software-Development-SRL/ecf_dgii` (.NET).

## 3. Diseño en ZentoryERP

### 3.1 Modelo de datos (schema FAT, Oracle 11g)

```sql
-- Configuración FE por empresa
CREATE TABLE FAT.TFE_CONFIG (
  NO_CIA            VARCHAR2(2)   NOT NULL,
  AMBIENTE          VARCHAR2(10)  DEFAULT 'testecf' NOT NULL, -- testecf|certecf|ecf
  RNC_EMISOR        VARCHAR2(11)  NOT NULL,
  RAZON_SOCIAL      VARCHAR2(150) NOT NULL,
  NOMBRE_COMERCIAL  VARCHAR2(150),
  DIRECCION_EMISOR  VARCHAR2(250),
  MUNICIPIO         VARCHAR2(6),
  PROVINCIA         VARCHAR2(6),
  CERTIFICADO_P12   BLOB,                         -- certificado digital
  CERT_PASSWORD_ENC VARCHAR2(500),                -- cifrado Fernet (SECRET_KEY)
  CERT_SUBJECT      VARCHAR2(250),
  CERT_VENCE        DATE,
  ESTADO_CERT       VARCHAR2(15) DEFAULT 'NO_INICIADO', -- NO_INICIADO|POSTULACION|PRUEBAS|SIMULACION|CERTIFICADO
  ACTIVO            VARCHAR2(1)  DEFAULT 'N',
  FECHA_ACTUALIZA   DATE         DEFAULT SYSDATE,
  CONSTRAINT PK_TFE_CONFIG PRIMARY KEY (NO_CIA)
);

-- Secuencias e-NCF autorizadas (espejo electrónico de TCNT_NCF)
CREATE TABLE FAT.TFE_SECUENCIA (
  NO_CIA          VARCHAR2(2)  NOT NULL,
  TIPO_ECF        VARCHAR2(2)  NOT NULL,          -- 31,32,33,34,41,43,44,45,46,47
  SECUENCIA_DESDE NUMBER(10)   NOT NULL,
  SECUENCIA_HASTA NUMBER(10)   NOT NULL,
  PROX_SECUENCIA  NUMBER(10)   NOT NULL,
  FECHA_VENCE     DATE         NOT NULL,          -- 31-dic año siguiente
  ACTIVA          VARCHAR2(1)  DEFAULT 'S',
  CONSTRAINT PK_TFE_SECUENCIA PRIMARY KEY (NO_CIA, TIPO_ECF, SECUENCIA_DESDE)
);

-- Bitácora/cola de documentos electrónicos emitidos
CREATE TABLE FAT.TFE_DOCUMENTO (
  NO_CIA           VARCHAR2(2)  NOT NULL,
  E_NCF            VARCHAR2(13) NOT NULL,         -- E310000000001
  TIPO_ECF         VARCHAR2(2)  NOT NULL,
  PUNTO            VARCHAR2(2),
  TIPO_DOCU        VARCHAR2(2),                   -- enlace a TFAT_FACTURA
  NO_DOCU          VARCHAR2(7),
  RNC_COMPRADOR    VARCHAR2(11),
  MONTO_TOTAL      NUMBER(14,2),
  ESTADO           VARCHAR2(22) DEFAULT 'PENDIENTE',
    -- PENDIENTE|FIRMADO|ENVIADO|ACEPTADO|ACEPTADO_CONDICIONAL|RECHAZADO|ERROR
  TRACK_ID         VARCHAR2(64),
  CODIGO_SEGURIDAD VARCHAR2(6),
  FECHA_FIRMA      DATE,
  XML_FIRMADO      CLOB,
  RESPUESTA_DGII   CLOB,
  INTENTOS         NUMBER(3) DEFAULT 0,
  FECHA_CREA       DATE DEFAULT SYSDATE,
  FECHA_ACTUALIZA  DATE,
  CONSTRAINT PK_TFE_DOCUMENTO PRIMARY KEY (NO_CIA, E_NCF)
);

-- Cache de tokens DGII (~1h por cía+ambiente)
CREATE TABLE FAT.TFE_TOKEN (
  NO_CIA   VARCHAR2(2)   NOT NULL,
  AMBIENTE VARCHAR2(10)  NOT NULL,
  TOKEN    VARCHAR2(2500) NOT NULL,
  EXPIRA   DATE          NOT NULL,
  CONSTRAINT PK_TFE_TOKEN PRIMARY KEY (NO_CIA, AMBIENTE)
);
```

Notas:
- `TFE_SECUENCIA` sigue el patrón de asignación de `TCNT_NCF`
  (`SELECT … FOR UPDATE OF PROX_SECUENCIA` + `UPDATE +1`) para evitar huecos y
  duplicados bajo concurrencia.
- No se toca `TCNT_NCF`/`TCNT_HNCF`: papel y electrónico conviven durante la
  transición (una cía certificada emite e-CF; las demás siguen en papel).
- `TFE_DOCUMENTO` guarda el XML firmado completo (obligación de conservación,
  y necesario para re-envío/contingencia y para el RFCE cuyo XML no viaja).

### 3.2 Backend (Django + oracledb thick, patrón existente)

Nueva app `backend/apps/fe/`:

```
backend/apps/fe/
  __init__.py
  apps.py
  urls.py                # /api/fe/...
  views.py               # config CRUD, secuencias, probar conexión, monitor
  dgii_client.py         # semilla→firma→token, requests a servicios DGII
  firma.py               # carga .p12, firma XMLDSig enveloped (signxml)
  crypto.py              # cifrado Fernet del password del certificado
backend/apps/legacy/repositories/fe_repo.py   # SQL sobre TFE_*
```

Endpoints Fase 1 (montados en el router principal junto a los demás módulos):

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/fe/config/?no_cia=` | leer config FE de la cía (sin password ni blob; incluye metadata del cert) |
| PUT | `/api/fe/config/` | guardar ambiente + datos emisor + estado certificación |
| POST | `/api/fe/config/certificado/` | subir `.p12` + password (multipart); valida y extrae subject/vencimiento |
| POST | `/api/fe/config/probar-conexion/` | semilla→firma→token contra el ambiente configurado; devuelve resultado |
| GET/POST/PUT | `/api/fe/secuencias/` | CRUD de rangos e-NCF por cía+tipo |
| GET | `/api/fe/documentos/?no_cia=&estado=` | monitor de e-CF emitidos (Fase 2 los alimenta) |

Reglas ya conocidas del proyecto que aplican: binds con `client.nbinds()` cuando
haya listas, rollback del pool en excepción, `/api/` exento de CSRF, deploy a la
VM 10.0.0.99 vía pscp + smoke (skill `sigaft-deploy-vm`).

Dependencias Python nuevas: `signxml` (firma XMLDSig), `cryptography` (ya
transitiva; lectura de .p12 y Fernet), `lxml`.

### 3.3 Frontend (React Query + shadcn/ui, patrón Configuración)

Nueva sección **"Facturación Electrónica"** dentro de Configuración, siguiendo
el patrón de `frontend/src/features/settings/unified/unified-companias.tsx`:

```
frontend/src/features/settings/unified/unified-facturacion-electronica.tsx
frontend/src/features/fe/api.ts            # hooks React Query
```

UI por empresa (selector de cía arriba, como el resto de Configuración):

1. **Card Estado**: badge del estado de certificación (No iniciado → …→
   Certificado), ambiente activo, vencimiento del certificado con alerta si
   < 30 días, switch "Emisión electrónica activa".
2. **Card Certificado digital**: upload `.p12/.pfx` + password; muestra
   subject y fecha de vencimiento extraídos por el backend; nunca re-muestra
   el password.
3. **Card Conexión DGII**: select ambiente (Pruebas / Certificación /
   Producción) + botón **Probar conexión** → hace semilla→token y muestra
   éxito/error con el mensaje de la DGII.
4. **Card Secuencias e-NCF**: tabla por tipo (31, 32, 34, …) con
   desde/hasta/próxima/vence/activa + diálogo para registrar el rango
   autorizado por la DGII (el rango se solicita en la Oficina Virtual, fuera
   del sistema).
5. **Card Monitor** (se llena en Fase 2): últimos e-CF con estado DGII,
   filtros por estado, botón re-enviar los que estén en ERROR.

Nombre de producto en UI: **ZentoryERP** (nunca SIGAF/SIGAFT). Textos en
español, lookups código→descripción, sin IDs internos visibles.

### 3.4 Flujo de emisión (Fase 2, resumen)

1. Al guardar una factura FAT cuya cía tiene `TFE_CONFIG.ACTIVO='S'` y el tipo
   de documento mapea a un tipo e-CF: tomar e-NCF de `TFE_SECUENCIA`
   (FOR UPDATE), construir XML e-CF (Encabezado/Emisor/Comprador/Detalles/
   Totales según Formato v1.0), firmar, guardar en `TFE_DOCUMENTO`.
2. Enviar: tipo 32 < RD$250,000 → RFCE síncrono a `fc.dgii.gov.do`; resto →
   Recepción normal → `trackId` → polling `consultaresultado` hasta estado
   final (job del runner de Windows ya existente cada N minutos, patrón
   `ZentoryERP-Cierres-Settings-PlanRunner`).
3. Rechazado → estado visible en el monitor + el operador corrige y re-emite
   (nota: un e-NCF rechazado no se reutiliza; se emite con secuencia nueva).
4. RI (PDF Puck existente, skill `sigaft-pdf-templates`): variante e-CF con
   e-NCF, código de seguridad, fecha de firma y QR de `consultatimbre`.
5. Si el comprador es receptor electrónico (directorio DGII), enviar también
   el XML a su URL de recepción (ARECF) — obligación de emisor.

### 3.5 Fases

| Fase | Alcance | Entregable |
|---|---|---|
| **F1** | Tablas TFE_*, app `apps/fe`, cliente DGII auth (semilla→firma→token), CRUD config + secuencias, UI Configuración, probar conexión en `testecf` | plan `2026-07-07-fe-ecf-config-fase1.md` (listo) |
| **F2** | Builder XML e-CF 31/32/33/34 + firma + recepción/RFCE + polling estados + hook en guardado de factura FAT + monitor | plan futuro |
| **F3** | RI con QR (plantillas Puck), aprobación comercial, recepción como comprador, anulación de rangos, contingencia | plan futuro |
| **F4** | Certificación DGII por cada RNC en `certecf` (postulación, set de pruebas, simulación, declaración jurada) y switch a `ecf` | trámite + acompañamiento |

### 3.6 Riesgos / decisiones abiertas

- **Emisor directo vs proveedor certificado**: este diseño asume directo;
  si el usuario prefiere proveedor (Alanube, etc.), F2–F4 cambian a integrar
  el API del proveedor y F1 se conserva casi igual (config por empresa).
- **Certificados digitales**: hay que comprarlos por cada RNC (Digifirma/
  Avansi); sin certificado solo se puede probar contra `testecf` con un
  certificado de prueba.
- Oracle 11g + thick mode: CLOB/BLOB por binds ya probados en plantillas PDF.
- La fecha límite exacta de cada RNC debe confirmarse en el
  [listado oficial de obligados](https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/Listados-contribuyentes-obligados-implementar-facturacion-electronica.aspx).
