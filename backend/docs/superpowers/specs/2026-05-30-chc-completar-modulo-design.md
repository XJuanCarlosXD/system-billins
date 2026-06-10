# Spec módulo CHC (Cheques y Conciliación Bancaria)

- **Fecha:** 2026-05-31
- **Estado:** Borrador para revisión
- **Meta-spec referenciado:** `2026-05-30-sigaft-meta-validacion-modulos-design.md`
- **Memoria técnica:** `memorias_por_modulo/memoria_cheques.md` (1953 líneas)
- **Posición roadmap:** módulo 7 de 9
- **Naturaleza del módulo:** *reportería intensiva*. 93 reports legacy (segundo después de CxC con 154). Conciliación bancaria es el core del sistema desde el punto de vista contable diario.

---

## 1. Inventario actual del módulo

### 1.1. Estado real en la VM (verificado 2026-05-31)
```
backend/apps/legacy/chc_*.py        → NO EXISTE
backend/apps/chc/                   → NO EXISTE
frontend/src/features/chc/          → NO EXISTE
frontend/src/routes/_authenticated/chc/ → NO EXISTE
```
**Conclusión:** módulo en **STUB cero**. No hay vistas, ni endpoints, ni rutas registradas. Construcción **desde cero** clonando la arquitectura de CxC y FAT.

### 1.2. Bugs conocidos
- N/A — no hay código que pueda tener bugs.

---

## 2. Gap con el legacy

### 2.1. Conteo autoritativo (MCP `project/modules-inventory`)
- **Forms legacy:** 56 (.fmx)
- **Reports legacy:** 93 (.rep/.rdf)

### 2.2. Inventario inferido de la memoria local
- **Opciones de menú:** 77
- **Formularios distintos referenciados:** 52
- **Reportes distintos referenciados:** 22

La diferencia (93 reports inventario MCP vs 22 reports inferidos local) significa que existen reports legacy que el binario `.fmx` no llama directamente — son ejecutados por `RUN_PRODUCT` desde otros forms o llamados desde menús. La lista de 22 cubre las salidas operativas más usadas, pero el plan reserva tiempo para descubrir el remanente al revisar capturas legado.

### 2.3. Opciones legacy NO implementadas (clon = vacío)
**Todas.** Para evitar texto inútil, agrupadas por área:

**A. Configuración / Mantenimiento (8 forms)**
- Compañías CHC (Fchc101), Sucursales/Puntos (Fchc102), Acceso al Sistema (Fchc103), Tipos de Documentos (Fchc104), Bancos (Fchc105), Cuentas Bancarias (Fchc106), Asignar Cuentas a Sucursales (Fchc107), Bancos Afiliados Pago Electrónico (Fchc110).

**B. Acceso (1 form)**
- Acceso de Usuario (Fchc601).

**C. Procesos transaccionales (≈17 forms)**
- Entrada de Solicitud de Cheque, Entrega de Cheques, Impresión/Reimpresión de Cheques, Anular Documento, Corregir NCF, Débito/Crédito Origen Empresa, Aplicar/Generar Saldos Menores por Ajustar, Generar Archivo Pago Electrónico, Generar Pagos Recurrentes, Mantenimiento Pagos Recurrentes, Listado Documentos Con/Sin Comprobante Ingreso, Impresión Reembolso Fondo, Impresión Solicitud Cheques, Impresión Entrada Diario, Fchc202/Fchc208 (legacy sin label).

**D. Cierre / Control (3 forms)**
- Fchc401 Impresión Entrada Diario, Fchc402 (cierre con borrado TCHC_ED), Fchc403 (cierre mensual TCHC_BCUENTA con regla `CERRAR_SIN_MOVI` + `PERMITIR_SOBREGIRO`).

