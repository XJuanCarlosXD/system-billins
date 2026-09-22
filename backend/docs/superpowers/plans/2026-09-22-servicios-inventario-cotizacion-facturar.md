# Servicios sin tocar existencia + Cotización → Factura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> This repo has no pytest suite for `apps/legacy`/`apps/fat` (Oracle-backed, no local DB). Verification per the project's established convention (see `docs/superpowers/specs/2026-09-22-...-design.md` and memory `feedback_ecf_todo_debe_salir_de_la_ui_no_scripts`) is: `py_compile` on the VM after `pscp`, direct HTTP smoke of changed endpoints, and a Playwright end-to-end pass at the end. No local `npm run build`/`pytest` gate exists for this stack.

**Goal:** Stop service-type products (`TINV_PRODUCTO.SERVICIO='S'`) from touching `TINV_EPRODUCTO` existencia anywhere in INV/FAT, and complete the Cotización → Factura flow (button, missing-product side sheet, factura↔cotización linking, anular).

**Architecture:** Backend fixes are surgical edits to two existing repository functions (`inv_repo.py::create_movimiento_documento`, `fat_repo.py::create_factura`) plus one new repo function (`anular_conduce`) and wiring of an already-half-built parameter (`no_cotizacion`). Frontend reuses two components that already exist (`CrearProductoModal`, the `cargarCotizacion()` autoload already in `fat-nueva-factura.tsx`) and adds one new small component (`MissingProductsSheet`).

**Tech Stack:** Django + `oracledb` thick mode (backend), React 19 + TanStack Router/Query + shadcn/ui (frontend), deployed to VM 10.0.0.99 via `pscp`/docker compose (backend) and Netlify build from `main` (frontend).

---

## File Map

| File | Change |
|---|---|
| `backend/apps/legacy/repositories/inv_repo.py` | Stop hardcoding `servicio='I'`; skip stock adjustment for service products in `create_movimiento_documento` |
| `backend/apps/legacy/repositories/fat_repo.py` | Same fix in `create_factura`'s sale movement; wire `no_cotizacion` param; new `anular_conduce()` |
| `backend/apps/fat/views.py` | Read `no_cotizacion` in `FatFacturasView.post`; new `FatAnularConduceView` |
| `backend/apps/fat/urls.py` | Route for `FatAnularConduceView` |
| `frontend/src/lib/regal-general-api.ts` | New `fatAnularConduce()` client method |
| `frontend/src/features/fat/components/crear-producto-modal.tsx` | New optional props `tipoInicial`, `preselectAlmacenKey` |
| `frontend/src/features/fat/components/missing-products-sheet.tsx` | **New file** — side sheet for lines with `no_produ==='X'` |
| `frontend/src/features/fat/fat-nueva-factura.tsx` | Accept `cotizacionInicial` prop, auto-load, integrate missing-products sheet |
| `frontend/src/routes/_authenticated/fat/nueva-factura.tsx` | `validateSearch` for `?cotizacion=` |
| `frontend/src/features/fat/conduces.tsx` | "Facturar" button (CT only) + "Anular" button+dialog (CO/CT) |
| `frontend/src/features/fat/fat-nuevo-conduce.tsx` | Wire the currently-`disabled` "Anular" button |

Working directory for every step below: `C:/Users/JCABREU/AppData/Local/memorias_sigaft/facturation-system/.worktrees/servicios-cotizacion-facturar`

---

### Task 1: INV — servicios no tocan existencia

**Files:**
- Modify: `backend/apps/legacy/repositories/inv_repo.py:2723-2760` (`_insert_movimiento`)
- Modify: `backend/apps/legacy/repositories/inv_repo.py:2906-2913` (new helper next to `_producto_impuesto_info`)
- Modify: `backend/apps/legacy/repositories/inv_repo.py:3000-3123` (`create_movimiento_documento` loop)

- [ ] **Step 1: Add `_producto_servicio_flag` helper right after `_producto_impuesto_info`**

Current code at line 2906-2913:
```python
def _producto_impuesto_info(cur, no_produ: str) -> tuple[str, float]:
    cur.execute(
        "SELECT NVL(tiene_impuesto,'S'), NVL(porciento_impuesto,0) "
        "FROM INV.TINV_PRODUCTO WHERE no_produ=:1", [no_produ])
    row = cur.fetchone()
    if not row:
        return 'S', 0.0
    return (row[0] or 'S').strip().upper(), float(row[1] or 0)
```

Add immediately after it:
```python
def _producto_servicio_flag(cur, no_produ: str) -> str:
    """Flag SERVICIO de TINV_PRODUCTO ('I' inventariable, 'S' servicio, 'K'
    kit, 'C' compuesto). Los productos servicio no tienen existencia fisica:
    quien llama debe omitir TINV_EPRODUCTO para ellos."""
    cur.execute(
        "SELECT NVL(servicio,'I') FROM INV.TINV_PRODUCTO WHERE no_produ=:1",
        [no_produ])
    row = cur.fetchone()
    return (row[0] or 'I').strip().upper() if row else 'I'
```

- [ ] **Step 2: `_insert_movimiento` receives and grabs el flag real en vez de `'I'` hardcodeado**

Replace the full function (lines 2723-2760):
```python
def _insert_movimiento(cur, *, no_cia, punto, tipo_docu, no_docu, no_linea,
                       almacen, no_produ, tipo_movi, tipo_transaccion,
                       fecha, cantidad, precio, costo, empaque, cpe,
                       usuario, impuesto=0.0, descuento=0.0,
                       tipo_refe='', no_refe='', no_orden=None,
                       servicio='I'):
    """INSERT directo a INV.TINV_MOVIMIENTO con todos los NOT NULL cubiertos.

    monto_neto es el valor de la linea al precio del documento (no al costo
    de inventario) menos el descuento: es lo que se imprime en la columna
    "Monto Neto" de los documentos (factura, devolucion, etc).

    `servicio` es el flag real de TINV_PRODUCTO.SERVICIO del producto de la
    linea -- antes quedaba hardcodeado a 'I' sin importar el producto, lo
    que hacia indistinguible en el ledger una venta de servicio de una de
    articulo. El caller decide, con ese mismo flag, si tambien debe tocar
    TINV_EPRODUCTO (los servicios no deben).
    """
    impuesto = round(impuesto or 0, 2)
    descuento = round(descuento or 0, 2)
    monto_neto = round((cantidad or 0) * (precio or 0) - descuento, 2)
    cur.execute(
        "INSERT INTO INV.TINV_MOVIMIENTO("
        "  no_cia, punto, tipo_docu, no_docu, no_linea,"
        "  almacen, no_produ, tipo_movi, tipo_transaccion, servicio,"
        "  fecha, cantidad, precio, costo,"
        "  st_anulado, empaque, cpe, usuario, monto_neto,"
        "  impuesto, descuento,"
        "  no_localidad, fecha_sysdate, aumento_cxc,"
        "  tipo_refe, no_refe, no_orden"
        ") VALUES("
        "  :1, :2, :3, :4, :5,"
        "  :6, :7, :8, :9, :10,"
        "  TO_DATE(:11,'YYYY-MM-DD'), :12, :13, :14,"
        "  'N', :15, :16, :17, :18,"
        "  :19, :20,"
        "  :21, SYSDATE, 0,"
        "  :22, :23, :24)",
        [no_cia, punto, tipo_docu, no_docu, no_linea,
         almacen, no_produ, tipo_movi, tipo_transaccion, servicio,
         fecha, cantidad, precio, costo,
         empaque, cpe, (usuario or '')[:30],
         monto_neto, impuesto, descuento,
         no_cia, tipo_refe, no_refe, no_orden])
```

- [ ] **Step 3: `create_movimiento_documento` — leer el flag por linea y omitir stock para servicios**

In the per-line loop, right after the existing product-existence check (lines 3009-3015):
```python
            cur.execute(
                "SELECT 1 FROM INV.TINV_PRODUCTO WHERE no_produ=:1", [no_produ])
            if not cur.fetchone():
                raise ValueError(
                    f"Linea {idx}: el producto '{no_produ}' no existe. "
                    "Selecciónelo desde el buscador en vez de escribir el código a mano."
                )
```
add:
```python
            servicio_flag = _producto_servicio_flag(cur, no_produ)
            es_servicio = servicio_flag == 'S'
```

Then change the block that currently reads (lines 3070-3084):
```python
            if tipo_movi == 'E':
                _insert_eproducto(cur, no_cia=no_cia, punto=punto,
                                  almacen=almacen_origen, no_produ=no_produ,
                                  costo=costo)
            else:
                cur.execute(
                    "SELECT 1 FROM INV.TINV_EPRODUCTO "
                    "WHERE no_cia=:1 AND punto=:2 AND almacen=:3 AND no_produ=:4",
                    [no_cia, punto, almacen_origen, no_produ])
                if not cur.fetchone():
                    raise ValueError(
                        f"Linea {idx}: el producto {no_produ} no esta asignado "
                        f"al almacen {almacen_origen} de la compania {no_cia}. "
                        "Asignelo en Catalogo de Productos antes de registrar "
                        "la salida.")
```
to:
```python
            if not es_servicio:
                if tipo_movi == 'E':
                    _insert_eproducto(cur, no_cia=no_cia, punto=punto,
                                      almacen=almacen_origen, no_produ=no_produ,
                                      costo=costo)
                else:
                    cur.execute(
                        "SELECT 1 FROM INV.TINV_EPRODUCTO "
                        "WHERE no_cia=:1 AND punto=:2 AND almacen=:3 AND no_produ=:4",
                        [no_cia, punto, almacen_origen, no_produ])
                    if not cur.fetchone():
                        raise ValueError(
                            f"Linea {idx}: el producto {no_produ} no esta asignado "
                            f"al almacen {almacen_origen} de la compania {no_cia}. "
                            "Asignelo en Catalogo de Productos antes de registrar "
                            "la salida.")
```

