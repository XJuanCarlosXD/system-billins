# FAT Backlog Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Despachá un subagent fresh por cada Task A-I**, en serie (no en paralelo: muchos editan los mismos archivos). NO pares a preguntar permiso entre tasks — al cierre del Task I dame UN resumen final.

**Goal:** Resolver los 9 grupos de issues del backlog FAT reportados 2026-05-29 — desde quick wins (eliminar ruta duplicada) hasta features pesados (chart dashboard, CRUD configuración, flujo NCF derivado del cliente).

**Architecture:** Cada Task = un grupo del backlog. Patrón: (1) verificar bug en Playwright MCP, (2) implementar fix backend + frontend, (3) deployar a VM 10.0.0.99 con pscp, (4) smoke con curl/Playwright, (5) commit en main (NO push). Subagents trabajan en serie porque varios issues tocan los mismos archivos (`fat_repo.py`, `views.py`, `cuadre-caja.tsx`, etc.).

**Tech Stack:** Django + DRF (backend), React + Vite + TanStack Router (frontend), Oracle 11g legacy schema, reportlab para PDFs, Playwright MCP para verificación visual.

**Spec de referencia:** `C:\Users\JCABREU\.claude\projects\C--Windows-system32\memory\project_sigaft_backlog_fat.md` (backlog detallado por grupo).

**Schema NCF crítico** (de memoria `project_sigaft_ncf_schema.md`):
- NCF DGI real = `POSICIONES_FIJAS_NCF || LPAD(NCF, 8, '0')`.
- `fat_repo._compose_ncf_dgi(posiciones, ncf_num)` ya existe — usar siempre.
- `TIPO_NCF_FISCAL` (FAT.TFAT_FACTURA) y `TIPO_NCF_FISCAL` (CNT.TCNT_NCF) están vacías; NO leer.
- `POSICIONES_FIJAS` (CNT.TCNT_NCF, sin `_NCF`) ≠ `POSICIONES_FIJAS_NCF` (FAT.TFAT_FACTURA, con `_NCF`). Mismo concepto, distintos nombres.

**Deploy pattern:**
```bash
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw 'Temp1234!' \
  "<windows_path>" jcabreu@10.0.0.99:facturation-system/<relative_path>
```
Django y Vite con hot reload — sin restart contenedores.

**Cookies smoke:** `/c/Users/JCABREU/AppData/Local/memorias_sigaft/pdf_audit/cookies.txt`. Si HTTP=403 regenerar:
```bash
curl -s -c /c/Users/JCABREU/AppData/Local/memorias_sigaft/pdf_audit/cookies.txt -X POST \
  -H "Content-Type: application/json" -d '{"username":"JCABREU","password":"Temp1234!"}' \
  http://10.0.0.99:8000/api/auth/login/
```

**Playwright login:** `http://10.0.0.99:5173/sign-in` con `JCABREU` / `Temp1234!`. Si Playwright se cuelga en una vista (PDF embed, modal infinito), anotalo y seguí — no bloquees.

**Commits:** subject conventional-commits (`fix(fat): ...`, `feat(fat-ui): ...`, `chore(fat): ...`). Body 2-4 líneas explicando el cambio. NUNCA `git push` (usuario decide al final).

---

## Task A: Filtrar Mantenimiento NCF por empresa activa

**Files:**
- Modify: `backend/apps/legacy/repositories/cnt_repo.py` — agregar param `no_cia` a `list_ncf`.
- Modify: `backend/apps/cnt/views.py` — leer `no_cia` del request.GET.
- Modify: `frontend/src/features/cnt/ncf.tsx` — pasar `noCia` al llamar al API.

- [ ] **Step 1: Verificar bug en Playwright**
1. Login y navegar a `http://10.0.0.99:5173/cnt?section=configuracion&view=ncf`.
2. `browser_evaluate` sobre `document.querySelectorAll('tbody tr').length` → debería ser > 8 (muestra rangos de varias empresas).

