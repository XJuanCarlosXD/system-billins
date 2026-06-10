# Plan de ejecucion CxP (Cuentas por Pagar)

- **Fecha:** 2026-05-30
- **Spec:** `specs/2026-05-30-cxp-construir-modulo-design.md`
- **Meta-spec:** `specs/2026-05-30-sigaft-meta-validacion-modulos-design.md`
- **Modulo plantilla a clonar:** CxC (`features/cxc/` y `routes/_authenticated/cxc/` en la VM).
- **Working dir VM:** `facturation-system/` en `jcabreu@10.0.0.99` (deploy via pscp; backend con auto-reload).

Convenciones:
- Cada tarea es atomica (2-5 min) y observable.
- Tras cada tarea editar/agregar archivo en local, validar (`python -c "import ast; ast.parse(...)"` o `pnpm typecheck`), y subir via pscp.
- `[B]` = backend, `[F]` = frontend, `[Q]` = QA/E2E.

---

## Fase 0 — Preparacion (5 tareas)

- [ ] **0.1 [B]** `cat` en VM `apps/legacy/cxp_urls.py` y volcar la lista exacta de URLs registradas en `notes/cxp-backend-endpoints-inventory.md` (local).
- [ ] **0.2 [B]** `cat` en VM `apps/legacy/cxp_views.py` + `repositories/cxp_repo.py`; mapear funciones existentes a la tabla §1.2 del spec; anotar firmas reales.
- [ ] **0.3 [B]** Verificar en `facturation_api/urls.py` que `path('api/cxp/', include('apps.legacy.cxp_urls'))` (o equivalente) este montado. Si no, agregarlo.
- [ ] **0.4 [F]** `ls` en VM `frontend/src/features/cxc/` y `frontend/src/routes/_authenticated/cxc/` para tener inventario de archivos plantilla.
- [ ] **0.5 [F]** Bajar copia local de `routes/_authenticated/cxc.tsx`, `routes/_authenticated/cxc/index.tsx` y un componente representativo (`features/cxc/cxc-clientes.tsx`) como referencia visual.

## Fase 1 — Layout, routing y sidebar (6 tareas)

- [ ] **1.1 [F]** Crear `routes/_authenticated/cxp.tsx` clon literal del layout CxC (Header + `<Main fluid>` + `<Outlet/>`).
- [ ] **1.2 [F]** Reemplazar `routes/_authenticated/cxp/index.tsx` por un componente que use `Navigate` a `/cxp/proveedores`.
- [ ] **1.3 [F]** Crear carpeta `features/cxp/` con `index.ts` (placeholder de reexports).
- [ ] **1.4 [F]** Editar `components/layout/data/sidebar-data.ts`: cambiar item "Cuentas por Pagar" de `NavLink` a `NavCollapsible` con 5 grupos vacios (Configuracion / Procesos / Consultas / Reportes / Cierre).
- [ ] **1.5 [F]** Agregar al sidebar los enlaces del grupo Configuracion (11 items) apuntando a rutas aun-no-existentes (pasaran a 404 hasta crearlas — visible).
- [ ] **1.6 [F]** `pnpm typecheck` + smoke browser: abrir `/cxp`, redirige; sidebar muestra grupo CxP anidado.

## Fase 2 — Catalogos de Configuracion: backend + frontend (16 tareas)

### 2A. Catalogos lookup (solo GET, dropdowns)

- [ ] **2.1 [B]** `repositories/cxp_repo.py`: agregar `list_tipos_proveedor()`, `list_tipos_costo_gasto()`, `list_formas_pago_dgii()`, `list_tipos_retencion_dgii()`.
- [ ] **2.2 [B]** `cxp_views.py` + `cxp_urls.py`: exponer `GET /api/cxp/lookups/tipos-proveedor/`, `tipos-costo-gasto/`, `formas-pago-dgii/`, `tipos-retencion-dgii/`.
- [ ] **2.3 [F]** Agregar metodos `listTiposProveedorCxp`, `listTiposCostoGastoCxp`, `listFormasPagoDgiiCxp`, `listTiposRetencionDgiiCxp` en `lib/regal-general-api.ts`.

### 2B. CRUD Proveedores (vista principal)

