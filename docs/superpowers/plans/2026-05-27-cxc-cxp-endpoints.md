# CxC + CxP Endpoints — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **MODELO:** ejecutar agentes de bulk en `sonnet` (regla de tokens del proyecto). Reservar opus solo para el chat principal.

**Goal:** Verificar que TODOS los endpoints backend de CxC funcionan (auditoría + fix), y construir/verificar TODOS los endpoints backend de CxP para que cada vista del sidebar de CxP tenga backend real (hoy varias son placeholder).

**Architecture:** Django en `backend/apps/legacy/` — vistas + `repositories/<mod>_repo.py` usando `client.fetch_dicts(sql, params)` / `client.cursor()` contra Oracle (esquemas `CXC.`/`CXP.`, tablas `TCXC_*`/`TCXP_*`). **CxC usa class-based views** (`SomeView.as_view()` en `cxc_urls.py`); **CxP usa function views** (`@csrf_exempt @require_http_methods` en `cxp_urls.py`). Frontend tanstack-router ya tiene las rutas CxP creadas (varias renderizan `cxp-placeholder.tsx`); reemplazar placeholders con componentes reales que llaman `regalGeneralApi` con el helper `request<T>` (NUNCA el axios `instance`, está roto).

**Tech Stack:** Django + oracledb (thick mode, pool), React + Vite + @tanstack/router, Oracle 11g.

**INFRA (fuente de verdad = VM, NO git):**
- VM `jcabreu@10.0.0.99` (Ubuntu, Docker Compose; frontend vite :5173 auto-reload, backend Django :8000). El repo local NO está al día.
- Tools Windows (Bash tool): `/c/Users/JCABREU/bin/pscp` (transferencia, fiable) y `/c/Users/JCABREU/bin/plink` (shell). Flags SIEMPRE: `-batch -pw 'Temp1234!' -hostkey 'SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc'`. Usar `timeout 35` en llamadas plink.
- Flujo por archivo: `pscp` baja de VM → editar en `/tmp` → `pscp` sube. Subir `.tsx`/`.py` recarga solo (sin rebuild).
- REGLA anti-pisado: antes de subir cualquier archivo que pueda existir más desarrollado en la VM, **bajarlo primero** de la VM y editar sobre esa versión.
- Oracle REAL: cualquier INSERT/UPDATE de prueba usar marca `ZZTEST` y borrarlo después.
- Rutas VM: backend `~/facturation-system/backend/apps/legacy/` (`cxc_urls.py`, `cxc_views.py`, `cxp_urls.py`, `cxp_views.py`, `repositories/cxc_repo.py`, `repositories/cxp_repo.py`), montaje principal en `backend/facturation_api/urls.py`. Frontend `~/facturation-system/frontend/src/` (`routes/_authenticated/cxp/*.tsx`, `features/cxp/*.tsx`, `lib/regal-general-api.ts`, `components/layout/data/sidebar-data.ts`).

**Fuentes visuales (paridad legado):** capturas en `C:\Users\JCABREU\AppData\Local\memorias_sigaft\capturas\Cuentas por Pagar\` (PNG timestamp — abrir 5-6 máx por sección), `archivo_606/607/623_*.txt` (formatos DGII compras), `impresion_doc_AC/AD/BD/FP_*.pdf`, `reporte_por_doc_cxp.pdf`.

---

## PATRONES DE REFERENCIA (copiar literal)

### Patrón repo (repositories/cxp_repo.py)
```python
from __future__ import annotations
from .. import client

def list_xxx(search='', activo=''):
    conditions = ['1=1']; params = []
    if search:
        params += [f'%{search.upper()}%']
        conditions.append(f"UPPER(t.nombre) LIKE :{len(params)}")
    where = ' AND '.join(conditions)
    sql = f"SELECT t.col1, t.col2 FROM CXP.TCXP_XXX t WHERE {where} ORDER BY t.col1"
    return client.fetch_dicts(sql, params)

def save_xxx(data: dict):
    with client.cursor() as cur:
        cur.execute("UPDATE CXP.TCXP_XXX SET col1=:1 WHERE pk=:2", [data.get('col1'), data.get('pk')])
        # o INSERT si no existe; commit lo maneja el context manager / client
