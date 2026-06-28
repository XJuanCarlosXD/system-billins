# ZentoryERP MCP — Servicio MCP integrado al backend

**Estado:** Diseño aprobado (sin implementar)
**Fecha:** 2026-06-22
**Autor:** JCABREU + Claude
**Producto:** ZentoryERP (clon del legado SIGAF)

## 1. Objetivo

Exponer todas las capacidades del ERP ZentoryERP — facturación, conduces, contabilidad, inventario, cuentas por cobrar/pagar, cheques, nómina, activos fijos, caja chica, órdenes de compra, mantenimientos, impresión PDF y exportación Excel — como un **servidor MCP HTTP** que clientes (Claude Desktop, Claude Code, otros) puedan conectar con un Bearer token por usuario.

El admin (usuario DBA / ROLE_SIGAF) tiene una vista nueva `/admin/mcp` para emitir, listar y revocar tokens por usuario.

El servidor también re-expone, vía proxy, las tools del MCP `memory-router` (memorias y skills del proyecto), de modo que con una sola URL el cliente accede a ERP + memoria de proyecto.

## 2. Decisiones aprobadas

| Decisión | Valor |
|---|---|
| Transporte | HTTP Streamable (mismo patrón que memory-router) |
| Capacidades | CRUD completo en todos los módulos |
| Tokens | Heredan permisos del usuario SIGAFT (no scopes propios) |
| Admin gate | Flag DBA / ROLE_SIGAF (mismo gate que `/admin/users`) |
| Descargas | URL firmada temporal (15 min) |
| Multiempresa | `no_cia` y `punto` **opcionales** en cada tool; el token puede tenerlos como default o bloqueados |
| Hosting | App Django integrada `apps/mcp/` en backend VM 10.0.0.99 / hopto.org |
| Naming | Producto y MCP usan **ZentoryERP**; módulos internos siguen siendo FAT/CNT/INV/etc. |

## 3. Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│ Cliente MCP (Claude Desktop / Code / otros)                 │
│   Authorization: Bearer <token>                              │
│   URL: https://grupo-abregonza.hopto.org:8443/mcp/          │
└──────────────┬──────────────────────────────────────────────┘
               │ Streamable HTTP
               ▼
┌─────────────────────────────────────────────────────────────┐
│ Django backend (VM 10.0.0.99, público hopto.org)            │
│                                                              │
│  Endpoints HTTP:                                             │
│    /mcp/                       → servidor MCP                │
│    /api/admin/mcp/tokens/      → CRUD tokens (DBA only)      │
│    /api/admin/mcp/tokens/<id>/usage/  → auditoría            │
│    /api/mcp/dl/<sig>/          → descargas PDF/Excel         │
│                                                              │
│  apps/mcp/                                                   │
│   ├── server.py        FastMCP/SDK, montaje ASGI            │
│   ├── auth.py          valida Bearer → usuario, flags       │
│   ├── tokens.py        modelo TMCP_TOKEN, hash+revoke       │
│   ├── downloads.py     firma/verificación JWT corto         │
│   ├── audit.py         insert en TMCP_TOKEN_USO             │
│   ├── ratelimit.py     60 calls/min por token               │
│   ├── memory_proxy.py  cliente HTTP a memory-router         │
│   ├── excel.py         openpyxl, mapeo consulta→xlsx        │
│   ├── tools/                                                 │
│   │   ├── fat.py       facturas, conduces, NCF, vendedores  │
│   │   ├── cxc.py       clientes, cobros, estado cuenta      │
│   │   ├── cxp.py       proveedores, pagos                   │
│   │   ├── inv.py       productos, kardex, movimientos       │
│   │   ├── cnt.py       cuentas, asientos, mayor, balances   │
│   │   ├── chc.py       cheques, conciliación                │
│   │   ├── sdn.py       nómina, empleados                    │
│   │   ├── acf.py       activos fijos                        │
│   │   ├── acc.py       caja chica                           │
│   │   ├── odc.py       órdenes de compra                    │
│   │   ├── man.py       catálogos cross-módulo               │
│   │   ├── print_.py    PDFs Puck + listados                 │
│   │   └── memoria.py   proxy memory-router                  │
│   ├── urls.py                                                │
│   └── apps.py                                                │
└─────────────────────────────────────────────────────────────┘