- [ ] **Step 2: Inspeccionar `cnt_repo.list_ncf` actual**
```bash
grep -n "def list_ncf\b" backend/apps/legacy/repositories/cnt_repo.py
```
Leer la función. Si el SELECT NO filtra por `NO_LOCALIDAD`, agregar el filtro.

- [ ] **Step 3: Modificar backend para filtrar por `no_cia`**
En `cnt_repo.py`, cambiar la firma de `list_ncf()` a `list_ncf(no_cia: str = '')`. Si `no_cia` está vacío devolver todos (backward compat para vistas globales); si tiene valor agregar `WHERE NO_LOCALIDAD = :1`.

En `apps/cnt/views.py` (buscar el view que sirve el endpoint NCF de CNT):
```python
no_cia = request.GET.get('no_cia', '')
items = cnt_repo.list_ncf(no_cia=no_cia)
```

- [ ] **Step 4: Modificar frontend para pasar `noCia`**
En `frontend/src/features/cnt/ncf.tsx`, en el effect/loader que llama al API agregar el query param. Buscar `regalGeneralApi.cntListNcf` o equivalente. Si la función helper no acepta `noCia`, extender el método en `regal-general-api.ts`.

- [ ] **Step 5: Syntax + deploy + smoke**
```bash
plink -ssh -batch -hostkey "..." -pw 'Temp1234!' jcabreu@10.0.0.99 \
  "python3 -c 'import ast,sys; ast.parse(sys.stdin.read()); print(\"OK\")'" \
  < backend/apps/legacy/repositories/cnt_repo.py
pscp ... cnt_repo.py views.py ncf.tsx regal-general-api.ts
```
Playwright reload de `/cnt?view=ncf` → confirmar que solo aparecen rangos de empresa 01.

- [ ] **Step 6: Commit**
```
fix(cnt): filtrar Mantenimiento NCF por empresa activa

cnt_repo.list_ncf acepta no_cia opcional. Frontend pasa el noCia
del contexto. Antes mostraba rangos de TODAS las empresas.
```

---

## Task B: Flujo NCF en nueva factura derivado del cliente

**Files:**
- Modify: `backend/apps/legacy/repositories/fat_repo.py` — endpoint para "Próximo NCF disponible" y validación de duplicados.
- Modify: `backend/apps/fat/views.py` — exponer endpoint `/api/fat/proximo-ncf/?no_cia&codigo_ncf`.
- Modify: `backend/apps/fat/urls.py`.
- Modify: `frontend/src/features/fat/fat-nueva-factura.tsx` — derivar tipo NCF del cliente, bloquear edición manual, mostrar próximo NCF, quitar "Anular" del select.
- Modify: `frontend/src/services/fat-api.ts` — tipos para próximo NCF.

- [ ] **Step 1: Verificar bug en Playwright**
1. Navegar a `/fat/nueva-factura`.
2. `browser_snapshot` — confirmar que el selector de "Tipo de documento" muestra "Anular documento" como opción.
3. Confirmar que NO muestra "Próximo NCF" en ninguna parte.
4. Cambiar de cliente — el tipo NCF (B01/B02) no cambia automáticamente.

