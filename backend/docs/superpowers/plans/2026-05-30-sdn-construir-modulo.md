# Plan hijo SDN — construir modulo Nomina

- **Fecha:** 2026-05-30
- **Spec referenciado:** `specs/2026-05-30-sdn-construir-modulo-design.md`
- **Meta-spec:** `specs/2026-05-30-sigaft-meta-validacion-modulos-design.md`
- **Estado:** Borrador para ejecucion
- **Modo:** ejecutar con `superpowers:subagent-driven-development` por fase; cada fase es un PR independiente (o serie de commits si la fase es chica).
- **Dependencias:** las fases F0..F8 deben ejecutarse en orden estricto. No paralelizar entre ellas.

---

## Convencion de cada tarea

- **ID:** Fn.k — fase n, tarea k.
- **Definicion de Hecho:** cada tarea termina con tests Playwright o smoke manual segun aplique, y `pnpm typecheck` + `python -c "import ast; ast.parse(...)"` antes de pscp.
- **Ubicacion VM:** backend en `facturation-system/backend/apps/...`, frontend en `facturation-system/frontend/src/...`.
- **No skip:** ningun TODO/FIXME en codigo al cerrar fase.

---

## Fase 0 — Bootstrap (5 tareas)

- **F0.1** Confirmar permisos en `permissions_repo.py`: que `get_for(user, 'sdn', no_cia, punto)` lea `TSDN_USUARIO` y combine con `TSDN_USUARION` (permiso por nomina). Smoke: GET `/api/perm/?modulo=sdn` con usuario real.
- **F0.2** Crear scaffolding backend: `apps/legacy/sdn_urls.py`, `apps/legacy/sdn_views.py`. Incluir en `facturation_api/urls.py` bajo `/api/sdn/`. Endpoint healthcheck `GET /api/sdn/ping`.
- **F0.3** Reemplazar `repositories/sdn_repo.py` (stub 24 lineas) por arquitectura por dominio: `sdn_repo/__init__.py`, `sdn_repo/catalogos.py`, `sdn_repo/empleados.py`, `sdn_repo/calculo.py`, `sdn_repo/regalia.py`, `sdn_repo/vacaciones.py`, `sdn_repo/cierre.py`. Mover `count_empleados`/`list_afp`/`list_ars` a sus modulos.
- **F0.4** Crear scaffolding frontend: `routes/_authenticated/sdn.tsx` (layout Header+Outlet), `routes/_authenticated/sdn/index.tsx` (dashboard placeholder con cards a las subsecciones).
- **F0.5** Sidebar: agregar NavCollapsible "Sistema de Nominas" en `components/layout/data/sidebar-data.ts` con subitems vacios (se llenan en cada fase). Verificar permiso `sdn` antes de mostrar.

## Fase A — Catalogos y configuracion (16 tareas)