Reusos directos (sin duplicar): fat_repo, cnt_repo, inv_repo,
cxc_repo, cxp_repo, chc_repo, sdn_repo, acf_repo, acc_repo,
odc_repo, permissions_repo, conexión Oracle, /print/<codigo>/<id>.
```

### Frontend

```
frontend/src/features/admin/mcp/
  ├── routes/mcp-tokens-page.tsx       lista + filtros
  ├── components/
  │   ├── token-list.tsx
  │   ├── new-token-dialog.tsx         modal crear
  │   ├── token-generated-dialog.tsx   muestra plaintext una vez
  │   ├── token-usage-drawer.tsx       últimos N usos
  │   └── revoke-confirm.tsx
  └── api.ts                            React Query hooks
```

Sidebar: nueva entrada **"MCP Tokens"** bajo "Administración", visible sólo si `user.is_dba`.

## 4. Modelo de datos

### Tabla `TMCP_TOKEN` (owner ABREGONZA, coherente con otras tablas custom del clon)

| Columna | Tipo | Notas |
|---|---|---|
| TOKEN_ID | VARCHAR2(36) | UUID v4, PK |
| USUARIO | VARCHAR2(30) | FK lógico al USUARIO SIGAFT (el token YA identifica al usuario, no se pasa en cada call) |
| NO_CIA | VARCHAR2(2) | empresa default, NULL = libre |
| BLOQUEAR_CIA | CHAR(1) | S/N — si S, NO_CIA es obligatorio y no se puede override |
| PUNTO | VARCHAR2(2) | punto default, NULL = libre |
| BLOQUEAR_PUNTO | CHAR(1) | S/N — si S, PUNTO es obligatorio y no se puede override |
| NOMBRE | VARCHAR2(100) | label humano |
| TOKEN_HASH | VARCHAR2(128) | SHA-256 del token plaintext |
| PREFIJO | VARCHAR2(8) | primeros 8 chars (no secret) |
| FECHA_CREACION | DATE | sysdate |
| FECHA_EXPIRA | DATE | NULL = nunca |
| FECHA_ULTIMO_USO | DATE | nullable |
| IP_ULTIMO_USO | VARCHAR2(45) | IPv4/IPv6 |
| ST_ACTIVO | CHAR(1) | S/N |
| CREADO_POR | VARCHAR2(30) | usuario admin |

### Tabla `TMCP_TOKEN_USO`

| Columna | Tipo | Notas |
|---|---|---|
| USO_ID | NUMBER | PK secuencia |
| TOKEN_ID | VARCHAR2(36) | FK |
| FECHA | DATE | sysdate |
| TOOL | VARCHAR2(80) | nombre de la tool |
| PARAMS_HASH | VARCHAR2(64) | sha256 de los args (no guarda valores sensibles) |
| IP | VARCHAR2(45) | |
| OK | CHAR(1) | S/N |
| ERROR_CODE | VARCHAR2(40) | si OK=N |
| DURATION_MS | NUMBER(10) | |

Índices: `(TOKEN_ID, FECHA DESC)`, `(USUARIO, FECHA DESC)` vía join.

Retención: 90 días (job de purga simple, no urgente).

## 5. Tokens

**Formato plaintext:** `mcp_<prefijo8>_<random32>` — 40 chars `[a-zA-Z0-9]`.
**Storage:** sólo SHA-256 en DB. El plaintext se muestra **una sola vez** al crear.
**Lookup:** auth recibe `Authorization: Bearer mcp_<prefijo>_<resto>`, calcula SHA-256, busca por `(PREFIJO, TOKEN_HASH)` con `ST_ACTIVO='S'` y `FECHA_EXPIRA IS NULL OR FECHA_EXPIRA > SYSDATE`.

Cache en memoria (LRU, TTL 60s) para evitar query Oracle en cada call.

## 6. Catálogo de tools

Las tools NO reciben usuario — el Bearer token lo identifica.
`no_cia` y `punto` son **opcionales** en cada tool; el resolver de contexto (sección 6.ter) decide qué empresa/punto aplicar.
Todas devuelven el envelope `{ ok, data | error_code, message }`.

### FAT — Facturación
- `fat_listar_facturas(no_cia, punto, fecha_desde?, fecha_hasta?, cliente?, vendedor?, tipo?, estado?, limit=50)`
- `fat_obtener_factura(no_cia, punto, tipo_factura, no_factura)`
- `fat_crear_factura(no_cia, punto, payload)`
- `fat_anular_factura(no_cia, punto, tipo_factura, no_factura, motivo)`
- `fat_listar_conduces(no_cia, punto, ...filtros, limit=50)`
- `fat_obtener_conduce(no_cia, punto, tipo_conduce, no_conduce)`
- `fat_crear_conduce(no_cia, punto, payload)`
- `fat_anular_conduce(no_cia, punto, tipo_conduce, no_conduce, motivo)`
- `fat_facturar_conduces(no_cia, punto, conduces[])`
- `fat_listar_ncf(no_cia, punto, tipo?)`
- `fat_obtener_ncf_disponible(no_cia, punto, tipo_ncf)`
- `fat_listar_vendedores(no_cia, punto)`
- `fat_listar_listas_precio(no_cia, punto)`
- `fat_listar_tipos_documento(no_cia)`
- `fat_listar_puntos(no_cia)`

### CXC — Cuentas por Cobrar
- `cxc_listar_clientes`, `cxc_obtener_cliente`, `cxc_crear_cliente`, `cxc_actualizar_cliente`
- `cxc_estado_cuenta(no_cia, punto, no_cliente, fecha_corte?)`
- `cxc_listar_cobros`, `cxc_crear_cobro`, `cxc_anular_cobro`
- `cxc_aplicacion_cobro(no_cia, punto, no_cobro)`

### CXP — Cuentas por Pagar
- `cxp_listar_proveedores`, `cxp_obtener_proveedor`, `cxp_crear_proveedor`, `cxp_actualizar_proveedor`
- `cxp_listar_facturas_proveedor`, `cxp_crear_factura_proveedor`, `cxp_anular_factura_proveedor`
- `cxp_listar_pagos`, `cxp_crear_pago`, `cxp_anular_pago`

### INV — Inventario
- `inv_listar_productos(no_cia, punto, busqueda?, grupo?, almacen?, limit=50)`
- `inv_obtener_producto`, `inv_crear_producto`, `inv_actualizar_producto`
- `inv_existencia(no_cia, punto, no_produ, almacen?)`
- `inv_kardex(no_cia, punto, no_produ, fecha_desde?, fecha_hasta?)`
- `inv_listar_movimientos`, `inv_crear_movimiento`
- `inv_listar_almacenes`, `inv_listar_grupos`, `inv_listar_unidades`

### CNT — Contabilidad
- `cnt_listar_cuentas(no_cia, busqueda?, nivel?)`
- `cnt_obtener_cuenta`, `cnt_crear_cuenta`
- `cnt_listar_asientos(no_cia, fecha_desde?, fecha_hasta?, origen?)`
- `cnt_obtener_asiento`, `cnt_crear_asiento`, `cnt_anular_asiento`
- `cnt_mayor_general(no_cia, no_cuenta, fecha_desde, fecha_hasta)`
- `cnt_balance_comprobacion(no_cia, fecha_corte)`
- `cnt_estado_resultados(no_cia, fecha_desde, fecha_hasta)`
- `cnt_balance_general(no_cia, fecha_corte)`
- `cnt_listar_ncf_dgii(no_cia)`

### CHC — Cheques
- `chc_listar_cheques`, `chc_obtener_cheque`, `chc_emitir_cheque`, `chc_anular_cheque`
- `chc_conciliacion_bancaria(no_cia, punto, no_cuenta, mes, ano)`

### SDN — Nómina
- `sdn_listar_empleados`, `sdn_obtener_empleado`, `sdn_crear_empleado`, `sdn_actualizar_empleado`
- `sdn_listar_nominas`, `sdn_generar_nomina`
- `sdn_listar_movimientos_manuales`, `sdn_crear_movimiento`
- `sdn_preview_cheques(no_cia, punto, nomina, periodo)`
- `sdn_rnc_empleados(no_cia, punto)`

### ACF — Activos Fijos
- `acf_listar_activos`, `acf_obtener_activo`, `acf_comprar_activo`, `acf_retirar_activo`, `acf_depreciar_periodo`

### ACC — Caja Chica
- `acc_listar_movimientos`, `acc_reponer_caja`, `acc_cerrar_caja`, `acc_resumen_caja`

### ODC — Órdenes de Compra
- `odc_listar_ordenes`, `odc_obtener_orden`, `odc_crear_orden`, `odc_crear_requisicion`, `odc_anular_orden`

### MAN — Mantenimientos cross-módulo
- `man_listar_ciudades`, `man_listar_barrios`, `man_listar_zonas`, `man_listar_rutas`

### Impresión y exportación
- `print_documento_pdf(codigo_doc, id, no_cia, punto, **params)` → `{ url, expires_at }`
- `print_listado_pdf(codigo_doc, filtros)` → `{ url, expires_at }`
- `print_listar_plantillas()` → catálogo de `codigo_doc` disponibles
- `export_excel(consulta, filtros)` → `{ url, expires_at, filename }`

Catálogo `consulta` para `export_excel`:
`fat_facturas`, `fat_conduces`, `cxc_clientes`, `cxc_estado_cuenta`, `cxp_proveedores`, `cxp_pagos`, `inv_productos`, `inv_kardex`, `inv_existencias`, `cnt_mayor`, `cnt_balance_comprobacion`, `cnt_ncf_dgii`, `chc_cheques`, `sdn_empleados`, `sdn_preview_cheques`, `acf_activos`, `acc_movimientos`, `odc_ordenes`.

### Memorias y skills del proyecto (proxy memory-router)
- `memoria_buscar(query, limit=10)` → `memory_search`
- `memoria_obtener(ids[])` → `memory_get`
- `memoria_briefing()` → `memory_briefing`
- `memoria_skills_disponibles()` → lista skills del proyecto
- `memoria_obtener_skill(nombre)` → contenido completo

Si memory-router está caído: error claro, resto del MCP sigue.

**Total aproximado:** ~80 tools.

## 6.ter Resolución de contexto (empresa/sucursal) por llamada

El token identifica al usuario (no se pasa `usuario` en ninguna tool). Para cada llamada que requiera `no_cia` / `punto`, el resolver aplica este orden:

```
Entrada: token.no_cia, token.bloquear_cia,
         token.punto,  token.bloquear_punto,
         args.no_cia (opcional), args.punto (opcional),
         empresas_accesibles_usuario = permissions_repo.empresas_y_puntos(usuario)