- [ ] **Step 2: Agregar endpoint `get_proximo_ncf` en `fat_repo.py`**
Append:
```python
def get_proximo_ncf(no_cia: str, codigo_ncf: str) -> dict:
    """Devuelve el próximo NCF disponible para una serie + el tipo DGI.

    Lee CNT.TCNT_NCF.PROX_NCF y POSICIONES_FIJAS para componer el NCF DGI.
    """
    if not no_cia or not codigo_ncf:
        return {}
    row = client.fetch_one(
        "SELECT PROX_NCF, POSICIONES_FIJAS, NCF_FINAL, DESCRIPCION "
        "FROM CNT.TCNT_NCF WHERE NO_LOCALIDAD=:1 AND CODIGO_NCF=:2",
        [no_cia, codigo_ncf.strip().upper()])
    if not row:
        return {}
    prox = int(row[0] or 0)
    pos = (row[1] or '').strip().upper()
    final = int(row[2] or 0)
    descripcion = (row[3] or '').strip()
    return {
        'codigo_ncf': codigo_ncf.upper(),
        'prox_ncf': prox,
        'posiciones_fijas': pos,
        'descripcion': descripcion,
        'ncf_dgi_proximo': _compose_ncf_dgi(pos, prox),
        'agotado': prox > final,
    }


def ncf_ya_usado(no_cia: str, ncf_num: int) -> bool:
    """True si ese NCF ya está usado en alguna factura no anulada."""
    row = client.fetch_one(
        "SELECT COUNT(*) FROM FAT.TFAT_FACTURA "
        "WHERE NO_CIA=:1 AND NCF=:2 AND NVL(ST_ANULADO,'N')='N'",
        [no_cia, int(ncf_num)])
    return bool(row and row[0] > 0)
```

- [ ] **Step 3: Exponer endpoint en views + urls**
En `apps/fat/views.py` agregar:
```python
@login_required
@require_http_methods(["GET"])
def fat_proximo_ncf(request):
    no_cia = request.GET.get('no_cia', '01')
    codigo_ncf = request.GET.get('codigo_ncf', '')
    return JsonResponse(fat_repo.get_proximo_ncf(no_cia, codigo_ncf))
```
En `apps/fat/urls.py` agregar:
```python
path('fat/proximo-ncf/', fat_proximo_ncf),
```

- [ ] **Step 4: Modificar `fat-nueva-factura.tsx`**

a) **Quitar "Anular documento" del select** — localizar el selector de `tipo_factura` (probablemente filtra de `fatListTiposDocumento`). Filtrar fuera cualquier item con `tipo_transaccion == 'AN'` o cuyo `descripcion` contenga 'Anular'.

b) **Derivar tipo NCF del cliente** — al `useEffect` que se dispara cuando `clienteSeleccionado` cambia, fetch `cxc_repo.get_cliente` (ya devuelve `codigo_ncf` del cliente) y setear el `codigoNcfActivo` automáticamente. Hacer el campo de tipo NCF read-only (`<Input disabled value={codigoNcfActivo} />`).

c) **Mostrar "Próximo NCF disponible"** — al cargar el cliente + tipo NCF, llamar `regalGeneralApi.fatProximoNcf({ no_cia, codigo_ncf: codigoNcfActivo })`. Renderizar `<div>Próximo NCF: <strong>{prox.ncf_dgi_proximo}</strong></div>` debajo del campo NCF.

d) **Validación choque NCF al submit** — si `ncfManual` está activo, antes de crear la factura llamar `fatProximoNcfCheck` (o reusar `fatProximoNcf` + comparar). Si el `ncf` que ingresa el usuario ya está usado, mostrar toast de error y bloquear submit.

- [ ] **Step 5: Tests / Smoke**
Playwright: nueva factura, seleccionar cliente FC → confirmar que NCF tipo cambia a B01 automático y se muestra "Próximo NCF: B01XXXXXXXXX". Verificar que "Anular" NO aparece en el select.

- [ ] **Step 6: Commit**
```
feat(fat): flujo NCF nueva factura derivado del cliente

- get_proximo_ncf en fat_repo lee TCNT_NCF.PROX_NCF y compone DGI.
- ncf_ya_usado valida duplicados antes del submit.
- Endpoint /api/fat/proximo-ncf/.
- UI bloquea modificación manual del tipo NCF (solo via cliente CXC).
- Selector tipo documento quita "Anular".
- Muestra "Próximo NCF disponible" debajo del campo.
```

---

## Task C: Reportes Facturación con filtros y datos

**Files:**
- Modify: `backend/apps/fat/views.py` — endpoints de reportes con filtros `desde`/`hasta`.
- Modify: `frontend/src/features/fat/rep-607.tsx`, `rep-ncf-nulos.tsx`, `fat-rep-607.tsx`, `fat-rep-ncf-nulos.tsx`, `fat-rep-ventas.tsx`, `rep-ventas.tsx` — agregar filtros de fecha + paginación de historial.