Then the `_insert_movimiento(...)` call right after it (lines 3086-3094) gains `servicio=servicio_flag`:
```python
            _insert_movimiento(
                cur, no_cia=no_cia, punto=punto, tipo_docu=tipo_docu,
                no_docu=no_docu, no_linea=idx,
                almacen=almacen_origen, no_produ=no_produ,
                tipo_movi=tipo_movi, tipo_transaccion=tipo_transaccion,
                fecha=fecha, cantidad=cantidad, precio=precio, costo=costo,
                empaque=empaque, cpe=cpe, usuario=usuario,
                impuesto=impuesto_linea, descuento=descuento_linea,
                no_orden=(no_orden or None), servicio=servicio_flag)
```

And the `_adjust_eproducto_stock(...)` call right after it (lines 3095-3097) gets wrapped:
```python
            if not es_servicio:
                _adjust_eproducto_stock(
                    cur, no_cia=no_cia, punto=punto, almacen=almacen_origen,
                    no_produ=no_produ, tipo_movi=tipo_movi, cantidad=cantidad)
```

Finally, the transferencia (TA) counterpart block (lines 3100-3123) also skips stock for servicios — replace:
```python
            if es_transferencia:
                # Movimiento contraparte de entrada al almacen destino.
                # NO_LINEA es NUMBER(3) -> usamos offset 500 para evitar colision.
                if idx > 499:
                    raise ValueError("Transferencia con mas de 499 lineas no soportada")
                almacen_dest = (lin.get('almacen_destino') or almacen_destino).strip()
                # La entrada al destino tambien auto-asigna el producto.
                _insert_eproducto(cur, no_cia=no_cia, punto=punto,
                                  almacen=almacen_dest, no_produ=no_produ,
                                  costo=costo)
                _insert_movimiento(
                    cur, no_cia=no_cia, punto=punto, tipo_docu=tipo_docu,
                    no_docu=no_docu, no_linea=idx + 500,
                    almacen=almacen_dest,
                    no_produ=no_produ,
                    tipo_movi='E', tipo_transaccion=tipo_transaccion,
                    fecha=fecha, cantidad=cantidad, precio=precio, costo=costo,
                    empaque=empaque, cpe=cpe, usuario=usuario,
                    tipo_refe=tipo_docu, no_refe=no_docu)
                _adjust_eproducto_stock(
                    cur, no_cia=no_cia, punto=punto,
                    almacen=almacen_dest,
                    no_produ=no_produ, tipo_movi='E', cantidad=cantidad)
                creadas += 1
```
with:
```python
            if es_transferencia:
                # Movimiento contraparte de entrada al almacen destino.
                # NO_LINEA es NUMBER(3) -> usamos offset 500 para evitar colision.
                if idx > 499:
                    raise ValueError("Transferencia con mas de 499 lineas no soportada")
                almacen_dest = (lin.get('almacen_destino') or almacen_destino).strip()
                if not es_servicio:
                    # La entrada al destino tambien auto-asigna el producto.
                    _insert_eproducto(cur, no_cia=no_cia, punto=punto,
                                      almacen=almacen_dest, no_produ=no_produ,
                                      costo=costo)
                _insert_movimiento(
                    cur, no_cia=no_cia, punto=punto, tipo_docu=tipo_docu,
                    no_docu=no_docu, no_linea=idx + 500,
                    almacen=almacen_dest,
                    no_produ=no_produ,
                    tipo_movi='E', tipo_transaccion=tipo_transaccion,
                    fecha=fecha, cantidad=cantidad, precio=precio, costo=costo,
                    empaque=empaque, cpe=cpe, usuario=usuario,
                    tipo_refe=tipo_docu, no_refe=no_docu, servicio=servicio_flag)
                if not es_servicio:
                    _adjust_eproducto_stock(
                        cur, no_cia=no_cia, punto=punto,
                        almacen=almacen_dest,
                        no_produ=no_produ, tipo_movi='E', cantidad=cantidad)
                creadas += 1
```

- [ ] **Step 4: py_compile check (local, no Oracle needed for syntax)**

Run: `python -m py_compile backend/apps/legacy/repositories/inv_repo.py`
Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/legacy/repositories/inv_repo.py
git commit -m "fix(inv): servicios no generan existencia en ningun tipo de movimiento

TINV_MOVIMIENTO.servicio quedaba hardcodeado a 'I' sin mirar el flag
real de TINV_PRODUCTO.SERVICIO, y create_movimiento_documento tocaba
TINV_EPRODUCTO para toda linea sin excepcion. Un producto tipo Servicio
en cualquier entrada/salida (EA, EC, EP, DV, DC, SA, SP, AE, AS, TA)
ahora sigue quedando trazado en el ledger pero ya no ensucia la
existencia fisica del articulo."
```

---

### Task 2: FAT — servicios no bloquean ni descuentan al facturar

**Files:**
- Modify: `backend/apps/legacy/repositories/fat_repo.py:2712-2865` (`create_factura` per-line loop)

- [ ] **Step 1: Leer el flag de servicio junto con costo/existencia**

Current code (lines 2732-2761):
```python
            cur.execute(
                "SELECT 1 FROM INV.TINV_PRODUCTO "
                "WHERE no_produ=:1 AND NVL(activo,'S')='S'",
                [no_produ_norm])
            if not cur.fetchone():
                raise ValueError("Producto {} no existe o esta inactivo".format(no_produ_norm))
            cur.execute(
                "SELECT NVL(ep.costo_actual,0), NVL(ep.exist_actual,0) "
                "FROM INV.TINV_EPRODUCTO ep "
                "WHERE ep.no_cia=:1 AND ep.punto=:2 AND ep.almacen=:3 AND ep.no_produ=:4",
                [no_cia, punto, almacen_norm, no_produ_norm])
            row_ep = cur.fetchone()
            if row_ep is None:
                raise ValueError(
                    "Producto {} no esta asignado al almacen {} "
                    "en la empresa {}".format(no_produ_norm, almacen_norm, no_cia))
            costo_unit = float(row_ep[0] or 0)
            exist_disp = float(row_ep[1] or 0)
            # TINV_EPRODUCTO tiene CHECK exist_actual >= 0: si la venta deja
            # existencia negativa Oracle lanza ORA-02290 y el cliente recibe
            # un 500 opaco. Validar aqui (acumulando lineas repetidas del
            # mismo producto/almacen) para responder 400 con mensaje claro.
            key_ped = (almacen_norm, no_produ_norm)
            pedido_acum[key_ped] = pedido_acum.get(key_ped, 0.0) + cant
            if pedido_acum[key_ped] > exist_disp:
                raise ValueError(
                    "Existencia insuficiente del producto {} en almacen {}: "
                    "disponible {:g}, solicitado {:g}".format(
                        no_produ_norm, almacen_norm, exist_disp,
                        pedido_acum[key_ped]))
```

Replace with:
```python
            cur.execute(
                "SELECT NVL(servicio,'I') FROM INV.TINV_PRODUCTO "
                "WHERE no_produ=:1 AND NVL(activo,'S')='S'",
                [no_produ_norm])
            prod_row = cur.fetchone()
            if not prod_row:
                raise ValueError("Producto {} no existe o esta inactivo".format(no_produ_norm))
            servicio_flag = (prod_row[0] or 'I').strip().upper()
            es_servicio = servicio_flag == 'S'
            cur.execute(
                "SELECT NVL(ep.costo_actual,0), NVL(ep.exist_actual,0) "
                "FROM INV.TINV_EPRODUCTO ep "
                "WHERE ep.no_cia=:1 AND ep.punto=:2 AND ep.almacen=:3 AND ep.no_produ=:4",
                [no_cia, punto, almacen_norm, no_produ_norm])
            row_ep = cur.fetchone()
            if row_ep is None:
                raise ValueError(
                    "Producto {} no esta asignado al almacen {} "
                    "en la empresa {}".format(no_produ_norm, almacen_norm, no_cia))
            costo_unit = float(row_ep[0] or 0)
            exist_disp = float(row_ep[1] or 0)
            # TINV_EPRODUCTO tiene CHECK exist_actual >= 0: si la venta deja
            # existencia negativa Oracle lanza ORA-02290 y el cliente recibe
            # un 500 opaco. Validar aqui (acumulando lineas repetidas del
            # mismo producto/almacen) para responder 400 con mensaje claro.
            # Los productos tipo Servicio no tienen existencia fisica -- no
            # aplica la validacion (un exist_actual=0 no debe bloquear
            # facturar un servicio).
            key_ped = (almacen_norm, no_produ_norm)
            pedido_acum[key_ped] = pedido_acum.get(key_ped, 0.0) + cant
            if not es_servicio and pedido_acum[key_ped] > exist_disp:
                raise ValueError(
                    "Existencia insuficiente del producto {} en almacen {}: "
                    "disponible {:g}, solicitado {:g}".format(
                        no_produ_norm, almacen_norm, exist_disp,
                        pedido_acum[key_ped]))
```

- [ ] **Step 2: Guardar el flag en `lineas_calc` para usarlo en el INSERT del movimiento**

Current `lineas_calc.append(...)` (lines 2774-2781):
```python
            lineas_calc.append({"no_linea": idx,
                "no_produ": no_produ_norm,
                "almacen": almacen_norm,
                "descripcion": lin.get("descripcion", "").strip(),
                "cantidad": cant, "precio": precio, "porc_descuento": porc_desc,
                "descuento": desc_monto, "porciento_impuesto": porc_imp,
                "impuesto": imp_monto, "monto_neto": neto,
                "costo": costo_unit, "empaque": empaque_unit, "cpe": cpe_unit})