Para CIA:
  1. Si token.bloquear_cia == 'S':
       cia_efectiva = token.no_cia
       si args.no_cia presente y args.no_cia != token.no_cia:
           → error VALIDATION_ERROR "company_locked"
  2. Si args.no_cia presente:
       validar que args.no_cia ∈ empresas_accesibles_usuario
       cia_efectiva = args.no_cia
  3. Si token.no_cia presente:           # default no bloqueada
       cia_efectiva = token.no_cia
  4. Si len(empresas_accesibles_usuario) == 1:
       cia_efectiva = la única
  5. Si no:
       → error MISSING_CONTEXT con detail.empresas_disponibles = [...]
         (el LLM cliente debe preguntar al humano cuál usar)

Mismo flujo para PUNTO (con bloquear_punto / punto / args.punto / puntos del usuario en cia_efectiva).
```

### Errores de contexto

```json
{ "ok": false,
  "error_code": "MISSING_CONTEXT",
  "message": "El token no fija empresa por defecto y el usuario tiene acceso a varias. Indique cuál usar.",
  "detail": {
    "campo_faltante": "no_cia",
    "empresas_disponibles": [
      { "no_cia": "01", "descripcion": "ABREGONZA" },
      { "no_cia": "02", "descripcion": "RC HERNANDEZ" },
      { "no_cia": "04", "descripcion": "RODRIGUEZ ARLEQUIN" }
    ]
  } }
