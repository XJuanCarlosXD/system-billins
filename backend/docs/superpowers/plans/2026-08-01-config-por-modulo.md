# Config por Modulo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enlazar las 71 pantallas de configuración ya construidas y
enrutadas en 9 módulos, agregando un `navGroup` "Configuración" (o
completando el existente en `inv`) como primer grupo de cada módulo en
`sidebar-data.ts`.

**Architecture:** Edición pura de datos en un solo archivo
(`frontend/src/components/layout/data/sidebar-data.ts`). Cada tarea inserta
un objeto `navGroup` nuevo justo después de `navGroups: [` del módulo
correspondiente (antes de su primer grupo actual), o en el caso de `inv`,
agrega items al `navGroup` `Configuración` que ya existe. Sin componentes
nuevos, sin rutas nuevas, sin cambios de backend.

**Tech Stack:** TypeScript, datos estáticos (no requiere build backend).

**Spec de referencia:** `docs/superpowers/specs/2026-08-01-config-por-modulo-design.md`

**Nota sobre testing:** usar `npx tsc --noEmit -p tsconfig.app.json` (NO
`tsconfig.json`, que no compila nada — lección de la sesión anterior) y
verificar con Playwright real contra `https://abregonza.netlify.app`
(navegador chromium ya instalado, scripts `repro*.mjs` en `frontend/` de
sesiones anteriores como base).

**Antes de tocar la VM:** frontend real = Netlify vía `git push origin
main`. Diffear contra la VM antes de subir, mismo procedimiento que los
planes anteriores de esta sesión.

---

### Task 1: CNT — agregar grupo Configuración completo

**Files:**
- Modify: `frontend/src/components/layout/data/sidebar-data.ts`

- [ ] **Step 1: Insertar el grupo antes de `Procesos` del módulo `cnt`**

Ubicar (único en el archivo, es la apertura del módulo `cnt`):

```ts
    {
      code: 'cnt',
      title: 'Contabilidad',
      icon: Calculator,
      navGroups: [
        {
          title: 'Procesos',
```

Reemplazar por:

```ts
    {
      code: 'cnt',
      title: 'Contabilidad',
      icon: Calculator,
      navGroups: [
        {
          title: 'Configuración',
          items: [
            { title: 'Catálogo de Cuentas', url: '/cnt', search: { section: 'configuracion', view: 'catalogo' } },
            { title: 'Centros de Costo', url: '/cnt', search: { section: 'configuracion', view: 'centros' } },
            { title: 'Mantenimiento NCF', url: '/cnt', search: { section: 'configuracion', view: 'ncf' } },
            { title: 'Períodos y Cierres', url: '/cnt', search: { section: 'configuracion', view: 'periodos' } },
            { title: 'Compañías', url: '/cnt', search: { section: 'configuracion', view: 'companias' } },
            { title: 'Sucursales', url: '/cnt', search: { section: 'configuracion', view: 'sucursales' } },
            { title: 'Tipos de Cuenta', url: '/cnt', search: { section: 'configuracion', view: 'tipos-cuenta' } },
            { title: 'Asignar Cuenta a Sucursal', url: '/cnt', search: { section: 'configuracion', view: 'catalogo-sucursal' } },
            { title: 'Grupo Contable Sucursal', url: '/cnt', search: { section: 'configuracion', view: 'grupos-sucursal' } },
          ],
        },
        {
          title: 'Procesos',
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(cnt): enlazar 9 pantallas de configuracion sin usar"
```

---

### Task 2: INV — completar el grupo Configuración existente

**Files:**
- Modify: `frontend/src/components/layout/data/sidebar-data.ts`

- [ ] **Step 1: Agregar los 14 items faltantes**

Ubicar (único, es el grupo `Configuración` de `inv`, hoy con 1 solo item):

```ts
        {
          title: 'Configuración',
          items: [
            {
              title: 'Catálogo de Productos',
              url: '/inv',
              search: { section: 'configuracion', view: 'productos' },
            },
          ],
        },
```

