# Plan CNT — Completar módulo Contabilidad General

- Fecha: 2026-05-31
- Spec referenciado: `2026-05-30-cnt-completar-modulo-design.md`
- Meta-spec: `2026-05-30-sigaft-meta-validacion-modulos-design.md`
- Skill MCP recomendado: `oracle-sigaf-erp` (consultas Oracle, repos, queries); `cnt-legado-architecture` (UI legado).

## Convenciones

- Cada tarea: 2-5 minutos de trabajo dirigido (definir, mover, escribir, validar).
- Tareas marcadas `[VM]` requieren deploy con `pscp` y validar con `python -c "import ast..."` previo.
- Verificación: `pnpm typecheck` en frontend; `python -m py_compile` en backend.
- Capturas Playwright: `backend/docs/captures/cnt/<flujo>.png`.

---

## Fase 1 — Auditoría legado y matriz de comparación

1. `[doc]` Crear `backend/docs/32_cnt_comparacion_legado_pendiente.md` con encabezado y columnas: Área | Opción legado | Qué hace en el viejo | Ruta/UI nueva | API/tabla Oracle | Estado | Gap.
2. `[doc]` Poblar filas de **Configuración** (15 opciones legado del plan 31) en la matriz, marcando cada una con su estado actual.
3. `[doc]` Poblar filas de **Procesos** (10 opciones legado + variantes US) en la matriz.
4. `[doc]` Poblar filas de **Consultas** (3 opciones legado) en la matriz.
5. `[doc]` Poblar filas de **Reportes y Estados Financieros** (12+ opciones legado).
6. `[doc]` Poblar filas de **Cierres** (mensual + anual) y agregar sección de "Descartadas con justificación" del spec §6.
7. `[VM]` Subir `32_cnt_comparacion_legado_pendiente.md` con `pscp` a `backend/docs/`.

## Fase 2 — Limpieza UI (dialog → inline)

8. Mover `frontend/src/features/cnt/catalogo.tsx` de Dialog a vista inline densa (filtros junto al título; tabla full width; form lateral o panel inferior).
9. Mover `frontend/src/features/cnt/ncf.tsx` a vista inline densa.
10. Mover `frontend/src/features/cnt/centros-costo.tsx` a vista inline densa.
11. Confirmar `pnpm typecheck` sin errores y `[VM]` deploy de los 3 archivos.

## Fase 3 — Vistas faltantes (configuración)

12. Crear `frontend/src/features/cnt/usuarios-modulo.tsx` (CRUD acceso usuarios — Fcnt103) + entradas en `index.tsx`.
13. Crear `frontend/src/features/cnt/tipos-proyecto.tsx` (CRUD — backend ya OK).
14. Crear `frontend/src/features/cnt/proyectos.tsx` (CRUD completo) + endpoint `proyectos/` en backend.
15. Crear `frontend/src/features/cnt/componentes-proyecto.tsx` + endpoint `componentes/`.
16. Crear `frontend/src/features/cnt/localidades.tsx` + endpoint `localidades/`.
17. Crear `frontend/src/features/cnt/departamentos.tsx` + endpoint `departamentos/`.
18. Crear `frontend/src/features/cnt/direcciones-admin.tsx` + endpoint `direcciones-admin/`.
19. Crear `frontend/src/features/cnt/tipos-ncf.tsx` + endpoint `tipos-ncf/`.
20. Crear `frontend/src/features/cnt/catalogo-gob.tsx` (equivalencia gubernamental-comercial) + endpoint `catalogo-gob/`.
21. Crear `frontend/src/features/cnt/desbloquear-usuario.tsx` + endpoint `desbloquear-usuario/`.
22. Crear `frontend/src/features/cnt/asignar-centros-cuenta.tsx` (vista dedicada en lugar del flujo en dialog).

## Fase 4 — Vistas faltantes (procesos y consultas)

23. Crear `frontend/src/features/cnt/asientos-us.tsx` + `asiento-us-form.tsx` (clon del flujo asientos con `afecta_us='S'`); agregar endpoints `asientos-us/...` en backend.
24. Crear `frontend/src/features/cnt/consulta-asiento.tsx` (buscar asiento por no/ano/mes y mostrar líneas + documento origen TCxC/TCxP/TCHC/TACC/TACF).
25. Crear `frontend/src/features/cnt/consulta-movimientos.tsx` consumiendo endpoint `movimientos-cuenta` existente.
26. Crear `frontend/src/features/cnt/aplicar-saldos-menores.tsx` + endpoint backend.
27. Crear `frontend/src/features/cnt/generar-entrada-nomina.tsx` + endpoint (lee `TNOM_DCCUENTAS`).
28. Crear `frontend/src/features/cnt/modificar-ed-nomina.tsx` + endpoint.
29. Ampliar `presupuesto.tsx` con tabs Inicial / Ajustes / Ejecución y endpoints `presupuesto/{inicial,ajustes,ejecucion}/`.

## Fase 5 — Reportes UI + endpoints PDF (extender `pdf_helpers.build_pdf_report`)