```

### Patrón function view CxP (cxp_views.py)
```python
@csrf_exempt
@require_http_methods(['GET', 'POST'])
def cxp_xxx(request):
    if request.method == 'GET':
        rows = cxp_repo.list_xxx(search=request.GET.get('search',''))
        return JsonResponse(rows, safe=False)
    data = json.loads(request.body)
    return JsonResponse(cxp_repo.save_xxx(data), status=201)
```

### Patrón url CxP (cxp_urls.py)
```python
path('xxx/', cxp_views.cxp_xxx),
path('xxx/<str:no>/', cxp_views.cxp_xxx_detail),
```

### Descubrir columnas Oracle ANTES de escribir SQL (obligatorio, exact-clone)
Ejecutar vía el contenedor backend en la VM:
```bash
timeout 40 /c/Users/JCABREU/bin/plink -batch -pw 'Temp1234!' -hostkey 'SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc' jcabreu@10.0.0.99 \
 "docker exec facturation_backend python -c \"from apps.legacy import client; import json; print(json.dumps(client.fetch_dicts(\\\"SELECT column_name, data_type, nullable FROM all_tab_columns WHERE owner='CXP' AND table_name='TCXP_XXX' ORDER BY column_id\\\", [])))\""
```
Y para listar tablas candidatas de un dominio:
```sql
SELECT table_name FROM all_tables WHERE owner='CXP' AND table_name LIKE 'TCXP_%' ORDER BY table_name
```
(idéntico con owner='CXC' / 'TCXC_%').

### Patrón frontend (reemplazar placeholder)
- `features/cxp/cxp-<vista>.tsx`: componente que recibe `{ noCia, punto }`, hace fetch vía `regalGeneralApi.cxp<Algo>(...)`, render con la misma UI/tabla que su gemelo en `features/cxc/`.
- `routes/_authenticated/cxp/<vista>.tsx`: importa el componente y le pasa `noCia/punto` de `useCompany()` (copiar de una ruta CxP ya funcional como `proveedores.tsx`).
- `lib/regal-general-api.ts`: añadir método `cxp<Algo>` con `request<T>('/api/cxp/<ruta>/', ...)`.

---

## FASE 0 — Setup y conectividad

### Task 0: Verificar VM, contenedores y baseline
- [ ] **Step 1:** Conectividad + contenedores vivos.
  Run: `timeout 35 /c/Users/JCABREU/bin/plink -batch -pw 'Temp1234!' -hostkey 'SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc' jcabreu@10.0.0.99 "docker ps --format '{{.Names}}: {{.Status}}'"`
  Expected: `facturation_frontend` y `facturation_backend` `Up`.
- [ ] **Step 2:** Baseline tsc del frontend (para no atribuir errores previos a este trabajo).
  Run: `... "docker exec facturation_frontend sh -lc 'cd /app && npx tsc --noEmit'"` (timeout 120000).
  Expected: registrar EXIT actual (debería ser 0 tras el build previo de CxP).
- [ ] **Step 3:** Confirmar includes en `backend/facturation_api/urls.py`: deben existir `path('api/cxc/', include('apps.legacy.cxc_urls'))` y `path('api/cxp/', include('apps.legacy.cxp_urls'))`.
  Run: `... "grep -nE 'api/cx[cp]' ~/facturation-system/backend/facturation_api/urls.py"`
  Expected: ambas líneas presentes. Si falta alguna, añadirla (bajar urls.py, editar, subir).

---

## FASE A — Auditoría CxC (verificar TODO)

CxC backend declara 31 endpoints en `cxc_urls.py` (Configuración, Clientes, Documentos, Procesos, Consultas, Reportes, Cierre). Objetivo: smoke-test cada uno y arreglar los que fallen.

### Task A1: Smoke-test de todos los endpoints GET de CxC
- [ ] **Step 1:** Obtener un `no_cia`/`punto` válido (usar el de la empresa por defecto; tomarlo de `/api/companies/` o de un proveedor/cliente existente).
- [ ] **Step 2:** Curl a cada ruta GET de `cxc_urls.py` y registrar http code + primeros 200 chars. Para rutas que requieren query params (documentos, estado-cuenta, reportes, etc.) pasar params mínimos válidos.
  Ejemplo: `... "curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:8000/api/cxc/cias/'"` y `... "curl -s 'http://localhost:8000/api/cxc/clientes/?no_cia=01' | head -c 200"`.
  Lista a probar (de cxc_urls.py): cias, puntos, tdocu, tcli, supervisores, vendedores, rutas, tcontable, ciudades, barrios, zonas, cadenas, clientes, clientes-ruta, documentos, next-doc, estado-cuenta, balance-clientes, historico, libro-ventas, rep-envejecimiento, rep-cobros-vendedor, rep-comisiones, rep-ncf, asiento-contable, generar-asiento, cierre.
- [ ] **Step 3:** Construir una tabla: ruta | http | ¿devuelve datos? | error. Marcar OK / FALLA.
- [ ] **Step 4 (commit lógico):** No hay git; el "commit" es dejar registrado el estado en el reporte.

### Task A2: Arreglar endpoints CxC que fallen
- [ ] **Step 1:** Para cada FALLA: leer la vista (`cxc_views.py`) y la función repo (`cxc_repo.py`) correspondiente (grep dirigido por el nombre).
- [ ] **Step 2:** Reproducir el error: `... "docker logs --tail 60 facturation_backend"` tras el curl que falló — capturar traceback Oracle/Python.
- [ ] **Step 3:** Si es columna/tabla mal nombrada: confirmar con la query `all_tab_columns` (owner='CXC'). Corregir SQL en el repo.
- [ ] **Step 4:** Bajar el archivo de la VM, editar, subir con pscp. Re-curl. Expected: 200 + datos.
- [ ] **Step 5:** Repetir hasta que todos los endpoints CxC den 200 (o documentar los que dependen de datos inexistentes, no de bugs).

---

## FASE B — Backend CxP (construir lo faltante + verificar lo existente)

### Existentes a VERIFICAR (ya en cxp_urls.py): proveedores (list/detalle/cuenta/cuentas/movimientos), documentos (list/detalle), aging, tipos-docu.
### Faltantes a CONSTRUIR (hoy placeholder en frontend):
- **Configuración:** cias, puntos, tproveedores (tipos de proveedor), tdocu (tipos de documento CxP), usuarios (acceso), ciudades, barrios.
- **Procesos:** entrada-documentos (alta DR/CR), reversar, liberar-debito, bloquear-pago.
- **Reportes:** 606 (ITBIS compras locales), 607 (retenciones), alfabético de proveedores, mayor auxiliar CxP, cuadre contable, certificado retención.
- **Cierre:** asiento-contable, generar-asiento, cierre mensual.

### Task B0: Verificar endpoints CxP existentes
- [ ] **Step 1:** Curl GET a proveedores/, documentos/, aging/, tipos-docu/ con params válidos. Registrar http + datos.
- [ ] **Step 2:** Arreglar cualquiera que falle (mismo método que Task A2). Expected: todos 200.

### Task B1..Bn: por cada endpoint FALTANTE (repetir este patrón, un endpoint por task)
Para cada vista de la lista "Faltantes":
- [ ] **Step 1: Descubrir Oracle.** Identificar la(s) tabla(s) `CXP.TCXP_*` que respalda la opción legado (apoyarse en las capturas + `all_tables`). Confirmar columnas/PK con la query `all_tab_columns` (ver patrón arriba). NO escribir SQL sin esto.
- [ ] **Step 2: Repo.** Añadir función(es) en `cxp_repo.py` siguiendo el patrón repo (fetch_dicts para list/get; cursor para save/proceso). Para reportes: query agregada read-only.
- [ ] **Step 3: View.** Añadir function view en `cxp_views.py` (`@csrf_exempt @require_http_methods`).
- [ ] **Step 4: URL.** Añadir `path('<ruta>/', cxp_views.cxp_xxx)` en `cxp_urls.py`.
- [ ] **Step 5: Deploy.** Bajar de VM los 3 archivos, editar, subir con pscp (orden: repo → views → urls).
- [ ] **Step 6: Verificar.** `curl http://localhost:8000/api/cxp/<ruta>/` → 200 + datos reales. Revisar `docker logs --tail 40 facturation_backend` si falla.
- [ ] **Step 7: Commit lógico.** Registrar en el reporte: ruta creada, tabla/PK usada, http result.