Reemplazar por:

```ts
        {
          title: 'Configuración',
          items: [
            {
              title: 'Catálogo de Productos',
              url: '/inv',
              search: { section: 'configuracion', view: 'productos' },
            },
            { title: 'Compañías', url: '/inv', search: { section: 'configuracion', view: 'companias' } },
            { title: 'Puntos de Trabajo', url: '/inv', search: { section: 'configuracion', view: 'puntos-trabajo' } },
            { title: 'Almacenes', url: '/inv', search: { section: 'configuracion', view: 'almacenes' } },
            { title: 'Tipos de Documento', url: '/inv', search: { section: 'configuracion', view: 'tipos-documentos' } },
            { title: 'Grupo de Productos', url: '/inv', search: { section: 'configuracion', view: 'grupo-productos' } },
            { title: 'Línea de Productos', url: '/inv', search: { section: 'configuracion', view: 'linea-productos' } },
            { title: 'Sub Línea de Productos', url: '/inv', search: { section: 'configuracion', view: 'sublinea-productos' } },
            { title: 'Grupo Contable', url: '/inv', search: { section: 'configuracion', view: 'grupo-contable' } },
            { title: 'Unidades de Empaque', url: '/inv', search: { section: 'configuracion', view: 'unidades-empaque' } },
            { title: 'Referencia de Empaque', url: '/inv', search: { section: 'configuracion', view: 'referencia-empaque' } },
            { title: 'Asignar Prod. a Cía/Almacén', url: '/inv', search: { section: 'configuracion', view: 'asignar-prod-cia' } },
            { title: 'Modificar Costo', url: '/inv', search: { section: 'configuracion', view: 'modificar-costo' } },
            { title: 'Mínimo y Máximo', url: '/inv', search: { section: 'configuracion', view: 'minimo-maximo' } },
            { title: 'Estantes y Tramos', url: '/inv', search: { section: 'configuracion', view: 'estantes-tramos' } },
          ],
        },
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(inv): completar grupo Configuracion con 14 pantallas sin usar"
```

---

### Task 3: CXC — agregar grupo Configuración

**Files:**
- Modify: `frontend/src/components/layout/data/sidebar-data.ts`

- [ ] **Step 1: Insertar antes de `Clientes` del módulo `cxc`**

Ubicar:

```ts
    {
      code: 'cxc',
      title: 'Cuentas por Cobrar',
      icon: CreditCard,
      navGroups: [
        {
          title: 'Clientes',
```

Reemplazar por:

```ts
    {
      code: 'cxc',
      title: 'Cuentas por Cobrar',
      icon: CreditCard,
      navGroups: [
        {
          title: 'Configuración',
          items: [
            { title: 'Compañías', url: '/cxc/cias' },
            { title: 'Puntos', url: '/cxc/puntos' },
            { title: 'Tipos de Documento', url: '/cxc/tdocu' },
            { title: 'Tipos de Cliente', url: '/cxc/tcli' },
            { title: 'Supervisores', url: '/cxc/supervisores' },
            { title: 'Vendedores', url: '/cxc/vendedores' },
            { title: 'Rutas', url: '/cxc/rutas' },
            { title: 'Tipo Contable', url: '/cxc/tcontable' },
            { title: 'Ciudades', url: '/cxc/ciudades' },
            { title: 'Barrios', url: '/cxc/barrios' },
            { title: 'Zonas', url: '/cxc/zonas' },
            { title: 'Cadenas', url: '/cxc/cadenas' },
          ],
        },
        {
          title: 'Clientes',
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(cxc): enlazar 12 pantallas de configuracion sin usar"
```

---

### Task 4: FAT — agregar grupo Configuración

**Files:**
- Modify: `frontend/src/components/layout/data/sidebar-data.ts`

- [ ] **Step 1: Insertar antes de `Proceso` del módulo `fat`**

Ubicar:

```ts
    {
      code: 'fat',
      title: 'Facturacion',
      icon: Receipt,
      navGroups: [
        {
          title: 'Proceso',
```

Reemplazar por:

```ts
    {
      code: 'fat',
      title: 'Facturacion',
      icon: Receipt,
      navGroups: [
        {
          title: 'Configuración',
          items: [
            { title: 'Compañías', url: '/fat/companias' },
            { title: 'Puntos de Trabajo', url: '/fat/puntos' },
            { title: 'Tipos de Documento', url: '/fat/tdocu' },
            { title: 'Condiciones de Pago', url: '/fat/condiciones' },
            { title: 'Tipos de Pago', url: '/fat/tipos-pago' },
            { title: 'Listas de Precio', url: '/fat/listas-precio' },
            { title: 'Transportistas', url: '/fat/transportistas' },
            { title: 'Notas', url: '/fat/notas' },
          ],
        },
        {
          title: 'Proceso',
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(fat): enlazar 8 pantallas de configuracion sin usar"
```

---

### Task 5: CXP — agregar grupo Configuración

**Files:**
- Modify: `frontend/src/components/layout/data/sidebar-data.ts`

- [ ] **Step 1: Insertar antes de `Proveedores` del módulo `cxp`**

Ubicar:

```ts
    {
      code: 'cxp',
      title: 'Cuentas por Pagar',
      icon: Wallet,
      navGroups: [
        {
          title: 'Proveedores',
```

Reemplazar por:

```ts
    {
      code: 'cxp',
      title: 'Cuentas por Pagar',
      icon: Wallet,
      navGroups: [
        {
          title: 'Configuración',
          items: [
            { title: 'Compañías', url: '/cxp/cias' },
            { title: 'Puntos', url: '/cxp/puntos' },
            { title: 'Ciudades', url: '/cxp/ciudades' },
            { title: 'Barrios', url: '/cxp/barrios' },
            { title: 'Tipos de Documento', url: '/cxp/tdocu' },
            { title: 'Tipos de Proveedor', url: '/cxp/tproveedores' },
            { title: 'Usuarios', url: '/cxp/usuarios' },
          ],
        },
        {
          title: 'Proveedores',
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(cxp): enlazar 7 pantallas de configuracion sin usar"
```

---

### Task 6: ODC — agregar grupo Configuración

**Files:**
- Modify: `frontend/src/components/layout/data/sidebar-data.ts`

- [ ] **Step 1: Insertar antes de `Procesos` del módulo `odc`**

Ubicar:

```ts
    {
      code: 'odc',
      title: 'Ordenes de Compra',
      icon: ShoppingCart,
      navGroups: [
        {
          title: 'Procesos',
```

Reemplazar por:

```ts
    {
      code: 'odc',
      title: 'Ordenes de Compra',
      icon: ShoppingCart,
      navGroups: [
        {
          title: 'Configuración',
          items: [
            { title: 'Compañías', url: '/odc/cias' },
            { title: 'Puntos', url: '/odc/puntos' },
            { title: 'Usuarios', url: '/odc/usuarios' },
          ],
        },
        {
          title: 'Procesos',
```