- [ ] **2.4 [B]** `cxp_repo.list_proveedores`: confirmar firma actual; si no soporta `q`/`activo`/paginacion, agregar.
- [ ] **2.5 [B]** `cxp_repo.create_proveedor(payload)` y `update_proveedor(no, payload)` con INSERT TCXP_DPROVEEDOR + INSERT TCXP_BPROVEEDOR para la sucursal activa.
- [ ] **2.6 [B]** Exponer `POST /api/cxp/proveedores/` y `PUT /api/cxp/proveedores/<no>/`.
- [ ] **2.7 [F]** `features/cxp/cxp-proveedores.tsx`: tabla + filtros + boton Nuevo + Sheet de edicion. Espejo de `cxc-clientes.tsx`. Usar `useQuery` con `staleTime: 1000*60*5`.
- [ ] **2.8 [F]** `routes/_authenticated/cxp/proveedores.tsx`: monta `CxpProveedores` con `noCia/punto` de `useCompany()`.

### 2C. Catalogos CRUD restantes

- [ ] **2.9 [F+B]** Tipos de Documento: backend `POST/PUT /api/cxp/tipos-documento/`; frontend `cxp-tipos-documento.tsx` + ruta.
- [ ] **2.10 [F+B]** Tipos de Proveedor: backend `POST/PUT /api/cxp/tipos-proveedor/`; frontend `cxp-tipos-proveedor.tsx` + ruta.
- [ ] **2.11 [F+B]** Tipos de Costos/Gastos DGII: `cxp-tipos-costos-gastos.tsx` + ruta + endpoints.
- [ ] **2.12 [F+B]** Companias (TCXP_CIAS): `cxp-companias.tsx` + ruta + endpoints.
- [ ] **2.13 [F+B]** Puntos de Trabajo (TCXP_PUNTO): `cxp-puntos-trabajo.tsx` + ruta + endpoints.
- [ ] **2.14 [F+B]** Acceso de Usuarios al Modulo (TCXP_USUARIO + TCXP_USUARIOD): `cxp-acceso-usuarios.tsx` + ruta + endpoints (READ + UPSERT toggle activo / por defecto).
- [ ] **2.15 [F+B]** Asignar Proveedores a Sucursales (TCXP_BPROVEEDOR): `cxp-asignar-proveedores.tsx` + endpoint.
- [ ] **2.16 [F+B]** Cuentas Bancarias Proveedor (TCXP_CUENTA_BCO_PROVEEDOR + audit TCXP_AUDITORIA_CUENTA_BCO): `cxp-cuentas-bancarias.tsx` + endpoints.
- [ ] **2.17 [F]** Wrappers `cxp-ciudades.tsx` y `cxp-barrios.tsx` que reusan `CxcCiudades`/`CxcBarrios` (NO duplicar logica; pasar prop `module="cxp"` si fuera necesario, sino reuso puro).

## Fase 3 — Procesos / Pagos: backend + frontend (18 tareas)

### 3A. Documentos (entrada DR/CR)

- [ ] **3.1 [B]** `cxp_repo.create_documento(payload)`: secuencia TCXP_SECUENCIA `FOR UPDATE`; INSERT TCXP_DOCUMENTO; INSERT TCXP_DCDOCU (lineas); si tiene NCF, consumir TCNT_NCF (UPDATE PROX_NCF) + INSERT TCNT_HNCF; validar permisos TCXP_USUARIOD.
- [ ] **3.2 [B]** `cxp_repo.update_documento` (edicion limitada antes de generar contabilidad).
- [ ] **3.3 [B]** `cxp_repo.anular_documento(no_cia,punto,tipo,no)`: marca anulado + revierte saldos relacionados; falla si tiene refedocu aplicado.
- [ ] **3.4 [B]** Endpoints: `POST /api/cxp/documentos/`, `PUT /api/cxp/documentos/<...>/`, `POST /api/cxp/documentos/<...>/anular/`.
- [ ] **3.5 [F]** `cxp-documentos.tsx`: tabla con filtros (proveedor, tipo doc, rango fecha, estado), boton Nuevo (abre Sheet con form completo), boton Anular en fila.
- [ ] **3.6 [F]** `cxp-documento-detalle.tsx` (ruta `cxp/documentos/$tipo/$no`): vista de detalle full + boton Imprimir (PDF AC/AD/BD/FP).

### 3B. Aplicacion de saldos / Reversar / Liberar / Bloquear