- **FA.1** Catalogo Companias `TSDN_CIAS`: repo `list_cias/get_cia/upsert_cia`, endpoints GET/POST/PUT, vista `features/sdn/config/companias/`.
- **FA.2** Catalogo Puntos `TSDN_PUNTO`: repo + endpoints + vista.
- **FA.3** Catalogo Nominas `TSDN_NOMINA` (incluye campos paralelos: sufijo fecha, periodo, forma_pago, metodo_pago, cuenta_contable, gasto_regalia, calculo_nomina, mes_proceso, ano_proceso, mes_cierre): repo + endpoints + vista. Validar que `MES_CIERRE` define rollover anual.
- **FA.4** Catalogo Usuarios `TSDN_USUARIO`+`TSDN_USUARION`: repo + endpoints + vista (permisos por nomina: AUTORIZAR_HORAS, CERRAR_NOMINA, REPORTE_NOMINA, TRASLADAR_EMPLEADO).
- **FA.5** Organigrama: Gerencias / Areas / Departamentos / Centros de Trabajo / Puestos. Cinco catalogos con jerarquia (Area depende de Gerencia, Depto de Area). Vistas anidadas en `features/sdn/config/organigrama/`.
- **FA.6** Catalogos geograficos: Paises, Parentesco, Nivel Academico, Profesion. Vistas tabulares simples.
- **FA.7** Catalogo Ingresos `TSDN_INGRESOS` (campos NO_INGRESO, CLASE_INGRESO, TIPO_INGRESO, VALIDO_REGALIA, VALIDO_BONIFICACION, MULTIPLICADO_POR).
- **FA.8** Catalogo Deducciones `TSDN_DEDUCCIONES`.
- **FA.9** Cuentas contables por concepto: `TSDN_CUENTA_INGRESO`, `TSDN_CUENTA_DEDUCCION`. Vista `features/sdn/config/cuentas-conceptos/` con joins a `TCNT_CATALOGO` y `TCNT_CENTRO_COSTO`.
- **FA.10** Catalogos AFP/ARS: `TSDN_AFP`, `TSDN_ARS`.
- **FA.11** Catalogos SS: `TSDN_COTIZACIONES_SS`, `TSDN_SEMANAS_COTIZABLES`.
- **FA.12** Escalas: `TSDN_ESCALA_IRS` (escala ISR), `TSDN_ESCALA_MESES` (tipos V/B/P). Vistas con filtro por tipo.
- **FA.13** Dias Feriados `TSDN_DIAS_FERIADOS` (DIA date).
- **FA.14** Puestos TSS `TSDN_PUESTOS_TSS` (codigo + descripcion para reportes DGT).
- **FA.15** Beneficiarios `TSDN_BENEFICIARIO`, Listado de Servicios `TSDN_LISTADO_SERVICIO`, Puestos de Servicios `TSDN_PUESTO_SERVICIO`, Grupo Contable `TSDN_GRUPO_CONTABLE`, Tipo de Gastos.
- **FA.16** Smoke E2E fase A: crear empresa demo + nomina demo + ingresos/deducciones basicos. Confirmar todas las vistas listan datos reales. Test Playwright `e2e/sdn/config.spec.ts`.

## Fase B — Empleados (Maestro) (8 tareas)

- **FB.1** Repo `empleados.py`: `list_empleados(filtros, paginado server-side)`, `get_empleado(no_cia, punto, no_empleado)`, `upsert_empleado`, `egresar_empleado`. Atencion: filtros NO_CIA+PUNTO+NOMINA+estado+departamento+gerencia+busqueda.
- **FB.2** Endpoints GET listado, GET detalle, POST/PUT, POST egresar.
- **FB.3** Endpoint foto: `GET /api/sdn/empleados/<no>/foto` (BLOB), `POST .../foto` (subida).
- **FB.4** Vista listado `features/sdn/empleados/index.tsx` con DataTable, filtros, busqueda por cedula y nombre.
- **FB.5** Vista detalle `features/sdn/empleados/$no.tsx` con tabs: Datos personales (cedula, nombre, apellido, sexo, fecha_nacimiento, pais, nacionalidad, nivel_academico, parentesco con beneficiarios), Laboral (nomina, gerencia, area, depto, puesto, no_puesto_tss, turno, fecha_ingreso, fecha_egreso, salario_mensual, discapacidad), Bancario (cuenta_banco, tipo_cuenta_banco, email1), Beneficiarios, Foto.
- **FB.6** Validaciones servidor: cedula 11 digitos unica por compania (RegEx + uniq query), salario_mensual > 0, fecha_ingreso <= SYSDATE, no_puesto_tss existe en `TSDN_PUESTOS_TSS`, nomina activa.
- **FB.7** Endpoint `GET /api/sdn/empleados/<no>/historico-salario` desde `TSDN_INGRESOS` join `TSDN_EMPLEADO`.
- **FB.8** Test E2E flujo critico #1 (alta de empleado): `e2e/sdn/empleado-alta.spec.ts`.

## Fase C — Acciones / Variacion salarial (7 tareas)

