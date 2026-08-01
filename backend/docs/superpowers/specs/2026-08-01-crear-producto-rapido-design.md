# Spec — Crear producto rápido desde el buscador de productos (estilo Odoo)

- Fecha: 2026-08-01
- Autor: JCABREU + Claude
- Estado: aprobado para implementación
- Alcance: componente compartido `BuscarProductoModal` + buscador inline de
  `entrada-compras.tsx` / `entrada-mercancia.tsx`, con efecto colateral en
  Nueva Factura / Conduce / Cotización de FAT (comparten el mismo modal).

## 0. Motivación

Hoy, si en Entrada de Compras (`entrada-compras.tsx`, legado FINV202) el
operador busca un producto que todavía no existe en el catálogo, el flujo se
corta: tiene que abandonar el documento a medio llenar, ir a Catálogo de
Productos, completar un formulario largo (línea, sub-línea, grupo, grupo
contable, empaques, almacenes...), volver a Entrada de Compras y buscar de
nuevo. El pedido es llevar la lógica de "crear sobre la marcha" tipo Odoo:
buscas, no aparece, lo creas ahí mismo con lo mínimo indispensable, y sigues
donde estabas.

## 1. Qué ya existe (no se toca)

- Backend `POST /api/inv/productos/` → `inv_repo.create_producto`
  (`inv_views.py:137`, `inv_repo.py:217`). Ya acepta crear con 5 campos
  obligatorios: `descripcion` (≤40 chars), `linea`, `sub_linea`,
  `grupo_produ`, `grupo_contable`. `no_produ` es opcional — si no se manda,
  se autogenera con `_reserve_next_producto` en la misma transacción.
- `GET /api/inv/productos/next-codigo/` ya devuelve el preview del siguiente
  código (`inv_repo.peek_next_producto`).
- Catálogos ya expuestos y en uso por `catalogo-productos.tsx`:
  `GET /inv/lineas/`, `GET /inv/sublineas/?linea=`, `GET /inv/grupos/`,
  `GET /inv/grupos-contables/`.
- La asignación del producto nuevo al almacén de la compañía/punto actual ya
  no es un paso manual: las entradas de mercancía auto-asignan
  `TINV_EPRODUCTO` (commit `c336679`, 2026-07-10) — no hace falta pedir
  almacenes en el modal rápido.
- El formulario completo de creación/edición ya existe en
  `catalogo-productos.tsx` (estado `form` en línea ~109, `handleSave` en
  línea ~418). Sirve como referencia de validaciones, pero **no se reutiliza
  tal cual**: es una pantalla completa con tabs de empaques/almacenes que no
  cabe en un modal rápido, y ese es justamente el problema que este spec
  resuelve.

## 2. Componente nuevo: `crear-producto-modal.tsx`

Ubicación: `frontend/src/features/fat/components/crear-producto-modal.tsx`,
junto a `buscar-producto-modal.tsx` (mismo patrón de componente compartido
cross-módulo que ya usan `BuscarProductoModal` y
`MovimientosProductoModal`).

Props:

```ts
interface Props {
  open: boolean
  onClose: () => void
  onCreated: (producto: {
    no_produ: string
    descri: string
    costo: number
    porciento_impuesto: number
  }) => void
  noCia: string
  /** Prefill de descripción con el texto que el usuario ya había tecleado en el buscador. */
  descripcionInicial?: string
}
```

Comportamiento interno:

1. Al abrir: `GET /inv/productos/next-codigo/` para mostrar el código
   previsto en un input editable (mismo patrón `autoCodigo`/`codigo_auto`
   que ya usa `catalogo-productos.tsx`). Si el usuario no lo toca, se manda
   `codigo_auto: true` en el POST (permite que el backend reasigne si otro
   usuario tomó ese código en el ínterin).
2. Cuatro `Select` compactos: Línea, Sub-línea (filtrada por la línea
   elegida, igual que `sublineasFiltradas` en `catalogo-productos.tsx:555`),
   Grupo, Grupo Contable — poblados de los 4 endpoints del punto 1.
3. Defaults por usuario: al montar, lee
   `localStorage['inv.crearProductoDefaults.' + usuario + '.' + noCia]`
   (JSON `{linea, sub_linea, grupo_produ, grupo_contable}`) y preselecciona
   esos valores si siguen existiendo en las listas cargadas. Si no hay nada
   guardado (primer uso), los 4 selects quedan vacíos y el usuario elige.
4. Campo Descripción: prefil con `descripcionInicial`, editable, contador de
   caracteres visible (máx 40 — mismo límite que valida `create_producto`).
5. Costo referencial (numérico, opcional, default 0) + checkbox "Aplica
   ITBIS" (default marcado, muestra/oculta el input "% ITBIS", default 18).
   Este costo es metadata del producto (`costo_mercado_rd`), **no** el costo
   de la línea del documento que se está armando — ese sigue siendo
   editable aparte en la grilla, como hoy.
6. Botón "Crear y continuar":
   - POST a `/inv/productos/` con el payload armado.
   - Éxito (201): guarda en `localStorage` la clasificación usada (línea,
     sub-línea, grupo, grupo contable) como nuevo default, llama
     `onCreated({no_produ, descri, costo, porciento_impuesto})`, cierra el
     modal.
   - Error (400 — p. ej. "Ya existe un producto con código X" si alguien lo
     tomó entre el preview y el submit, o falta algún campo requerido):
     se muestra el mensaje del backend inline en el modal (no un toast que
     desaparece) y el modal queda abierto para corregir y reintentar.