- [ ] **3.7 [B]** `cxp_repo.aplicar_saldo(payload)`: INSERT TCXP_REFEDOCU + UPDATE TCXP_DOCUMENTO.SALDO en ambos documentos.
- [ ] **3.8 [F+B]** `cxp-aplicacion-saldos.tsx` + endpoint `POST /api/cxp/aplicacion-saldos/`.
- [ ] **3.9 [F+B]** `cxp-reversar-documento.tsx` + endpoint (usa `anular_documento` con motivo).
- [ ] **3.10 [B]** `cxp_repo.liberar_debito(payload)`: DELETE TCXP_REFEDOCU + UPDATE TCXP_DOCUMENTO.SALDO + INSERT TCXP_LIBERA_DEBITO_AUDI.
- [ ] **3.11 [F+B]** `cxp-liberar-debito.tsx` + endpoint `POST /api/cxp/liberar-debito/`.
- [ ] **3.12 [B]** `cxp_repo.bloquear_pago(no_cia,punto,tipo,no,bloquear,motivo)`: UPDATE TCXP_DOCUMENTO.PAGO_BLOQUEADO + INSERT TCXP_BLOQUEO_PAGO_AUDI.
- [ ] **3.13 [F+B]** `cxp-bloqueo-pago.tsx` + endpoints `POST /api/cxp/bloqueo-pago/` (toggle).

### 3C. Saldos menores

- [ ] **3.14 [B]** `cxp_repo.generar_saldos_menores(no_cia,punto,max_saldo,clase)`: DELETE+INSERT en TCXP_AJUSTAR.
- [ ] **3.15 [B]** `cxp_repo.aplicar_saldos_menores(no_cia,punto,clase)`: para cada fila de TCXP_AJUSTAR, INSERT TCXP_DOCUMENTO ajuste + secuencia + UPDATE TCNT_BCENTRO_COSTO.
- [ ] **3.16 [F+B]** `cxp-saldos-menores.tsx` (tabs Generar / Aplicar) + endpoints.

### 3D. Solicitud de pago / Cheques

- [ ] **3.17 [B]** `cxp_repo.generar_solicitud_pago(payload)` + `procesar_solicitud_pago(payload)` (interactua con TCHC_SECUENCIA, TCHC_CHEQUE, TCXP_SOLICITUD).
- [ ] **3.18 [F+B]** `cxp-solicitud-pago.tsx` + endpoints.

### 3E. NCF / DGII

- [ ] **3.19 [B]** `cxp_repo.corregir_ncf(no_cia,punto,tipo,no,nuevo_ncf)`: UPDATE TCXP_DOCUMENTO + audit en TCNT_HNCF (procedencia='C' correccion).
- [ ] **3.20 [F+B]** `cxp-corregir-ncf.tsx` + endpoint.

## Fase 4 — Consultas (4 tareas)

- [ ] **4.1 [F]** `cxp-consulta-documentos.tsx` (lee `cxp/documentos` con filtros avanzados; export Excel boton).
- [ ] **4.2 [F]** `cxp-consulta-cuentas.tsx` (lee `cxp/proveedores` + `cxp/aging` por proveedor).
- [ ] **4.3 [F]** `cxp-consulta-movimientos.tsx` (lee `cxp/movimientos-proveedor` con rangos).
- [ ] **4.4 [B]** `cxp_repo.export_documentos_xlsx(filtros)` + endpoint `GET /api/cxp/documentos/export/xlsx/`.

## Fase 5 — Reportes PDF + DGII (12 tareas)