- **FC.1** Repo `acciones.py`: list/get/create/autorizar/aplicar. Numeracion via `TSDN_CIAS.NO_ACCION` con `FOR UPDATE`.
- **FC.2** Endpoint POST `/api/sdn/acciones` (crear borrador, ST_ACTIVA='N').
- **FC.3** Endpoint POST `/api/sdn/acciones/<no>/autorizar` (set ST_ACTIVA='A', AUTORIZADA_POR=user, FECHA_ACCION, validar clase IN B,D,F,I,J,K segun TSDN_TIPO_ACCIONES; clase K excluyente).
- **FC.4** Endpoint POST `/api/sdn/acciones/aplicar` (ejecuta updates segun clase: cambio salario => update TSDN_EMPLEADO.SALARIO_MENSUAL e INSERT en TSDN_INGRESOS historico; traslado => update gerencia/area/depto/puesto; egreso => set FECHA_EGRESO + cascading update T*_USUARIO.ACTIVO='N' en todos los modulos + TCSC.ACTIVO='N'). Marca ST_ACTUALIZADA='S'.
- **FC.5** Vista listado y workflow `features/sdn/acciones/`: estados borrador → autorizada → aplicada.
- **FC.6** Endpoint `GET /api/sdn/acciones/pdf/` reporte (`Fsdn509`).
- **FC.7** Test E2E: crear accion variacion salarial → autorizar → aplicar → ver salario actualizado en empleado.

## Fase D — Horas / Ingresos individuales / Deducciones individuales (8 tareas)

- **FD.1** Repo + endpoints `TSDN_HORAS_EMPLEADOS`: list/upsert/autorizar (set ESTADO='A'). Permiso `AUTORIZAR_HORAS` en TSDN_USUARION.
- **FD.2** Vista `features/sdn/horas/` con grid (empleado x dia x clase_hora) + boton autorizar masivo.
- **FD.3** Repo + endpoints `TSDN_CALCULO_INGRESOS` (individual='S'): list/upsert/delete. Validar concepto en `TSDN_ASIGNAR_INGRESO_DEDU`.
- **FD.4** Vista `features/sdn/ingresos-individuales/` (`Fsdn204`): seleccionar empleado, agregar concepto+monto.
- **FD.5** Repo + endpoints `TSDN_CALCULO_DEDUCCIONES`: list/upsert/delete. Soporte deduccion por cuotas con referencia CxC (NO_CLIENTE, TIPO_DOCU, NO_DOCU).
- **FD.6** Vista `features/sdn/egresos-individuales/` (`Fsdn205`): incluir lookup de cliente CxC y documento.
- **FD.7** Endpoint POST `/api/sdn/ingresos/import-excel` (`Fsdn222`): parsear XLSX, validar empleado/concepto/monto, insertar masivo en `TSDN_CALCULO_INGRESOS`. Reportar errores por fila.
- **FD.8** Smoke E2E fase D: cargar empleado con horas + ingreso individual + deduccion por cuota; verificar persistencia.

## Fase E — Calculo de nomina (10 tareas — bloque mas critico)

- **FE.1** Diseno: documento separado `docs/sdn_calculo_algoritmo.md` con pseudocodigo paso a paso del calculo. **Punto de revision con usuario antes de codear**. Incluir: orden de aplicacion (ingresos → horas → conceptos → bases → deducciones legales → otras deducciones → ISR), formulas con cita de la query legacy.
- **FE.2** Verificacion contra norma:
  - TSS: tasas SFS 3.04% empleado + 7.09% patrono, AFP 2.87% emp + 7.10% pat, sobre salario tope `TOPE_SALARIO_SS`. **Marcar TODO con norma vigente RD a confirmar con usuario.**
  - INFOTEP: 1% patrono sobre nomina, 0.5% empleado sobre bonificacion. Confirmar.
  - ISR: tabla escala progresiva en `TSDN_ESCALA_IRS`, `MODO_CALCULO_ISR` puede ser anualizado (proyeccion anual / 12) o proporcional. Confirmar.
  - Factor diario `TSDN_CIAS.FACTOR_CALCULO_DIARIO` default 23.83 (~365/12/30, ajustar segun regla del cliente).
