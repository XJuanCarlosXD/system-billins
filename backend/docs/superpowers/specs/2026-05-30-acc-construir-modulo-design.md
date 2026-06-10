# Spec módulo ACC (Adm. Caja Chica)

- **Fecha:** 2026-05-30
- **Estado:** Borrador inicial — listo para plan
- **Meta-spec referenciado:** `2026-05-30-sigaft-meta-validacion-modulos-design.md`
- **Memoria técnica:** `memorias_por_modulo/memoria_adm_caja_chica.md` (39 opciones menú, 30 formularios, 7 reportes; tablas autoritativas)
- **Conteo legacy (MCP `project/modules-inventory`):** 24 forms / 11 reports — **el módulo más chico del lote**.

---

## 1. Inventario actual del módulo

**Backend:** No existe `apps/acc/`, ni `apps/legacy/acc_*.py`, ni `acc_repo.py`. Confirmado vía VM 10.0.0.99:
```
NONE_BACKEND_LEGACY
NONE_BACKEND_APP
NONE_FEATURES
NONE_ROUTES
```

**Frontend:** No existe `frontend/src/features/acc/` ni `frontend/src/routes/_authenticated/acc/`.

**Estado real:** **CERO** implementación. Quick-win candidato — se construye desde cero clonando arquitectura ya estable de FAT/CxC.