```

```json
{ "ok": false,
  "error_code": "VALIDATION_ERROR",
  "message": "Token bloqueado a empresa 01, no se permite override.",
  "detail": { "campo": "no_cia", "valor_token": "01", "valor_recibido": "02" } }
```

### En la vista admin `/admin/mcp`

El modal "Nuevo token" agrega:

```
Empresa por defecto: [ libre ▾ | 01 ABREGONZA | 02 RC HERNANDEZ | ... ]
                     [ ] Bloquear (no permitir override desde el cliente)
Punto por defecto:   [ libre ▾ | 01 | 02 | ... ]
                     [ ] Bloquear

Notas:
- Libre + no bloqueado  → el cliente debe pasar empresa/punto en cada call,
                           o se le pregunta si tiene acceso a varias.
- Default + no bloqueado → si el cliente no pasa, se usa este; puede override.
- Default + bloqueado    → siempre se usa este; override genera error.
```

## 6.bis Tipos de documento por módulo (capa transversal)

Cada módulo del ERP maneja sus propios **tipos de documento** en tablas catálogo (TFAT_TDOCU, TCXC_TDOCU, TCXP_TDOCU, TCNT_TASIENTO, TINV_TMOV, TCHC_TIPO, TODC_TDOCU, TACC_TIPO, TACF_TIPO, TSDN_TIPO_MOV…). Cada registro define:

- **Código** (ej. `F`, `O`, `C`, `RC`, `NC`, `OC`, `RQ`, `T1`, `S1`).
- **Descripción** (ej. "Factura de Crédito", "Cotización").
- **Tipo de transacción** (`F`, `O`, `C`, `D`, `E`, `S`, …).
- **Banderas de efectos secundarios:** `afecta_cxc`, `afecta_cxp`, `afecta_inv`, `afecta_cnt`, `usa_ncf`, `cont_secuencia`, `requiere_almacen`, `permite_anular`, etc.
- **Secuencia** (referencia a `TFAT_SECUENCIA`, `TCNT_SECUENCIA`, etc.).
- **Reglas de NCF** (cuando aplica): tipo NCF fiscal, posiciones fijas, expiración.

### Registry interno

`apps/mcp/doc_types.py` mantiene un **registry declarativo** que mapea cada módulo a:

```python
{
  "fat": {
    "tabla": "TFAT_TDOCU",
    "repo": "fat_repo",
    "listar_fn": fat_repo.listar_tipos_documento,
    "describir_fn": fat_repo.describir_tipo_documento,
    "campos_efecto": ["AFECTA_CXC","AFECTA_INV","AFECTA_CNT","USA_NCF","CONT_SECUENCIA"],
    "schemas_create": {
       "F": FacturaCreditoSchema,
       "O": OrdenSchema,
       "C": CotizacionSchema,
       ...
    },
    "validators": [_validar_ncf_si_aplica, _validar_cliente_no_suspendido, ...],
    "post_create_hooks": [_marcar_secuencia, _generar_asiento_cnt_si_aplica],
  },
  "cxc": { ... },
  "cnt": { ... },
  ...
}
```

Cada `schemas_create` es un **Pydantic schema** que declara los campos requeridos para ese tipo de documento específico. El registry permite agregar tipos nuevos sin tocar las tools (extensible).

### Tools transversales nuevas

- `doc_tipos_listar(modulo, no_cia, punto?)` → lista de `{ codigo, descripcion, tipo_transaccion, banderas: { afecta_cxc, afecta_inv, ... }, secuencia_actual, activo }` para el módulo dado.
- `doc_tipos_describir(modulo, no_cia, tipo_documento)` → schema completo:
  ```json
  {
    "modulo": "fat",
    "tipo_documento": "F",
    "descripcion": "Factura de Crédito",
    "campos_requeridos": [
      { "nombre": "no_cliente", "tipo": "string", "lookup": "cxc_clientes" },
      { "nombre": "vendedor",   "tipo": "string", "lookup": "fat_vendedores" },
      { "nombre": "fecha",      "tipo": "date" },
      { "nombre": "ncf",        "tipo": "string", "regla": "auto desde secuencia B01" },
      { "nombre": "detalle[]",  "tipo": "array",
        "items": [
          { "nombre": "no_produ", "tipo": "string", "lookup": "inv_productos" },
          { "nombre": "cantidad", "tipo": "number" },
          { "nombre": "precio",   "tipo": "number" },
          { "nombre": "descuento","tipo": "number", "opcional": true }
        ]
      }
    ],
    "efectos": { "afecta_cxc": true, "afecta_inv": true, "afecta_cnt": true, "usa_ncf": true },
    "ejemplo_payload": { ... }
  }
  ```

Esto permite que el LLM cliente **pregunte primero qué necesita** antes de armar el `payload` de `fat_crear_factura` / `cxc_crear_cobro` / `cnt_crear_asiento` / etc.

### Patrón uniforme en cada `<modulo>_crear_<recurso>`

```
1. Validar token + permisos del usuario.
2. Resolver tipo_documento del payload → fila en TXXX_TDOCU.
3. Validar payload contra schema dinámico (registry.schemas_create[tipo]).
4. Correr validators del tipo (NCF, saldo cliente, existencia inv, balanceado cnt, etc.).
5. Obtener próxima secuencia (o usar la del payload si el tipo no autoincrementa).
6. INSERT encabezado + detalle (transacción Oracle).
7. Disparar post_create_hooks declarados (asiento contable, afectación cxc, etc.).
8. Auditar en TMCP_TOKEN_USO.
9. Devolver { ok: true, data: { ...documento_creado, secuencia, ncf, asiento_id? } }.
```

Si el cliente manda un `tipo_documento` no permitido o falta un campo del schema, el error es `VALIDATION_ERROR` con `detail.campos_faltantes` y `detail.campos_invalidos` puntuales — no un mensaje genérico.

### Cobertura mínima de tipos (puede crecer)

| Módulo | Tipos típicos a soportar al menos |
|---|---|
| FAT  | `F` Factura crédito, `O` Orden, `C` Cotización, `P` Pedido, `D` Devolución |
| CXC  | `RC` Recibo de cobro, `NC` Nota crédito, `ND` Nota débito, `AJ` Ajuste |
| CXP  | `FP` Factura proveedor, `NC` Nota crédito prov, `PG` Pago, `AJ` Ajuste |
| INV  | `E1` Entrada compra, `S1` Salida consumo, `T1` Traspaso, `AJ` Ajuste físico |
| CNT  | `MN` Asiento manual, `AU` Asiento automático, `CI` Cierre |
| CHC  | `CH` Cheque emitido, `TR` Transferencia, `AN` Cheque anulado |
| SDN  | `BO` Bono, `PR` Préstamo, `DE` Deducción, `VC` Vacaciones |
| ACF  | `CO` Compra, `RE` Retiro, `DE` Depreciación |
| ACC  | `RE` Reposición, `GA` Gasto, `CI` Cierre |
| ODC  | `OC` Orden compra, `RQ` Requisición |

Cada uno con su schema Pydantic, validators y hooks. La lista crece leyendo la tabla `TXXX_TDOCU` real — el registry sólo declara lo que el MCP sabe construir; los demás se exponen sólo en `_listar` y `_obtener` pero el `_crear` rechaza con `VALIDATION_ERROR` indicando que ese tipo aún no está soportado por el MCP.

## 7. Descargas firmadas

JWT corto firmado con `SECRET_KEY`. Claims (sin `usr` — el `tok` resuelve el usuario y el contexto que ya se validó al emitir):

```json
{ "tok": "<token_id>",
  "cia": "01", "pto": "01",
  "kind": "pdf" | "xlsx",
  "src": "/print/factura/...?...",         // pdf
  "qry": "fat_facturas|<payload-hash>",     // xlsx (payload guardado en cache 15min)
  "exp": <epoch>
}
```

`GET /api/mcp/dl/<sig>/`:
1. Verifica firma + expiración.
2. Verifica `tok` activo (revocación rompe la URL aunque el JWT siga vigente).
3. Si `kind=pdf`: redirige internamente / proxy a la URL Puck `src`.
4. Si `kind=xlsx`: recupera payload del cache, ejecuta consulta, arma `.xlsx` con `openpyxl`, devuelve con `Content-Disposition: attachment`.
5. Audita en `TMCP_TOKEN_USO` con tool `download:<kind>`.

Tiempo de expiración: **15 minutos**.

## 8. Auth y permisos

1. Middleware MCP extrae `Authorization: Bearer <plaintext>`. Ninguna tool acepta `usuario` como parámetro — **el token identifica al usuario**.
2. Cálculo SHA-256, lookup en `TMCP_TOKEN` activo (`ST_ACTIVO='S'`) y no expirado (`FECHA_EXPIRA IS NULL OR FECHA_EXPIRA > SYSDATE`).
3. Resuelve `USUARIO`, `NO_CIA`/`BLOQUEAR_CIA`, `PUNTO`/`BLOQUEAR_PUNTO` del token.
4. El resolver de contexto (sección 6.ter) determina `cia_efectiva` y `punto_efectivo` para la llamada.
5. Cada tool valida:
   - `cia_efectiva`/`punto_efectivo` que el usuario puede acceder (via `permissions_repo`).
   - Flag de acción específica para la tool (lectura ≠ creación ≠ anulación).
6. Si falta flag → `{ ok:false, error_code:"PERMISSION_DENIED" }`.

Endpoints `/api/admin/mcp/...` requieren además `is_dba_or_role_sigaf(usuario)`. Usa la misma sesión Django actual (cookie de la app web del admin), no tokens MCP.

## 9. Errores

Envelope uniforme:

```json
{ "ok": false,
  "error_code": "PERMISSION_DENIED" | "NOT_FOUND" | "VALIDATION_ERROR"
              | "ORACLE_ERROR" | "UPSTREAM_UNAVAILABLE" | "RATE_LIMITED",
  "message": "...",
  "detail": { ... } }