- **FE.3** Repo `calculo.py`: funcion `calcular_nomina(no_cia, punto, nomina, ano, mes, periodo, user)`:
  - INSERT TSDN_AUDITORIA proceso='U'.
  - SELECT TSDN_NOMINA estado='A' y CALCULO_NOMINA != 'C'.
  - SELECT empleados activos en nomina (FECHA_EGRESO IS NULL).
  - Para cada empleado: aplicar conceptos, deducciones, ISR.
  - INSERT TSDN_MOVIMIENTO ORIGEN='N'.
  - UPDATE TSDN_NOMINA.CALCULO_NOMINA='S'.
- **FE.4** Endpoint `POST /api/sdn/nomina/calcular`.
- **FE.5** Endpoint `POST /api/sdn/nomina/recalcular-empleado` (mismo algoritmo limitado a 1 empleado, borra movimientos ORIGEN='N' previos para ese empleado y re-genera).
- **FE.6** Endpoint `DELETE /api/sdn/nomina/movimientos?...` para limpiar antes de recalcular.
- **FE.7** Vista `features/sdn/calculo/` con seleccion nomina/ano/mes/periodo, boton Calcular, progreso, listado de movimientos generados por empleado, link a volante.
- **FE.8** Volante de pago PDF: endpoint `GET /api/sdn/volante/<no_empleado>/pdf/?ano=&mes=&periodo=`. Usa `pdf_helpers.build_pdf_report`. Estructura: header empresa + datos empleado + tabla ingresos | montos + tabla deducciones | montos + neto a pagar + firma.
- **FE.9** Reconciliacion SQL: ejecutar query del clon vs legacy `Fsdn208` para 5 empleados aleatorios; documentar evidencia en PR.
- **FE.10** Test E2E flujo critico #2 (generar nomina quincenal): `e2e/sdn/calcular-nomina.spec.ts`.

## Fase F — Procesos anuales (Regalia / Vacaciones / Bonificacion / Prestaciones) (12 tareas)

- **FF.1** Repo `regalia.py`: `generar_regalia(no_cia, punto, ano, nomina)` poblando `TSDN_CALCULO_REGALIA` desde `TSDN_MOVIMIENTO` (VALIDO_REGALIA='S') agrupado por mes columna (ENE..DIC+OTROS) y empleado.
- **FF.2** Repo `regalia.py`: `generar_archivo_banco_regalia` (DELETE TSDN_ARCHIVO_BANCO ORIGEN='S'; INSERT). Endpoint y vista.
- **FF.3** Reportes regalia PDF: Constancia (`Fsdn309`) y Reporte Regalia/ISR (`Fsdn305`). Reconciliacion SQL contra legacy.
- **FF.4** Repo `vacaciones.py`: `generar_vacaciones(no_cia, punto, nomina, ano)` consultando `TSDN_ESCALA_MESES` tipo V + `TSDN_DIAS_FERIADOS`, calculando TIEMPO_ANO/MES/DIA por empleado e insertando en `TSDN_VACACIONES`. Endpoint `Fsdn401`.
- **FF.5** Vista mantenimiento vacaciones `features/sdn/vacaciones/` (`Fsdn402`): editar FECHA_INICIAL/FINAL, CANTIDAD_DIAS.
- **FF.6** Repo `vacaciones.py`: `calcular_vacaciones` (`Fsdn403`) que poblara `TSDN_MOVIMIENTO_TMP` con monto de vacaciones por empleado. **Validar contra norma DGT RD el calculo de salario base.**
- **FF.7** Repo `vacaciones.py`: `procesar_vacaciones` (`Fsdn407`): mueve TMP a TSDN_MOVIMIENTO definitivo, genera doc CxC por descuento (via `TCXC_SECUENCIA`/`TCXC_DOCUMENTO`/`TCXC_REFEDOCU`), archiva en `TSDN_VACACIONESH`. Auditoria proceso='C'.
- **FF.8** Endpoints: archivo banco vacaciones (`Fsdn405`), solicitud cheques (`Fsdn409`), reportes (`Fsdn404`, `Fsdn406`, `Fsdn408` DGT3).
- **FF.9** Repo `bonificacion.py`: `pagar_bonificacion(...)` usando `TSDN_PAGO_BONIFICACION` y escala B. Endpoint y vista (`Fsdn315`). Reporte PDF.
- **FF.10** Repo `prestaciones.py`: `calcular_prestaciones(no_empleado)` para empleados con FECHA_EGRESO no null. Componentes: preaviso, cesantia, vacaciones proporcionales, regalia proporcional. **Verificar formulas contra Codigo de Trabajo RD vigente — bloqueador, consultar usuario.**
- **FF.11** Endpoint + vista prestaciones (listado empleados egresados, calculo, PDF).
- **FF.12** Test E2E flujo critico #3 (generar regalia anual): `e2e/sdn/regalia.spec.ts`.