```
Replace with:
```python
            lineas_calc.append({"no_linea": idx,
                "no_produ": no_produ_norm,
                "almacen": almacen_norm,
                "descripcion": lin.get("descripcion", "").strip(),
                "cantidad": cant, "precio": precio, "porc_descuento": porc_desc,
                "descuento": desc_monto, "porciento_impuesto": porc_imp,
                "impuesto": imp_monto, "monto_neto": neto,
                "costo": costo_unit, "empaque": empaque_unit, "cpe": cpe_unit,
                "servicio": servicio_flag})
```

- [ ] **Step 3: Grabar el flag real en TINV_MOVIMIENTO y omitir el descuento de existencia para servicios**

Current code (lines 2826-2864):
```python
            # La factura nueva debe descargar inventario en el ledger INV.
            cur.execute(
                "INSERT INTO INV.TINV_MOVIMIENTO("
                "  no_cia, punto, tipo_docu, no_docu, no_linea,"
                "  almacen, no_produ, tipo_movi, tipo_transaccion, servicio,"
                "  fecha, cantidad, precio, costo,"
                "  st_anulado, empaque, cpe, usuario, monto_neto,"
                "  no_localidad, fecha_sysdate, aumento_cxc"
                ") VALUES("
                "  :1, :2, :3, :4, :5,"
                "  :6, :7, 'S', :8, 'I',"
                "  TO_DATE(:9,'YYYY-MM-DD'), :10, :11, :12,"
                "  'N', :13, :14, :15, :16,"
                "  :1, SYSDATE, 0)",
                client.nbinds(
                    no_cia, punto, tf, new_no_factura, lin["no_linea"],
                    lin["almacen"], lin["no_produ"], tipo_transaccion,
                    fecha, lin["cantidad"], lin["precio"], lin["costo"],
                    lin["empaque"], lin["cpe"], usuario[:30],
                    round(lin["cantidad"] * lin["costo"], 2)))
            try:
                cur.execute(
                    "UPDATE INV.TINV_EPRODUCTO "
                    "SET exist_actual = NVL(exist_actual, 0) - :1 "
                    "WHERE no_cia=:2 AND punto=:3 AND almacen=:4 AND no_produ=:5",
                    [lin["cantidad"], no_cia, punto, lin["almacen"], lin["no_produ"]])
            except Exception as exc:
                # Otra venta pudo consumir la existencia entre la validacion
                # y este UPDATE; el CHECK exist_actual >= 0 lo detecta.
                if "ORA-02290" in str(exc):
                    raise ValueError(
                        "Existencia insuficiente del producto {} en almacen {} "
                        "(consumida por otra operacion)".format(
                            lin["no_produ"], lin["almacen"]))
                raise
            if cur.rowcount == 0:
                raise ValueError(
                    "Producto {} no esta asignado al almacen {}".format(
                        lin["no_produ"], lin["almacen"]))
```

Replace with:
```python
            # La factura nueva debe descargar inventario en el ledger INV.
            # servicio real (antes 'I' hardcodeado sin importar el producto).
            cur.execute(
                "INSERT INTO INV.TINV_MOVIMIENTO("
                "  no_cia, punto, tipo_docu, no_docu, no_linea,"
                "  almacen, no_produ, tipo_movi, tipo_transaccion, servicio,"
                "  fecha, cantidad, precio, costo,"
                "  st_anulado, empaque, cpe, usuario, monto_neto,"
                "  no_localidad, fecha_sysdate, aumento_cxc"
                ") VALUES("
                "  :1, :2, :3, :4, :5,"
                "  :6, :7, 'S', :8, :17,"
                "  TO_DATE(:9,'YYYY-MM-DD'), :10, :11, :12,"
                "  'N', :13, :14, :15, :16,"
                "  :1, SYSDATE, 0)",
                client.nbinds(
                    no_cia, punto, tf, new_no_factura, lin["no_linea"],
                    lin["almacen"], lin["no_produ"], tipo_transaccion,
                    fecha, lin["cantidad"], lin["precio"], lin["costo"],
                    lin["empaque"], lin["cpe"], usuario[:30],
                    round(lin["cantidad"] * lin["costo"], 2), lin["servicio"]))
            if lin["servicio"] != 'S':
                try:
                    cur.execute(
                        "UPDATE INV.TINV_EPRODUCTO "
                        "SET exist_actual = NVL(exist_actual, 0) - :1 "
                        "WHERE no_cia=:2 AND punto=:3 AND almacen=:4 AND no_produ=:5",
                        [lin["cantidad"], no_cia, punto, lin["almacen"], lin["no_produ"]])
                except Exception as exc:
                    # Otra venta pudo consumir la existencia entre la validacion
                    # y este UPDATE; el CHECK exist_actual >= 0 lo detecta.
                    if "ORA-02290" in str(exc):
                        raise ValueError(
                            "Existencia insuficiente del producto {} en almacen {} "
                            "(consumida por otra operacion)".format(
                                lin["no_produ"], lin["almacen"]))
                    raise
                if cur.rowcount == 0:
                    raise ValueError(
                        "Producto {} no esta asignado al almacen {}".format(
                            lin["no_produ"], lin["almacen"]))
```

Note: `client.nbinds(*vals)` maps args to `{'1': v1, '2': v2, ...}` by call order (see `backend/apps/legacy/client.py:116-123`), so appending `lin["servicio"]` as the 17th argument makes it available as `:17` — independent from where `:17` appears in the SQL text.

- [ ] **Step 4: py_compile check**

Run: `python -m py_compile backend/apps/legacy/repositories/fat_repo.py`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/legacy/repositories/fat_repo.py
git commit -m "fix(fat): facturar un producto Servicio no exige ni descuenta existencia

create_factura bloqueaba cualquier venta de un producto tipo Servicio
porque exist_actual siempre es 0 para ellos, y ademas grababa el
movimiento de venta con servicio='I' hardcodeado. Ahora se lee el flag
real del producto: se sigue exigiendo que este asignado al almacen
(dato barato para que el picker lo encuentre), pero se omite la
validacion de existencia insuficiente y el descuento de exist_actual."
```

---

### Task 3: Cotización → Factura — completar el wiring de `no_cotizacion`

**Files:**
- Modify: `backend/apps/legacy/repositories/fat_repo.py:2608-2624` (signature + inicio de `create_factura`)
- Modify: `backend/apps/legacy/repositories/fat_repo.py:2910-2930` (final del `with client.cursor()`, antes del commit)
- Modify: `backend/apps/fat/views.py:190-228` (`FatFacturasView.post`)

- [ ] **Step 1: `create_factura` gana el parametro `no_cotizacion` y lo valida al inicio**

Current signature (lines 2608-2612):
```python
def create_factura(no_cia, punto, tipo_factura, no_cliente, fecha, vendedor,
                   forma_pago, no_lista, nota, lineas, usuario,
                   codigo_ncf: str = "", detalle: str = "",
                   valor_recibido: float = 0.0,
                   nombre_cliente_factura: str = "", rnc_factura: str = ""):
```
Replace with:
```python
def create_factura(no_cia, punto, tipo_factura, no_cliente, fecha, vendedor,
                   forma_pago, no_lista, nota, lineas, usuario,
                   codigo_ncf: str = "", detalle: str = "",
                   valor_recibido: float = 0.0,
                   nombre_cliente_factura: str = "", rnc_factura: str = "",
                   no_cotizacion: str = ""):
```