**Capturas legacy disponibles:** `C:\Users\JCABREU\AppData\Local\memorias_sigaft\capturas\adm_caja_chica\` (verdad visual).

---

## 2. Gap con el legacy

Brecha total: **100%** vs 24 forms / 11 reports legacy autoritativos. Detalle (consolidado por familia):

### 2.1. Configuración / Maestros (8 forms)
- `Facc101` Mantenimiento de Compañías (TACC_CIAS)
- `Facc102` Mantenimiento de Puntos de Trabajo (TACC_PUNTO)
- `Facc103` Mantenimiento de Acceso al Sistema (TACC_USUARIO/TACC_USUARIOC) — permisos por usuario y por caja
- `Facc104` Mantenimiento de Caja Chica (TACC_CAJA_CHICA) — monto del fondo, cuenta contable, NCF asociado, moneda P/D
- `Facc105` Mantenimiento Tipo de Gastos (TACC_TGASTOS) — código → cuenta + centro_costo
- `Facc106` Mantenimiento Tipo de Beneficiarios (TACC_TBENEFICIARIO)
- `Facc107` Mantenimiento de Beneficiarios (TACC_BENEFICIARIO + TACC_PROX_BENE secuencia)

### 2.2. Transaccional / Procesos (6 forms)
- `Facc201` Entrada de Documentos/Comprobantes (TACC_DOCUMENTO + TACC_DCDOCU; NCF DGI, forma_pago DGII, tipo_gasto, beneficiario)
- `Facc202` Imprimir Reposición de Caja Chica (TACC_REPOSICION; consume NCF de TCNT_NCF + log TCNT_HNCF)
- `Facc203` Generar Solicitud Cheque de Reposición (integra con TCHC_CHEQUE)
- `Facc204` Corregir NCF y Otros Datos (UPDATE selectivo sobre TACC_DOCUMENTO post-creación)
- `Facc205` Anular Reposición de Caja Chica (TACC_DOCU_REPO_NULA + reversión)

### 2.3. Cierre / Contabilidad (3 forms)
- `Facc401` Impresión Entrada de Diario (TACC_ED working table)
- `Facc402` Generación del Asiento Contable (UPDATE TACC_DOCUMENTO ST_GENERADO_CNT='S', integra con CNT)
- `Facc403` Cierre Mensual (INSERT TACC_CIERRE + UPDATE TACC_PUNTO período proceso)

### 2.4. Consultas (2 forms)
- `Facc501` Consulta de Documentos
- `Facc502` Consulta Reposición de Caja Chica

### 2.5. Reportes PDF (11 reportes — autoritativos del MCP)
Memoria local detecta 7 archivos `.rep`; meta-spec conteo MCP indica 11. Adoptar **11 como objetivo** y documentar los 4 extra al investigar capturas. Reportes confirmados:
- `Racc201.rep` Reporte Movimientos Pendientes (filtros: fecha, caja, moneda, saldado P/S/Ambos)
- `Racc203.rep` Facturación (movimientos por caja/período)
- `Racc301.rep` Listado documentos por beneficiario/tipo_gasto
- `Racc302.rep` Listado documentos por caja/período
- `Racc303.rep` Listado documentos por moneda
- `Racc304.rep` Listado de Beneficiarios (filtro tipo_bene, activo S/N/T, fecha)
- `Racc203` (FACTURACION) — verificar si es duplicado de 203
- **4 reportes adicionales por descubrir** (la memoria local subreporta; usar capturas legacy).

### 2.6. Reglas DGI / contables que faltan
- NCF formato real DGI en reposiciones (helper `_compose_ncf_dgi`).
- Validación período abierto antes de grabar (ANO_PROCESO/MES_PROCESO de TACC_PUNTO).
- Forma de pago DGII (TCXP_FORMA_PAGO_DGII lookup).
- Tipo de gasto DGII (TCXP_TCOSTO_GASTO lookup).

---

## 3. Trabajo a realizar

### 3.1. Vistas/pantallas (frontend `features/acc/`)
1. `acc/maestros/cajas-chicas` — CRUD TACC_CAJA_CHICA
2. `acc/maestros/beneficiarios` — CRUD TACC_BENEFICIARIO (auto-secuencia)
3. `acc/maestros/tipos-beneficiario` — CRUD TACC_TBENEFICIARIO
4. `acc/maestros/tipos-gasto` — CRUD TACC_TGASTOS
5. `acc/maestros/puntos-trabajo` — CRUD TACC_PUNTO (solo si no se hereda de CNT)
6. `acc/maestros/usuarios` — permisos TACC_USUARIO/TACC_USUARIOC
7. `acc/documentos/nuevo` — formulario entrada (Facc201)
8. `acc/documentos/lista` — listado + filtros + drill a detalle
9. `acc/documentos/:id` — vista detalle/edición + corrección NCF (Facc204)
10. `acc/reposiciones/nueva` — flujo imprimir reposición (Facc202)
11. `acc/reposiciones/lista` — listado + consulta (Facc502)
12. `acc/reposiciones/:id/anular` — Facc205
13. `acc/reposiciones/:id/solicitud-cheque` — integración CHC (Facc203)
14. `acc/cierre/mensual` — Facc403
15. `acc/cierre/asiento-contable` — Facc402
16. `acc/reportes` — hub de los 11 PDFs

### 3.2. Endpoints backend
- `apps/acc/views.py` + `apps/legacy/acc_repo.py` (patrón FAT/CxC).
- URLs: `apps/acc/urls.py` montadas en `/api/acc/`.
- Endpoints clave:
  - CRUD cajas, beneficiarios, tipos_bene, tipos_gasto (GET/POST/PUT/DELETE)
  - `POST /api/acc/documentos/` (crear con validación período + permisos)
  - `GET /api/acc/documentos/` (paginado, filtros caja/fecha/beneficiario)
  - `PATCH /api/acc/documentos/:id/ncf` (Facc204)
  - `POST /api/acc/reposiciones/` (consume NCF, registra TCNT_HNCF)
  - `POST /api/acc/reposiciones/:id/anular`
  - `POST /api/acc/reposiciones/:id/solicitud-cheque`
  - `POST /api/acc/cierre/asiento` (genera TACC_ED → asiento CNT)
  - `POST /api/acc/cierre/mensual`
  - 11 endpoints `/pdf/` (uno por reporte) usando `pdf_helpers.build_pdf_report`

### 3.3. Reportes PDF (11)
Cada uno usa `apps/legacy/pdf_helpers.py:build_pdf_report` con header/footer estándar (§5 meta-spec). Aporte por reporte: query, columnas, totales, filtros.

### 3.4. Bugs a corregir
N/A — construcción desde cero. Aplicar de entrada las restricciones técnicas §4 del meta-spec.

---

## 4. Flujos críticos para E2E Playwright (5)

1. **Crear documento de caja chica** — login → seleccionar caja → nuevo doc → completar beneficiario, tipo_gasto, NCF, monto, forma_pago → guardar → aparece en lista con estado pendiente de reposición.
2. **Generar reposición de caja chica con NCF DGI** — selecciona docs pendientes → genera reposición → consume NCF de TCNT_NCF (verifica `PROX_NCF++`, inserta TCNT_HNCF) → PDF reposición se imprime con NCF formato DGI.
3. **Anular reposición** — abre reposición existente → anular → verifica TACC_DOCU_REPO_NULA + docs vuelven a estado pendiente.
4. **Generar asiento contable** — selecciona período → genera asiento → verifica UPDATE TACC_DOCUMENTO.ST_GENERADO_CNT='S' + integración con CNT (asiento aparece en CNT).
5. **Reporte Movimientos Pendientes PDF** — abre `/acc/reportes` → selecciona Racc201 → filtros (caja, fecha, moneda, saldado) → PDF descargado, header con razón social real, totales correctos.

---

## 5. Queries a reconciliar con legacy

| # | Reporte legacy | Query (resumen) | Tablas |
|---|---|---|---|
| Q1 | `Racc201.rep` Movimientos Pendientes | `SELECT d.no_docu, d.fecha, b.nombre, g.descripcion, d.monto, d.saldado FROM TACC_DOCUMENTO d, TACC_BENEFICIARIO b, TACC_TGASTOS g WHERE d.no_cia=:b1 AND d.punto=:b2 AND d.no_caja=:b3 AND d.fecha BETWEEN :b4 AND :b5 AND b.no_bene=d.no_bene AND g.tipo_gasto=d.tipo_gasto` | TACC_DOCUMENTO, TACC_BENEFICIARIO, TACC_TGASTOS |
| Q2 | `Racc203.rep` Facturación | `SELECT ... FROM TACC_DOCUMENTO d, TACC_REPOSICION r WHERE d.no_reposicion=r.no_reposicion AND r.fecha BETWEEN ...` | TACC_DOCUMENTO, TACC_REPOSICION |
| Q3 | `Racc301.rep` Por beneficiario/tipo_gasto | `SELECT ... GROUP BY no_bene, tipo_gasto` | TACC_DOCUMENTO, TACC_BENEFICIARIO, TACC_TGASTOS, TACC_USUARIOC |
| Q4 | `Racc302.rep` Por caja/período | mismo patrón Q1 con grouping por no_caja | TACC_DOCUMENTO, TACC_CAJA_CHICA |
| Q5 | `Racc303.rep` Por moneda | filtro adicional `caja.moneda IN ('P','D','T')` | TACC_CAJA_CHICA |
| Q6 | `Racc304.rep` Beneficiarios | `SELECT a.nombre, a.no_bene, a.fecha, d.tipo_bene||' '||d.descripcion FROM TACC_BENEFICIARIO a, TACC_TBENEFICIARIO d WHERE a.tipo_bene=d.tipo_bene AND (a.activo=:p_activo OR :p_activo='T')` | TACC_BENEFICIARIO, TACC_TBENEFICIARIO |
| Q7 | Saldo Caja Chica (consulta) | `SELECT cc.monto - NVL(SUM(d.monto),0) saldo FROM TACC_CAJA_CHICA cc LEFT JOIN TACC_DOCUMENTO d ON d.no_caja=cc.no_caja AND d.saldado='N' WHERE cc.no_cia=:b1 AND cc.punto=:b2 AND cc.no_caja=:b3 GROUP BY cc.monto` | TACC_CAJA_CHICA, TACC_DOCUMENTO |

Procedimiento estándar §6 meta-spec aplica a cada uno: ejecutar query del clon vs query del `.rep` legacy y comparar conteo + sumas + muestra 10 filas.

---

## 6. Opciones legacy descartadas con justificación

- **Entradas redundantes del menú** ("Cuentas Por Cobrar (Fmenu cxc -> menu cxc)", "Activos Fijos (Fmenu acf...)", etc. detectadas en la sección Navegación/Especial de la memoria): son links cruzados al menú general, no son funcionalidad ACC. Se descartan porque el menú global del clon ya provee navegación entre módulos.
- **`fcxp203` / `rcxp202.rep`**: reporte de CxP detectado por referencia cruzada en binarios ACC. Pertenece al módulo CxP, no a ACC. Descartado en el scope ACC.
- **Reportes "extras" sobre el conteo MCP (11) si capturas confirman <11**: documentar al iterar.

---

## 7. Estimación

- **Tareas plan:** ~22 (quick-win, ver plan hijo).
- **Esfuerzo agregado:** 4-6 días de desarrollo enfocado (1 dev). Construcción desde cero pero alcance acotado: pocos formularios, sin reglas de empaque-CPE ni paridades complejas tipo FAT/INV/SDN.
- **Riesgos:** bajo. Integración con CNT (asiento contable) y CHC (solicitud cheque) son los puntos de mayor cuidado — reusar helpers existentes.

---

## 8. Memorias relacionadas

- `sigaft/module-memory-20260530-final/adm_caja_chica/part-001..009` (MCP)
- `project/modules-inventory` (MCP) — conteo autoritativo 24/11
- `project-sigaft-ncf-schema` — composición NCF DGI
- Skill agent MCP: `oracle-sigaf-erp`