**E. Conciliación bancaria (5 forms — núcleo del módulo)**
- Conciliar por Documento (Fchc702), Conciliar por Lote (Fchc701), Digitar Dr/Cr que no Corresponden (Fchc703), Reporte de Balance Conciliado (Fchc704), Reversar Conciliación / Desconciliar (Fchc705), Cerrar Conciliación (Fchc706).

**F. Consultas y reportes operativos (≈8 forms)**
- Certificado de Retención a Proveedores (Fchc505), Consulta de Cheques, Consulta Documentos Origen Banco, Consulta Histórico de Balance, Consulta Movimientos Cuentas, Enviar Documentos a Excel, Notificación de Pago.

### 2.4. Reportes PDF legacy a portar (lista priorizada de 22, hay un long tail)

| # | Artefacto | Nombre legacy | Prioridad | Notas |
|---|-----------|---------------|-----------|-------|
| 1 | Rchc501 | MOVIMIENTO CUENTA | **P0** | El más usado. Saldo inicial + débitos + créditos por fecha sobre TCHC_CHEQUE/TCHC_CUENTAH. |
| 2 | Rchc502 | BALANCE CUENTAS | **P0** | Saldo por cuenta bancaria con históricos. |
| 3 | Rchc505 | DISPONIBILIDAD BANCARIA | **P0** | Saldo neto - cheques en tránsito (TCHC_TRANSITO). |
| 4 | Rchc218 | LIBRO DIARIO CHEQUES CON DETALLE | **P0** | Libro oficial cheques emitidos (auditoría/DGII). |
| 5 | Rchc202 | LISTADO DIARIO CHEQUE | **P0** | Listado diario chequera. |
| 6 | Rchc203 | LISTADO DIARIO DÉBITO/CRÉDITO | **P0** | D/C bancarios del día. |
| 7 | Rchc219 | LISTADO DIARIO DÉB/CRÉD/DEPÓSITO | **P0** | Cubre depósitos también. |
| 8 | Rchc503 | CHEQUES POR CUENTA | **P1** | Por proveedor + cuenta banco + estado A/N. |
| 9 | Rchc207 | LISTADO CHEQUES ENTREGADOS | **P1** | Auditoría entrega. |
| 10 | Rchc217 | LISTADO SOLICITUD DETALLE | **P1** | Solicitudes pendientes/aprobadas. |
| 11 | Rchc249 | LISTADO AUTORIZACIÓN PAGO | **P1** | Flujo aprobación. |
| 12 | Rchc509 | DOCUMENTOS POR PROVEEDORES | **P1** | Cheques agrupados por proveedor. |
| 13 | Rchc701 | LIBRO/REPORTE CONCILIACIÓN | **P0** | Conciliación bancaria mensual. |
| 14 | Rchc232 | REPORTE (sin label) | **P2** | Por descubrir vía captura legado. |
| 15 | Rchc233 | REPORTE CON DETALLE | **P2** | Idem. |
| 16 | Rchc201 | (sin label) | **P2** | Listado base. |
| 17 | Rchc208 | (sin label) | **P2** | Idem. |
| 18 | Rchc209 | (sin label) | **P2** | Idem. |
| 19 | Rchc210 | (sin label) | **P2** | Idem. |
| 20 | Rchc213 | (sin label) | **P2** | Idem. |
| 21 | Rchc227 | (sin label) | **P2** | Idem. |
| 22 | Rcxp202 | REPORTE REV. SALDOS | **P3** | Vive en CxP pero invocado desde CHC. Reutilizar endpoint CxP si existe. |

### 2.5. Reglas DGI / contables que faltan
- **Cheques + Retención ISR a proveedores:** Rchc505/Fchc505 generan certificado retención (606/623). Schema NCF aplica a tipo_docu de certificado.
- **Asiento contable automático del cierre Fchc402/Fchc403:** los UPDATEs detectados (TCHC_CHEQUE.ST_GENERADO_CNT, TCHC_DCCHEQUE.NO_ASIENTO/ANO_ASIENTO/MES_ASIENTO + DELETE TCHC_ED) son el efecto contable. Replicar exactamente.
- **NCF para pagos electrónicos** (Fchc110, archivo bancario): usar helper `_compose_ncf_dgi`.