Nota: `odc-config.tsx` queda excluido a propósito — sin ruta registrada,
decisión confirmada con el usuario de no tocarlo en este spec.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(odc): enlazar 3 pantallas de configuracion sin usar"
```

---

### Task 7: CHC — agregar grupo Configuración

**Files:**
- Modify: `frontend/src/components/layout/data/sidebar-data.ts`

- [ ] **Step 1: Insertar antes de `Procesos` del módulo `chc`**

Ubicar:

```ts
    {
      code: 'chc',
      title: 'Bancos / Cheques',
      icon: Banknote,
      navGroups: [
        {
          title: 'Procesos',
```

Reemplazar por:

```ts
    {
      code: 'chc',
      title: 'Bancos / Cheques',
      icon: Banknote,
      navGroups: [
        {
          title: 'Configuración',
          items: [
            { title: 'Bancos', url: '/chc/bancos' },
            { title: 'Compañías', url: '/chc/cias' },
            { title: 'Cuentas Bancarias', url: '/chc/cuentas' },
            { title: 'Puntos', url: '/chc/puntos' },
            { title: 'Tipos de Documento', url: '/chc/tipos-docu' },
          ],
        },
        {
          title: 'Procesos',
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(chc): enlazar 5 pantallas de configuracion sin usar"
```

---

### Task 8: ACC — agregar grupo Configuración

**Files:**
- Modify: `frontend/src/components/layout/data/sidebar-data.ts`

- [ ] **Step 1: Insertar antes de `Procesos` del módulo `acc`**

Ubicar:

```ts
    {
      code: 'acc',
      title: 'Caja Chica',
      icon: Coins,
      navGroups: [
        {
          title: 'Procesos',
```

Reemplazar por:

```ts
    {
      code: 'acc',
      title: 'Caja Chica',
      icon: Coins,
      navGroups: [
        {
          title: 'Configuración',
          items: [
            { title: 'Beneficiarios', url: '/acc/beneficiarios' },
            { title: 'Cajas', url: '/acc/cajas' },
            { title: 'Compañías', url: '/acc/cias' },
            { title: 'Puntos', url: '/acc/puntos' },
            { title: 'Tipos de Beneficiario', url: '/acc/tipos-bene' },
            { title: 'Tipos de Gasto', url: '/acc/tipos-gasto' },
          ],
        },
        {
          title: 'Procesos',
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(acc): enlazar 6 pantallas de configuracion sin usar"
```

---

### Task 9: SDN — agregar grupo Configuración

**Files:**
- Modify: `frontend/src/components/layout/data/sidebar-data.ts`

- [ ] **Step 1: Insertar antes de `Mantenimiento` del módulo `sdn`**

Ubicar:

```ts
    {
      code: 'sdn',
      title: 'Nomina',
      icon: UsersIcon,
      navGroups: [
        {
          title: 'Mantenimiento',
          items: [{ title: 'Empleados', url: '/sdn/empleados' }],
        },
```

Reemplazar por:

```ts
    {
      code: 'sdn',
      title: 'Nomina',
      icon: UsersIcon,
      navGroups: [
        {
          title: 'Configuración',
          items: [
            { title: 'AFP', url: '/sdn/afp' },
            { title: 'Áreas', url: '/sdn/areas' },
            { title: 'ARS', url: '/sdn/ars' },
            { title: 'Compañías', url: '/sdn/cias' },
            { title: 'Deducciones', url: '/sdn/deducciones' },
            { title: 'Definición de Nóminas', url: '/sdn/def-nominas' },
            { title: 'Departamentos', url: '/sdn/deptos' },
            { title: 'Gerencias', url: '/sdn/gerencias' },
            { title: 'Ingresos', url: '/sdn/ingresos' },
          ],
        },
        {
          title: 'Mantenimiento',
          items: [{ title: 'Empleados', url: '/sdn/empleados' }],
        },
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(sdn): enlazar 9 pantallas de configuracion sin usar"
```

---

### Task 10: ACF — agregar grupo Configuración

**Files:**
- Modify: `frontend/src/components/layout/data/sidebar-data.ts`

- [ ] **Step 1: Insertar antes de `Mantenimiento` del módulo `acf`**

Ubicar:

```ts
    {
      code: 'acf',
      title: 'Activos Fijos',
      icon: Archive,
      navGroups: [
        {
          title: 'Mantenimiento',
          items: [{ title: 'Activos Fijos', url: '/acf/activos' }],
        },
```

Reemplazar por:

```ts
    {
      code: 'acf',
      title: 'Activos Fijos',
      icon: Archive,
      navGroups: [
        {
          title: 'Configuración',
          items: [
            { title: 'Categorías', url: '/acf/categorias' },
            { title: 'Compañías', url: '/acf/cias' },
            { title: 'Departamentos', url: '/acf/departamentos' },
            { title: 'Grupos', url: '/acf/grupos' },
            { title: 'Marcas', url: '/acf/marcas' },
            { title: 'Puntos', url: '/acf/puntos' },
            { title: 'Responsables', url: '/acf/responsables' },
            { title: 'Subgrupos', url: '/acf/subgrupos' },
          ],
        },
        {
          title: 'Mantenimiento',
          items: [{ title: 'Activos Fijos', url: '/acf/activos' }],
        },
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/data/sidebar-data.ts
git commit -m "feat(acf): enlazar 8 pantallas de configuracion sin usar"
```

---

### Task 11: Verificar tipos y desplegar

**Files:** ninguno nuevo.

- [ ] **Step 1: Typecheck completo**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "sidebar-data"`
Expected: sin salida.

- [ ] **Step 2: Diffear contra la VM antes de subir**

```bash
pscp -batch -hostkey "SHA256:ds2PzCSg6+BrqLex5a74SVS681czz+P3+l6lKPuuztc" -pw "Temp1234!" \
  jcabreu@10.0.0.99:facturation-system/frontend/src/components/layout/data/sidebar-data.ts /tmp/vm_sidebar_check.ts
```

Comparar identificadores (mismo método que planes anteriores de esta
sesión: `comm -13` sobre listas de identificadores ordenadas) contra el
baseline pre-Task-1 para confirmar que no hay contenido exclusivo de la
VM que se pierda.

- [ ] **Step 3: Push**

```bash
git push origin main
```

- [ ] **Step 4: Esperar el nuevo build (hash de `index-*.js` cambia)**

```bash
curl -s https://abregonza.netlify.app/ | grep -oE 'src="/assets/index-[^"]+\.js"'
```

Repetir cada 15s hasta que cambie.

- [ ] **Step 5: Verificar con Playwright real — al menos 3 módulos representativos**

Adaptar `frontend/repro7.mjs` (ya usado en esta sesión: login + leer
`sidebar.innerText()`). Navegar dentro de `cnt`, `cxc` y `fat` (click en
el tile del módulo desde `/`, o navegar directo a
`/cnt?section=configuracion&view=catalogo`,
`/cxc/cias`, `/fat/companias`) y confirmar:
- El sidebar del módulo muestra un grupo "Configuración" con los items
  esperados (ej. para `cnt`: "Catálogo de Cuentas", "Centros de Costo",
  etc.).
- La navegación a cada URL no produce `pageerror` ni HTTP >=400 inesperado
  (mismo patrón de verificación que el resto de la sesión — no asumir,
  confirmar).
- El contenido de la pantalla carga (no una página en blanco) — leer
  `page.locator('body').innerText()` y confirmar que no está vacío / no
  dice "Oops! Something went wrong".

Si cualquier verificación falla, detenerse y no reportar como terminado.

---

## Auto-revisión del plan

- **Cobertura del spec:** los 9 módulos de §3 del spec tienen su tarea
  (Tasks 1-10, nota: son 10 tareas porque INV se separó de los demás por
  ser "completar" en vez de "insertar" — cubre igual los 9 módulos: cnt,
  inv, cxc, fat, cxp, odc, chc, acc, sdn, acf = 10 nombres, correcto son
  10 módulos con gaps, no 9 — el spec dice "9 módulos" contando mal,
  correcto es 10: cnt, inv, cxc, fat, cxp, odc, chc, acc, sdn, acf. `lic`
  es el único de los 11 sin gaps. Confirmado contra la auditoría original).
- **Consistencia con `command-menu.tsx`:** ya lee `sidebarData.modules[].navGroups`
  completo (arreglado en la sesión anterior), así que no requiere ninguna
  tarea adicional — las 71 pantallas entran automáticamente al buscador
  Ctrl+K.
- **Sin placeholders:** cada tarea tiene el bloque de código completo a
  insertar y el ancla exacta (única en el archivo, verificada contra el
  código fuente real leído en esta sesión) donde insertarlo.