- [ ] **5.1 [B]** Extender `apps/legacy/pdf_helpers.py` con perfil `cxp_report` (columnas variables).
- [ ] **5.2 [B]** Reporte Alfabetico de Proveedores: query + endpoint `GET /api/cxp/reportes/proveedores/pdf/`.
- [ ] **5.3 [B]** Reporte Antiguedad de Saldos: query (rangos 0-30/31-60/61-90/>90) + endpoint `GET /api/cxp/reportes/aging/pdf/`.
- [ ] **5.4 [B]** Reporte Movimientos de Proveedores: query + endpoint `GET /api/cxp/reportes/movimientos/pdf/`.
- [ ] **5.5 [B]** Reporte Mayor Auxiliar: query agrupada por cuenta TCNT_CATALOGO + endpoint `GET /api/cxp/reportes/mayor-auxiliar/pdf/`.
- [ ] **5.6 [B]** Reporte 606 (PDF): query TCXP_DOCUMENTO + TCNT_HNCF + retenciones + endpoint `GET /api/cxp/reportes/606/pdf/`.
- [ ] **5.7 [B]** Reporte 606 (archivo plano DGII): generador TXT con anchos fijos columnas DGII RD + endpoint `GET /api/cxp/reportes/606/txt/`. Comparar con `archivo_606_202505.txt` legacy.
- [ ] **5.8 [B]** Reporte 623 (Retenciones del Estado, TXT): generador + endpoint `GET /api/cxp/reportes/623/txt/`. Comparar con `archivo_623.txt`.
- [ ] **5.9 [B]** Reporte Cuadre Contable: diferencia TCXP_BPROVEEDOR.SALDO vs TCNT_BCUENTA.SALDO + endpoint.
- [ ] **5.10 [B]** Certificado de Retencion Proveedores: query por proveedor+periodo + endpoint `GET /api/cxp/reportes/certificado-retencion/pdf/`.
- [ ] **5.11 [B]** Reportes Saldos Menores y Documentos por Proveedor: query + endpoints.
- [ ] **5.12 [F]** `cxp-reportes.tsx`: hub con cards por reporte; cada card abre Sheet con filtros y dispara descarga del PDF/TXT (`window.open` o `download` blob).

## Fase 6 — Impresiones de Comprobante AC/AD/BD/FP (5 tareas)

- [ ] **6.1 [B]** `pdf_helpers`: agregar plantilla `cxp_comprobante` parametrizada por TIPO_TRANSACCION.
- [ ] **6.2 [B]** Endpoint `GET /api/cxp/documentos/<no_cia>/<punto>/<tipo>/<no>/pdf/?layout=FP|AC|AD|BD`. Determinar layout automaticamente desde TCXP_TDOCU si no se pasa.
- [ ] **6.3 [B]** Comparar PDF generado vs `impresion_doc_FP_FACTURA_PROVEDORES.pdf` (capturas): mismas etiquetas, NCF DGI, totales, retenciones.
- [ ] **6.4 [B]** Idem para `impresion_doc_AC`, `impresion_doc_AD`, `impresion_doc_BD`.
- [ ] **6.5 [F]** Boton "Imprimir" en `cxp-documento-detalle.tsx` -> abre el PDF en nueva pestana.

## Fase 7 — Cierre + Asiento Contable (6 tareas)

- [ ] **7.1 [B]** `cxp_repo.preview_asiento(no_cia,punto,ano,mes)`: SELECT desde TCXP_DOCUMENTO + TCXP_DCDOCU agrupado por cuenta/centro costo (espejo del SELECT de Fcxp401).
- [ ] **7.2 [B]** `cxp_repo.imprimir_asiento(...)`: ejecuta el preview y persiste en TCXP_ED (DELETE+INSERT). Genera PDF asiento.
- [ ] **7.3 [B]** `cxp_repo.generar_asiento_contabilidad(...)`: mueve TCXP_ED -> TCNT_HASIENTO/detalle; marca TCXP_DOCUMENTO.ST_GENERADO_CNT='S'. Transaccional.
- [ ] **7.4 [B]** `cxp_repo.cierre_mensual(no_cia,punto)`: valida TCXP_DOCUMENTO sin pendientes y TCHC_CHEQUE liquidados; avanza ANO/MES_PROCESO en TCXP_PUNTO; espeja avance en TCNT_PUNTO.
- [ ] **7.5 [B]** Endpoints: `GET /api/cxp/cierre/preview/`, `POST /api/cxp/cierre/imprimir-asiento/`, `POST /api/cxp/cierre/generar-asiento/`, `POST /api/cxp/cierre/mensual/`.
- [ ] **7.6 [F]** `cxp-cierre.tsx` con 3 tabs (Imprimir Asiento / Generar Asiento / Cierre Mensual) + confirmaciones explicitas con motivo (auditoria).

## Fase 8 — Reconciliacion SQL vs legacy (5 tareas — DoD §3.2)