---

## 3. Trabajo a realizar

### 3.1. Vistas/pantallas (frontend `features/chc/`)

**Layout y rutas:**
- `routes/_authenticated/chc/index.tsx` — dashboard CHC (saldo por cuenta + cheques pendientes conciliar + alerta de conciliación abierta).
- `routes/_authenticated/chc/layout.tsx` — sidebar/breadcrumb con secciones: Configuración, Cheques, Conciliación, Consultas, Reportes, Cierre.

**Configuración (8 vistas CRUD):**
- `chc/bancos/` (Fchc105) — list + form bancos (BANCO, DESCRI, ACTIVO).
- `chc/cuentas-bancarias/` (Fchc106) — list + form (CUENTA_BANCO, NOMBRE, BANCO, MONEDA, ACTIVA, PERMITIR_SOBREGIRO, DIAS_TRANSITO, CUENTA contable).
- `chc/asignar-cuentas-sucursales/` (Fchc107) — matriz cuenta×sucursal (TCHC_BCUENTA).
- `chc/companias/` (Fchc101), `chc/sucursales/` (Fchc102), `chc/tipos-documento/` (Fchc104), `chc/usuarios/` (Fchc103 — permisos TCHC_USUARIO/USUARIOC/USUARIOD), `chc/bancos-afiliados-pago-electronico/` (Fchc110).

**Cheques / Operaciones (≈10 vistas):**
- `chc/solicitudes/` — entrada de solicitud de cheque + impresión solicitud.
- `chc/cheques/nueva/` — emitir cheque (encabezado TCHC_CHEQUE + detalle TCHC_DCCHEQUE, FK a TCXP_DOCUMENTO de los documentos pagados).
- `chc/cheques/` — listado, filtros (cuenta, fecha, estado activo/nulo, proveedor), acciones: imprimir, anular, entregar.
- `chc/cheques/:id/` — detalle con tab "Documentos pagados" + tab "Asiento contable" + tab "Reimpresiones".
- `chc/anular-documento/` (Fchc anulación) — anular cheque con reversión efectos.
- `chc/corregir-ncf/` — corregir NCF de cheque ya impreso.
- `chc/debito-credito-origen/` — D/C bancario manual (TCHC_OTROSDOCU vía Fchc703 idea reutilizada).
- `chc/pagos-recurrentes/` — list/CRUD TCHC_PAGO_RECURRENTE + acción "Generar".
- `chc/pago-electronico/` — generar archivo banco (Fchc110 ach).
- `chc/saldos-menores-ajuste/` — generar + aplicar (2 vistas combinadas).
- `chc/entrega-cheques/` — flujo entrega.
- `chc/reimpresion/` — historial TCHC_REIMPRESO + acción reimprimir con motivo.

**Conciliación bancaria (5 vistas — núcleo):**
- `chc/conciliacion/` — selector cuenta/mes + tab "Por documento" (Fchc702) + tab "Por lote" (Fchc701).
- `chc/conciliacion/dr-cr-no-correspondientes/` (Fchc703) — digitar partidas que no corresponden.
- `chc/conciliacion/balance/` (Fchc704) — visualizar balance conciliado, exportar.
- `chc/conciliacion/reversar/` (Fchc705) — desconciliar con auditoría.
- `chc/conciliacion/cerrar/` (Fchc706) — cerrar mes (set TCHC_CUENTAH.CONCILIACION_CERRADA='S').

**Cierre / Control (2 vistas):**
- `chc/cierre/diario/` (Fchc401) — generación entrada de diario contable.
- `chc/cierre/mensual/` (Fchc402+Fchc403) — cierre mensual con generación de asiento + propagación a CxC/CxP periodo.

