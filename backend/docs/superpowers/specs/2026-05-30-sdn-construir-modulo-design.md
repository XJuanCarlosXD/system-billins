# Spec modulo SDN (Nomina) — construir desde cero

- **Fecha:** 2026-05-30
- **Estado:** Borrador para revision
- **Meta-spec referenciado:** `2026-05-30-sigaft-meta-validacion-modulos-design.md`
- **Memoria tecnica local:** `memorias_por_modulo/memoria_nomina.md` (98 opciones de menu, 94 forms inventariados, 1 reporte `.rep` referenciado; el conteo autoritativo `project/modules-inventory` del MCP fija 104 forms / 50 reports — limitacion: sin `.rdf` fuente el listado de reportes inferido es incompleto).
- **MCP keys consultadas:** `sigaf/module-memory-20260530-final/nomina/part-019..023`, `sigaf/module-memory-full-20260530/nomina/part-002,003,005,016`, `project/risk-areas`.
- **Capturas de referencia:** `C:\Users\JCABREU\AppData\Local\memorias_sigaft\capturas\Sistema de Nominas\` (no auditadas en este spec; el ejecutor debe abrirlas).
- **Skill agent MCP recomendado:** `oracle-sigaf-erp` (cubre el schema TSDN_* y reglas de permisos).
- **Riesgo:** #1 en `project/risk-areas`. Reglas fiscales DGT/TSS/INFOTEP/DGII complejas, calculos retroactivos, prestaciones, regalia, vacaciones, nominas paralelas (sufijos de fecha), cierre con asiento contable.

---

## 0. Resumen ejecutivo

SDN se construye **desde cero** (backend + frontend). El backend tiene unicamente un esqueleto en `apps/legacy/repositories/sdn_repo.py` (24 lineas, 3 funciones triviales: `count_empleados`, `list_afp`, `list_ars`). No existen `apps/sdn/`, `apps/nomina/`, ni `features/sdn`, ni rutas `_authenticated/sdn/`. Es el modulo de mayor complejidad y se aborda **por bloques** con dependencias estrictas: Configuracion → Catalogos maestros → Empleados → Conceptos/Acciones → Procesos quincenales → Procesos anuales (regalia/vacaciones) → Reportes → Cierre. Sin Configuracion no se valida nada; sin Empleados no se calcula nada; sin calculo no se cierra.

**Restricciones criticas:** ninguna formula fiscal (TSS, INFOTEP, ISR, factor diario, escalas) se inventa. Cada calculo cita la query/regla legacy y/o se marca **"verificar contra norma DGT/TSS RD"** para revision con el usuario antes de implementar.

---

## 1. Inventario actual del modulo

### 1.1 Frontend (clon)

Estado: **CERO**.

- No existe `frontend/src/routes/_authenticated/sdn/` ni `_authenticated/nomina/`.
- No existe `frontend/src/features/sdn/` ni `features/nomina/`.
- Sidebar (`components/layout/data/sidebar-data.ts`): SDN no figura como NavLink ni NavCollapsible.
- No hay metodos SDN en `lib/regal-general-api.ts`.

### 1.2 Backend (clon)

Estado: **STUB minimo**.

- `backend/apps/legacy/repositories/sdn_repo.py` — 24 lineas, 3 funciones (`count_empleados`, `list_afp`, `list_ars`).
- **NO existen:** `apps/sdn/`, `apps/nomina/`, `apps/legacy/sdn_urls.py`, `apps/legacy/sdn_views.py`.
- No hay endpoints expuestos al frontend bajo `/api/sdn/`.

### 1.3 Bugs conocidos / deuda tecnica

- N/A (no hay codigo SDN para tener bugs).
- Deuda implicita: `permissions_repo.get_for(user, 'sdn', no_cia, punto)` debe verificarse que soporte el modulo `sdn` (tabla `TSDN_USUARIO` + `TSDN_USUARION` por nomina).

---

## 2. Gap con el legacy (104 forms / 50 reports)

El menu SDN inferido desde la memoria local agrupa 98 opciones en 7 secciones. Mapeo macro (el plan hijo desglosa form por form):

### 2.1 Acceso (1 opcion)

- `Fsdn601.fmx` Acceso de Usuario al Sistema — `TSDN_CIAS`, `TSDN_PUNTO`, `TSDN_USUARIO`.

### 2.2 Configuracion (~32 opciones)

Catalogos basicos:

1. `Fsdn101.fmx` Mantenimiento de Companias (`TSDN_CIAS`).
2. `Fsdn102.fmx` Mantenimiento de Puntos de Trabajo (`TSDN_PUNTO`).
3. `Fsdn103.fmx` Mantenimiento de Acceso al Sistema (`TSDN_USUARIO`, `TSDN_USUARION` por nomina).
4. `Fsdn104.fmx` Mantenimiento de Nominas (`TSDN_NOMINA` — paralelas con sufijo, mes/ano proceso, periodo, forma_pago, metodo_pago, cuenta_contable, gasto_regalia, calculo_nomina).
5. Gerencias / Areas / Departamentos / Puestos / Centros de Trabajo (`TSDN_GERENCIA`, `TSDN_AREA`, `TSDN_DEPTO`, `TSDN_PUESTO`, `TSDN_CENTRO_TRABAJO`).
6. Paises / Parentesco / Nivel Academico / Profesion (`TSDN_PAIS`, `TSDN_PARENTESCO`, `TSDN_NIVEL_ACADEMICO`, `TSDN_PROFESION`).
7. Conceptos: Ingresos (`TSDN_INGRESOS`), Deducciones (`TSDN_DEDUCCIONES`).
8. Cuentas contables por concepto: `Fsdn126.fmx` (`TSDN_CUENTA_INGRESO`), `Fsdn127.fmx` (`TSDN_CUENTA_DEDUCCION`).
9. AFP / ARS (`TSDN_AFP`, `TSDN_ARS`), Cotizaciones SS (`TSDN_COTIZACIONES_SS`), Semanas Cotizables (`TSDN_SEMANAS_COTIZABLES`).
10. Escala IRS (`TSDN_ESCALA_IRS`) y Escala Meses (`TSDN_ESCALA_MESES` — tipos V vacaciones, B bonificacion, P prestaciones).
11. Dias Feriados (`TSDN_DIAS_FERIADOS`).
12. Puestos TSS (`TSDN_PUESTOS_TSS`) — codigo para DGT/TSS.
13. Listado de Servicios / Puestos de Servicios (`TSDN_PUESTO_SERVICIO`, `TSDN_LISTADO_SERVICIO`).
14. Grupo Contable (`TSDN_GRUPO_CONTABLE`), Tipo de Gastos.
15. Beneficiarios (`TSDN_BENEFICIARIO`).

### 2.3 Empleados (Maestro) — Consultas/Reportes (10 opciones)

- `Fsdn301.fmx` Maestro de Empleados (`TSDN_EMPLEADO`, foto, FECHA_INGRESO/EGRESO, CEDULA, SALARIO_MENSUAL, NOMINA, CUENTA_BANCO, TIPO_CUENTA_BANCO, EMAIL1, PAIS, NO_PUESTO_TSS, NO_NIVEL, DISCAPACIDAD, ST_VACACIONES).
- `Fsdn308.fmx` Historico de Salario.
- `Fsdn309.fmx` Constancia Pago Regalia.
- `Fsdn310.fmx` Generar Datos para la TSS.
- `Fsdn311.fmx` Distribucion de Monedas (denominaciones para pago efectivo).
- `Fsdn312.fmx` Archivo Autodeterminacion TSS.
- `Fsdn313.fmx` Genera Archivo del Banco.
- `Fsdn314.fmx` Genera Archivo DGT4.
- `Fsdn305.fmx` Reporte Regalia/ISR.
- `Fsdn315.fmx` Pago de Bonificaciones (`TSDN_PAGO_BONIFICACION`).

### 2.4 Procesos quincenales (16 opciones)

- `Fsdn204.fmx` Movimientos Manuales Nomina.
- `Fsdn205.fmx` Mantenimiento de Egresos Individuales (`TSDN_CALCULO_DEDUCCIONES`).
- `Fsdn206.fmx` **CALCULO DE NOMINA** (forma motora — `TSDN_MOVIMIENTO`, `TSDN_CALCULO_INGRESOS`, `TSDN_CALCULO_DEDUCCIONES`, ISR mode segun `TSDN_CIAS.MODO_CALCULO_ISR`).
- `Fsdn207.fmx` Informe de Nomina.
- `Fsdn208.fmx` Reporte (volante de pago / planilla).
- `Fsdn210.fmx` Cierre/Asiento Nomina (`TSDN_DCNOMINA`, `TSDN_NOMINAH`, integracion CxC `TCXC_DOCUMENTO` para descuentos por cuotas).
- `Fsdn214.fmx`, `Fsdn215.fmx`, `Fsdn216.fmx` (variantes consulta movimientos / generar ED — entradas de diario).
- `Fsdn221.fmx`, `Fsdn222.fmx` Cargar Ingresos desde Excel.
- `Fsdn202.fmx` Horas Laboradas por Empleados (consulta).
- `Fsdn203.fmx` Autorizar Horas (`TSDN_HORAS_EMPLEADOS.ESTADO='A'`).
- `Generar Solicitudes de Cheques`, `Generar Archivo al Banco`, `Saldos Menores por Ajustar` (aplicar/generar).

### 2.5 Procesos Vacaciones / Regalia / Bonificacion (~10 opciones)

- `Fsdn401.fmx` Generar Vacaciones (escala `TSDN_ESCALA_MESES` tipo V, dias feriados, inserta `TSDN_VACACIONES`).
- `Fsdn402.fmx` Mantenimiento de Vacaciones.
- `Fsdn403.fmx` Calculo de Vacaciones.
- `Fsdn404.fmx` Reporte de Vacaciones.
- `Fsdn405.fmx` Generar Archivo Vacaciones al Banco (`TSDN_ARCHIVO_BANCO`).
- `Fsdn406.fmx` Reporte Detalle de Vacaciones.
- `Fsdn407.fmx` Proceso de Vacaciones (genera doc CxC por descuento, `TSDN_VACACIONESH`).
- `Fsdn408.fmx` Reporte de Vacaciones DGT3.
- `Fsdn409.fmx` Generar Solicitud de Cheques de Vacaciones.
- Regalia/Bonificacion: `Fsdn315.fmx` Pago de Bonificaciones, `Fsdn309.fmx` Constancia Pago Regalia, `Fsdn305.fmx` Reporte Regalia/ISR (incluye INSERT a `TSDN_ARCHIVO_BANCO` ORIGEN='S').

### 2.6 Acciones / Variacion Salarial (12 opciones)

- `Fsdn501.fmx` Mantenimiento Tipos de Acciones (`TSDN_TIPO_ACCIONES`).
- `Fsdn502.fmx` Motivo de Acciones (`TSDN_MOTIVO`).
- `Fsdn503/506.fmx` Mantenimiento / Consulta de Acciones a Empleado (`TSDN_ACCIONES`).
- `Fsdn507.fmx` Autorizar Acciones (numera con `TSDN_CIAS.NO_ACCION`, valida clases B/D/F/I/J/K).
- `Fsdn508.fmx` Actualizacion Acciones Empleado (impacta tablas T*_USUARIO de todos los modulos para desactivar usuario, `TCSC.ACTIVO`).
- `Fsdn509.fmx` Reporte de Acciones.
- `Fsdn510.fmx` Acciones de Variacion de Salario.
- `Mantenimiento de Salida` (egresos / prestaciones).
- `Consulta Reposicion de Caja Chica` (referencia ACC).
- `Traslado de Empleados Inactivos a Otra Compania`.

### 2.7 Reportes (50 segun MCP — solo 1 `.rep` referenciado en memoria local)

Limitacion: la memoria local solo lista 1 reporte `.rep`. La mayoria de "reportes" se llaman desde forms (`Fsdn207`, `Fsdn208`, `Fsdn305`, `Fsdn308`, `Fsdn312`, `Fsdn314`, `Fsdn315`, `Fsdn404`, `Fsdn406`, `Fsdn408`, `Fsdn509`). El ejecutor debe abrir capturas y MCP `module-memory-full-20260530/nomina/part-*` para identificar los 50 reales antes del cierre del modulo. Spec asume cobertura via PDFs por endpoint /api/sdn/.../pdf/.

### 2.8 Reglas DGI/contables que faltan (cero implementadas)

- ISR (`MODO_CALCULO_ISR` en `TSDN_CIAS`): 2 modos posibles (anualizado vs proporcional). Escala `TSDN_ESCALA_IRS`. Verificar contra norma DGII RD vigente.
- TSS: tope salario SS `TSDN_CIAS.TOPE_SALARIO_SS`, cotizaciones via `TSDN_COTIZACIONES_SS`. Verificar contra norma TSS RD.
- INFOTEP: porcentaje sobre nomina. Verificar contra norma INFOTEP RD.
- AFP/ARS: tasas en `TSDN_AFP`/`TSDN_ARS`.
- Factor calculo diario `TSDN_CIAS.FACTOR_CALCULO_DIARIO` (default 23.83).
- Regalia: salarios mensuales del ano TSDN_CALCULO_REGALIA, formula SUM(ENE..DIC+OTROS)/12.
- Vacaciones: dias por escala (TSDN_ESCALA_MESES tipo V) calculados sobre tiempo en la empresa (TIEMPO_ANO/MES/DIA, considerando dias feriados).
- Bonificacion: escala `TSDN_ESCALA_MESES` tipo B.
- Prestaciones laborales (preaviso, cesantia, vacaciones proporcionales): formula segun Codigo de Trabajo RD. **Verificar contra norma DGT RD**.

---

## 3. Trabajo a realizar

Organizado por bloques con **dependencias estrictas**. Cada bloque produce un PR o un commit serie.

### 3.1 Bloque A — Catalogos (Configuracion + Maestros)

#### 3.1.1 Backend

Crear `apps/legacy/sdn_urls.py`, `apps/legacy/sdn_views.py`, y poblar `apps/legacy/repositories/sdn_repo.py`. Endpoints (todos parametrizados, todos validan `permissions_repo.get_for(user, 'sdn', no_cia, punto)`):

| Endpoint | Repo | Tabla |
|---|---|---|
| `GET /api/sdn/cias` | `list_cias` | `TSDN_CIAS` |
| `GET /api/sdn/puntos?no_cia=` | `list_puntos` | `TSDN_PUNTO` |
| `GET /api/sdn/usuarios?no_cia=&punto=` | `list_usuarios` | `TSDN_USUARIO`+`TSDN_USUARION` |
| `GET /api/sdn/nominas?no_cia=&punto=` | `list_nominas` | `TSDN_NOMINA` (incluye sufijos paralelos) |
| `GET /api/sdn/gerencias`, `/areas`, `/deptos`, `/puestos`, `/centros-trabajo` | catalogos basicos | `TSDN_GERENCIA`, `TSDN_AREA`, `TSDN_DEPTO`, `TSDN_PUESTO`, `TSDN_CENTRO_TRABAJO` |
| `GET /api/sdn/paises`, `/parentescos`, `/niveles-academicos`, `/profesiones` | catalogos basicos | `TSDN_PAIS`, `TSDN_PARENTESCO`, `TSDN_NIVEL_ACADEMICO`, `TSDN_PROFESION` |
| `GET /api/sdn/ingresos`, `/deducciones` | conceptos | `TSDN_INGRESOS`, `TSDN_DEDUCCIONES` |
| `GET /api/sdn/cuentas-ingreso/<no_ingreso>`, `/cuentas-deduccion/<no_deduccion>` | cuentas contables por concepto | `TSDN_CUENTA_INGRESO`, `TSDN_CUENTA_DEDUCCION` |
| `GET /api/sdn/afp`, `/ars` | seguros | `TSDN_AFP`, `TSDN_ARS` |
| `GET /api/sdn/cotizaciones-ss`, `/semanas-cotizables` | SS | `TSDN_COTIZACIONES_SS`, `TSDN_SEMANAS_COTIZABLES` |
| `GET /api/sdn/escala-irs`, `/escala-meses?tipo={V,B,P}` | escalas | `TSDN_ESCALA_IRS`, `TSDN_ESCALA_MESES` |
| `GET /api/sdn/dias-feriados`, `/puestos-tss`, `/beneficiarios` | catalogos | `TSDN_DIAS_FERIADOS`, `TSDN_PUESTOS_TSS`, `TSDN_BENEFICIARIO` |
| `POST/PUT/DELETE` para cada catalogo segun permisos del usuario | upserts | (idem) |

#### 3.1.2 Frontend

- `routes/_authenticated/sdn.tsx` (layout con Header + Outlet).
- `routes/_authenticated/sdn/index.tsx` (dashboard del modulo con accesos rapidos).
- Sidebar: agregar NavCollapsible "Sistema de Nominas" agrupando Configuracion / Maestros / Procesos / Reportes / Cierre.
- `features/sdn/config/`: una vista por catalogo (companias, puntos, nominas, gerencias, areas, deptos, puestos, centros-trabajo, paises, parentescos, niveles-academicos, profesiones, ingresos, deducciones, afp, ars, cotizaciones-ss, semanas-cotizables, escala-irs, escala-meses, dias-feriados, puestos-tss, beneficiarios, grupo-contable, tipo-gastos, listado-servicios, puestos-servicios).
- Patron base: clonar literal arquitectura CxC `features/cxc/config/`.

### 3.2 Bloque B — Empleados (Maestro)

#### 3.2.1 Backend

- `GET /api/sdn/empleados?no_cia=&punto=&nomina=&q=&pagina=&estado={A,E}` — listado paginado server-side, indices en `TSDN_EMPLEADO.NO_CIA, PUNTO, NOMINA, NO_EMPLEADO`.
- `GET /api/sdn/empleados/<no_empleado>` — detalle (incluye foto blob, beneficiarios, historicos).
- `POST/PUT /api/sdn/empleados` — alta/edicion con validaciones: cedula unica por compania, NO_PUESTO_TSS valido, NOMINA activa, FECHA_INGRESO <= SYSDATE.
- `POST /api/sdn/empleados/<no>/egresar` — registra FECHA_EGRESO, congela movimientos.
- `GET /api/sdn/empleados/<no>/historico-salario` — `TSDN_INGRESOS` por empleado.
- `GET /api/sdn/empleados/<no>/acciones` — `TSDN_ACCIONES`.

#### 3.2.2 Frontend

- `features/sdn/empleados/` con DataTable, filtros (nomina, estado, departamento, gerencia), busqueda por cedula/nombre.
- Detalle/edicion con tabs: Datos personales, Laboral, Bancario, Beneficiarios, Foto, Historico salario, Acciones.

### 3.3 Bloque C — Acciones / Variacion Salarial

#### 3.3.1 Backend

- `GET /api/sdn/acciones?...filtros` listado.
- `POST /api/sdn/acciones` crear (clases B,D,F,I,J,K validadas via `TSDN_TIPO_ACCIONES`).
- `POST /api/sdn/acciones/<no>/autorizar` — `Fsdn507`: numera con `TSDN_CIAS.NO_ACCION + 1`, set `ST_ACTIVA='A'`, `AUTORIZADA_POR=USER`.
- `POST /api/sdn/acciones/aplicar` — `Fsdn508`: actualiza TSDN_EMPLEADO con la accion (cambio salario, traslado, egreso) y, en caso de egreso, desactiva en T*_USUARIO de todos los modulos.
- `GET /api/sdn/acciones/pdf/` — reporte.

#### 3.3.2 Frontend

- `features/sdn/acciones/` listado + crear + autorizar + aplicar (workflow estado: borrador → autorizada → aplicada).

### 3.4 Bloque D — Horas / Ingresos individuales

- `GET/POST /api/sdn/horas?no_cia=&punto=&nomina=&fecha=...` (`TSDN_HORAS_EMPLEADOS`).
- `POST /api/sdn/horas/autorizar` (set ESTADO='A').
- `GET/POST /api/sdn/calculo-ingresos` (`TSDN_CALCULO_INGRESOS` — montos individuales por empleado/concepto antes del calculo).
- `POST /api/sdn/calculo-ingresos/import-excel` (`Fsdn222`).
- `GET/POST /api/sdn/calculo-deducciones` (`TSDN_CALCULO_DEDUCCIONES` — descuentos por cuotas con referencia a CxC).

### 3.5 Bloque E — Calculo de nomina (forma motora)

`POST /api/sdn/nomina/calcular` (cuerpo: `no_cia, punto, nomina, ano, mes, periodo`).

Algoritmo (inferido de `Fsdn206.fmx`):
1. Auditoria: INSERT en `TSDN_AUDITORIA` proceso='U'.
2. Validar `TSDN_NOMINA.ESTADO='A'`, `CALCULO_NOMINA != 'C'` (no cerrada).
3. Para cada empleado activo en nomina:
   1. Ingresos: leer `TSDN_CALCULO_INGRESOS` y conceptos con `MULTIPLICADO_POR` (`SALARIO_MENSUAL`, `HORAS`, etc.), generar `TSDN_MOVIMIENTO` con `ORIGEN='N'`, `TIPO_TRANSACCION='I'`.
   2. Horas extras: leer `TSDN_HORAS_EMPLEADOS` estado='A', `CANTIDAD_HORA * PRECIO_HORA * factor`.
   3. Deducciones legales (TSS, AFP, ARS, INFOTEP): aplicar tasas con tope `TOPE_SALARIO_SS`. **Verificar contra norma TSS/INFOTEP RD**.
   4. ISR segun `TSDN_CIAS.MODO_CALCULO_ISR` y escala `TSDN_ESCALA_IRS`. **Verificar contra norma DGII RD**.
   5. Otras deducciones: leer `TSDN_CALCULO_DEDUCCIONES` (cuotas), generar movimientos `TIPO_TRANSACCION='D'`.
4. Marcar `TSDN_NOMINA.CALCULO_NOMINA='S'`.

`POST /api/sdn/nomina/recalcular-empleado` (recalculo individual).

### 3.6 Bloque F — Procesos anuales (Regalia / Vacaciones / Bonificacion)

- `POST /api/sdn/regalia/generar` (calcula `TSDN_CALCULO_REGALIA` = SUM(ENE..DIC+OTROS)/12 por empleado).
- `POST /api/sdn/regalia/archivo-banco` (genera `TSDN_ARCHIVO_BANCO ORIGEN='S'`).
- `GET /api/sdn/regalia/constancia/<no_empleado>/pdf/` (`Fsdn309`).
- `GET /api/sdn/regalia/reporte/pdf/` (`Fsdn305`).
- `POST /api/sdn/vacaciones/generar` (`Fsdn401` — escala V, dias feriados, inserta `TSDN_VACACIONES`).
- `GET/POST /api/sdn/vacaciones` mantenimiento (`Fsdn402`).
- `POST /api/sdn/vacaciones/calcular` (`Fsdn403` — genera `TSDN_MOVIMIENTO_TMP`).
- `POST /api/sdn/vacaciones/proceso` (`Fsdn407` — confirma, genera doc CxC por descuento via `TCXC_SECUENCIA`+`TCXC_DOCUMENTO`+`TCXC_REFEDOCU`, archiva en `TSDN_VACACIONESH`).
- `POST /api/sdn/vacaciones/archivo-banco` (`Fsdn405`).
- `POST /api/sdn/vacaciones/solicitud-cheques` (`Fsdn409`).
- `GET /api/sdn/vacaciones/reporte/pdf/`, `detalle/pdf/`, `dgt3/pdf/`.
- `POST /api/sdn/bonificacion/pagar` (`Fsdn315` — `TSDN_PAGO_BONIFICACION`, escala B).
- `POST /api/sdn/prestaciones/calcular` (preaviso + cesantia + vacaciones proporcionales). **Verificar contra Codigo de Trabajo RD**.

### 3.7 Bloque G — Reportes PDF

Endpoints `/api/sdn/<nombre>/pdf/` que reutilizan `apps/legacy/pdf_helpers.build_pdf_report`. Lista MINIMA garantizada (a expandir con auditoria de capturas hasta 50):

1. Volante de pago (por empleado, periodo).
2. Planilla / Informe de nomina (`Fsdn207`).
3. Reporte general (`Fsdn208`).
4. Reporte regalia/ISR (`Fsdn305`).
5. Reporte historico salario (`Fsdn308`).
6. Pago bonificaciones (`Fsdn315`).
7. Reporte vacaciones (`Fsdn404`).
8. Reporte detalle vacaciones (`Fsdn406`).
9. Reporte vacaciones DGT3 (`Fsdn408`).
10. Reporte de acciones (`Fsdn509`).
11. Reporte historico de nomina (REPORTE HISTORICO DE NOMINA del menu).
12. Reporte revision de saldos (REPORTE REV. DE SALDOS).
13. **Reportes fiscales DGT/TSS:** Archivo Autodeterminacion TSS (`Fsdn312`), Datos TSS (`Fsdn310`), DGT4 (`Fsdn314`), Archivo Banco (`Fsdn313`), Distribucion Monedas (`Fsdn311`).
14. Constancia pago regalia (`Fsdn309`).
15. Saldos menores por ajustar (Aplicar/Generar).

### 3.8 Bloque H — Cierre

- `POST /api/sdn/nomina/generar-asiento` (`Fsdn210`): para periodo cerrado con `CALCULO_NOMINA='S'`, generar `TSDN_DCNOMINA`, `TSDN_NOMINAH` (snapshot historico por empleado: INGRESOS, OTROS_INGRESOS, HORAS_EXTRAS, DEDUCCIONES, ISR), generar documentos CxC para empleados con cuotas descontadas, marcar `ST_GENERADO_CNT='S'`, auditoria proceso='C'.
- `POST /api/sdn/nomina/generar-solicitud-cheques` (`Fsdn212`/`Fsdn409` — integracion `TCHC_SECUENCIA`/`TCHC_TDOCU`).
- `POST /api/sdn/nomina/generar-archivo-banco` (`Fsdn313` — `TSDN_ARCHIVO_BANCO ORIGEN='N'`).
- `POST /api/sdn/nomina/cerrar-periodo` (avanza `TSDN_NOMINA.MES_PROCESO/ANO_PROCESO/PERIODO`, bloquea reprocesos, registra cierre).
- Validacion: no permitir cerrar si quedan movimientos con `GENERO_ED='N'` o documentos sin asiento.

---

## 4. Flujos criticos E2E (Playwright — 5)

1. **Alta de empleado** — Login → SDN → Empleados → Nuevo → llenar tabs → Guardar → aparece en listado con NOMINA y NO_PUESTO_TSS validos. Verificar HTTP 2xx y empleado consultable por cedula.
2. **Generar nomina quincenal** — SDN → Calculo → seleccionar nomina/ano/mes/periodo → Calcular → ver listado de movimientos generados (`TSDN_MOVIMIENTO` ORIGEN='N') → ver volante PDF de un empleado con ingresos, deducciones legales y neto correctos.
3. **Generar regalia anual** — SDN → Regalia → Generar (ano) → ver `TSDN_CALCULO_REGALIA` con SALARIO=SUM/12 → generar archivo banco → reporte regalia/ISR PDF.
4. **Cerrar periodo de nomina** — Calculo previo → Cierre → Generar asiento → ver `TSDN_DCNOMINA` con ST_GENERADO_CNT='S', `TSDN_NOMINAH` con snapshot → intentar cerrar nuevamente debe fallar con 409.
5. **Reporte TSS (Autodeterminacion)** — SDN → Reportes → Archivo Autodeterminacion TSS → seleccionar nomina/ano/mes → ver archivo TXT/PDF con cedulas, salarios, deducciones agregadas por empleado (TIPO_TRANSACCION='D', CLASE_TRANSACCION IN ('E','F')).

---

## 5. Queries a reconciliar con legacy (cabecera; el plan hijo lista todas)

| # | Reporte legacy | Query del clon (esperada) | Fuentes |
|---|---|---|---|
| 1 | Planilla / `Fsdn208` | `SELECT NO_EMPLEADO, NOMBRE, INGRESOS, DEDUCCIONES, NETO FROM TSDN_MOVIMIENTO+TSDN_EMPLEADO ... WHERE NO_CIA, PUNTO, NOMINA, ANO, MES, PERIODO` | `Fsdn208.fmx` |
| 2 | Volante de pago (por empleado) | Suma por concepto (`I` ingresos, `D` deducciones, ISR) para periodo | `Fsdn207.fmx`, `Fsdn208.fmx` |
| 3 | Archivo Autodeterminacion TSS | `SELECT NVL(SUM(H.MONTO_TRANSACCION),0) FROM TSDN_MOVIMIENTO H WHERE TIPO_TRANSACCION='D' AND CLASE_TRANSACCION IN ('E','F') GROUP BY NO_EMPLEADO` | `Fsdn312.fmx` |
| 4 | Reporte Regalia | `SELECT NO_EMPLEADO, ROUND(SUM(NVL(ENE,0)+...+NVL(DIC,0)+NVL(OTROS,0))/12, 2) FROM TSDN_CALCULO_REGALIA GROUP BY NO_EMPLEADO` | `Fsdn305.fmx` |
| 5 | Reporte Vacaciones DGT3 | `SELECT E.NO_EMPLEADO, E.NOMBRE, ... FROM TSDN_EMPLEADO E + TSDN_VACACIONES` | `Fsdn408.fmx` |
| 6 | Historico salario | `SELECT FROM TSDN_INGRESOS+TSDN_EMPLEADO WHERE empleado, fecha_i..fecha_f, status` | `Fsdn308.fmx` |
| 7 | Acciones autorizadas | `SELECT FROM TSDN_ACCIONES WHERE ST_ACTIVA='A' AND AUTORIZADA_POR IS NOT NULL` | `Fsdn507.fmx`/`Fsdn509.fmx` |
| 8 | Pago Bonificaciones | `SELECT R.NO_EMPLEADO, R.MONTO SALARIO, E.CUENTA_BANCO ... FROM TSDN_PAGO_BONIFICACION R, TSDN_EMPLEADO E` | `Fsdn315.fmx` |
| 9 | Distribucion monedas | `SELECT TIPO, MONTO FROM SDN.TSDN_DENOMINACIONES ORDER BY MONTO DESC` agrupado por nomina | `Fsdn311.fmx` |
| 10 | Asiento contable cierre | `SELECT FROM TSDN_DCNOMINA WHERE ANO, MES, NOMINA, PERIODO AND MONTO != 0` agrupado por cuenta | `Fsdn210.fmx` |

El plan hijo agrega queries detalladas para cada reporte/forma a medida que se implementa.

---

## 6. Opciones legacy descartadas (con justificacion)

- **Forms ACC referenciadas** (`Facc401.fmx`, `Facc402.fmx`, `Facc403.fmx`) que aparecen en la memoria SDN: pertenecen a Caja Chica; se descartan aqui (responsabilidad del modulo ACC).
- **"Activos Fijos", "Adm. Caja Chica", "Cheques y Conciliaciones", "Contabilidad General", "Cuentas Por Cobrar", "Cuentas Por Pagar", "Facturacion", "Inventario", "Ordenes de Compras"** del menu SDN: son **links a otros modulos**, no opciones funcionales propias. Se descartan (cubiertas por su modulo respectivo).
- **`ACCESAR`, `SALIR`, `MANTENIMIENTO DE SALDOS MENORES X AJUSTAR`** sin artefacto `.fmx` (Existe: False en memoria): se descartan o se reinterpretan como acciones del cierre cuando aplique.
- **Distribucion de Monedas (`Fsdn311`)**: si el cliente no paga en efectivo se descarta — confirmar con usuario.

---

## 7. Estimacion

- **Bloques:** 8 (A..H).
- **Tareas estimadas en el plan hijo:** 70–80.
- **Esfuerzo agregado:** este es **el modulo mas grande junto con CxP**, con calculos fiscales que requieren validacion contra normas DGT/TSS/INFOTEP/DGII RD; el calculo de horas/sesion no se compromete aqui — el plan hijo desglosa por tarea y se reevalua tras el bloque A.

---

## 8. Dependencias criticas (orden de implementacion dentro de SDN)

```
A Catalogos
  └─► B Empleados (necesita TSDN_NOMINA, TSDN_PUESTO, TSDN_GERENCIA, TSDN_AREA, TSDN_DEPTO)
        ├─► C Acciones (necesita TSDN_TIPO_ACCIONES, TSDN_MOTIVO, TSDN_EMPLEADO)
        └─► D Horas/Ingresos individuales (necesita TSDN_INGRESOS, TSDN_DEDUCCIONES, TSDN_EMPLEADO)
              └─► E Calculo de nomina (necesita TSDN_ESCALA_IRS, TSDN_COTIZACIONES_SS, TSDN_CIAS.MODO_CALCULO_ISR + D)
                    ├─► F Procesos anuales (necesitan E para regalia/vacaciones/bonificacion)
                    │     └─► G Reportes (gran parte requieren E o F finalizados)
                    └─► H Cierre (requiere E + G volante + integracion CxC/CHC/CNT)
```

**Reglas:** ningun bloque posterior puede empezar sin que su predecesor pase smoke E2E del flujo critico correspondiente.

---

## 9. Anti-objetivos

- No inventar formulas TSS/INFOTEP/ISR sin verificar contra norma vigente RD — bloquear y consultar al usuario.
- No re-implementar logica de modulos vecinos (CxC, CHC, CNT) — usar sus repos/endpoints existentes.
- No paralelizar bloques con dependencias (ver §8).
- No descartar reportes sin justificar (meta-spec §3.1).

---

## 10. Referencias

- Meta-spec: `2026-05-30-sigaft-meta-validacion-modulos-design.md`
- Memoria local: `memorias_por_modulo/memoria_nomina.md`
- MCP keys: `sigaf/module-memory-20260530-final/nomina/part-019..023`, `sigaf/module-memory-full-20260530/nomina/part-002,003,005,016`
- Skill agent: `oracle-sigaf-erp` (project=facture-project)
- Plan hijo: `plans/2026-05-30-sdn-construir-modulo.md`