Right after `with client.cursor() as cur:` (line 2624), before the `TFAT_SECUENCIA` lookup, add the fail-fast validation (probes `CT` then `CO`, same order the frontend's `cargarCotizacion` already uses):
```python
    no_cot = (no_cotizacion or "").strip()
    tipo_cot_origen = ""
    with client.cursor() as cur:
        if no_cot:
            for tc_probe in ("CT", "CO"):
                cur.execute(
                    "SELECT NVL(st_anulado,'N'), no_factura FROM FAT.TFAT_CONDUCE "
                    "WHERE no_cia=:1 AND punto=:2 AND tipo_conduce=:3 AND no_conduce=:4",
                    [no_cia, punto, tc_probe, no_cot])
                cot_row = cur.fetchone()
                if cot_row:
                    tipo_cot_origen = tc_probe
                    st_anulado_cot, no_factura_cot = cot_row[0], (cot_row[1] or '').strip()
                    if st_anulado_cot == 'S':
                        raise ValueError(
                            "La cotizacion/conduce {} esta anulada, no se puede facturar".format(no_cot))
                    if no_factura_cot:
                        raise ValueError(
                            "La cotizacion/conduce {} ya esta facturada (factura {})".format(
                                no_cot, no_factura_cot))
                    break
        cur.execute(
            "SELECT prox_formulario, prox_documento FROM FAT.TFAT_SECUENCIA "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_docu=:3 FOR UPDATE",
            [no_cia, punto, tf])
```

(The `cur.execute("SELECT prox_formulario...")` line already existed — this step only adds the block above it and keeps the rest of the function body unchanged.)

- [ ] **Step 2: Tras crear la factura, enlazar el conduce origen (misma transaccion)**

Current code right before the final commit (lines 2910-2927):
```python
        cur.execute(
            "UPDATE FAT.TFAT_SECUENCIA "
            "SET prox_documento=prox_documento+1, ult_docu_impreso=:1 "
            "WHERE no_cia=:2 AND punto=:3 AND tipo_docu=:4",
            [new_no_factura, no_cia, punto, tf])
        if ncf_val is not None and codigo_ncf_emitir:
            # Avanza prox_ncf al siguiente del NCF efectivamente emitido
            # (puede haber saltado por colisiones).
            cur.execute(
                "UPDATE CNT.TCNT_NCF SET prox_ncf=:1 "
                "WHERE no_localidad=:2 AND codigo_ncf=:3",
                [ncf_val + 1, no_cia, codigo_ncf_emitir])
        historial_repo.log_evento(
            cur, usuario=usuario, no_cia=no_cia, punto=punto, modulo="FAT",
            tipo_documento=tf, no_documento=new_no_factura, accion="CREAR",
        )
        cur.connection.commit()
    return {"no_factura": new_no_factura, "tipo_factura": tf, "ncf": ncf_val,
            "total_neto": total_neto, "total_linea": total_linea,
            "descuento": total_descuento, "impuesto": total_impuesto,
            "valor_recibido": valor_recibido, "valor_devuelto": valor_devuelto}
```

Replace with:
```python
        cur.execute(
            "UPDATE FAT.TFAT_SECUENCIA "
            "SET prox_documento=prox_documento+1, ult_docu_impreso=:1 "
            "WHERE no_cia=:2 AND punto=:3 AND tipo_docu=:4",
            [new_no_factura, no_cia, punto, tf])
        if ncf_val is not None and codigo_ncf_emitir:
            # Avanza prox_ncf al siguiente del NCF efectivamente emitido
            # (puede haber saltado por colisiones).
            cur.execute(
                "UPDATE CNT.TCNT_NCF SET prox_ncf=:1 "
                "WHERE no_localidad=:2 AND codigo_ncf=:3",
                [ncf_val + 1, no_cia, codigo_ncf_emitir])
        if no_cot and tipo_cot_origen:
            cur.execute(
                "UPDATE FAT.TFAT_CONDUCE SET no_factura=:1, tipo_factura=:2 "
                "WHERE no_cia=:3 AND punto=:4 AND tipo_conduce=:5 AND no_conduce=:6",
                [new_no_factura, tf, no_cia, punto, tipo_cot_origen, no_cot])
        historial_repo.log_evento(
            cur, usuario=usuario, no_cia=no_cia, punto=punto, modulo="FAT",
            tipo_documento=tf, no_documento=new_no_factura, accion="CREAR",
        )
        cur.connection.commit()
    return {"no_factura": new_no_factura, "tipo_factura": tf, "ncf": ncf_val,
            "total_neto": total_neto, "total_linea": total_linea,
            "descuento": total_descuento, "impuesto": total_impuesto,
            "valor_recibido": valor_recibido, "valor_devuelto": valor_devuelto,
            "no_cotizacion": no_cot, "tipo_cotizacion": tipo_cot_origen}
```

- [ ] **Step 3: La view lee `no_cotizacion` del request y lo pasa**

Current code (`backend/apps/fat/views.py:209-224`):
```python
        try:
            valor_recibido_raw = request.data.get('valor_recibido')
            valor_recibido = float(valor_recibido_raw) if valor_recibido_raw not in (None, '') else 0.0
            res = fat_repo.create_factura(
                no_cia=str(no_cia).strip(), punto=str(punto).strip(),
                tipo_factura=str(tipo_factura).strip(),
                no_cliente=int(no_cliente), fecha=str(fecha).strip(),
                vendedor=str(vendedor).strip(), forma_pago=str(forma_pago).strip(),
                no_lista=str(no_lista).strip(), nota=str(nota).strip(),
                detalle=str(detalle).strip(), lineas=lineas,
                usuario=request.user.username,
                codigo_ncf=str(request.data.get('codigo_ncf', '')).strip(),
                valor_recibido=valor_recibido,
                nombre_cliente_factura=str(request.data.get('nombre_cliente_factura', '')).strip(),
                rnc_factura=str(request.data.get('rnc_factura', '')).strip())
            return Response(res, status=201)
        except ValueError as e:
            return Response({'detail': str(e)}, status=400)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)
```
Replace with:
```python
        try:
            valor_recibido_raw = request.data.get('valor_recibido')
            valor_recibido = float(valor_recibido_raw) if valor_recibido_raw not in (None, '') else 0.0
            res = fat_repo.create_factura(
                no_cia=str(no_cia).strip(), punto=str(punto).strip(),
                tipo_factura=str(tipo_factura).strip(),
                no_cliente=int(no_cliente), fecha=str(fecha).strip(),
                vendedor=str(vendedor).strip(), forma_pago=str(forma_pago).strip(),
                no_lista=str(no_lista).strip(), nota=str(nota).strip(),
                detalle=str(detalle).strip(), lineas=lineas,
                usuario=request.user.username,
                codigo_ncf=str(request.data.get('codigo_ncf', '')).strip(),
                valor_recibido=valor_recibido,
                nombre_cliente_factura=str(request.data.get('nombre_cliente_factura', '')).strip(),
                rnc_factura=str(request.data.get('rnc_factura', '')).strip(),
                no_cotizacion=str(request.data.get('no_cotizacion', '')).strip())
            return Response(res, status=201)
        except ValueError as e:
            return Response({'detail': str(e)}, status=400)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)
```

- [ ] **Step 4: py_compile ambos archivos**

Run: `python -m py_compile backend/apps/legacy/repositories/fat_repo.py backend/apps/fat/views.py`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/legacy/repositories/fat_repo.py backend/apps/fat/views.py
git commit -m "feat(fat): enlazar factura con su cotizacion origen (TFAT_CONDUCE.NO_FACTURA)

El frontend (fat-nueva-factura.tsx) ya enviaba no_cotizacion al crear
una factura, pero la view lo ignoraba y create_factura ni lo aceptaba
como parametro -- TFAT_CONDUCE.NO_FACTURA nunca se seteaba pese a que
la UI ya muestra 'Factura vinculada'. create_factura ahora valida
fail-fast (no anulada, no ya facturada) antes de crear el documento y,
en la misma transaccion, actualiza el conduce origen al terminar."
```

---

### Task 4: Anular (reversar) cotización/conduce — backend

**Files:**
- Modify: `backend/apps/legacy/repositories/fat_repo.py` (nueva función, junto a `update_conduce`)
- Modify: `backend/apps/fat/views.py` (nueva view, junto a `FatConduceDetailView`)
- Modify: `backend/apps/fat/urls.py`

- [ ] **Step 1: `anular_conduce()` en `fat_repo.py`**

Add right after the closing of `update_conduce` (search for the function that starts at `def update_conduce(no_cia, punto, tipo_conduce, no_conduce, no_cliente, fecha,` — insert this new function immediately after `update_conduce`'s `return` statement, at the same indentation level, before the next `def`):

```python
def anular_conduce(no_cia, punto, tipo_conduce, no_conduce, usuario, motivo=""):
    """Anula (reversa) una cotizacion/conduce. Una cotizacion no genera NCF,
    movimiento de inventario ni documento CXC -- no hay nada que revertir
    contablemente, asi que anular es solo marcar ST_ANULADO='S'. Bloqueado
    si ya esta anulado o si ya tiene una factura vinculada (esa se anula
    aparte, desde Facturas)."""
    tc = tipo_conduce.strip().upper()
    nc = no_conduce.strip()
    with client.cursor() as cur:
        cur.execute(
            "SELECT NVL(st_anulado,'N'), no_factura FROM FAT.TFAT_CONDUCE "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_conduce=:3 AND no_conduce=:4 "
            "FOR UPDATE",
            [no_cia, punto, tc, nc])
        row = cur.fetchone()
        if not row:
            raise ValueError("Conduce no encontrado")
        st_anulado, no_factura = row[0], (row[1] or '').strip()
        if st_anulado == 'S':
            raise ValueError("El conduce ya esta anulado")
        if no_factura:
            raise ValueError(
                "No se puede anular: ya esta facturado (factura {})".format(no_factura))
        cur.execute(
            "UPDATE FAT.TFAT_CONDUCE SET st_anulado='S' "
            "WHERE no_cia=:1 AND punto=:2 AND tipo_conduce=:3 AND no_conduce=:4",
            [no_cia, punto, tc, nc])
        historial_repo.log_evento(
            cur, usuario=usuario, no_cia=no_cia, punto=punto, modulo="FAT",
            tipo_documento=tc, no_documento=nc, accion="ANULAR", nota=motivo,
        )
        cur.connection.commit()
    return {"tipo_conduce": tc, "no_conduce": nc, "anulado": True, "motivo": motivo}
```

If `historial_repo.log_evento` doesn't accept a `nota` kwarg, check its signature (`grep -n "def log_evento" backend/apps/legacy/repositories/historial_repo.py`) before this step and drop the `nota=motivo` argument if unsupported — every other call site in this file (`create_factura`, etc.) omits it, so confirm before assuming.

- [ ] **Step 2: `FatAnularConduceView` en `views.py`**

Add right after the closing of `class FatConduceDetailView` (after its `patch` method, before the `# -- Cuadre de Caja --` comment block):
```python
class FatAnularConduceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        no_cia = request.data.get('no_cia')
        punto = request.data.get('punto', '01')
        tipo_conduce = request.data.get('tipo_conduce')
        no_conduce = request.data.get('no_conduce')
        motivo = request.data.get('motivo', '')
        if not all([no_cia, tipo_conduce, no_conduce]):
            return Response({'detail': 'no_cia, tipo_conduce y no_conduce son requeridos'}, status=400)
        forbidden = _check_fat_access(request.user.username, str(no_cia).strip(), str(punto).strip())
        if forbidden:
            return forbidden
        try:
            res = fat_repo.anular_conduce(
                no_cia=str(no_cia).strip(), punto=str(punto).strip(),
                tipo_conduce=str(tipo_conduce).strip(), no_conduce=str(no_conduce).strip(),
                usuario=request.user.username, motivo=str(motivo).strip())
            return Response(res)
        except ValueError as e:
            return Response({'detail': str(e)}, status=422)
        except Exception as e:
            return Response({'detail': str(e)}, status=500)
```

- [ ] **Step 3: Ruta en `urls.py`**

In `backend/apps/fat/urls.py`, line 9, add `FatAnularConduceView` to the import list:
```python
    FatConducesView, FatConduceDetailView, FatCuadreCajaView,
```
becomes
```python
    FatConducesView, FatConduceDetailView, FatAnularConduceView, FatCuadreCajaView,
```

And add the route right after line 57 (`path('fat/conduces/<str:tipo>/<str:no_conduce>/', FatConduceDetailView.as_view()),`):
```python
    path('fat/conduces/anular/', FatAnularConduceView.as_view()),
```

- [ ] **Step 4: py_compile los 3 archivos**

Run: `python -m py_compile backend/apps/legacy/repositories/fat_repo.py backend/apps/fat/views.py backend/apps/fat/urls.py`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/legacy/repositories/fat_repo.py backend/apps/fat/views.py backend/apps/fat/urls.py
git commit -m "feat(fat): endpoint para anular (reversar) cotizaciones/conduces

POST /api/fat/conduces/anular/ marca ST_ANULADO='S'. Una cotizacion no
genera NCF/inventario/CXC, asi que anular no revierte nada contable --
solo bloquea edicion/facturacion futura. Rechaza si ya esta anulado o
si ya tiene factura vinculada (esa se anula aparte, desde Facturas)."
```

---

### Task 5: Deploy backend a la VM y smoke HTTP

**Files:** ninguno (solo despliegue + verificación)

- [ ] **Step 1: Subir los archivos cambiados a la VM (skill `sigaft-deploy-vm`)**

Run (ajustar credenciales/paths según esa skill):
```bash
/c/Users/JCABREU/bin/pscp -batch -pw Temp1234! -hostkey SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc \
  backend/apps/legacy/repositories/inv_repo.py \
  backend/apps/legacy/repositories/fat_repo.py \
  backend/apps/fat/views.py \
  backend/apps/fat/urls.py \
  jcabreu@10.0.0.99:/home/jcabreu/facturation-system/backend/apps/legacy/repositories/
```
(usar 4 comandos `pscp` separados, uno por ruta de destino real: `apps/legacy/repositories/`, `apps/legacy/repositories/`, `apps/fat/`, `apps/fat/` — confirmar los paths remotos exactos con `sigaft-deploy-vm` antes de copiar.)

- [ ] **Step 2: py_compile remoto**

Run:
```bash
/c/Users/JCABREU/bin/plink -batch -pw Temp1234! -hostkey SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc jcabreu@10.0.0.99 \
  "cd facturation-system && docker compose exec -T backend python -m py_compile apps/legacy/repositories/inv_repo.py apps/legacy/repositories/fat_repo.py apps/fat/views.py apps/fat/urls.py"
```
Expected: no output, exit 0. If it fails, fix and re-upload before continuing.

- [ ] **Step 3: Smoke HTTP — servicio no bloquea existencia (Task 2)**

Con un producto real marcado `servicio='S'` en alguna compañía de prueba (crearlo si no existe uno, vía `POST /api/inv/productos/` con `servicio: 'S'`), intentar `POST /api/fat/facturas/` con una línea de ese producto y `cantidad` > 0. Confirmar HTTP 201 (no 400 "Existencia insuficiente").

- [ ] **Step 4: Smoke HTTP — anular conduce (Task 4)**

Crear un conduce de prueba (`POST /api/fat/conduces/`), luego `POST /api/fat/conduces/anular/` con su `tipo_conduce`/`no_conduce`. Confirmar HTTP 200 con `{"anulado": true}`. Repetir la llamada — confirmar HTTP 422 "ya esta anulado".

No commit en este task (solo verificación).

---

### Task 6: Frontend — `fatAnularConduce` en el cliente API

**Files:**
- Modify: `frontend/src/lib/regal-general-api.ts` (junto a `fatAnularFactura`, alrededor de la línea 1172-1176)

- [ ] **Step 1: Agregar el método**

Right after the existing `fatAnularFactura` method:
```typescript
  fatAnularFactura: (data: { no_cia: string; punto?: string; tipo_factura: string; no_factura: string; usuario?: string; motivo?: string; liberar_ncf?: boolean; tipo_anula_dgii?: string }) =>
    request<{ no_factura: string; tipo_factura: string; anulado: boolean; motivo: string }>('/fat/facturas/anular/', {
      method: 'POST', body: JSON.stringify(data),
    }),
```
add:
```typescript

  fatAnularConduce: (data: { no_cia: string; punto?: string; tipo_conduce: string; no_conduce: string; motivo?: string }) =>
    request<{ tipo_conduce: string; no_conduce: string; anulado: boolean; motivo: string }>('/fat/conduces/anular/', {
      method: 'POST', body: JSON.stringify(data),
    }),
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/regal-general-api.ts
git commit -m "feat(frontend): cliente API para anular cotizaciones/conduces"
```

---

### Task 7: Frontend — `CrearProductoModal` gana `tipoInicial` y `preselectAlmacenKey`

**Files:**
- Modify: `frontend/src/features/fat/components/crear-producto-modal.tsx`

- [ ] **Step 1: Nuevas props opcionales**

Current `Props` interface (lines 56-73):
```typescript
interface Props {
  open: boolean
  onClose: () => void
  /** Se llama tras crear el producto con éxito. El caller decide qué hacer
   * con él (seleccionarlo en una fila, en el modal de búsqueda, etc). No se
   * invoca en modo edición — para eso usar `onUpdated`. */
  onCreated: (producto: CrearProductoModalResult) => void
  /** Se llama tras editar un producto existente con éxito. */
  onUpdated?: () => void
  noCia: string
  punto?: string
  /** Prefill de descripción con el texto que el usuario ya había tecleado
   * en el buscador que disparó este modal. Solo aplica al crear. */
  descripcionInicial?: string
  /** Si se define, el sheet abre en modo edición para este no_produ en vez
   * de crear uno nuevo. */
  editingNoProdu?: string | null
}
```
Replace with:
```typescript
interface Props {
  open: boolean
  onClose: () => void
  /** Se llama tras crear el producto con éxito. El caller decide qué hacer
   * con él (seleccionarlo en una fila, en el modal de búsqueda, etc). No se
   * invoca en modo edición — para eso usar `onUpdated`. */
  onCreated: (producto: CrearProductoModalResult) => void
  /** Se llama tras editar un producto existente con éxito. */
  onUpdated?: () => void
  noCia: string
  punto?: string
  /** Prefill de descripción con el texto que el usuario ya había tecleado
   * en el buscador que disparó este modal. Solo aplica al crear. */
  descripcionInicial?: string
  /** Si se define, el sheet abre en modo edición para este no_produ en vez
   * de crear uno nuevo. */
  editingNoProdu?: string | null
  /** Preselecciona el tipo (Inventario/Servicio/Kit/Compuesto) al crear.
   * Solo aplica al crear. */
  tipoInicial?: 'I' | 'S' | 'K' | 'C'
  /** Formato `no_cia|punto|almacen`. Si viene, ese almacén queda pre-marcado
   * en "Asignar a Empresa/Almacén" al crear (evita que el producto recién
   * creado quede sin asignar y la operación que lo disparó falle después).
   * Solo aplica al crear. */
  preselectAlmacenKey?: string
}
```

- [ ] **Step 2: Recibirlas en la firma del componente**

Current (lines 174-183):
```typescript
export function CrearProductoModal({
  open,
  onClose,
  onCreated,
  onUpdated,
  noCia,
  punto,
  descripcionInicial = '',
  editingNoProdu = null,
}: Props) {
```
Replace with:
```typescript
export function CrearProductoModal({
  open,
  onClose,
  onCreated,
  onUpdated,
  noCia,
  punto,
  descripcionInicial = '',
  editingNoProdu = null,
  tipoInicial,
  preselectAlmacenKey,
}: Props) {
```

- [ ] **Step 3: Preseleccionar el almacén al abrir (solo en modo creación)**

Current (line 263, dentro del `useEffect` de reset al abrir):
```typescript
    setAlmacenesSel(new Set())
```
Replace with:
```typescript
    setAlmacenesSel(!isEdit && preselectAlmacenKey ? new Set([preselectAlmacenKey]) : new Set())
```

- [ ] **Step 4: Preseleccionar el tipo al crear**

Current (lines 403-404, dentro del `else` del mismo `useEffect`):
```typescript
    } else {
      setForm({ ...emptyForm, descripcion: descripcionInicial })
```
Replace with:
```typescript
    } else {
      setForm({ ...emptyForm, descripcion: descripcionInicial, servicio: tipoInicial || emptyForm.servicio })
```

- [ ] **Step 5: Agregar `preselectAlmacenKey` a las dependencias del `useEffect`**

Current (line 419-420):
```typescript
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, noCia, editingNoProdu])
```
Replace with:
```typescript
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, noCia, editingNoProdu, preselectAlmacenKey, tipoInicial])
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fat/components/crear-producto-modal.tsx
git commit -m "feat(fat): CrearProductoModal acepta tipo y almacen preseleccionados

