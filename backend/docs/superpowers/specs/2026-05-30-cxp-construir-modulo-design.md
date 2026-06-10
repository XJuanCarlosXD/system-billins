# Spec modulo CxP (Cuentas por Pagar) — construir desde cero

- **Fecha:** 2026-05-30
- **Estado:** Borrador para revision
- **Meta-spec referenciado:** `2026-05-30-sigaft-meta-validacion-modulos-design.md`
- **Memoria tecnica:** `memorias_por_modulo/memoria_cuentas_por_pagar.md`
- **Brief de construccion:** MCP `cxp/handoff-build-frontend` y `cxc-cxp/estado-2026-05-27`
- **Capturas de referencia:** `C:\Users\JCABREU\AppData\Local\memorias_sigaft\capturas\Cuentas por Pagar\` (30 PNG + .txt 606/607/623 + impresion_doc_*.pdf)
- **Modulo gemelo de referencia (template):** CxC ya COMPLETO — clonar arquitectura literal.

---

## 1. Inventario actual del modulo

### 1.1 Frontend (clon)

Estado: **STUB**.

- Unica ruta presente: `frontend/src/routes/_authenticated/cxp/index.tsx` (placeholder).
- **NO existe** `routes/_authenticated/cxp.tsx` (layout con Header + Outlet).
- **NO existe** carpeta `frontend/src/features/cxp/`.
- **NO existen** rutas hijas `routes/_authenticated/cxp/<vista>.tsx`.
- Sidebar (`components/layout/data/sidebar-data.ts`): "Cuentas por Pagar" figura como NavLink simple a `/cxp` (no NavCollapsible).
- No hay metodos CxP en `lib/regal-general-api.ts` (sin endpoints expuestos al frontend).

### 1.2 Backend (clon)

Estado: **PARCIAL**.

Archivos confirmados en VM 10.0.0.99 (vivienda autoritativa segun brief MCP):

- `backend/apps/legacy/cxp_urls.py`
- `backend/apps/legacy/cxp_views.py`
- `backend/apps/legacy/repositories/cxp_repo.py`

Endpoints existentes (montados bajo `/api/cxp/` via include en `facturation_api/urls.py` — confirmar prefijo):

| Endpoint | Repo metodo (esperado) | Observacion |
|---|---|---|
| `cxp_proveedores` (GET, listado) | `list_proveedores(no_cia, punto, q?)` | Filtro busqueda/pagina |
| `cxp_proveedor(<no>)` (GET) | `get_proveedor(no_proveedor)` | Detalle |
| `cxp_proveedor_cuenta` (GET/POST?) | `get/set_cuenta_bco_proveedor` | Cuenta bancaria del proveedor |
| `cxp_cuentas_proveedor` (GET) | `list_cuentas_proveedor(no_proveedor)` | Multiples cuentas bcarias |
| `cxp_movimientos_proveedor` (GET) | `list_movimientos(no_proveedor, fecha_ini, fecha_fin)` | Movimientos por proveedor |
| `cxp_documentos` (GET) | `list_documentos(no_cia, punto, filtros)` | Lista de documentos DR/CR |
| `cxp_documento(no_cia,punto,tipo,no)` (GET) | `get_documento(...)` | Detalle de documento |
| `cxp_aging` (GET) | `aging(no_cia, punto, fecha_corte, ...)` | Antiguedad de saldos |
| `cxp_tipos_docu` (GET) | `list_tipos_docu()` | Catalogo TCXP_TDOCU |

### 1.3 Bugs conocidos / deuda tecnica

- Sidebar deja CxP como link plano (no anidado por secciones).
- `routes/_authenticated/cxp/index.tsx` muestra texto stub; debe redirigir a la primera vista real una vez exista (`/cxp/proveedores`).
- Backend usa convencion `cxp_<vista>` (no `cxp_<vista>_view`) — confirmar al imitar patron para crear los nuevos endpoints.

---

## 2. Gap con el legacy (45 forms / 30 reports)

### 2.1 Menu legacy mapeado desde capturas

Capturas usadas: `Screenshot 2026-05-20 092300.png` (Configuracion), `092306.png` (Procesos), `092312.png` (Consultas), `092317.png` (Reportes), `092323.png` (Cierre). Estructura del `Fmenu_cxp`:

**Configuracion** (10 opciones)
1. Companias (`Fcxp101.fmx` — TCXP_CIAS)
2. Puntos de Trabajo o Sucursales (`Fcxp102.fmx` — TCXP_PUNTO)
3. Acceso de Usuarios al Modulo (`Fcxp103.fmx` — TCXP_USUARIO/TCXP_USUARIOD)
4. Tipos de Proveedores (`Fcxp105.fmx` — TCXP_TPROVEEDOR)
5. Tipos de Documento (`Fcxp104.fmx` — TCXP_TDOCU)
6. Ciudades (`Fcxc111.fmx` — TCXC_CIUDAD, compartida con CxC)
7. Sectores o Barrios (`Fcxc112.fmx` — TCXC_BARRIO, compartida con CxC)
8. Proveedores (`Fcxp106.fmx` — TCXP_DPROVEEDOR/TCXP_BPROVEEDOR)
9. Asignar Proveedores a Sucursales (`Fcxp107.fmx` — TCXP_BPROVEEDOR)
10. Asignar/Cambiar Cuenta Bancaria (`Fcxp110.fmx` — TCXP_CUENTA_BCO_PROVEEDOR)
11. Tipos Costos y Gastos Definidos por DGII (`Fcxp108.fmx` — TCXP_TCOSTO_GASTO)

**Procesos** (12 opciones)
1. Entrada de Documentos DR/CR (`Fcxp201.fmx` — TCXP_DOCUMENTO + TCXP_DCDOCU + TCXP_REFEDOCU + TCNT_HNCF)
2. Listado de Documentos por Proveedor (`Fcxp205.fmx` reimpresion/listado)
3. Listado de Doc. Por Documento (variante listado)
4. Listado de Docus. Con Detalle Contable (variante listado)
5. Impresion/Reimpresion de Documentos Dr/Cr (`Fcxp212.fmx` — impresion AC/AD/BD/FP)
6. Aplicacion de Movs. con Saldo a Favor (`Fcxp206.fmx` — TCXP_REFEDOCU)
7. Reversar Documento (`Fcxp211.fmx` / variante anular)
8. Saldos Menores x Ajustar (`Fcxp202.fmx` generar + `Fcxp204.fmx` aplicar)
9. Generar Solicitud de Pago A Cheque (`Fcxp209.fmx` + `Fcxp207.fmx` procesar + `Fcxp208.fmx` mantenimiento + `Fcxp210.fmx`/`Fcxp211.fmx`)
10. Corregir NCF (vista de mantenimiento de NCF en documento)
11. Liberar Debito (`Fcxp213.fmx` — TCXP_LIBERA_DEBITO_AUDI)
12. Bloquear/Desbloquear Pago a Factura (`Fcxp214.fmx` — TCXP_BLOQUEO_PAGO_AUDI)

**Consultas** (3 opciones)
1. Consulta de Documentos (`Fcxp501.fmx`)
2. Consulta de Cuentas Por Pagar (`Fcxp502.fmx`)
3. Consulta Movimientos de Proveedores (`Fcxp503.fmx`)

**Reportes** (8 opciones)
1. Alfabetico de Proveedores (Rcxp302.rep — listado catalogo)
2. Analisis Antiguedad de Saldos (`Fcxp310.fmx` -> `Rcxp308.rep` / `Rcxp310.rep`)
3. Movimientos de Proveedores (`Rcxp503.rep`)
4. Mayor Auxiliar Cuentas Por Pagar (`Fcxp301.fmx` -> `Rcxp311.rep`)
5. ITBIS en Compras Locales Formato 606 (`Fcxp307.fmx` + `Fcxp308.fmx` -> `Rcxp306.rep`/606 .txt) — DGII RD
6. Reporte de Cuadre Contable (cuadre TCXP_DOCUMENTO vs TCNT_AUXILIAR)
7. Enviar Documentos a Excel (export tabular del listado)
8. Certificado Retencion Proveedores (`Fcxp309.fmx`)

**Cierre** (3 opciones)
1. Imprimir Asiento Contable (`Fcxp401.fmx` — TCXP_ED)
2. Generar Asiento a Contabilidad (`Fcxp402.fmx` — TCXP_ED -> TCNT_*)
3. Cierre Mensual (`Fcxp403.fmx` — TCXP_PUNTO ANO/MES_PROCESO)

**Acceso** (utilitario)
- Acceso al Sistema (`Fcxp601.fmx`) — set NO_CIA/PUNTO activo.

Tres archivos .txt presentes (`archivo_606_*.txt`, `archivo_607_*.txt`, `archivo_623.txt`) confirman que el legacy genera ademas de PDF un archivo plano DGII RD:
- **606** — Compras de bienes y servicios (proveedores) — origen: TCXP_DOCUMENTO + TCNT_HNCF + retenciones.
- **607** — Ventas de bienes y servicios. Aparece tambien en capturas de CxP por la ubicacion de archivos; el origen funcional pertenece a CxC/FAT, pero el clon CxP debe **al menos** exportar el formato 606 + 623 reales. (607 se descarta del scope CxP — pertenece a FAT/CxC.)
- **623** — Retenciones del Estado (ISR/ITBIS) — origen: TCXP_DOCUMENTO con retenciones aplicadas.

PDFs de impresion vistos (`impresion_doc_*.pdf`): AC=Ajuste Credito, AD=Ajuste Debito, BD=Balance Debito, FP=Factura de Proveedores. Plus `reporte_por_doc_cxp.pdf`. Son **4 layouts de impresion de comprobante** que debe replicar la impresion/reimpresion del proceso 5.

### 2.2 Opciones legacy NO implementadas (gap completo frontend)

**Todo el modulo.** Frontend = 0 vistas reales. Estimacion ~25-28 vistas mapeo 1:1 con el menu anterior.

### 2.3 Reportes legacy NO implementados

**Todos los 10 reportes** del modulo (`Rcxp201/202/204/205/208/306/308/310/311/503`) faltan; mas archivos planos 606 y 623.

### 2.4 Reglas DGI / contables que faltan

- Composicion de NCF DGI real: legacy almacena `POSICIONES_FIJAS_NCF` + `LPAD(NCF,8,'0')`. **Reutilizar** helper `fat_repo._compose_ncf_dgi` (NO releer columnas legacy/vacias).
- Tipos de retencion DGII (`TCXP_TIPO_RETENCION_DGII`) y formas de pago DGII (`TCXP_FORMA_PAGO_DGII`) son catalogos referenciados — exponer lookups.
- Tipos de costos/gastos DGII (`TCXP_TCOSTO_GASTO`) son obligatorios para el 606.
- Auditoria de bloqueo/desbloqueo de pago: `TCXP_BLOQUEO_PAGO_AUDI` (insert con motivo, usuario, fecha).
- Auditoria de liberacion de debito: `TCXP_LIBERA_DEBITO_AUDI`.
- Auditoria de cambio de cuenta bancaria del proveedor: `TCXP_AUDITORIA_CUENTA_BCO`.

---

## 3. Trabajo a realizar

### 3.1 Frontend — Layout, rutas y vistas espejo de CxC

#### 3.1.1 Layout y skeleton

- Crear `routes/_authenticated/cxp.tsx` (layout) con `Header` + `<Main fluid>` + `<Outlet/>`. Patron literal de `routes/_authenticated/cxc.tsx`.
- `routes/_authenticated/cxp/index.tsx` deja de ser stub y redirige a `/cxp/proveedores`.
- Convertir el item del sidebar (`components/layout/data/sidebar-data.ts`) de `NavLink` a `NavCollapsible` con 5 subgrupos: Configuracion, Procesos, Consultas, Reportes, Cierre.
- Crear carpeta `features/cxp/` con `index.ts` que reexporta los componentes (mismo patron CxC).

#### 3.1.2 Vistas espejo (~25 vistas — lista exacta)

Para cada vista: `routes/_authenticated/cxp/<vista>.tsx` (1 archivo, define ruta + importa componente) + `features/cxp/cxp-<vista>.tsx` (componente que recibe `noCia/punto` via `useCompany()`). Cada componente usa `useQuery`/`useMutation` con `request<T>` de `lib/regal-general-api.ts` (NO el `instance` axios).

**Configuracion (10 vistas)**
1. `cxp/companias` -> `cxp-companias.tsx`
2. `cxp/puntos-trabajo` -> `cxp-puntos-trabajo.tsx`
3. `cxp/acceso-usuarios` -> `cxp-acceso-usuarios.tsx`
4. `cxp/tipos-proveedor` -> `cxp-tipos-proveedor.tsx`
5. `cxp/tipos-documento` -> `cxp-tipos-documento.tsx`
6. `cxp/ciudades` -> reutiliza componente CxC (`features/cxc/cxc-ciudades.tsx`) en wrapper CxP, NO duplica logica.
7. `cxp/barrios` -> idem, reusa `cxc-barrios.tsx`.
8. `cxp/proveedores` -> `cxp-proveedores.tsx` (vista por defecto del modulo).
9. `cxp/asignar-proveedores` -> `cxp-asignar-proveedores.tsx`.
10. `cxp/cuentas-bancarias` -> `cxp-cuentas-bancarias.tsx`.
11. `cxp/tipos-costos-gastos` -> `cxp-tipos-costos-gastos.tsx`.

**Procesos (8 vistas — algunas son acciones dentro de la misma vista)**
12. `cxp/documentos` -> `cxp-documentos.tsx` (entrada DR/CR + listado).
13. `cxp/documentos/$tipo/$no` -> `cxp-documento-detalle.tsx` (detalle / edicion).
14. `cxp/aplicacion-saldos` -> `cxp-aplicacion-saldos.tsx`.
15. `cxp/reversar-documento` -> `cxp-reversar-documento.tsx`.
16. `cxp/saldos-menores` -> `cxp-saldos-menores.tsx` (generar + aplicar en tabs).
17. `cxp/solicitud-pago` -> `cxp-solicitud-pago.tsx` (Fcxp209 + Fcxp207 procesar).
18. `cxp/corregir-ncf` -> `cxp-corregir-ncf.tsx`.
19. `cxp/liberar-debito` -> `cxp-liberar-debito.tsx`.
20. `cxp/bloqueo-pago` -> `cxp-bloqueo-pago.tsx`.

**Consultas (3 vistas)**
21. `cxp/consulta-documentos` -> `cxp-consulta-documentos.tsx`.
22. `cxp/consulta-cuentas` -> `cxp-consulta-cuentas.tsx`.
23. `cxp/consulta-movimientos` -> `cxp-consulta-movimientos.tsx`.

**Reportes (1 vista hub + sub-rutas o tabs por reporte — 7 reportes)**
24. `cxp/reportes` -> `cxp-reportes.tsx` (hub con sidebar de reportes; cada reporte abre el form de filtros y muestra el PDF preview/descarga).

**Cierre (1 vista con 3 tabs)**
25. `cxp/cierre` -> `cxp-cierre.tsx` (tabs: Imprimir Asiento / Generar Asiento / Cierre Mensual).

Total: ~25 vistas reales + 1 layout + 1 index redirector.

#### 3.1.3 Metodos en `lib/regal-general-api.ts`

Para cada endpoint backend, agregar metodo tipado:
```
listProveedoresCxp, getProveedorCxp, createProveedorCxp, updateProveedorCxp,
listCuentasProveedorCxp, asignarCuentaBancariaCxp,
listMovimientosProveedorCxp, listDocumentosCxp, getDocumentoCxp,
createDocumentoCxp, anularDocumentoCxp, aplicarSaldosCxp,
listTiposDocuCxp, listTiposProveedorCxp, listTiposCostoGastoCxp,
listFormasPagoDgiiCxp, listTiposRetencionDgiiCxp,
generarSaldosMenoresCxp, aplicarSaldosMenoresCxp,
generarSolicitudPagoCxp, procesarSolicitudPagoCxp,
liberarDebitoCxp, bloquearPagoCxp, desbloquearPagoCxp,
agingCxp, consultaCuentasCxp, consultaMovimientosCxp,
reporte606Cxp, reporte623Cxp, reporteAntiguedadCxp,
reporteMovimientosCxp, reporteMayorAuxiliarCxp,
reporteCuadreContableCxp, certificadoRetencionCxp,
imprimirAsientoCxp, generarAsientoCxp, cierreMensualCxp,
pdfDocumentoCxp (AC|AD|BD|FP).
```

### 3.2 Backend — completar lo que falta

Patron: `apps/legacy/cxp_views.py` (CBV `View` con `JsonResponse`, `@csrf_exempt`), urls en `apps/legacy/cxp_urls.py`, logica en `apps/legacy/repositories/cxp_repo.py`. Antes de cualquier query nueva: verificar columnas/PK con `all_tab_columns` contra Oracle.

#### 3.2.1 Catalogos de configuracion (faltan)

- `GET/POST/PUT cxp/tipos-proveedor` (TCXP_TPROVEEDOR, valida cuenta contable existe en TCNT_CATALOGO).
- `GET cxp/tipos-documento` ya existe parcial; agregar `POST/PUT` (TCXP_TDOCU).
- `GET cxp/tipos-costos-gastos` (TCXP_TCOSTO_GASTO).
- `GET cxp/formas-pago-dgii` (TCXP_FORMA_PAGO_DGII — lookup).
- `GET cxp/tipos-retencion-dgii` (TCXP_TIPO_RETENCION_DGII — lookup).
- `POST cxp/proveedores` (alta) y `PUT cxp/proveedores/<no>` (edicion) — TCXP_DPROVEEDOR + TCXP_BPROVEEDOR.
- `POST cxp/proveedor-asignar-sucursal` (TCXP_BPROVEEDOR per (no_cia,punto)).
- `POST cxp/cuenta-bancaria-proveedor` + `PUT` (TCXP_CUENTA_BCO_PROVEEDOR + audit TCXP_AUDITORIA_CUENTA_BCO).
- `GET/POST cxp/companias` (TCXP_CIAS).
- `GET/POST cxp/puntos-trabajo` (TCXP_PUNTO).
- `GET/POST cxp/acceso-usuarios` (TCXP_USUARIO + TCXP_USUARIOD).

#### 3.2.2 Procesos / Pagos

- `POST cxp/documentos` (entrada DR/CR): inserta TCXP_DOCUMENTO + TCXP_DCDOCU + (opcional) TCXP_REFEDOCU + TCNT_HNCF (consume NCF). Usar secuencia TCXP_SECUENCIA con `FOR UPDATE OF ULT_DOCU`. Validar permisos `TCXP_USUARIOD`.
- `POST cxp/documentos/<...>/anular` (reversar): valida que no este aplicado, marca anulado, libera saldos relacionados.
- `POST cxp/aplicacion-saldos`: TCXP_REFEDOCU insert + actualizacion de saldos.
- `POST cxp/saldos-menores/generar` (TCXP_AJUSTAR delete+insert).
- `POST cxp/saldos-menores/aplicar` (consume TCXP_AJUSTAR, insert TCXP_DOCUMENTO ajuste, TCNT_BCENTRO_COSTO update).
- `POST cxp/solicitud-pago` (TCXP_SOLICITUD + TCHC_CHEQUE en estado pre-emision).
- `POST cxp/solicitud-pago/procesar` (procesa solicitud -> cheque definitivo TCHC_*).
- `POST cxp/corregir-ncf` (UPDATE TCXP_DOCUMENTO.POSICIONES_FIJAS_NCF/NCF + TCNT_HNCF audit).
- `POST cxp/liberar-debito` (DELETE TCXP_REFEDOCU + UPDATE saldos + INSERT TCXP_LIBERA_DEBITO_AUDI).
- `POST cxp/bloqueo-pago` (UPDATE TCXP_DOCUMENTO.PAGO_BLOQUEADO + INSERT TCXP_BLOQUEO_PAGO_AUDI).

#### 3.2.3 Cierre

- `GET cxp/cierre/preview` (lista documentos pendientes de generar asiento).
- `POST cxp/cierre/imprimir-asiento` (genera TCXP_ED + PDF asiento).
- `POST cxp/cierre/generar-asiento` (mueve TCXP_ED -> TCNT_HASIENTO / detalle CNT; marca ST_GENERADO_CNT='S').
- `POST cxp/cierre/mensual` (avanza ANO/MES_PROCESO en TCXP_PUNTO; valida TCXP_DOCUMENTO sin pendientes; TCHC_CHEQUE liquidados).

### 3.3 Reportes PDF (objetivo: 10 + 2 planos)

Todos via `apps/legacy/pdf_helpers.py:build_pdf_report` (header + body + footer estandar §5 meta-spec). Endpoint patron `/api/cxp/.../pdf/`.

| # | Reporte | Legacy | Endpoint clon |
|---|---|---|---|
| 1 | Alfabetico de Proveedores | Rcxp302.rep | `GET /api/cxp/reportes/proveedores/pdf/` |
| 2 | Analisis Antiguedad de Saldos | Rcxp308.rep / Rcxp310.rep | `GET /api/cxp/reportes/aging/pdf/` |
| 3 | Movimientos de Proveedores | Rcxp503.rep | `GET /api/cxp/reportes/movimientos/pdf/` |
| 4 | Mayor Auxiliar | Rcxp311.rep | `GET /api/cxp/reportes/mayor-auxiliar/pdf/` |
| 5 | ITBIS Compras 606 (PDF) | Rcxp306.rep | `GET /api/cxp/reportes/606/pdf/` |
| 6 | ITBIS Compras 606 (TXT plano DGII) | archivo_606_YYYYMM.txt | `GET /api/cxp/reportes/606/txt/` |
| 7 | Retenciones del Estado 623 (TXT) | archivo_623.txt | `GET /api/cxp/reportes/623/txt/` |
| 8 | Cuadre Contable | (Rcxp...) | `GET /api/cxp/reportes/cuadre-contable/pdf/` |
| 9 | Certificado Retencion Proveedores | Fcxp309 -> rep | `GET /api/cxp/reportes/certificado-retencion/pdf/` |
| 10 | Listado Saldos Menores | Rcxp201/202/204 | `GET /api/cxp/reportes/saldos-menores/pdf/` |
| 11 | Listado Documentos por Proveedor | Rcxp205/208 | `GET /api/cxp/reportes/documentos-proveedor/pdf/` |
| 12 | Excel de Documentos | (export) | `GET /api/cxp/documentos/export/xlsx/` |

### 3.4 Impresiones de comprobante (4 layouts AC/AD/BD/FP)

Endpoint comun: `GET /api/cxp/documentos/<no_cia>/<punto>/<tipo>/<no>/pdf/`. El layout cambia segun `TCXP_TDOCU.TIPO_TRANSACCION`:

- **FP** Factura Proveedores (TIPO_TRANSACCION='F'): cabecera con razon social, NCF DGI, proveedor, items (`TCXP_DCDOCU`), ITBIS, retenciones, total. Espejo de `impresion_doc_FP_FACTURA_PROVEDORES.pdf`.
- **AC** Ajuste Credito (TIPO_TRANSACCION='C'): nota de credito al proveedor.
- **AD** Ajuste Debito (TIPO_TRANSACCION='D'): nota de debito al proveedor.
- **BD** Balance Debito: balance/estado de cuenta del documento.

PDF helper de chasis: extender `build_pdf_report` con `kind='cxp_comprobante'`.

### 3.5 Bugs a corregir (al final del modulo)

- Sidebar deja CxP como link plano -> convertir a NavCollapsible.
- `routes/_authenticated/cxp/index.tsx` stub -> redirect a `/cxp/proveedores`.
- Validar prefijo `/api/cxp/` realmente registrado en `facturation_api/urls.py` (issue del brief).

---

## 4. Flujos E2E criticos (5)

1. **Alta de proveedor**: Configuracion -> Proveedores -> Nuevo -> llenar (RNC, razon social, tipo proveedor, ciudad, barrio, cuenta contable derivada del tipo) -> Guardar. Validar INSERT en TCXP_DPROVEEDOR + TCXP_BPROVEEDOR + audit. Reuso del proveedor en pantalla de documento.
2. **Registrar factura de proveedor (FP)**: Procesos -> Documentos DR/CR -> tipo factura -> selecciona proveedor -> ingresa NCF B11 (compra), detalle items (TCXP_DCDOCU), ITBIS, retenciones. Verificar:
   - INSERT TCXP_DOCUMENTO con `POSICIONES_FIJAS_NCF` + `NCF`.
   - INSERT TCNT_HNCF (auditoria de NCF consumido).
   - Saldo del proveedor (TCXP_BPROVEEDOR) actualizado.
   - PDF impresion FP generado.
3. **Aplicacion de pago**: Procesos -> Aplicacion de Movs con Saldo a Favor -> selecciona nota credito + factura destino -> aplica monto. Verificar INSERT TCXP_REFEDOCU + UPDATE saldos en TCXP_DOCUMENTO. Reversion via Liberar Debito.
4. **Reporte 606 mensual**: Reportes -> ITBIS 606 -> filtra periodo YYYYMM -> genera PDF + TXT plano DGII. Comparar TXT clon vs `archivo_606_202505.txt` legacy: mismas filas, mismos totales, mismo formato fijo de columnas DGII.
5. **Cierre mensual**: Cierre -> Imprimir Asiento (preview) -> Generar Asiento a Contabilidad (TCXP_ED -> TCNT) -> Cierre Mensual (avanza mes). Validar:
   - TCXP_DOCUMENTO sin pendientes (`ST_GENERADO_CNT='S'`).
   - TCHC_CHEQUE liquidados.
   - TCXP_PUNTO.MES_PROCESO avanzado en +1 (rollover de ano si mes=12).
   - Asientos en TCNT_HASIENTO con `ORIGEN='CXP'`.

---

## 5. Queries a reconciliar con legacy

| Query (clon) | Reporte legacy | Verificacion |
|---|---|---|
| `aging(no_cia, punto, fecha_corte)` | `Rcxp308.rep` | Antiguedad por rangos 0-30/31-60/61-90/>90. Saldo total = SUM(SALDO) en TCXP_DOCUMENTO filtrado. |
| `list_movimientos_proveedor(no_proveedor, fecha_ini, fecha_fin)` | `Rcxp503.rep` | Conteo y totales por TIPO_MOVI ('D'/'C'). |
| `reporte_606(no_cia, punto, ano, mes)` | `Rcxp306.rep` + archivo_606_YYYYMM.txt | Filas idénticas con `TCXP_DOCUMENTO` JOIN `TCXP_REFEDOCU` JOIN `TCNT_POSICIONES_FIJAS_NCF`; columnas fijas DGII (RNC, NCF, fecha, monto, ITBIS, retencion). |
| `reporte_623(no_cia, punto, ano, mes)` | `archivo_623.txt` | Retenciones del Estado por proveedor. |
| `mayor_auxiliar(cuenta, ano, mes)` | `Rcxp311.rep` | Movimientos contables por cuenta TCNT_CATALOGO via TCXP_DOCUMENTO. |
| `cuadre_contable(no_cia, punto, periodo)` | (interno) | Suma saldos TCXP_BPROVEEDOR = saldo cuenta contable TCNT_BCUENTA. Diferencia=0.00. |
| `libro_compras` (interno helper para 606) | (libro) | Compras del mes filtradas por TIPO_TRANSACCION IN ('F','C','D'). |

Procedimiento §6 meta-spec: ejecutar ambas queries (clon vs legacy) en SQL Developer contra mismo Oracle 11g, comparar conteo+suma+muestra. Evidencia en PR.

---

## 6. Opciones legacy descartadas con justificacion

| Opcion | Justificacion |
|---|---|
| **Enviar Documentos a Excel** (Reportes) | Se cubre con `GET /api/cxp/documentos/export/xlsx/` desde la vista de Consulta de Documentos (boton "Exportar"); no merece pantalla independiente. |
| **Reporte 607 (Ventas)** | NO pertenece a CxP — es de FAT/CxC. Aunque hay `archivo_607_*.txt` en la carpeta de capturas, el origen funcional es ventas, no compras. Descartado del scope CxP. |
| **Sigaf / Window** (items legacy del menu) | Menus Forms6i nativos sin equivalente web; descartados del clon. |
| **Acceso submenu** | El switching de NO_CIA/PUNTO ya esta resuelto en el clon via `useCompany()` global; no se replica el form Fcxp601. |
| **Listado de Doc. por Documento / Listado con Detalle Contable** | Se unifican en la vista `cxp-documentos` con filtros (proveedor/documento/detalle contable). No requieren pantallas separadas. |

---

## 7. Estimacion

- **Vistas frontend:** 25 vistas + 1 layout + 1 redirect index.
- **Endpoints backend nuevos:** ~30 (catalogos config 11 + procesos 10 + reportes/cierre 9).
- **Reportes PDF:** 10 PDFs + 2 archivos planos DGII (606/623) + 4 layouts impresion comprobante (AC/AD/BD/FP).
- **Tareas atomicas en el plan:** ~55-60 (≥40 requerido por meta-spec; ver `2026-05-30-cxp-construir-modulo.md`).
- **Esfuerzo agregado:** este es el spec mas grande del lote — modulo construido casi desde cero. Estimar 50-70 horas de implementacion + 10 horas de reconciliacion + Playwright.

---

## 8. Memorias relacionadas

- `cxp/handoff-build-frontend` (MCP) — brief explicito de construccion.
- `cxc-cxp/estado-2026-05-27` (MCP) — patron CxC a clonar.
- `project-sigaft-ncf-schema` (local) — composicion NCF DGI.
- `feedback-facturas-dgi` (local) — reglas DGII NCF/RNC.
- `sigaft/module-memory-20260530-final/cuentas_por_pagar/part-*` (MCP) — memoria tecnica chunked.
- Skill agent: `oracle-sigaf-erp` — usar para subtareas de queries Oracle.