**Consultas (4 vistas):**
- `chc/consultas/cheques/` — búsqueda avanzada.
- `chc/consultas/documentos-origen-banco/`.
- `chc/consultas/historico-balance/`.
- `chc/consultas/movimientos-cuenta/`.
- `chc/exportar-excel/` — útil para conciliación manual.
- `chc/certificado-retencion/` (Fchc505) — emitir certificado retención proveedor.

**Reportes (1 vista hub):**
- `chc/reportes/` — landing con tarjetas por reporte (22), cada una abre modal con filtros y dispara endpoint `/api/chc/.../pdf/`.

### 3.2. Endpoints backend (`backend/apps/chc/views.py` + `legacy/repositories/chc_repo.py`)

**Catálogos / Config (8 grupos):**
- `GET/POST/PUT/DELETE /api/chc/bancos/`
- `GET/POST/PUT/DELETE /api/chc/cuentas-bancarias/`
- `GET/PUT /api/chc/asignaciones-cuenta-sucursal/`
- `GET/POST/PUT /api/chc/tipos-documento/`
- `GET/PUT /api/chc/usuarios-permisos/` (TCHC_USUARIO, TCHC_USUARIOC por cuenta, TCHC_USUARIOD por tipo doc)
- `GET/POST/PUT /api/chc/bancos-afiliados-pe/`

**Cheques:**
- `GET /api/chc/cheques/` (paginado + filtros)
- `GET /api/chc/cheques/:tipo/:no/`
- `POST /api/chc/cheques/` (emitir — encabezado + detalle + secuencia TCHC_SECUENCIA)
- `POST /api/chc/cheques/:tipo/:no/anular/`
- `POST /api/chc/cheques/:tipo/:no/imprimir/`
- `POST /api/chc/cheques/:tipo/:no/reimprimir/`
- `POST /api/chc/cheques/:tipo/:no/entregar/`
- `POST /api/chc/cheques/:tipo/:no/corregir-ncf/`

**D/C, Otros, Recurrentes, Pago electrónico, Saldos menores:**
- `POST /api/chc/otros-documentos/` (D/C bancario manual)
- `GET/POST/PUT/DELETE /api/chc/pagos-recurrentes/`
- `POST /api/chc/pagos-recurrentes/generar/`
- `POST /api/chc/pago-electronico/archivo/`
- `POST /api/chc/saldos-menores/generar/` y `/aplicar/`

**Conciliación:**
- `GET /api/chc/conciliacion/pendientes/?cuenta=&mes=&ano=`
- `POST /api/chc/conciliacion/marcar/` (lote o documento)
- `POST /api/chc/conciliacion/reversar/`
- `POST /api/chc/conciliacion/cerrar/`
- `GET /api/chc/conciliacion/balance/`
- `POST /api/chc/conciliacion/dr-cr-no-corresponden/`

**Cierre / Control:**
- `POST /api/chc/cierre/diario/` (entrada de diario CHC→CNT)
- `POST /api/chc/cierre/mensual/` (con regla `CERRAR_SIN_MOVI`)
- `POST /api/chc/cierre/mensual/reversar/`

**Consultas:**
- `GET /api/chc/consultas/cheques/`
- `GET /api/chc/consultas/documentos-origen-banco/`
- `GET /api/chc/consultas/historico-balance/`
- `GET /api/chc/consultas/movimientos-cuenta/`
- `GET /api/chc/consultas/exportar-excel/`
- `GET /api/chc/certificado-retencion/:tipo/:no/`

### 3.3. Reportes PDF (22 endpoints — núcleo del esfuerzo)
Todos extendiendo `apps/legacy/pdf_helpers.py:build_pdf_report` y siguiendo el header/footer del meta-spec §5.