```

Excepciones Oracle no se filtran al usuario — log interno + `ORACLE_ERROR` genérico con `request_id` para soporte.

## 10. Rate limiting y observabilidad

- **60 calls/min** por `TOKEN_ID` (in-memory sliding window).
- Logging estructurado: `tool`, `usuario`, `token_prefix`, `no_cia`, `punto`, `duration_ms`, `ok`.
- Métricas opcional: contador por tool y por error_code.

## 11. Vista admin `/admin/mcp`

(detalle UI en sección 2 del brainstorm — incluida ya en este spec)

- Lista con filtros (usuario, activos/todos, búsqueda por nombre/prefijo).
- Modal "Nuevo token": usuario, nombre, no_cia/punto default, expiración (no expira / 30 / 90 / 365 / fecha custom).
- Modal "Token generado": muestra plaintext una vez + JSON listo-para-pegar de `mcpServers`.
- Acciones por fila: Renombrar, Revocar, Ver historial uso.

React Query con `staleTime: 30s`. shadcn/ui Dialog/DataTable.

## 11.bis Vista de monitoreo `/admin/mcp/usage`

Vista admin (mismo gate DBA / ROLE_SIGAF) para observar el uso del MCP en tiempo casi-real, alimentada por `TMCP_TOKEN_USO`.

### Endpoint backend
`GET /api/admin/mcp/usage/` con filtros:
- `desde`, `hasta` (default: últimas 24h)
- `usuario?`, `token_id?`, `tool?`, `modulo?`, `ok?` (S/N), `no_cia?`
- `granularidad` ∈ {`hora`, `dia`, `semana`} para series temporales

Devuelve agregados pre-calculados en SQL (no se trae crudo):

```json
{
  "kpis": {
    "total_calls": 12834,
    "calls_ok": 12601,
    "calls_error": 233,
    "error_rate": 0.0182,
    "p50_ms": 142, "p95_ms": 480, "p99_ms": 1120,
    "usuarios_activos": 7,
    "tokens_activos": 11,
    "downloads_pdf": 318, "downloads_xlsx": 92
  },
  "serie_temporal": [
    { "bucket": "2026-06-22T08:00", "ok": 530, "error": 8, "p95_ms": 410 },
    ...
  ],
  "top_tools": [
    { "tool": "fat_listar_facturas", "calls": 2104, "error_rate": 0.004, "p95_ms": 320 },
    ...
  ],
  "top_usuarios": [
    { "usuario": "JCABREU", "calls": 4801, "ultimo_uso": "2026-06-22T10:14" },
    ...
  ],
  "top_errores": [
    { "error_code": "MISSING_CONTEXT", "calls": 87, "ultima_tool": "fat_listar_facturas" },
    { "error_code": "PERMISSION_DENIED", "calls": 54, "ultima_tool": "cnt_crear_asiento" },
    ...
  ]
}
```

Si el rango cubre >7 días, fuerza `granularidad=dia` para limitar puntos.

### Layout React `/admin/mcp/usage`

```
┌──────────────────────────────────────────────────────────────────┐
│  Uso del MCP                              [↻ refresh]  [⤓ CSV]   │
│  Rango: [Últimas 24h ▾]   Granularidad: [Hora ▾]                │
│  Filtros: [Usuario ▾] [Tool ▾] [Empresa ▾] [Sólo errores ☐]     │
├──────────────────────────────────────────────────────────────────┤
│  KPIs                                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│  │ 12,834     │ │ 1.82%      │ │ 480 ms     │ │  7 usrs    │    │
│  │ llamadas   │ │ error rate │ │ p95        │ │ activos    │    │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘    │
│  ┌────────────┐ ┌────────────┐                                   │
│  │  318 PDF   │ │   92 XLSX  │                                   │
│  │ descargados│ │ descargados│                                   │
│  └────────────┘ └────────────┘                                   │
├──────────────────────────────────────────────────────────────────┤
│  Llamadas en el tiempo                                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ▁▂▃▅▇█▆▅▄▃▂▃▅▆█▇▆▅▄▃▂▂▃                                   │  │ ← stacked bar ok/error
│  │ 00h  03h  06h  09h  12h  15h  18h  21h                     │  │
│  └────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│  Top tools                       │ Top usuarios                  │
│  fat_listar_facturas   2,104  ●  │ JCABREU         4,801  ●     │
│  inv_existencia        1,852  ●  │ MARIA           3,210  ●     │
│  cnt_balance_comprob   1,420  ●  │ PEDRO             920  ●     │
│  print_documento_pdf     318  ●  │ ...                           │
│  ...                             │                               │
├──────────────────────────────────────────────────────────────────┤
│  Errores recientes                                                │
│  Hora      Usuario  Tool                    error_code            │
│  10:14:21  MARIA    cnt_crear_asiento       PERMISSION_DENIED  ⓘ │
│  10:11:08  JCABREU  fat_crear_factura       VALIDATION_ERROR   ⓘ │
│  ...                                                              │
└──────────────────────────────────────────────────────────────────┘

