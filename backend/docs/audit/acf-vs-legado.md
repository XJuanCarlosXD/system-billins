# Auditoría ACF — clon vs legado (2026-07-07)

Profundiza el smoke del 2026-07-02. ACF **no tiene memoria legacy propia**
(`memorias_por_modulo/` no incluye activos fijos), así que esta auditoría no
puede comparar forma-por-forma; audita la funcionalidad construida
(spec 2026-06-19, commit 18f82d1) y la preparación de datos.

## Resumen

- **Los 36 endpoints `/api/acf/*` responden correctamente** (incl. 9
  print-data): catálogos CRUD, activos, compra/retiro, depreciación con
  preview, cierre mensual con status, 4 reportes.
- **El módulo está construido pero no operable**: sin activos ni catálogos ni
  cuentas contables. Todo el gap es de datos/negocio, no de código.
- 0 bloqueantes técnicos.

## Verificación en vivo (2026-07-07, producción, read-only)

| Endpoint | Resultado |
|----------|-----------|
| cias | 200 — 5 (sembradas 2026-07-03) — **cuenta_caja/ganancia/pérdida/superávit = NULL** |
| puntos | 200 — 1 (metodo 'L', período 2026/07) |
| marcas | 200 — 106 · departamentos 200 — 1 |
| categorias/grupos/subgrupos/responsables | 200 — **0 filas** |
| activos (cia01) | 200 — **0 filas** (TACF_ACTIVOS vacío) |
| rep-resumen/por-grupo/por-departamento/valuacion | 200 — estructuras correctas, vacías |
| depreciacion/preview | 200 — período/método/cantidad/total_estimado |
| cierre/status + cierres | 200 — status OK, 0 cierres |
| print-data listado + valuación | 200 — 0 filas (consistente) |

Compra/retiro/depreciación/cierre: solo-render (regla de producción); el flujo
transaccional fue probado con datos de prueba al construirse (2026-06-19).

## Gaps por severidad

### Mayores (todos de negocio, prerequisito para operar)
- [ ] **Capturar/migrar los activos reales** — TACF_ACTIVOS en 0. Sin esto el
  módulo no produce nada. Requiere levantamiento físico o migración desde el
  legado (si el legado ACF tiene datos en el server 10.0.0.51, extraerlos).
- [ ] **Sembrar catálogos**: categorías, grupos/subgrupos (con % depreciación
  fiscal DGII cat. 1/2/3), responsables.
- [ ] **Completar cuentas contables de TACF_CIAS** (cuenta_caja, ganancia y
  pérdida por venta, superávit) — sin ellas el asiento de retiro/depreciación
  no puede contabilizar.
- [ ] **Recuperar el inventario legacy ACF**: correr el extractor de memorias
  sobre `o:\gpsc\acf\formas\` para tener el catálogo Facf*/Racf* y poder
  auditar paridad real (hoy no hay fuente de verdad).

### Menores
- [ ] Depreciación US$ / revalorización: la valuación expone
  `revalorizacion`/`mejoras` pero no hay pantalla para registrarlas.
- [ ] Marcas=106 pobladas vs categorías=0 — confirmar de dónde salieron las
  marcas (¿migración parcial previa?) para completar el resto igual.

## Evidencia
- Sondeo `/tmp/acf_probe.sh` (contenedor facturation_backend, 2026-07-07).
  Solo GET/login; sin escrituras.
- Endpoints: `backend/apps/legacy/acf_urls.py` (36 rutas).
- Estado datos: memorias proyecto 2026-06-19 → 2026-07-03 (siembra TACF_CIAS/PUNTO).