| Endpoint | Reporte | Prioridad |
|----------|---------|-----------|
| `/api/chc/reportes/movimiento-cuenta/pdf/` | Rchc501 | P0 |
| `/api/chc/reportes/balance-cuentas/pdf/` | Rchc502 | P0 |
| `/api/chc/reportes/disponibilidad-bancaria/pdf/` | Rchc505 | P0 |
| `/api/chc/reportes/libro-diario-cheques-detalle/pdf/` | Rchc218 | P0 |
| `/api/chc/reportes/listado-diario-cheque/pdf/` | Rchc202 | P0 |
| `/api/chc/reportes/listado-diario-dc/pdf/` | Rchc203 | P0 |
| `/api/chc/reportes/listado-diario-dcd/pdf/` | Rchc219 | P0 |
| `/api/chc/reportes/conciliacion/pdf/` | Rchc701 | P0 |
| `/api/chc/reportes/cheques-por-cuenta/pdf/` | Rchc503 | P1 |
| `/api/chc/reportes/cheques-entregados/pdf/` | Rchc207 | P1 |
| `/api/chc/reportes/solicitud-detalle/pdf/` | Rchc217 | P1 |
| `/api/chc/reportes/autorizacion-pago/pdf/` | Rchc249 | P1 |
| `/api/chc/reportes/documentos-por-proveedor/pdf/` | Rchc509 | P1 |
| `/api/chc/reportes/rchc232/pdf/` | Rchc232 | P2 |
| `/api/chc/reportes/rchc233/pdf/` | Rchc233 | P2 |
| `/api/chc/reportes/rchc201/pdf/` | Rchc201 | P2 |
| `/api/chc/reportes/rchc208/pdf/` | Rchc208 | P2 |
| `/api/chc/reportes/rchc209/pdf/` | Rchc209 | P2 |
| `/api/chc/reportes/rchc210/pdf/` | Rchc210 | P2 |
| `/api/chc/reportes/rchc213/pdf/` | Rchc213 | P2 |
| `/api/chc/reportes/rchc227/pdf/` | Rchc227 | P2 |
| `/api/chc/reportes/certificado-retencion/pdf/` | Fchc505 output | P1 |

### 3.4. Bugs a corregir
- N/A (módulo nuevo). Cualquier defecto detectado durante ejecución se registra como issue separado, no como TODO en código.

---

## 4. Flujos críticos para E2E (5)

1. **Emitir cheque desde solicitud aprobada**
   Pre: cuenta bancaria activa, proveedor con documentos CxP pendientes, secuencia TCHC_SECUENCIA inicializada.
   Pasos: ir a `chc/cheques/nueva/` → seleccionar proveedor → seleccionar documentos CxP a pagar → calcular monto → confirmar → imprimir.
   Verifica: HTTP 2xx, NCF generado correctamente, TCHC_CHEQUE insertado con `ST_NULO='A'`, TCHC_DCCHEQUE con FK a TCXP_DOCUMENTO, TCXP_DOCUMENTO marcado pagado.

2. **Conciliar lote de cheques del mes y cerrar conciliación**
   Pre: cuenta con cheques emitidos en mes M, TCHC_CUENTAH abierto.
   Pasos: `chc/conciliacion/` → cuenta + mes M → seleccionar 10 cheques → "Conciliar lote" → revisar balance en `chc/conciliacion/balance/` → cerrar mes en `chc/conciliacion/cerrar/`.
   Verifica: TCHC_CHEQUE.ST_CONCILIADO='S', TCHC_CUENTAH.CONCILIACION_CERRADA='S', balance final = saldo bancario + tránsito.

3. **Anular cheque ya impreso con efecto reversal**
   Pre: cheque autorizado e impreso, no conciliado.
   Pasos: `chc/cheques/:id/` → acción "Anular" → confirmar con motivo.
   Verifica: TCHC_CHEQUE.ST_NULO='N', documentos CxP vinculados regresan a "pendiente", saldo TCHC_BCUENTA actualizado.

4. **Generar libro diario de cheques (Rchc218) y reconciliar con legacy**
   Pre: mes con cheques emitidos.
   Pasos: `chc/reportes/` → "Libro diario cheques con detalle" → filtros → "Generar PDF".
   Verifica: PDF descargado, conteo + total general idéntico al `.rep` legacy ejecutado contra Oracle.