## Fase G — Reportes faltantes (10 tareas)

- **FG.1** Reporte Informe de Nomina (`Fsdn207`) — endpoint PDF + vista filtros.
- **FG.2** Reporte general (`Fsdn208`) — endpoint PDF + filtros amplios (gerencia/area/depto/empleado).
- **FG.3** Reporte historico salario (`Fsdn308`).
- **FG.4** Reporte historico de nomina ("REPORTE HISTORICO DE NOMINA"), revision de saldos ("REPORTE REV. DE SALDOS").
- **FG.5** Archivo Autodeterminacion TSS (`Fsdn312`) — generar archivo TXT segun formato TSS RD vigente. **Verificar layout actual con usuario.**
- **FG.6** Generar Datos TSS (`Fsdn310`) — listado empleados activos con cedulas/salarios.
- **FG.7** Genera Archivo DGT4 (`Fsdn314`).
- **FG.8** Genera Archivo Banco (`Fsdn313`) — formato banco principal.
- **FG.9** Distribucion de Monedas (`Fsdn311`) — solo si cliente paga en efectivo (confirmar).
- **FG.10** Auditoria de capturas para identificar reportes faltantes hasta llegar a 50 (meta `project/modules-inventory`). Cada nuevo reporte detectado se agrega como tarea adicional. Test E2E flujo critico #5 (reporte TSS): `e2e/sdn/reporte-tss.spec.ts`.

## Fase H — Cierre (8 tareas)

- **FH.1** Repo `cierre.py`: `generar_asiento(no_cia, punto, nomina, ano, mes, periodo)` (`Fsdn210`). Construye `TSDN_DCNOMINA` agrupando TSDN_MOVIMIENTO por cuenta contable+centro_costo (via TSDN_CUENTA_INGRESO/TSDN_CUENTA_DEDUCCION). Snapshot `TSDN_NOMINAH` por empleado (INGRESOS, OTROS_INGRESOS, HORAS_EXTRAS, DEDUCCIONES, ISR).
- **FH.2** Integracion CxC: si hay empleados con cuotas descontadas (TSDN_CALCULO_DEDUCCIONES con NO_CLIENTE), generar TCXC_DOCUMENTO + TCXC_REFEDOCU (referencia al documento de cuota).
- **FH.3** Endpoint POST `/api/sdn/nomina/generar-asiento` + vista `features/sdn/cierre/asiento.tsx`. Bloquea con HTTP 409 si ya generado.
- **FH.4** Repo: `generar_solicitudes_cheques` (`Fsdn212`/`Fsdn409`) — integracion `TCHC_SECUENCIA`/`TCHC_TDOCU`/`TCHC_USUARIOC`.
- **FH.5** Repo: `generar_archivo_banco_nomina` (`Fsdn313`) — INSERT TSDN_ARCHIVO_BANCO ORIGEN='N'.
- **FH.6** Repo + endpoint `cerrar_periodo` — avanza `TSDN_NOMINA.MES_PROCESO`/`ANO_PROCESO`/`PERIODO` (rollover si MES = MES_CIERRE). Validar: no movimientos pendientes (GENERO_ED='N' AND MONTO_TRANSACCION!=0), no documentos sin asiento, todos los empleados con calculo.
- **FH.7** Vista `features/sdn/cierre/` con checklist visual de pre-cierre (calculos, asientos, cheques, archivo banco) + boton Cerrar.
- **FH.8** Test E2E flujo critico #4 (cerrar periodo): `e2e/sdn/cerrar-periodo.spec.ts`. Segundo intento debe fallar con 409.