30. Endpoint `cnt/balance/pdf/` (Balance Comprobación) — query saldos `TCNT_BCUENTA` + header empresa real.
31. Endpoint `cnt/mayor/pdf/` (Rcnt201) — query movimientos por cuenta y rango de meses.
32. Endpoint `cnt/estado-resultados/pdf/` y `cnt/balance-general/pdf/` — líneas EF agrupadas.
33. Endpoint `cnt/verificar-asientos/pdf/` (Rcnt210) — descuadres por asiento.
34. Endpoint `cnt/historico-asientos/pdf/` (Rcnt316) — libro diario por mes.
35. Endpoint `cnt/historico-transacciones/pdf/` (Rcnt315) — movimientos con origen.
36. Endpoint `cnt/catalogo/pdf/` (Rcnt301) + `cnt/catalogo-sucursal/pdf/` (Rcnt317).
37. Endpoint `cnt/centros-costo/pdf/` (Rcnt310) + `cnt/cuentas-con-centros/pdf/` (Rcnt311).
38. Endpoint `cnt/proyectos/pdf/` (Rcnt312) + `cnt/gastos-proyecto/pdf/` (Rcnt204 variante).
39. Endpoint `cnt/presupuesto/pdf/` (Rcnt202 + Rcnt204 parametrizado).
40. Crear vista `frontend/src/features/cnt/anexos-ef.tsx` (CRUD `TCNT_LINEAS_EF` / `TCNT_CUENTAS_EF`) + endpoints `lineas-ef/`, `cuentas-ef/`.

## Fase 6 — Cierres

41. Implementar `cierre-anual.tsx` (Fcnt402) — traslado utilidad retenida a `TCNT_CIAS.UTILIDAD_RETENIDA` + bloqueo del año + endpoint `cierre-anual/`.
42. Validar que el flujo `cierre-mensual` actual escribe en `TCNT_CIERRE` y actualiza `TCNT_PUNTO.MES_PROCESO`; agregar test unitario backend.

## Fase 7 — Reconciliación SQL (DoD §3.2)

43. Documentar query exacta del clon para cada uno de los 7 reportes clave en `backend/docs/captures/cnt/sql/<reporte>.sql`.
44. Ejecutar las 7 queries contra Oracle producción (lectura) y exportar resultados a CSV en la misma carpeta.
45. Comparar lado-a-lado con `.rep` legacy (capturas en `capturas/contabilidad/`) y registrar discrepancias en `32_cnt_comparacion_legado_pendiente.md`.

## Fase 8 — Playwright E2E (DoD §3.3)

46. Crear `frontend/e2e/cnt/01-crear-asiento.spec.ts` (crear → autorizar → actualizar, verificar HTTP 2xx + cero console.error + screenshot).
47. Crear `frontend/e2e/cnt/02-balance-comprobacion-pdf.spec.ts` (filtros + descarga PDF + verificar título y razón social).
48. Crear `frontend/e2e/cnt/03-cierre-mensual.spec.ts` (precond: período abierto; verificar bloqueo de reproceso).
49. Crear `frontend/e2e/cnt/04-estado-resultados.spec.ts` (generar EF + PDF).
50. Crear `frontend/e2e/cnt/05-libro-diario.spec.ts` (histórico de transacciones del mes + PDF).

## Fase 9 — Limpieza y cierre

51. `grep -rE "TODO|FIXME|XXX" backend/apps/cnt/ frontend/src/features/cnt/` → debe retornar cero matches. Mover pendientes a issues.
52. Verificar permisos en cada nueva vista: llamada a `permissions_repo.get_for(user, 'CNT', no_cia, punto)` con HTTP 403 si `None`/`not activo`.
53. Confirmar `pnpm typecheck` sin errores y `python -m py_compile` en todos los archivos `apps/cnt/`.
54. Actualizar dashboard `backend/docs/superpowers/00_roadmap_avance.md` con DoD 3.1-3.4 ✅ para CNT.
55. `[VM]` Deploy final con `pscp` de todos los archivos modificados; smoke manual en `https://<host>/cnt`.
56. Cerrar el módulo: PR con evidencias (capturas Playwright + screenshots SQL + matriz audit).

---

## Notas de ejecución

- **Capturas legado**: usar `C:\Users\JCABREU\AppData\Local\memorias_sigaft\capturas\contabilidad\` (49 PNGs) para validar densidad / textos / orden de columnas de cada vista nueva.
- **Skill MCP**: `memory_dispatch("oracle-sigaf-erp", task="<query/repo concreto>")` cuando una tarea requiera reglas Oracle 11g específicas (especialmente fases 5 y 7).
- **Plantilla densa**: full width, sin `max-w`, filtros junto al título, tabla a ancho completo, form lateral en `Sheet`/`Card` inline. No volver a abrir Dialog modal para CRUDs.
- **Multi-moneda**: si el usuario confirma que la empresa activa NO opera en US, las tareas 23 y endpoints US se aplazan; documentar en spec §6.