5. **Cierre mensual del módulo con generación de asiento contable**
   Pre: mes conciliado, sin cheques pendientes en TCHC_ED.
   Pasos: `chc/cierre/mensual/` → seleccionar cuenta + mes → "Procesar".
   Verifica: asiento creado en CNT con NO_ASIENTO/ANO_ASIENTO/MES_ASIENTO propagado a TCHC_DCCHEQUE, TCHC_CHEQUE.ST_GENERADO_CNT='S', TCHC_ED limpiado.

---

## 5. Queries a reconciliar con legacy

### 5.1. Rchc501 — Movimiento de Cuenta
```sql
SELECT SALDO_INICIAL FROM TCHC_CUENTAH
 WHERE NO_CIA=:cia AND PUNTO=:pto AND ANO=:ano AND MES=:mes AND CUENTA_BANCO=:cta;

SELECT TIPO_DOCU, NO_DOCU, FECHA_CHEQUE, BENEFICIARIO,
       DECODE(TIPO_MOVI,'D',VALOR_ORIGINAL,0) AS DEBITO,
       DECODE(TIPO_MOVI,'C',VALOR_ORIGINAL,0) AS CREDITO
  FROM TCHC_CHEQUE
 WHERE NO_CIA=:cia AND PUNTO=:pto AND CUENTA_BANCO=:cta
   AND TRUNC(FECHA_CHEQUE) BETWEEN :desde AND :hasta
   AND ST_NULO='A'
 ORDER BY FECHA_CHEQUE, NO_DOCU;
```

### 5.2. Rchc502 — Balance de Cuentas
```sql
SELECT D.CUENTA_BANCO, D.NOMBRE, D.MONEDA,
       B.SALDO_INICIAL + B.DEPOSITO_MES + B.DEB_MES - B.CHE_MES - B.CRE_MES AS SALDO_ACTUAL
  FROM TCHC_BCUENTA B, TCHC_DCUENTA D
 WHERE B.NO_CIA=:cia AND B.PUNTO=:pto AND D.CUENTA_BANCO=B.CUENTA_BANCO
   AND D.ACTIVA='S';
```

### 5.3. Rchc505 — Disponibilidad Bancaria
```sql
SELECT cuenta_banco,
       saldo_actual,
       NVL((SELECT SUM(monto_transito) FROM TCHC_TRANSITO T
             WHERE T.NO_CIA=B.NO_CIA AND T.PUNTO=B.PUNTO
               AND T.CUENTA_BANCO=B.CUENTA_BANCO
               AND TRUNC(SYSDATE) - TRUNC(FECHA_DEPOSITO) <= D.DIAS_TRANSITO),0) AS EN_TRANSITO,
       saldo_actual - en_transito AS DISPONIBLE
  FROM TCHC_BCUENTA B, TCHC_DCUENTA D
 WHERE D.CUENTA_BANCO=B.CUENTA_BANCO;
```

### 5.4. Rchc218 — Libro Diario de Cheques con Detalle
```sql
SELECT C.FECHA_CHEQUE, C.TIPO_DOCU, C.NO_DOCU, C.BENEFICIARIO, C.MONTO_TOTAL,
       D.TIPO_DOCU_REF, D.NO_DOCU_REF, D.VALOR
  FROM TCHC_CHEQUE C, TCHC_DCCHEQUE D
 WHERE C.NO_CIA=:cia AND C.PUNTO=:pto AND C.CUENTA_BANCO=:cta
   AND TRUNC(C.FECHA_CHEQUE) BETWEEN :desde AND :hasta
   AND D.NO_CIA=C.NO_CIA AND D.PUNTO=C.PUNTO
   AND D.TIPO_DOCU=C.TIPO_DOCU AND D.NO_DOCU=C.NO_DOCU
 ORDER BY C.FECHA_CHEQUE, C.NO_DOCU;
```