- [ ] **Step 1: Verificar bug en Playwright**
Navegar a cada ruta de reportes en el sidebar `Facturacion → Reportes`. Confirmar que ninguno muestra datos.

- [ ] **Step 2: Inspeccionar endpoints actuales**
```bash
grep -n "rep_607\|rep_ventas\|rep_ncf" backend/apps/fat/urls.py backend/apps/fat/views.py
```
Verificar qué params aceptan. Si solo aceptan `ano`/`mes`, agregar `desde`/`hasta` (ISO YYYY-MM-DD).

- [ ] **Step 3: Backend — extender endpoints con `desde`/`hasta`**
En `fat_repo.py` los métodos `rep_607`, `rep_ventas`, `list_facturas_sin_ncf` etc. agregar filtros opcionales por rango fecha y `LIMIT`/pagination.

- [ ] **Step 4: Frontend — agregar filtros + tabla con paginación**
En cada `*-rep-*.tsx`: 2 `<Input type="date" />` (desde/hasta) + botón "Generar". Default `desde=primer día del mes actual`, `hasta=hoy`. Llamar al API con esos params. Renderizar tabla con resultados.

- [ ] **Step 5: Smoke**
Playwright: cada reporte muestra datos al cambiar fechas.

- [ ] **Step 6: Commit**
```
feat(fat-reportes): filtros desde/hasta + paginación en reportes 607, ventas, ncf-nulos
```

---

## Task D: Dashboard chart de ventas mes en curso

**Files:**
- Modify: `backend/apps/fat/views.py` (o `dashboard`) — endpoint `/api/dashboard/ventas-mes/?no_cia=01`.
- Modify: `backend/apps/legacy/repositories/fat_repo.py` — `ventas_dia_a_dia(no_cia, ano, mes)`.
- Modify: `frontend/src/features/dashboard/index.tsx` — agregar card con chart (recharts).

- [ ] **Step 1: Backend — `ventas_dia_a_dia`**
Append en `fat_repo.py`:
```python
def ventas_dia_a_dia(no_cia: str, ano: int, mes: int) -> list[dict]:
    rows = client.fetch_all(
        "SELECT TO_CHAR(FECHA,'YYYY-MM-DD') AS DIA, SUM(TOTAL_NETO) AS TOTAL "
        "FROM FAT.TFAT_FACTURA "
        "WHERE NO_CIA=:1 AND EXTRACT(YEAR FROM FECHA)=:2 AND EXTRACT(MONTH FROM FECHA)=:3 "
        "AND NVL(ST_ANULADO,'N')='N' "
        "GROUP BY TO_CHAR(FECHA,'YYYY-MM-DD') ORDER BY DIA",
        [no_cia, int(ano), int(mes)])
    return [{'dia': r['dia'], 'total': float(r['total'] or 0)} for r in rows]
```

- [ ] **Step 2: Endpoint + URL**
```python
@login_required
@require_http_methods(["GET"])
def dashboard_ventas_mes(request):
    no_cia = request.GET.get('no_cia', '01')
    from datetime import date
    today = date.today()
    items = fat_repo.ventas_dia_a_dia(no_cia, today.year, today.month)
    return JsonResponse({'items': items, 'ano': today.year, 'mes': today.month})
```
`urls.py`:
```python
path('dashboard/ventas-mes/', dashboard_ventas_mes),
```

- [ ] **Step 3: Frontend — chart con recharts**
Verificar si recharts está instalado: `grep recharts frontend/package.json`. Si NO, `npm install recharts` (sino usar Chart.js o nivo). En `dashboard/index.tsx` agregar un `<Card>` con `<LineChart data={ventasDia}>` que muestre día vs total.

- [ ] **Step 4: Smoke + Commit**
```
feat(dashboard): chart ventas día-a-día del mes en curso
```