Click en (ⓘ) abre drawer con detalle (params_hash, ip, mensaje completo).
Click en una fila del Top tools/usuarios → filtra todo el tablero por eso.
```

### Componentes
- Charts: **Recharts** (ya usado en dashboard NCF).
- DataTable y filtros: shadcn/ui — mismo patrón que `/admin/mcp/tokens`.
- React Query con `refetchInterval: 30s` y botón refresh manual.
- Exportar CSV del rango filtrado.

### Performance
- Índices Oracle: `TMCP_TOKEN_USO (FECHA DESC)`, `(TOKEN_ID, FECHA DESC)`, `(TOOL, FECHA DESC)`.
- Agregados en una sola query con `GROUP BY TRUNC(FECHA, 'HH')` + window functions para percentiles.
- Si en algún momento el volumen lo justifica, materializar a tabla `TMCP_USAGE_AGG_HORA` con job nocturno (no en MVP).

### Drilldown a token
Desde la lista `/admin/mcp/tokens` (sección 11) el botón "Ver uso" lleva a `/admin/mcp/usage?token_id=<id>` con el filtro pre-aplicado.

## 12. Testing

- Unit tests por archivo de tools usando Oracle de pruebas con transacciones rollback.
- Tests de auth: token válido, hash incorrecto, expirado, revocado, formato malo.
- Tests del proxy memory-router con `httpx.MockTransport`.
- Tests del `downloads.py`: firma válida, expirada, manipulada, token revocado.
- Test E2E con script Python que abre conexión MCP HTTP real al backend del VM.
- Smoke manual con Claude Desktop real conectado al endpoint público:
  `fat_listar_facturas`, `cnt_balance_comprobacion`, `print_documento_pdf factura`, `export_excel fat_facturas`, `memoria_buscar`.

## 13. Despliegue

Sigue el skill `sigaft-deploy-vm`:
1. `pscp` de archivos `.py` cambiados a la VM.
2. `docker compose exec backend python -m py_compile <files>`.
3. `docker compose exec backend python manage.py migrate` para crear `TMCP_TOKEN` y `TMCP_TOKEN_USO`.
4. `docker compose restart backend`.
5. Smoke `curl https://grupo-abregonza.hopto.org:8443/mcp/` y crear token de prueba desde `/admin/mcp`.
6. Frontend a Netlify via push a `main`.