Nuevas props opcionales tipoInicial y preselectAlmacenKey, solo activas
al crear (no al editar). Las usa el side sheet de productos faltantes
de Cotizacion -> Factura para que el producto nuevo salga ya marcado
como Servicio/Articulo y asignado al almacen de la factura en curso."
```

---

### Task 8: Frontend — nuevo componente `MissingProductsSheet`

**Files:**
- Create: `frontend/src/features/fat/components/missing-products-sheet.tsx`

- [ ] **Step 1: Crear el archivo**

```typescript
// Side sheet que se abre al cargar una cotización en Nueva Factura si trae
// líneas "manuales" (no_produ='X', solo marca/descripción libre — ver
// fat-nuevo-conduce.tsx::agregarLineaCustom). Esas líneas no corresponden a
// ningún producto real de INV.TINV_PRODUCTO, así que no se pueden facturar
// tal cual: por cada una, el usuario decide si se materializa como Artículo
// o como Servicio, reutilizando el mismo CrearProductoModal del resto del
// sistema (no se duplica el formulario de producto).
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CrearProductoModal,
  type CrearProductoModalResult,
} from './crear-producto-modal'

export interface LineaFaltante {
  idx: number
  descripcion: string
  cantidad: number
  precio: number
}

interface Props {
  open: boolean
  lineas: LineaFaltante[]
  noCia: string
  punto: string
  preselectAlmacenKey?: string
  onResolved: (idx: number, producto: CrearProductoModalResult) => void
  onClose: () => void
}