## Fase I — DoD final del modulo (6 tareas)

- **FI.1** Auditoria paridad menu vs legacy: abrir `capturas\Sistema de Nominas\` PNG por PNG y verificar que cada opcion del menu tiene equivalente en clon (ruta + componente). Documentar descartes en spec §6.
- **FI.2** Auditoria de reportes hasta llegar a 50 (meta `project/modules-inventory`). Crear issues por reportes faltantes o documentar descartes.
- **FI.3** Reconciliacion SQL — ejecutar las 10 queries de spec §5 contra Oracle y comparar con legacy. Documentar evidencia en PR final (`backend/docs/captures/sdn/`).
- **FI.4** Suite Playwright completa (5 flujos criticos) corre verde local y en CI.
- **FI.5** `grep -rE "TODO|FIXME|XXX" backend/apps/legacy/sdn_*.py backend/apps/legacy/repositories/sdn_repo/ frontend/src/features/sdn/ frontend/src/routes/_authenticated/sdn*` = 0.
- **FI.6** Actualizar `backend/docs/superpowers/00_roadmap_avance.md` marcando SDN con sus 4 DoD.

---

## Tareas totales: 80

- F0: 5
- FA: 16
- FB: 8
- FC: 7
- FD: 8
- FE: 10
- FF: 12
- FG: 10
- FH: 8
- FI: 6

---

## Bloqueadores que requieren usuario antes de codear

1. **FE.2** — tasas TSS/AFP/ARS/INFOTEP vigentes RD.
2. **FE.2** — modos de calculo ISR `TSDN_CIAS.MODO_CALCULO_ISR` (anualizado vs proporcional) y escala vigente.
3. **FF.10** — formulas prestaciones laborales (preaviso, cesantia) segun Codigo de Trabajo RD.
4. **FG.5** — layout actual TSS Autodeterminacion (formato TXT puede haber cambiado).
5. **FG.9** — confirmar si Distribucion de Monedas se mantiene o se descarta.

Todos los bloqueadores se documentan en el PR de la fase respectiva con tag `[BLOCKED-VERIFY-NORM]` y se resuelven antes de aplicar la formula. Hasta entonces se implementa el cascaron + queries de soporte, pero el calculo se deja fallar con un 501 Not Implemented explicitando el bloqueador.

---

## Riesgos identificados (residuales)

- **Nominas paralelas con sufijo de fecha:** el campo `NOMINA` puede traer sufijos timestamp para nominas adicionales. Verificar en data real cuantas variantes existen por empresa.
- **Calculo retroactivo:** una accion de variacion salarial con fecha pasada puede requerir recalcular nominas ya generadas. El plan asume **no soportar retroactivos** en V1; documentar como descarte y pedir confirmacion.
- **Bonificacion semestral:** escala B puede ser semestral; verificar periodicidad antes de FF.9.
- **Volumen empleados:** queries de calculo masivo en TSDN_MOVIMIENTO deben ser batched (bind array) para evitar timeouts Oracle 11g.

---

## Salidas concretas al ejecutar el plan

- 1 PR por fase (F0..FI) — 10 PR estimados.
- Modulo SDN funcional cubriendo configuracion + maestros + procesos + reportes + cierre.
- 5 tests E2E Playwright.
- Documentacion `docs/sdn_calculo_algoritmo.md` revisada con usuario.
- Dashboard avance actualizado.