Las tablas Oracle se crean por **migration Django con `RunSQL`** apuntando al owner correcto, NO con `inspectdb`.

## 14. Lo que NO entra en este spec

- Multi-tenant cross-empresa (cada token pertenece a un usuario y maneja su(s) empresa(s) ya autorizadas).
- WebSockets / push notifications desde el MCP — sólo request/response y SSE para streams si MCP lo requiere.
- Quotas por costo / billing.
- Tools que crucen módulos en una sola llamada — el cliente las compone.
- Migración de skills/memorias a una DB propia — siempre vía proxy a memory-router.

## 15. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Filtración de token | Hash en DB, prefijo en UI, revoke instantáneo, rate limit, auditoría completa |
| Una tool write con bug corrompe Oracle | Reusar repos ya probados, validaciones de payload con Pydantic, transacciones explícitas |
| Carga pesada de Oracle por loops del cliente | Rate limit 60/min, paginación obligatoria con `limit ≤ 200` |
| memory-router caído rompe el MCP | Tools `memoria_*` aisladas, fallan solas sin tumbar el server |
| Excel grandes saturan memoria | `openpyxl write_only` + streaming, límite 50k filas por export |
| URL firmada filtrada | TTL 15 min + ligada a TOKEN_ID — si revocas el token, sus URLs dejan de funcionar |