- [ ] **8.1 [Q]** Aging: ejecutar query clon contra Oracle 11g; comparar contra ejecucion de `Rcxp308.rep` legacy para mismo periodo. Documentar screenshot lado-a-lado.
- [ ] **8.2 [Q]** 606 TXT: diff por linea del TXT clon vs `archivo_606_202505.txt` legacy. Tolerancia 0.
- [ ] **8.3 [Q]** Movimientos por proveedor: comparar Rcxp503.rep vs endpoint clon.
- [ ] **8.4 [Q]** Mayor Auxiliar: idem Rcxp311.rep.
- [ ] **8.5 [Q]** Cuadre contable: SUM(saldo TCXP_BPROVEEDOR) - SUM(saldo TCNT_BCUENTA proveedores) = 0.00.

## Fase 9 — Suite Playwright E2E (6 tareas — DoD §3.3)

- [ ] **9.1 [Q]** `frontend/e2e/cxp/proveedor-alta.spec.ts`: flujo alta proveedor.
- [ ] **9.2 [Q]** `frontend/e2e/cxp/registrar-factura.spec.ts`: flujo factura FP con NCF B11.
- [ ] **9.3 [Q]** `frontend/e2e/cxp/aplicar-pago.spec.ts`: aplicacion de movs con saldo a favor.
- [ ] **9.4 [Q]** `frontend/e2e/cxp/reporte-606.spec.ts`: generacion de 606 TXT + verificacion HTTP 200 + bytes > 0.
- [ ] **9.5 [Q]** `frontend/e2e/cxp/cierre-mensual.spec.ts`: cierre mensual happy path.
- [ ] **9.6 [Q]** Capturas Playwright en `backend/docs/captures/cxp/` para los 5 flujos.

## Fase 10 — Limpieza y cierre (6 tareas — DoD §3.4)

- [ ] **10.1** `grep -rE "TODO|FIXME|XXX" backend/apps/legacy/cxp_*.py backend/apps/legacy/repositories/cxp_repo.py frontend/src/features/cxp/ frontend/src/routes/_authenticated/cxp/` = 0 matches.
- [ ] **10.2** Validar NCF DGI: spot-check 10 documentos `TCXP_DOCUMENTO` con NCF; el endpoint `pdf/` muestra `POSICIONES_FIJAS_NCF || LPAD(NCF,8,'0')`, nunca el numero crudo.
- [ ] **10.3** Validar RNC: la pantalla `cxp-proveedores` bloquea guardar si `RNC` no es 9 u 11 digitos.
- [ ] **10.4** Validar razon social real (TCNT_CIAS.DESCRIPCION) en todos los PDF headers; sin "Empresa 01".
- [ ] **10.5** Borrar registros de prueba `ZZTEST*` insertados durante desarrollo (TCXP_DPROVEEDOR, TCXP_DOCUMENTO, TCXP_ED).
- [ ] **10.6** Actualizar `backend/docs/superpowers/00_roadmap_avance.md` marcando CxP con DoD 3.1/3.2/3.3/3.4 ✅.

---

## Resumen de conteo

| Fase | Tareas |
|---|---|
| 0. Preparacion | 5 |
| 1. Layout/Routing/Sidebar | 6 |
| 2. Configuracion (catalogos) | 16 |
| 3. Procesos/Pagos | 18 |
| 4. Consultas | 4 |
| 5. Reportes + DGII | 12 |
| 6. Impresiones AC/AD/BD/FP | 5 |
| 7. Cierre/Asiento | 6 |
| 8. Reconciliacion SQL | 5 |
| 9. Playwright E2E | 6 |
| 10. Limpieza y cierre | 6 |
| **TOTAL** | **89** |

Excede el minimo de 40 tareas atomicas requerido por el meta-spec (acorde a que CxP se construye casi desde cero).

---

## Notas de ejecucion

- Antes de cada tarea backend nueva, verificar columnas/PK con `SELECT column_name, data_type, nullable FROM all_tab_columns WHERE owner='CXP' AND table_name='TCXP_<X>'`.
- Antes de cada tarea frontend nueva, abrir el componente CxC equivalente en VM (`pscp` get) como template literal.
- Cada cambio se sube con pscp; backend tiene auto-reload, frontend require `pnpm dev` (ya corriendo en VM 10.0.0.99:5173).
- Permisos siempre via `permissions_repo.get_for(user, 'CXP', no_cia, punto)`.
- NUNCA invalidar la queryKey raiz: usar `['cxp', 'proveedores', no_cia, punto]` granular.
- Tras Fase 10: levantar PR cerrando el DoD del modulo, segun §11 del meta-spec.
