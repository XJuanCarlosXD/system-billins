# Spec — Enlazar las pantallas de Configuración ya construidas en cada módulo

- Fecha: 2026-08-01
- Autor: JCABREU + Claude
- Estado: aprobado para implementación
- Alcance: `frontend/src/components/layout/data/sidebar-data.ts` únicamente.
  Cero componentes nuevos, cero rutas nuevas, cero cambios de backend —
  las 71 pantallas ya existen, ya tienen ruta registrada y ya funcionan;
  solo no hay ningún link del sidebar que apunte a ellas.

## 0. Motivación

Auditoría (agente Explore, 2026-08-01) encontró 71 pantallas construidas y
enrutadas en 9 de los 11 módulos, sin ningún item de `navGroups` que
apunte a ellas — invisibles tanto en el sidebar como en el buscador
Ctrl+K (que se alimenta de `sidebarData`). Son mayormente catálogos de
Compañías/Puntos/Tipos de Documento y catálogos propios de cada módulo
(Vendedores, Rutas, Ciudades en CxC; AFP/ARS/Departamentos en Nómina;
Categorías/Marcas en Activos Fijos; el "Configuración" completo de
Contabilidad, etc).

## 1. Qué ya existe (no se toca)

- Todas las 71 pantallas (componentes React) y sus rutas TanStack Router —
  ya construidas y funcionando, verificado por la auditoría leyendo cada
  archivo de ruta.
- El patrón `Configuración` como primer `navGroup` de un módulo — ya lo
  usan `inv` y `lic` en `sidebar-data.ts`. Este spec extiende el mismo
  patrón a los 9 módulos restantes, no inventa uno nuevo.
- `odc-config.tsx` — sin ruta registrada, confirmado código huérfano.
  Decisión del usuario: no se toca en este spec.
- El resto de `navGroups` de cada módulo (Procesos/Consultas/Reportes/
  Cierre/etc) — sin cambios, solo se agrega el grupo `Configuración`
  delante de ellos (o se completa, en el caso de `inv`).

## 2. Regla de inserción

Para cada módulo, el `navGroup` `Configuración` se inserta como **primer**
elemento del array `navGroups` de ese módulo (mismo lugar donde ya vive en
`inv` y `lic`), con un `item` por pantalla, `title` = nombre de la
pantalla, `url` = la ruta ya registrada (path-based o `search: {section,
view}` según el patrón que ya use ese módulo — `fat`/`cxc`/`cxp`/`odc`/
`chc`/`acc`/`sdn`/`acf` usan rutas por path; `inv`/`cnt` usan la ruta única
`/inv` o `/cnt` con `search`).

## 3. Pantallas a enlazar, por módulo

**CNT** — grupo `Configuración` nuevo, insertado antes de `Procesos`:
Catálogo de Cuentas (`view: 'catalogo'`), Centros de Costo (`'centros'`),
Mantenimiento NCF (`'ncf'`), Períodos y Cierres (`'periodos'`),
Compañías (`'companias'`), Sucursales (`'sucursales'`), Tipos de Cuenta
(`'tipos-cuenta'`), Asignar Cuenta a Sucursal (`'catalogo-sucursal'`),
Grupo Contable Sucursal (`'grupos-sucursal'`). Todas con
`url: '/cnt', search: { section: 'configuracion', view: '<view>' }`.

**INV** — el grupo `Configuración` ya existe con 1 item (Catálogo de
Productos); se completa agregando: Compañías (`'companias'`), Puntos de
Trabajo (`'puntos-trabajo'`), Almacenes (`'almacenes'`), Tipos de
Documento (`'tipos-documentos'`), Grupo de Productos (`'grupo-productos'`),
Línea de Productos (`'linea-productos'`), Sub Línea de Productos
(`'sublinea-productos'`), Grupo Contable (`'grupo-contable'`), Unidades de
Empaque (`'unidades-empaque'`), Referencia de Empaque
(`'referencia-empaque'`), Asignar Prod. a Cía/Almacén
(`'asignar-prod-cia'`), Modificar Costo (`'modificar-costo'`), Mínimo y
Máximo (`'minimo-maximo'`), Estantes y Tramos (`'estantes-tramos'`). Todas
con `url: '/inv', search: { section: 'configuracion', view: '<view>' }`.