**Notas por dominio:**
- **Procesos (reversar, liberar-debito, bloquear-pago, entrada-documentos):** son escritura → usar `client.cursor()`, validar reglas del legado (ver capturas), y PROBAR con marca `ZZTEST` que luego se borra. Confirmar con el usuario antes de procesos irreversibles sobre datos reales.
- **Reportes 606/607:** el formato de salida debe matchear los `.txt` de DGII (`archivo_606_*.txt`, `archivo_607_*.txt`); el endpoint puede devolver JSON y el frontend arma el .txt, o el endpoint genera el texto. Decidir mirando cómo lo hace CxC `rep-ncf`/`libro-ventas`.
- **Cierre/asiento:** mirar el gemelo CxC (`asiento-contable`, `generar-asiento`, `cierre`) como plantilla literal de la lógica contable.

---

## FASE C — Frontend CxP: reemplazar placeholders por vistas reales

Por cada endpoint CxP nuevo que quede funcional en Fase B:
### Task C1..Cn (un task por vista)
- [ ] **Step 1:** Añadir método `cxp<Algo>` en `lib/regal-general-api.ts` con `request<T>` apuntando a `/api/cxp/<ruta>/`.
- [ ] **Step 2:** Crear `features/cxp/cxp-<vista>.tsx` clonando el gemelo de `features/cxc/` (misma tabla/form/UI).
- [ ] **Step 3:** Editar `routes/_authenticated/cxp/<vista>.tsx`: dejar de importar `cxp-placeholder` y renderizar el componente real con `noCia/punto` de `useCompany()`.
- [ ] **Step 4:** Subir con pscp (regal-general-api.ts → feature → route). Vite recarga solo.
- [ ] **Step 5:** Verificar: `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/cxp/<vista>` → 200, y que la vista pinte datos (revisar logs vite por errores de parse).