---

## Task E: Cuadre de caja — 7 bugs

**Files:**
- Modify: `frontend/src/features/fat/cuadre-caja.tsx` — render loop, fecha default, historial bajo demanda.
- Modify: `frontend/src/features/fat/fat-cuadre-caja.tsx` — mismo.
- Modify: `backend/apps/legacy/repositories/fat_repo.py` — exponer tipo NCF y desglose formas de pago en cuadre.
- Modify: `backend/apps/fat/views.py` — endpoint cuadre con desglose.

- [ ] **Step 1: E.1 — Fix render loop infinito**
Inspeccionar `cuadre-caja.tsx`. Probable: `useEffect(() => { fetch... }, [data])` o falta de array de deps. Cambiar a `useEffect(() => { fetch... }, [noCia, punto, fecha])`. Verificar que ningún setState dentro de un effect dispare el mismo effect.

- [ ] **Step 2: E.2 — Fecha default = hoy**
```tsx
const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
```

- [ ] **Step 3: E.3 — Historial bajo demanda**
La tabla del historial debe quedar vacía hasta que el usuario haga click en "Generar" o cambie la fecha. Eliminar el fetch automático al mount.

- [ ] **Step 4: E.4 — Mostrar tipo NCF (B01/B02)**
En el backend, el endpoint cuadre debe devolver `ncf_dgi` y `posiciones_fijas_ncf` por cada factura (similar al fix de Task FAT-print). Reusar `_compose_ncf_dgi` en `fat_repo.cuadre_caja_detalle`. Frontend: agregar columna "Tipo NCF" en la tabla.

- [ ] **Step 5: E.5/E.6/E.7 — Desglose formas de pago**
El endpoint cuadre debe leer la tabla `FAT.TFAT_FORMA_PAGO` (catálogo) en lugar de agrupar como "otras". Hacer JOIN con `TFAT_FACTURA_FORMA_PAGO` (o similar — descubrir con DESCRIBE). Devolver: `{forma_pago_codigo, forma_pago_descripcion, monto}`. En el frontend mostrar cada forma de pago (cheque, transferencia, tarjeta) por separado. Mismo para cobros de crédito (probablemente tabla CXC).

- [ ] **Step 6: Smoke + Commit**
```
fix(fat): cuadre caja — render loop, fecha hoy, historial on-demand, tipo NCF, desglose formas de pago
```

---

## Task F: `/fat/facturas` — imprimir lista, NCF en PDF, numeración

**Files:**
- Create: `backend/apps/fat/views_print.py` — nueva función `fat_lista_facturas_pdf(request)` que genera PDF de la lista filtrada.
- Modify: `backend/apps/fat/urls.py` — registrar `/api/fat/reportes/listado/pdf/`.
- Modify: `frontend/src/features/fat/facturas.tsx` — botón "Imprimir" del toolbar abre el PDF nuevo.
- Modify: `frontend/src/features/fat/fat-export.ts` — formatear `tipo_factura + '-' + no_factura` correctamente en exports.

- [ ] **Step 1: F.1 — Endpoint listado en PDF**
En `views_print.py` agregar:
```python
@login_required
@require_http_methods(["GET"])
def fat_lista_facturas_pdf(request):
    no_cia = request.GET.get('no_cia', '01')
    punto = request.GET.get('punto', '01')
    desde = request.GET.get('desde', '')
    hasta = request.GET.get('hasta', '')
    tipo = request.GET.get('tipo', '')
    estado = request.GET.get('estado', '')
    items = fat_repo.list_facturas(no_cia=no_cia, punto=punto,
                                    desde=desde, hasta=hasta,
                                    tipo=tipo, estado=estado,
                                    page=1, page_size=10000)['items']
    columns = ['TIPO', 'NO_FACTURA', 'FECHA', 'CLIENTE', 'NCF', 'TOTAL']
    rows = [{
        'tipo': r['tipo_factura'],
        'no_factura': r['no_factura'],
        'fecha': str(r['fecha'])[:10] if r['fecha'] else '',
        'cliente': r['nombre_cliente'],
        'ncf': r.get('ncf_dgi') or '',
        'total': r['total_neto'],
    } for r in items]
    cia = inv_repo.get_compania(no_cia) or {}
    razon = (cia.get('descripcion') or no_cia).strip()
    pdf = build_pdf_report(
        title=f"Listado de Facturas — {razon}",
        columns=columns, rows=rows, col_widths=None,
        header_extra=[f"<b>Período:</b> {desde} a {hasta}" if desde or hasta else ""],
    )
    resp = HttpResponse(pdf, content_type='application/pdf')
    resp['Content-Disposition'] = 'inline; filename="listado_facturas.pdf"'
    return resp
```