**CXC** — grupo nuevo antes de `Clientes`: Compañías (`/cxc/cias`), Puntos
(`/cxc/puntos`), Tipos de Documento (`/cxc/tdocu`), Tipos de Cliente
(`/cxc/tcli`), Supervisores (`/cxc/supervisores`), Vendedores
(`/cxc/vendedores`), Rutas (`/cxc/rutas`), Tipo Contable
(`/cxc/tcontable`), Ciudades (`/cxc/ciudades`), Barrios (`/cxc/barrios`),
Zonas (`/cxc/zonas`), Cadenas (`/cxc/cadenas`).

**FAT** — grupo nuevo antes de `Proceso`: Compañías (`/fat/companias`),
Puntos de Trabajo (`/fat/puntos`), Tipos de Documento (`/fat/tdocu`),
Condiciones de Pago (`/fat/condiciones`), Tipos de Pago
(`/fat/tipos-pago`), Listas de Precio (`/fat/listas-precio`),
Transportistas (`/fat/transportistas`), Notas (`/fat/notas`).

**CXP** — grupo nuevo antes de `Proveedores`: Compañías (`/cxp/cias`),
Puntos (`/cxp/puntos`), Ciudades (`/cxp/ciudades`), Barrios
(`/cxp/barrios`), Tipos de Documento (`/cxp/tdocu`), Tipos de Proveedor
(`/cxp/tproveedores`), Usuarios (`/cxp/usuarios`).

**ODC** — grupo nuevo antes de `Procesos`: Compañías (`/odc/cias`), Puntos
(`/odc/puntos`), Usuarios (`/odc/usuarios`). (`odc-config.tsx` excluido a
propósito — sin ruta.)

**CHC** — grupo nuevo antes de `Procesos`: Bancos (`/chc/bancos`),
Compañías (`/chc/cias`), Cuentas Bancarias (`/chc/cuentas`), Puntos
(`/chc/puntos`), Tipos de Documento (`/chc/tipos-docu`).

**ACC** — grupo nuevo antes de `Procesos`: Beneficiarios
(`/acc/beneficiarios`), Cajas (`/acc/cajas`), Compañías (`/acc/cias`),
Puntos (`/acc/puntos`), Tipos de Beneficiario (`/acc/tipos-bene`), Tipos
de Gasto (`/acc/tipos-gasto`).

**SDN** — grupo nuevo antes de `Mantenimiento`: AFP (`/sdn/afp`), Áreas
(`/sdn/areas`), ARS (`/sdn/ars`), Compañías (`/sdn/cias`), Deducciones
(`/sdn/deducciones`), Definición de Nóminas (`/sdn/def-nominas`),
Departamentos (`/sdn/deptos`), Gerencias (`/sdn/gerencias`), Ingresos
(`/sdn/ingresos`).

**ACF** — grupo nuevo antes de `Mantenimiento`: Categorías
(`/acf/categorias`), Compañías (`/acf/cias`), Departamentos
(`/acf/departamentos`), Grupos (`/acf/grupos`), Marcas (`/acf/marcas`),
Puntos (`/acf/puntos`), Responsables (`/acf/responsables`), Subgrupos
(`/acf/subgrupos`).

**LIC** — sin cambios, ya completo.

## 4. Efecto en `command-menu.tsx`

Ninguno directo — `flattenModules()` (ya arreglado en la sesión anterior)
lee `sidebarData.modules[].navGroups` completo, así que las 71 pantallas
nuevas aparecen automáticamente en el buscador Ctrl+K en cuanto se agregan
a `sidebar-data.ts`, sin tocar `command-menu.tsx`.

## 5. Fuera de alcance

- `odc-config.tsx` — confirmado con el usuario, no se toca.
- Cualquier cambio a los componentes de pantalla en sí (ya funcionan).
- Cambiar el permiso/gate de acceso — estas pantallas heredan el mismo
  `hasModule(<code>)` que ya protege el resto del módulo, vía
  `filterNavItems`/`buildHomeNavGroups` (sin cambios en esa lógica).
- Reordenar o renombrar `navGroups` existentes de cada módulo — solo se
  inserta `Configuración` al principio, el resto queda igual.