### 5.5. Rchc701 — Conciliación
```sql
SELECT cuenta_banco, mes, ano,
       SUM(DECODE(ST_CONCILIADO,'S',VALOR_ORIGINAL,0)) AS CONCILIADO,
       SUM(DECODE(ST_CONCILIADO,'N',VALOR_ORIGINAL,0)) AS PENDIENTE
  FROM TCHC_CHEQUE
 WHERE NO_CIA=:cia AND PUNTO=:pto AND CUENTA_BANCO=:cta
   AND TO_CHAR(FECHA_CHEQUE,'YYYYMM') = :ano||LPAD(:mes,2,'0')
 GROUP BY cuenta_banco, mes, ano;
```

### 5.6. Procedimiento de validación
Para cada reporte P0/P1: extraer SQL del `.rep` ejecutando vía sqldeveloper contra el legacy, comparar con SQL del clon (Oracle 11g, mismas binds), exigir conteo + suma idénticos.

---

## 6. Opciones legacy descartadas con justificación

| Opción | Razón |
|--------|-------|
| `Rcxp202.rep` (REPORTE REV. SALDOS llamado desde CHC) | Vive en CxP. No re-implementar en CHC; el frontend CHC enlaza al endpoint CxP existente (cuando CxP esté cerrado). |
| `Fmenu_*.fmx` (entradas que solo abren otro módulo: CXC, CXP, FAT, INV, CNT, etc.) | Son navegación de menú legacy. El clon tiene sidebar global; no se reimplementan como vistas. |
| `Fchc202.fmx` y `Fchc208.fmx` (sin label) | Marcadas como variantes/duplicados internos. Verificar contra capturas legado; si son duplicados de Fchc201/Fchc207 → descartar y consolidar. |
| Reports `Rchc201/208/209/210/213/227/232/233` sin label claro | Mantener en P2 y revisar las capturas en `capturas\cheques\` antes de programar. Si resultan duplicados o reportes ad-hoc obsoletos, descartar formalmente en el plan. |

---

## 7. Estimación

- **Tareas:** ~48 (ver plan hijo).
- **Esfuerzo agregado estimado:** 110-140 horas distribuidas en:
  - Backend repos + endpoints transaccionales: 30h
  - Backend reportes PDF (22): 35h
  - Frontend layout + 30 vistas: 40h
  - Conciliación (lógica + UI + tests): 15h
  - Tests Playwright (5 flujos): 8h
  - Reconciliación SQL legacy: 10h
- **Riesgo principal:** la conciliación bancaria + cierre mensual tienen efectos contables encadenados (CHC → CNT, CHC → CxP). Cualquier error en triggers de saldo deja inconsistente TCHC_BCUENTA.SALDO_INICIAL_B/SALDO_INICIAL — tests E2E deben verificar saldos pre/post.
- **Dependencias bloqueantes:** módulo CxP debe estar al menos con backend completo (proveedores, documentos) antes de poder emitir cheques que paguen documentos CxP. Si CxP-frontend aún es stub, CHC puede arrancar consultando directamente `TCXP_DOCUMENTO` vía cxp_repo. CNT debe poder recibir asientos (no requiere UI, solo el endpoint de inserción).

---

## 8. Memorias relacionadas

- `memorias_por_modulo/memoria_cheques.md` — memoria técnica chunked.
- MCP `sigaft/module-memory-20260530-final/cheques/part-001..037` — versión MCP de la memoria.
- MCP `project/risk-areas` — CHC identificado como #3 en riesgo.
- Meta-spec `2026-05-30-sigaft-meta-validacion-modulos-design.md` §3 (DoD), §4 (restricciones), §5 (PDFs), §6 (reconciliación SQL).
- Skill agent MCP `oracle-sigaf-erp` — usar para queries Oracle 11g del módulo.