## 3. Punto de entrada — `BuscarProductoModal`

Archivo `buscar-producto-modal.tsx`.

- Nuevo estado local `crearOpen`.
- En el bloque de "sin resultados" (línea 430-441, cuando
  `results.length === 0` y `debouncedSearch` no está vacío), se agrega
  debajo del mensaje existente un botón:

  `Crear producto "${debouncedSearch}" →`

  que abre `CrearProductoModal` con `descripcionInicial={debouncedSearch}`.
- `onCreated`: construye un objeto `BuscarProductoModalProducto` mínimo
  (`{ no_produ, descri, precio: costo, porciento_impuesto, unidad_empaque:
  'UND', existencia: 0 }`) y lo pasa a `handleSelect` (línea 248) — el mismo
  camino que seleccionar un producto ya existente. El caller
  (`entrada-compras.tsx`, `fat-nueva-factura.tsx`, etc.) no necesita saber
  si el producto es nuevo o preexistente.
- Nuevo prop opcional `permitirCrear?: boolean` (default `true`): deja la
  puerta abierta a que algún caller futuro lo desactive sin tener que volver
  a tocar la firma del componente. No se usa por ningún caller en esta
  primera entrega — el alcance acordado es que aparezca en todos lados.

## 4. Punto de entrada — buscador inline de la grilla

Archivos `entrada-compras.tsx` (líneas 639-658) y `entrada-mercancia.tsx`
(líneas 632-661): el dropdown de resultados inline bajo el input de código.

- Cuando `isSearching && !searching && searchResults.length === 0 &&
  searchTerm.trim()`, se agrega dentro del dropdown la misma fila-botón
  `Crear producto "${searchTerm}" →`.
- Abre `CrearProductoModal`; `onCreated` hace lo mismo que ya hace
  `selectProducto(idx, p)` hoy: setea `noProdu`/`nombre`/`costo` en la fila
  y llama `cargarEmpaques(idx, no_produ, costo)`.

## 5. FAT — Nueva Factura / Conduce / Cotización

Alcance confirmado con el usuario: "en todo lugar donde se usa
`BuscarProductoModal`". Estas pantallas heredan el botón "Crear producto"
automáticamente por el paso 3, sin cambios adicionales en sus propios
archivos — es la misma instancia del modal compartido.

Nota de negocio para tener presente en implementación (no bloquea el
alcance, solo se documenta): un producto creado desde una pantalla de venta
nace con existencia 0 y sin precio de lista — la factura en curso usará el
"costo referencial" que el operador haya puesto en el modal rápido como si
fuera el precio, lo cual probablemente no sea el precio de venta real. Es
equivalente a lo que ya pasa hoy si se edita el precio manualmente en una
línea, así que se acepta tal cual; si en el futuro molesta, se puede acotar
con el prop `permitirCrear=false` en esas tres pantallas sin tocar el resto
del diseño.

## 6. Detalle de negocio importante: Grupo Contable

`grupo_contable` no es una etiqueta cosmética: mapea a las cuentas contables
reales de inventario/ajuste/costo de venta (`inv_grupo_contable_detail`,
campos `inventario`, `ajuste_inventario`, `costo_venta_contado`). Elegir el
grupo contable equivocado en el modal rápido tiene impacto contable real —
es la misma cuenta que se debita al registrar la compra (ver memoria
`project_inv_cxp_espejo_root_cause_20260731`: la compra debita la cuenta de
Inventario del producto, no una cuenta genérica). Por eso el default de
`localStorage` es por usuario **y** compañía, no un default global fijo: dos
operadores que compran categorías distintas de producto no deben heredar la
clasificación contable del otro.

## 7. Validaciones cliente-side (antes de hacer POST)

- Descripción no vacía, ≤ 40 caracteres (se corta o se bloquea el submit).
- Línea, Sub-línea, Grupo, Grupo Contable seleccionados — los 4 son
  requeridos por el backend; si falta alguno, el POST devuelve 400 y el
  mensaje de `errData.error` se muestra tal cual (mismo patrón que
  `handleSave` en `entrada-compras.tsx:389-391` con `errData.detail ??
  errData.error`) — no hace falta duplicar el texto de validación en el
  frontend.
- Costo ≥ 0 si se ingresa.

## 8. Fuera de alcance

- Gestión de empaques (unidades de medida alternativas: FUNDA, CAJA, etc.)
  en el modal rápido. El producto nace con la unidad base (UND); si necesita
  otras, se completa después en Catálogo de Productos → Empaques. Es
  consistente con que hoy mismo `cargarEmpaques` ya maneja bien "producto
  sin empaques" (cae a UND por catch silencioso).
- Asignación manual de almacenes/compañías en el modal — ya no es necesaria
  (ver punto 1, auto-asignación en la entrada de mercancía).
- Flag de permiso nuevo — mismo control de acceso que ya protege la pantalla
  desde la que se abre el modal (decisión confirmada con el usuario).
- Tocar el formulario completo de `catalogo-productos.tsx` — sigue
  existiendo tal cual para edición completa/posterior del producto
  (empaques, imagen, proveedor preferido, etc.). El modal rápido es
  complementario, no lo reemplaza.
- Cambios de schema Oracle o al endpoint `create_producto` — todos los
  campos que usa el modal rápido ya son aceptados hoy por el backend.