export function MissingProductsSheet({
  open,
  lineas,
  noCia,
  punto,
  preselectAlmacenKey,
  onResolved,
  onClose,
}: Props) {
  const [creando, setCreando] = useState<{
    idx: number
    tipo: 'I' | 'S'
    descripcion: string
  } | null>(null)

  return (
    <>
      <Sheet
        open={open && !creando}
        onOpenChange={(o) => {
          if (!o) onClose()
        }}
      >
        <SheetContent size='lg' className='sm:max-w-2xl'>
          <SheetHeader>
            <SheetTitle>Estos artículos no existen en el inventario</SheetTitle>
          </SheetHeader>
          <div className='space-y-3 overflow-y-auto px-6 py-4'>
            <p className='text-sm text-muted-foreground'>
              La cotización tiene {lineas.length} línea
              {lineas.length !== 1 ? 's' : ''} con producto manual (marca/
              descripción libre) que no corresponde a un artículo real.
              Elige cómo crear cada una antes de guardar la factura.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className='text-right'>Cantidad</TableHead>
                  <TableHead className='text-right'>Precio</TableHead>
                  <TableHead className='w-56 text-center'>Crear como</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((l) => (
                  <TableRow key={l.idx}>
                    <TableCell className='text-sm'>
                      {l.descripcion || '(sin descripción)'}
                    </TableCell>
                    <TableCell className='text-right font-mono text-sm'>
                      {l.cantidad}
                    </TableCell>
                    <TableCell className='text-right font-mono text-sm'>
                      {l.precio.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className='flex justify-center gap-2'>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() =>
                            setCreando({ idx: l.idx, tipo: 'I', descripcion: l.descripcion })
                          }
                        >
                          Artículo
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() =>
                            setCreando({ idx: l.idx, tipo: 'S', descripcion: l.descripcion })
                          }
                        >
                          Servicio
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <SheetFooter>
            <Button variant='outline' onClick={onClose}>
              Cerrar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {creando && (
        <CrearProductoModal
          open={true}
          onClose={() => setCreando(null)}
          noCia={noCia}
          punto={punto}
          descripcionInicial={creando.descripcion}
          tipoInicial={creando.tipo}
          preselectAlmacenKey={preselectAlmacenKey}
          onCreated={(p) => {
            const idx = creando.idx
            setCreando(null)
            onResolved(idx, p)
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/fat/components/missing-products-sheet.tsx
git commit -m "feat(fat): side sheet para materializar productos faltantes de una cotizacion"
```

---

### Task 9: Frontend — integrar todo en `fat-nueva-factura.tsx`

**Files:**
- Modify: `frontend/src/features/fat/fat-nueva-factura.tsx`

- [ ] **Step 1: Nueva prop `cotizacionInicial`**

Current (lines 38-41):
```typescript
interface Props {
  noCia: string
  punto: string
}
```
Replace with:
```typescript
interface Props {
  noCia: string
  punto: string
  cotizacionInicial?: string
}
```

Current function signature (line 166):
```typescript
export function NuevaFactura({ noCia, punto }: Props) {
```
Replace with:
```typescript
export function NuevaFactura({ noCia, punto, cotizacionInicial }: Props) {
```

- [ ] **Step 2: Import del nuevo componente**

Current imports (lines 34-36):
```typescript
import { BuscarProductoModal } from './components/buscar-producto-modal'
import { empaqueLabel } from './utils/empaque-label'
import { CrearClienteModal } from '@/components/cxc/crear-cliente-modal'
```
Replace with:
```typescript
import { BuscarProductoModal } from './components/buscar-producto-modal'
import { MissingProductsSheet } from './components/missing-products-sheet'
import { empaqueLabel } from './utils/empaque-label'
import { CrearClienteModal } from '@/components/cxc/crear-cliente-modal'
```

- [ ] **Step 3: Estado nuevo para el sheet, junto al resto del estado de líneas**

Current (lines 264-266):
```typescript
  // Lines
  const [lineas, setLineas] = useState<Linea[]>([])
  const [defaultAlmacen, setDefaultAlmacen] = useState('')
```
Replace with:
```typescript
  // Lines
  const [lineas, setLineas] = useState<Linea[]>([])
  const [defaultAlmacen, setDefaultAlmacen] = useState('')
  const [missingSheetOpen, setMissingSheetOpen] = useState(false)
  const cotizacionAutoCargadaRef = useRef(false)
```

- [ ] **Step 4: Detectar líneas faltantes al terminar de cargar la cotización**

Current end of `cargarCotizacion` (lines 596-600):
```typescript
    toast({
      title: `${cot.tipo_conduce} ${cot.no_conduce} cargado`,
      description: `${lineasCot.length} línea(s) — Cliente ${cot.no_cliente} ${cot.nombre_cliente || ''}`,
    })
  }
```
Replace with:
```typescript
    toast({
      title: `${cot.tipo_conduce} ${cot.no_conduce} cargado`,
      description: `${lineasCot.length} línea(s) — Cliente ${cot.no_cliente} ${cot.nombre_cliente || ''}`,
    })
    if (nuevas.some((l) => l.no_produ === 'X')) setMissingSheetOpen(true)
  }
```

- [ ] **Step 5: Auto-cargar cuando la ruta trae `?cotizacion=`**

Add this `useEffect` right after the closing brace of `cargarCotizacion` (after the block from Step 4 above, i.e. right after the line `}` that closes the function, before `const limpiarCliente = () => {`):
```typescript

  // Autocarga si se llega desde el botón "Facturar" de Consulta de
  // Documentos (conduces.tsx) con ?cotizacion=<no_conduce>. Reusa la misma
  // función que ya dispara el input manual "Cotización/Pedido" — sin
  // duplicar lógica de carga.
  useEffect(() => {
    if (!cotizacionInicial || cotizacionAutoCargadaRef.current) return
    if (!noCia || !punto) return
    cotizacionAutoCargadaRef.current = true
    setNoCotizacion(cotizacionInicial)
    cargarCotizacion(cotizacionInicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotizacionInicial, noCia, punto])
```

- [ ] **Step 6: Handler para resolver una línea faltante + lista derivada**

Add this right after the `eliminarLinea` function (lines 751-752):
```typescript
  const eliminarLinea = (idx: number) =>
    setLineas((prev) => prev.filter((_, i) => i !== idx))
```
becomes
```typescript
  const eliminarLinea = (idx: number) =>
    setLineas((prev) => prev.filter((_, i) => i !== idx))

  // Líneas que llegaron de una cotización como "producto manual" (no_produ
  // 'X', ver fat-nuevo-conduce.tsx::agregarLineaCustom) y todavía no se
  // resolvieron a un producto real. Alimenta MissingProductsSheet.
  const lineasFaltantes = lineas
    .map((l, idx) => ({ idx, l }))
    .filter(({ l }) => l.no_produ === 'X')
    .map(({ idx, l }) => ({
      idx,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio: l.precio,
    }))

  const resolverLineaFaltante = (
    idx: number,
    p: { no_produ: string; porciento_impuesto: number; unidad_empaque?: string }
  ) => {
    setLineas((prev) => {
      const arr = [...prev]
      if (!arr[idx]) return prev
      const l = { ...arr[idx] }
      l.no_produ = p.no_produ
      l.porciento_impuesto = p.porciento_impuesto
      l.itbis = p.porciento_impuesto > 0
      l.emp = p.unidad_empaque || l.emp
      l.empaques = []
      arr[idx] = l
      return arr
    })
    aplicarEmpaquesALinea(idx, p.no_produ, lineas[idx]?.precio ?? 0)
  }
```

- [ ] **Step 7: Renderizar el sheet**

Add right before the closing `<BuscarProductoModal ... />` block ends, i.e. right after its closing `/>` (around line 2009, immediately after `defaultAlmacen={modalAlmacen || defaultAlmacen}` `/>`  — insert as a new sibling element right after that component in the JSX):
```typescript
        defaultAlmacen={modalAlmacen || defaultAlmacen}
      />

      <MissingProductsSheet
        open={missingSheetOpen}
        lineas={lineasFaltantes}
        noCia={noCia}
        punto={punto}
        preselectAlmacenKey={
          defaultAlmacen ? `${noCia}|${punto}|${defaultAlmacen}` : undefined
        }
        onResolved={(idx, p) => resolverLineaFaltante(idx, p)}
        onClose={() => setMissingSheetOpen(false)}
      />
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/fat/fat-nueva-factura.tsx
git commit -m "feat(fat): Nueva Factura autocarga cotizacion por query param y resuelve productos faltantes

cargarCotizacion() ya existia (input manual 'Cotizacion/Pedido'); ahora
tambien se dispara solo con ?cotizacion=<no> en la URL (lo que usa el
boton Facturar de Consulta de Documentos). Si la cotizacion trae lineas
manuales (no_produ='X'), se abre MissingProductsSheet para resolverlas
como Articulo o Servicio antes de poder guardar la factura."
```

---

### Task 10: Frontend — ruta `/fat/nueva-factura` acepta `?cotizacion=`

**Files:**
- Modify: `frontend/src/routes/_authenticated/fat/nueva-factura.tsx`

- [ ] **Step 1: Reemplazar el archivo completo**

Current content:
```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { NuevaFactura } from '@/features/fat/fat-nueva-factura'

export const Route = createFileRoute('/_authenticated/fat/nueva-factura')({
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  return <NuevaFactura noCia={noCia} punto={punto} />
}
```
Replace with:
```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useCompany } from '@/context/company-context'
import { NuevaFactura } from '@/features/fat/fat-nueva-factura'

export const Route = createFileRoute('/_authenticated/fat/nueva-factura')({
  validateSearch: (search: Record<string, unknown>) => ({
    cotizacion: typeof search.cotizacion === 'string' ? search.cotizacion : undefined,
  }),
  component: _Page,
})

function _Page() {
  const { selectedCompany, selectedPoint } = useCompany()
  const noCia = selectedCompany ?? ''
  const punto  = selectedPoint  ?? ''
  const { cotizacion } = Route.useSearch()
  return <NuevaFactura noCia={noCia} punto={punto} cotizacionInicial={cotizacion} />
}
```

(Pattern copied from the sibling route `frontend/src/routes/_authenticated/fat/nuevo-conduce.tsx`, which already does exactly this for `id`/`tipo`.)

- [ ] **Step 2: Commit**

```bash
git add frontend/src/routes/_authenticated/fat/nueva-factura.tsx
git commit -m "feat(fat): ruta nueva-factura acepta ?cotizacion= para autocarga"
```

---

### Task 11: Frontend — botones "Facturar" y "Anular" en Consulta de Documentos (`conduces.tsx`)

**Files:**
- Modify: `frontend/src/features/fat/conduces.tsx`

- [ ] **Step 1: Imports nuevos**

Current (lines 1-37):
```typescript
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  PackageOpen,
  Pencil,
  Printer,
  Search,
} from 'lucide-react'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DocumentoDetalleSheet } from '@/features/documentos/documento-detalle-sheet'
import { DocumentoHistorial } from '@/features/historial/documento-historial'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { buildReportMeta, downloadCsv } from './fat-export'
```
Replace with:
```typescript
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Calendar,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  PackageOpen,
  Pencil,
  Printer,
  Receipt,
  Search,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { regalGeneralApi } from '@/lib/regal-general-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DocumentoDetalleSheet } from '@/features/documentos/documento-detalle-sheet'
import { DocumentoHistorial } from '@/features/historial/documento-historial'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { buildReportMeta, downloadCsv } from './fat-export'
```

- [ ] **Step 2: Estado para el diálogo de anulación**

Find the component's existing state declarations (near the top of the `Conduces` function — search for `const [selected, setSelected] = useState` in this file) and add right after it:
```typescript
  const [anularOpen, setAnularOpen] = useState(false)
  const [motivoAnular, setMotivoAnular] = useState('')
  const [anulando, setAnulando] = useState(false)
  const [anularError, setAnularError] = useState('')
```

- [ ] **Step 3: Handler de confirmación de anulación**

Add near the other handlers (e.g. right after `openConducePdf`, before `const totalPages = ...` at line 332):
```typescript
  const confirmarAnularConduce = async () => {
    if (!selected) return
    setAnulando(true)
    setAnularError('')
    try {
      await regalGeneralApi.fatAnularConduce({
        no_cia: selected.no_cia,
        punto: selected.punto,
        tipo_conduce: selected.tipo_conduce,
        no_conduce: selected.no_conduce,
        motivo: motivoAnular.trim(),
      })
      setAnularOpen(false)
      setSelected((s) => (s ? { ...s, st_anulado: 'S' } : s))
      toast.success(`${selected.tipo_conduce}-${selected.no_conduce} anulado`)
      load(page)
    } catch (e: any) {
      const msg = e?.body?.detail ?? e?.message ?? 'Error al anular'
      setAnularError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setAnulando(false)
    }
  }
```

(Confirm the exact names `load`/`page` in scope by checking the file's existing pagination handler — `conduces.tsx` already calls `load(page - 1)`/`load(page + 1)` in the pagination buttons at lines 548/558, so both are in scope.)

- [ ] **Step 4: Botones "Facturar" y "Anular" en el sheet de detalle**

Current button row (lines 599-642):
```typescript
              <div className='flex flex-wrap justify-end gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  className='shrink-0 gap-1'
                  onClick={() =>
                    openConducePdf({
                      no_cia: selected.no_cia,
                      punto: selected.punto,
                      tipo_conduce: selected.tipo_conduce,
                      no_conduce: selected.no_conduce,
                    })
                  }
                >
                  <FileText className='h-3.5 w-3.5' /> Imprimir PDF
                </Button>
                {selected.st_anulado !== 'S' && (
                  <Button
                    size='sm'
                    variant='outline'
                    className='shrink-0 gap-1'
                    onClick={() => {
                      setSelected(null)
                      navigate({
                        to: '/fat/nuevo-conduce' as never,
                        search: {
                          id: selected.no_conduce,
                          tipo: selected.tipo_conduce,
                        } as never,
                      })
                    }}
                  >
                    <Pencil className='h-3.5 w-3.5' /> Editar
                  </Button>
                )}
                <Button
                  size='sm'
                  variant='outline'
                  className='shrink-0 gap-1'
                  onClick={() => setVerHistorial(v => !v)}
                >
                  <History className='h-3.5 w-3.5' /> {verHistorial ? 'Ocultar historial' : 'Ver historial'}
                </Button>
              </div>
```
Replace with:
```typescript
              <div className='flex flex-wrap justify-end gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  className='shrink-0 gap-1'
                  onClick={() =>
                    openConducePdf({
                      no_cia: selected.no_cia,
                      punto: selected.punto,
                      tipo_conduce: selected.tipo_conduce,
                      no_conduce: selected.no_conduce,
                    })
                  }
                >
                  <FileText className='h-3.5 w-3.5' /> Imprimir PDF
                </Button>
                {selected.tipo_conduce === 'CT' &&
                  selected.st_anulado !== 'S' &&
                  !selected.no_factura && (
                    <Button
                      size='sm'
                      className='shrink-0 gap-1'
                      onClick={() => {
                        const no = selected.no_conduce
                        setSelected(null)
                        navigate({
                          to: '/fat/nueva-factura' as never,
                          search: { cotizacion: no } as never,
                        })
                      }}
                    >
                      <Receipt className='h-3.5 w-3.5' /> Facturar
                    </Button>
                  )}
                {selected.st_anulado !== 'S' && !selected.no_factura && (
                  <Button
                    size='sm'
                    variant='outline'
                    className='shrink-0 gap-1'
                    onClick={() => {
                      setSelected(null)
                      navigate({
                        to: '/fat/nuevo-conduce' as never,
                        search: {
                          id: selected.no_conduce,
                          tipo: selected.tipo_conduce,
                        } as never,
                      })
                    }}
                  >
                    <Pencil className='h-3.5 w-3.5' /> Editar
                  </Button>
                )}
                {selected.st_anulado !== 'S' && !selected.no_factura && (
                  <Button
                    size='sm'
                    variant='destructive'
                    className='shrink-0 gap-1'
                    onClick={() => {
                      setMotivoAnular('')
                      setAnularError('')
                      setAnularOpen(true)
                    }}
                  >
                    <XCircle className='h-3.5 w-3.5' /> Anular
                  </Button>
                )}
                <Button
                  size='sm'
                  variant='outline'
                  className='shrink-0 gap-1'
                  onClick={() => setVerHistorial(v => !v)}
                >
                  <History className='h-3.5 w-3.5' /> {verHistorial ? 'Ocultar historial' : 'Ver historial'}
                </Button>
              </div>
```

- [ ] **Step 5: Diálogo de confirmación de anulación**

Add right after the closing `</DocumentoDetalleSheet>` (immediately before the component's final `</section>` closing tag — search for `</DocumentoDetalleSheet>` near the end of the file):
```typescript
      </DocumentoDetalleSheet>

      <Dialog open={anularOpen} onOpenChange={setAnularOpen}>
        <DialogContent className='p-6 sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2 text-destructive'>
              <AlertTriangle className='h-5 w-5' /> Confirmar Anulación
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-3 text-sm'>
            <p>
              Va a anular{' '}
              <strong>
                {selected?.tipo_conduce === 'CT' ? 'la cotización' : 'el conduce'}{' '}
                {selected?.tipo_conduce}-{selected?.no_conduce}
              </strong>
              . Esta acción no se puede deshacer.
            </p>
            <div className='space-y-1'>
              <Label className='text-xs'>Motivo (opcional)</Label>
              <Textarea
                value={motivoAnular}
                onChange={(e) => setMotivoAnular(e.target.value)}
                placeholder='Describa el motivo de anulación...'
                rows={3}
                className='resize-none'
              />
            </div>
            {anularError && (
              <p className='text-xs text-destructive'>{anularError}</p>
            )}
            <div className='flex justify-end gap-2 pt-1'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setAnularOpen(false)}
                disabled={anulando}
              >
                Cancelar
              </Button>
              <Button
                variant='destructive'
                size='sm'
                onClick={confirmarAnularConduce}
                disabled={anulando}
              >
                <XCircle className='mr-1 h-3 w-3' />
                {anulando ? 'Anulando...' : 'Confirmar Anulación'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
```

(This replaces the previous final two lines `</section>\n  )\n}` of the file — the new block ends the same way, just with the `Dialog` inserted before it.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/fat/conduces.tsx
git commit -m "feat(fat): botones Facturar y Anular en Consulta de Documentos (conduces)

Facturar (solo CT, no anulada, no ya facturada) navega a Nueva Factura
con ?cotizacion=<no> para autocarga. Anular (CO/CT, no anulada, no ya
facturada) llama al nuevo endpoint y refresca la lista."
```

---

### Task 12: Frontend — activar el botón "Anular" (stub) en `fat-nuevo-conduce.tsx`

**Files:**
- Modify: `frontend/src/features/fat/fat-nuevo-conduce.tsx`

- [ ] **Step 1: Revisar el contexto exacto antes de editar**

Run: `grep -n "editId\|editTipo\|Anular" frontend/src/features/fat/fat-nuevo-conduce.tsx`

Confirm the component already has `editId`/`editTipo` props (seen at lines 46-51) and no existing `st_anulado`/`no_factura` state for the conduce being edited — the edit-mode load path (triggered when `editId` is set) needs to be located and read fully before this task, since the current file excerpt read during planning only covered lines 1-80 and 870-960. Locate the `useEffect` that loads the conduce when `editId` is present (search for `editId` usages) and confirm it stores the full response (or at least `st_anulado`/`no_factura`) somewhere accessible, e.g. in a state variable. If it only extracts individual fields today, add `const [conduceCargado, setConduceCargado] = useState<{ no_factura?: string; st_anulado?: string } | null>(null)` and set it from that response, so the button's visibility/enabled state and the anular call have what they need.

- [ ] **Step 2: Reemplazar el botón deshabilitado**

Current (lines 926-930):
```typescript
          <div className='flex items-end'>
            <Button variant='outline' disabled className='w-full text-gray-400'>
              Anular
            </Button>
          </div>
```
Replace with:
```typescript
          <div className='flex items-end'>
            <Button
              variant='outline'
              className='w-full'
              disabled={!editId || conduceCargado?.st_anulado === 'S' || !!conduceCargado?.no_factura}
              onClick={async () => {
                if (!editId || !editTipo) return
                if (!window.confirm(`¿Anular ${editTipo}-${editId}? Esta acción no se puede deshacer.`)) return
                try {
                  await regalGeneralApi.fatAnularConduce({
                    no_cia: noCia,
                    punto,
                    tipo_conduce: editTipo,
                    no_conduce: editId,
                  })
                  toast({ title: `${editTipo}-${editId} anulado` })
                  navigate({ to: '/fat/conduces' as never })
                } catch (e: any) {
                  toast({
                    title: 'Error al anular',
                    description: e?.body?.detail ?? e?.message ?? 'Error desconocido',
                    variant: 'destructive',
                  })
                }
              }}
            >
              Anular
            </Button>
          </div>
```

Verify the file's existing toast usage first: `grep -n "useToast\|toast(" frontend/src/features/fat/fat-nuevo-conduce.tsx` — if it uses `useToast()` (like `fat-nueva-factura.tsx`) rather than `sonner`, keep the `toast({ title, description, variant })` call shape above (already written for that hook). If it uses `sonner`, adapt to `toast.success(...)`/`toast.error(...)` instead — check before applying this step, since the excerpt read during planning (lines 1-80) did not show a toast import for this specific file.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/fat/fat-nuevo-conduce.tsx
git commit -m "feat(fat): activar boton Anular en edicion de conduce/cotizacion

Era un stub disabled. Ahora llama al endpoint de anulacion y vuelve a
Consulta de Documentos. Deshabilitado si ya esta anulado o ya tiene
factura vinculada, igual que la regla del backend."
```

---

### Task 13: Deploy frontend (Netlify) y verificación

**Files:** ninguno

- [ ] **Step 1: Verificación de tipos local (sin build completo — ver nota de cabecera)**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "missing-products-sheet|crear-producto-modal|fat-nueva-factura|conduces\.tsx|fat-nuevo-conduce|nueva-factura\.tsx|regal-general-api"`
Expected: no output referencing the files touched in this plan (pre-existing unrelated TS errors elsewhere are expected per project convention — see header note).

- [ ] **Step 2: Push a `main` vía PR (no directo)**

Este trabajo vive en la rama `servicios-cotizacion-facturar` del worktree. Al terminar todos los tasks:
```bash
git push -u origin servicios-cotizacion-facturar
gh pr create --draft --title "fix(inv,fat): servicios sin existencia + cotizacion a factura" --body "Ver docs/superpowers/specs/2026-09-22-servicios-inventario-cotizacion-facturar-design.md"
```
El frontend en Netlify solo se construye desde `main` — este PR no dispara deploy hasta mergear. Para probar el frontend antes de mergear, ver `sigaft-legacy-testing`/`sigaft-deploy-vm` por si hay un preview de Netlify por PR; si no lo hay, el Task 14 (Playwright) debe correr después de mergear a `main` y esperar el deploy (marker en bundle, per memoria `reference_netlify_deploy_status_api`).

---

### Task 14: Verificación end-to-end con Playwright (skill `sigaft-legacy-testing`)

**Files:** ninguno — solo verificación, sin cambios de código.

- [ ] **Step 1: Login y ubicar una compañía/cliente/producto de prueba**

Usar el patrón de datos de prueba ya establecido en este proyecto (ver memorias — p.ej. cliente/producto con prefijo `ZZTEST` si existe uno, o crear un producto de prueba nuevo vía UI marcándolo claramente como prueba en la descripción).

- [ ] **Step 2: Entrada de Compras con línea de Servicio**

En INV, registrar una Entrada de Compras con un producto marcado `Servicio` (crear uno de prueba si no hay). Confirmar en Catálogo de Productos / Movimientos que el documento se creó pero la existencia del servicio no cambió (o sigue en 0/sin fila).

- [ ] **Step 3: Crear cotización de prueba**

En FAT, crear una cotización (CT) con: 1 línea de producto real existente + 1 línea manual (código `X`) con marca/descripción libre inventada para la prueba.

- [ ] **Step 4: Facturar desde Consulta de Documentos**

Ir a Consulta de Documentos (conduces), abrir esa cotización, click "Facturar". Confirmar que navega a Nueva Factura con cliente y ambas líneas cargadas.

- [ ] **Step 5: Resolver el side sheet**

Confirmar que se abre automáticamente "Estos artículos no existen en el inventario" con la línea manual. Resolverla como "Servicio". Confirmar que el `CrearProductoModal` abre con la descripción prellenada y el tipo Servicio ya seleccionado, y que el almacén de la factura aparece pre-marcado. Crear el producto.

- [ ] **Step 6: Guardar la factura**

Confirmar que la línea recién resuelta ya no dice `X` sino el código real, y que Guardar no bloquea por "Existencia insuficiente" pese a que el servicio recién creado tiene existencia 0.

- [ ] **Step 7: Confirmar el enlace factura↔cotización**

Volver a Consulta de Documentos, abrir la misma cotización, confirmar que "Factura vinculada" ahora muestra el tipo/número correcto (ya no `—`), y que los botones Facturar/Editar/Anular ya no aparecen (porque `no_factura` quedó seteado).

- [ ] **Step 8: Cleanup — anular la cotización de prueba**

Dado que la cotización de prueba del Paso 3 ya quedó facturada (no se puede anular directamente — bloqueado por diseño), anular en cambio la FACTURA de prueba generada en el Paso 6 desde Facturas (`fatAnularFactura`, ya existente). Documentar en el reporte final que este cleanup se ejecutó y su resultado.

- [ ] **Step 9: Reporte final**

Resumir: qué se probó, qué pasó en cada paso (con capturas si el MCP de Playwright las genera), y confirmación explícita de que el cleanup del Paso 8 se completó. Si algún paso falla, NO ajustar el dato de prueba para esquivarlo (ver memoria `feedback_no_ajustar_test_para_que_pase`) — reportar el fallo real y volver a un task anterior a corregir el código.

---

## Self-Review Notes

- **Spec coverage:** A→Task 1, B→Task 2, C→Tasks 3/9/10/11, D→Tasks 7/8/9, E→Tasks 4/11/12, F→Task 14. All spec sections have a task.
- **Placeholder scan:** No TBD/TODO left. Task 12 Step 1 and Task 5 Step 1 intentionally ask the executor to confirm exact remote paths / existing state before writing code, because the plan's research pass did not read `fat-nuevo-conduce.tsx`'s edit-load `useEffect` in full — that's a real gap in this plan's research, not a placeholder for effort; flagged explicitly so the executor knows to look before leaping rather than guessing.
- **Type consistency:** `CrearProductoModalResult` (no_produ, descri, costo, porciento_impuesto, precio?, unidad_empaque?, referencia_empaque?) is the type flowing from Task 7/8 into Task 9's `resolverLineaFaltante` — matches. `fatAnularConduce` request/response shape in Task 6 matches what Task 11/12 call it with.