- [ ] **Step 2: URL**
```python
path('fat/reportes/listado/pdf/', fat_lista_facturas_pdf),
```

- [ ] **Step 3: Frontend — botón "Imprimir" del toolbar**
En `facturas.tsx` (el botón "PDF" del toolbar línea ~211): `onClick` debe abrir `window.open(${API_BASE}/fat/reportes/listado/pdf/?...filtros, '_blank')` en lugar de llamar a `printFacturas` (que es la impresión nativa que dejaba el NCF en blanco).

- [ ] **Step 4: F.3 — Numeración FT-XXX / FC-XXX**
En `fat-export.ts`, en las funciones `printFacturas` y `printFacturaDetalle`, donde se concatena `tipo_factura + no_factura` usar:
```typescript
const numFactura = `${r.tipo_factura}-${r.no_factura}`  // ej. "FT-00313432"
```
En lugar de mostrar solo `r.no_factura`.

- [ ] **Step 5: Smoke + Commit**
```
feat(fat): imprimir listado de facturas como PDF con NCF DGI y numeración tipo-numero
```

---

## Task G: Conduces / Cotizaciones — detalle, edición, NCF

**Files:**
- Modify: `frontend/src/features/fat/conduces.tsx` — handler click row, modal de detalle.
- Modify: `frontend/src/features/fat/fat-conduces.tsx` — mismo si aplica.
- Modify: `frontend/src/features/fat/fat-nuevo-conduce.tsx` — botón editar, carga de NCF.
- Modify: `backend/apps/legacy/repositories/fat_repo.py` — `get_conduce(no_cia, punto, tipo, no_conduce)` si no existe; exponer `ncf_dgi`.

- [ ] **Step 1: G.1 — Click row abre detalle**
En `conduces.tsx` (o donde sea el listado), agregar `onClick` al `<TableRow>` que setea un estado `selected` y abre un `<Dialog>` con el detalle del conduce. Patrón paralelo a `facturas.tsx`.

- [ ] **Step 2: G.2 — Edición**
En el modal de detalle agregar botón "Editar" que navega a `/fat/nuevo-conduce?id=<no_conduce>&tipo=<tipo>` (route con query params). En `fat-nuevo-conduce.tsx`, al detectar query params cargar los datos del conduce via `regalGeneralApi.fatGetConduce(...)`.

- [ ] **Step 3: G.3 — NCF form trae data**
En el form de conduce, cuando carga un conduce existente, los campos NCF deben prepoblarse con el `ncf_dgi` del backend.

- [ ] **Step 4: Smoke + Commit**
```
feat(fat): conduces y cotizaciones — detalle, edición y carga de NCF
```

---

## Task H: Eliminar `/fat/ncf` duplicado

**Files:**
- Delete: `frontend/src/features/fat/ncf-fat.tsx`
- Delete: `frontend/src/routes/_authenticated/fat/ncf.tsx`
- Modify: `frontend/src/components/layout/data/sidebar-data.ts` — quitar línea 73 ("Control de NCF" → `/fat/ncf`).
- Regenerate: `frontend/src/routeTree.gen.ts` (auto-generado por TanStack).