---

## FASE D — Validación final

### Task D1: Build + smoke completo
- [ ] **Step 1:** `docker exec facturation_frontend sh -lc 'cd /app && npx tsc --noEmit'` → EXIT 0. Si falla, arreglar tipos antes de continuar.
- [ ] **Step 2:** `docker logs --tail 60 facturation_frontend` → sin errores de compilación (solo HMR).
- [ ] **Step 3:** Curl http code de cada ruta `/cxc/*` y `/cxp/*` del sidebar → todos 200.
- [ ] **Step 4:** Curl a cada endpoint `/api/cxc/*` y `/api/cxp/*` → 200 + datos. Tabla final OK/FALLA.

### Task D2: Reporte + memoria
- [ ] **Step 1:** Reporte conciso: endpoints CxC auditados (OK/arreglados), endpoints CxP nuevos (ruta + tabla), vistas frontend conectadas, resultados de validación.
- [ ] **Step 2:** Actualizar memoria MCP (`memory_propose`, namespace `facture-project`) con el nuevo estado: qué quedó 100% funcional vs lo que aún falta.
- [ ] **Step 3:** Borrar cualquier registro `ZZTEST` creado durante pruebas de procesos.

---

## Self-Review (cobertura)
- CxC: Fase A cubre auditoría de las 7 secciones (smoke-test + fix). ✔
- CxP existentes: Task B0. ✔
- CxP faltantes (Config, Procesos, Reportes, Cierre): Fase B (un task por endpoint) + Fase C (frontend). ✔
- Validación: Fase D (tsc + vite + curl rutas + curl APIs). ✔
- Exact-clone Oracle: Step 1 de cada task obliga a confirmar columnas con all_tab_columns. ✔
- Seguridad datos reales: procesos de escritura con ZZTEST + confirmación. ✔