- [ ] **Step 1: Verificar bug en Playwright**
Navegar a `/fat/ncf`. Confirmar que muestra los mismos datos que `/cnt?view=ncf` (duplicado).

- [ ] **Step 2: Eliminar archivos**
```bash
rm frontend/src/features/fat/ncf-fat.tsx
rm frontend/src/routes/_authenticated/fat/ncf.tsx
```

- [ ] **Step 3: Quitar entrada del sidebar**
En `frontend/src/components/layout/data/sidebar-data.ts` borrar la línea:
```typescript
{ title: 'Control de NCF', url: '/fat/ncf' },
```

- [ ] **Step 4: Regenerar route tree**
```bash
cd frontend && npx tsr generate
```
(O equivalente — TanStack Router auto-regenera al detectar cambio en `src/routes/`. Si no, `npm run dev` lo regenera.)

- [ ] **Step 5: Deploy + smoke**
Confirmar que `/fat/ncf` ahora da 404 y la entrada no aparece en el sidebar.

- [ ] **Step 6: Commit**
```
chore(fat): elimina ruta /fat/ncf duplicada con /cnt?view=ncf
```

---

## Task I: CRUD completo en Configuración FAT

**Files:**
- Modify: `frontend/src/features/fat/tdocu.tsx` (Tipos de Documento).
- Modify: otras vistas bajo "Configuración" del menú FAT — listar con: tipos de pago, notas de pie, condiciones de pago, etc.
- Modify: `backend/apps/fat/views.py` — exponer endpoints PATCH/DELETE para cada entidad.
- Modify: `backend/apps/legacy/repositories/fat_repo.py` — `upsert_*` y `deactivate_*` por entidad.

- [ ] **Step 1: Mapear vistas de configuración**
En `sidebar-data.ts` listar los items del submenú "Configuracion" del módulo FAT. Para cada uno, ubicar el archivo en `frontend/src/features/fat/` y verificar si tiene botones "Editar" / "Eliminar" / "Desactivar".

- [ ] **Step 2: Patrón por entidad**
Por cada entidad (Tipo Documento, Tipo Pago, Nota, Condición de Pago, Vendedor...) verificar:
- Backend tiene endpoint LIST + UPSERT (POST) + DELETE/DEACTIVATE (DELETE o PATCH `activo='N'`).
- Frontend tiene tabla con columnas + botón "Editar" (abre dialog con form) + botón "Desactivar".

- [ ] **Step 3: Implementar lo que falte**
Para cada gap detectado, agregar el endpoint backend + el handler frontend. Usar el mismo patrón visible en otras vistas que ya funcionan (por ejemplo `cnt/ncf.tsx` ya tiene "Editar NCF" modal — copiar el patrón).

- [ ] **Step 4: Smoke por cada entidad**
Playwright: en cada vista de Config, crear un item, editarlo, desactivarlo. Confirmar que persistió.

- [ ] **Step 5: Commit (uno por entidad o uno global según volumen)**
```
feat(fat-config): CRUD completo en tipos documento / pago / notas / condiciones
```

---

## Roll-back plan

Cada Task tiene su commit aislado. Si una task rompe producción:
```bash
plink -ssh -batch ... jcabreu@10.0.0.99 "cd facturation-system && git checkout HEAD~N -- <files>"
```
Hot reload recupera en ~5s.

## Métricas de cierre

- [ ] Cada uno de los 9 grupos A-I tiene al menos 1 commit en `main`.
- [ ] Cada ruta verificada en Playwright muestra el comportamiento esperado (capturas/grabaciones documentadas en el resumen final).
- [ ] No quedan referencias a `codigo_ncf` legacy en UI nueva (todos usan `ncf_dgi`).
- [ ] `git log --oneline 21482f4..HEAD` muestra >= 9 commits con prefijos `fix(fat)`, `feat(fat)`, `chore(fat)`.
- [ ] Resumen final entregado al usuario con: commits, vistas verificadas, gaps que requieran sesión adicional.
