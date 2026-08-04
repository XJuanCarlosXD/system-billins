# Spec — Landing page pública en `/` con redirección a login

- Fecha: 2026-08-04
- Autor: JCABREU + Claude
- Estado: aprobado para implementación
- Alcance: `frontend/` únicamente (routing + nueva feature `landing`). No
  toca backend, no pega a ningún endpoint — contenido 100% estático.

## 0. Motivación

Hoy `/` está detrás del guard de `_authenticated`
(`frontend/src/routes/_authenticated/route.tsx`): cualquier visitante sin
sesión que entre a `/` rebota directo a `/sign-in`. No existe ninguna
página pública de presentación del producto. El usuario pidió una landing
con animaciones (Framer Motion, ya es dependencia del proyecto), soporte
light/dark (ya existe `ThemeProvider`/`ThemeSwitch`), un botón que lleve al
login, y una sección que explique los módulos del sistema.

## 1. Qué ya existe y se reutiliza tal cual

- `ThemeProvider` (`context/theme-provider.tsx`) — envuelve toda la app en
  `main.tsx`, la landing hereda light/dark sin trabajo extra.
- `ThemeSwitch` (`components/theme-switch.tsx`) — se usa tal cual en el
  header de la landing.
- `framer-motion` — ya en `package.json` (`^11.18.2`).
- Lenguaje visual de `features/auth/sign-in/index.tsx` (halos degradados
  animados, grid de fondo sutil al 4-8% opacidad, logo
  `/images/zentory-logo.png`, texto con gradiente
  `from-blue-600 via-indigo-600 to-violet-600`) — se reutiliza el mismo
  estilo para que la landing se sienta parte del mismo producto que el
  login, no una pieza aparte.
- Lista real de módulos, íconos e íconos de lucide-react —
  `components/layout/data/sidebar-data.ts` (`sidebarData.modules`), **no**
  la lista decorativa de `sign-in/index.tsx` (que tiene nombres
  ligeramente distintos porque es solo flavor visual, no la fuente de
  verdad).
- Asistente IA + MCP — **ya implementado**, no es aspiracional. Confirmado
  en el repo:
  - `backend/apps/mcp/` — servidor MCP HTTP con tools reales por módulo
    (`tools/fat.py`, `cxc.py`, `cxp.py`, `inv.py`, `cnt.py`, `chc.py`,
    `sdn.py`, `acf.py`, `acc.py`, `odc.py`, `man.py`, `print_.py`), que
    ejecutan acciones de verdad contra Oracle (crear factura, aplicar
    nota de crédito, consultar estado de cuenta, etc.), no solo texto.
  - `backend/apps/asistente/skills/` — 7 skills reales con `SKILL.md`:
    `facturar`, `cotizar`, `devolucion-ventas`, `nota-credito-cxc`,
    `nota-debito-cxc`, `consultar-cuenta-cliente`,
    `nueva-empresa-onboarding`. Cada una define `when_to_use` (frases que
    la disparan), `modules_required` y `tools_used`.
  - En la app, el asistente es el botón flotante
    (`frontend/src/features/asistente/floating-button.tsx`) disponible
    dentro de `_authenticated`. La landing solo lo **describe** — no lo
    embebe (es una feature autenticada, no tiene sentido exponerla en
    una página pública sin sesión).

## 2. Cambio de routing (la parte estructural)

`/` deja de estar detrás de `_authenticated` y pasa a ser la landing
pública. El dashboard actual se mueve a `/dashboard`.

- Nuevo archivo `frontend/src/routes/index.tsx`:
  ```ts
  export const Route = createFileRoute('/')({ component: Landing })
  ```
- Renombrar `frontend/src/routes/_authenticated/index.tsx` →
  `frontend/src/routes/_authenticated/dashboard.tsx`, cambiando
  `createFileRoute('/_authenticated/')` →
  `createFileRoute('/_authenticated/dashboard')`. El componente
  (`Dashboard`) no cambia.
- `frontend/src/routes/_authenticated/route.tsx` no cambia — el guard
  sigue protegiendo todo lo que cuelga de `_authenticated`, solo que ya
  no incluye la raíz.

### 2.1 Sitios que hoy navegan a `to: '/'` asumiendo que ahí está el
dashboard — pasan a `/dashboard`:

| Archivo | Qué hace hoy | Cambio |
|---|---|---|
| `features/auth/sign-in/components/user-auth-form.tsx:64` | `navigate({ to: redirectTo \|\| '/', replace: true })` tras login exitoso | default pasa a `/dashboard` |
| `features/auth/otp/components/otp-form.tsx:51` | `navigate({ to: '/' })` tras verificar OTP | `/dashboard` |
| `routes/(auth)/sign-in.tsx` | `beforeLoad`: si ya hay sesión, `redirect({ to: search.redirect \|\| '/' })` | default pasa a `/dashboard` |
| `components/layout/app-sidebar.tsx:130` | `<Link to='/'>` (logo del sidebar autenticado) | `/dashboard` |
| `components/layout/app-title.tsx:24` | mismo patrón, título del sidebar | `/dashboard` |
| `features/errors/forbidden.tsx`, `general-error.tsx`, `not-found-error.tsx`, `unauthorized-error.tsx` | botón "Back to Home" → `navigate({ to: '/' })` | `/dashboard` |
| `routes/_authenticated/403.tsx` | botón "Ir al inicio" → `nav({ to: '/' })` | `/dashboard` |

Justificación de los 4 componentes de error compartidos: se usan tanto en
contexto público (`routes/(errors)/404.tsx`, `500.tsx`, `401.tsx`) como
autenticado (`routes/_authenticated/errors/$error.tsx`). Mandar su CTA a
`/dashboard` es seguro en ambos casos — si el usuario tiene sesión llega
al dashboard; si no la tiene, el guard de `_authenticated` lo rebota a
`/sign-in` con el `redirect` correspondiente, que es el comportamiento
útil cuando algo salió mal dentro de la app (distinto de aterrizar otra
vez en la landing de marketing).

Los tests que hardcodean `to: '/'` como expectativa
(`otp-form.test.tsx:53`, `user-auth-form.test.tsx:106`) se actualizan a
`to: '/dashboard'` junto con el código que prueban.

## 3. Nueva feature `frontend/src/features/landing/index.tsx`

Componente `Landing`, sin llamadas a API, contenido estático en español.
Estructura de arriba a abajo:

### 3.1 Header
Barra fija/sticky simple: logo `/images/zentory-logo.png` + "ZentoryERP",
`<ThemeSwitch />`, botón "Iniciar sesión" (`<Link to='/sign-in'>`) a la
derecha.

### 3.2 Hero
- Título con gradiente: "ZentoryERP — Gestión empresarial todo en uno".
- Subtítulo: una línea describiendo el sistema (facturación, inventario,
  contabilidad, cuentas y reportes en un solo lugar — mismo texto que ya
  usa `sign-in/index.tsx` para no inventar copy nuevo).
- Botón primario grande "Iniciar sesión" → `/sign-in`, con
  `motion.div`/`whileHover`/`whileTap` para micro-interacción.
- Fondo: halos degradados animados (mismo patrón que `sign-in/index.tsx`,
  `motion.div` con `animate={{x:[...], y:[...]}}` en loop infinito) + grid
  sutil de fondo. Entrada del bloque con `initial`/`animate`
  fade+slide-up, igual que la card de `sign-in`.

### 3.3 Beneficios
3-4 tiles con dato verificable (no cifras de marketing inventadas, es un
sistema interno):
- "11 módulos integrados"
- "Asistente IA vía MCP en cada módulo" (enlaza con scroll a la sección
  3.5)
- "Cumplimiento NCF / e-CF DGII"
- "Multi-empresa y multi-punto"
- "Modo claro y oscuro"

Animación stagger con `whileInView` (cada tile aparece con delay
incremental al entrar en el viewport, `viewport={{ once: true }}`).

### 3.4 Grid de módulos
Una tarjeta por cada entrada de `sidebarData.modules` (11 en total: FAT,
CXC, CXP, ODC, LIC, INV, CHC, ACC, SDN, ACF, CNT), reutilizando el mismo
`icon` que ya trae cada módulo en `sidebar-data.ts`. Cada tarjeta:
ícono + título (`module.title`) + una descripción de una línea (nueva,
no existe hoy — se escribe en este componente):

| code | title (sidebar-data.ts) | Descripción |
|---|---|---|
| fat | Facturacion | Facturas, cotizaciones, conduces, cuadre de caja y cierre mensual con NCF/e-CF. |
| cxc | Cuentas por Cobrar | Clientes, cobros, estados de cuenta, envejecimiento de cartera y comisiones por vendedor. |
| cxp | Cuentas por Pagar | Proveedores, aplicación de pagos, retenciones y reportes 606. |
| odc | Ordenes de Compra | Órdenes y requisiciones a proveedores, integradas con Inventario y Cuentas por Pagar. |
| lic | Licitaciones | Gestión de procesos de licitación y propuestas. |
| inv | Inventario | Entradas, salidas, existencias por almacén y ajustes, multi-empresa. |
| chc | Bancos / Cheques | Conciliación bancaria, emisión y control de cheques. |
| acc | Caja Chica | Reposiciones, asientos y cierre de caja chica con reportes. |
| sdn | Nomina | Movimientos, vacaciones, cheques de pago e informes DGII. |
| acf | Activos Fijos | Compra, depreciación, retiro y cierre de activos fijos. |
| cnt | Contabilidad | Asientos, mayor general y cierres contables consolidando todos los módulos. |

Grid responsive (1 columna en móvil, 2-3 en desktop), animación stagger
con `whileInView` igual que la sección de beneficios.

Línea de cierre debajo del grid, en texto pequeño: "Los 11 módulos son
operables también desde el Asistente IA integrado ↓" (ancla a 3.5).

### 3.5 Asistente IA + MCP

Sección con `id='asistente'` para el anchor del punto anterior. Explica,
sin tecnicismos de arquitectura (esto es para el usuario final, no un
doc técnico), que cada módulo tiene un asistente conversacional que
ejecuta acciones reales, no solo responde texto:

- Encabezado: "Un asistente que también trabaja por ti".
- Subtítulo: "Cada módulo se conecta a un asistente de IA vía MCP que
  puede facturar, cotizar, aplicar notas y consultar cuentas — con tu
  confirmación antes de cada acción."
- 4 tarjetas de ejemplo (subset representativo de las 7 skills reales en
  `backend/apps/asistente/skills/`, se eligen las más ilustrativas para
  no saturar la landing), cada una con: nombre de la skill, frase de
  ejemplo tomada de su `when_to_use`, y su `description` real:

  | Skill | Ejemplo de uso (`when_to_use`) | Qué hace (`description`) |
  |---|---|---|
  | Facturar | "Factura a {cliente}" | Crear una factura de venta nueva en FAT (NCF B01-B15). |
  | Cotizar | "Cotizar para {cliente}" | Crear una cotización en FAT (sin NCF — no genera transacción contable). |
  | Consultar cuenta cliente | "¿Cuánto debe {cliente}?" | Estado de cuenta de un cliente CXC con saldo, aging y movimientos. |
  | Devolución de ventas | "El cliente devolvió mercancía" | Preparar una devolución de ventas (factura FT, FC o AF). |

  Debajo del grid de 4, línea pequeña: "+ notas de crédito/débito CxC y
  onboarding de nueva empresa" (menciona sin tarjeta aparte las 2 skills
  restantes, para dejar claro que son 7 sin ocupar más espacio).
- Sin botón de acción propio — el asistente vive dentro de la app
  (`_authenticated`), así que el único CTA de esta sección sigue siendo
  "Iniciar sesión" (reutiliza el mismo botón del header/hero, no se
  duplica un tercero).
- Animación: mismo patrón `whileInView` + stagger que 3.3/3.4, tarjetas
  con `whileHover` sutil (scale 1.02) para señalar interactividad sin
  necesitar código funcional real (la landing no ejecuta ninguna skill).

### 3.6 Footer
Simple: "© 2026 ZentoryERP".

## 4. Fuera de alcance

- Cualquier cambio de backend o endpoint — la landing no hace requests.
- Copy de marketing extenso (testimonios, precios, contadores de
  usuarios/empresas reales) — se evita porque son cifras que no existen
  o no aplican a un sistema interno.
- Rediseñar `sign-in/index.tsx` — se reutiliza su lenguaje visual, no se
  toca el archivo.
- Internacionalización — la landing es en español, como el resto de la
  UI (sidebar, formularios).
- Cambiar el guard de `_authenticated` más allá de que ya no cubre `/`
  (sigue protegiendo `/dashboard` y todo lo demás igual que hoy).
- Embeber un chat funcional o cualquier llamada real al asistente/MCP en
  la landing — la sección 3.5 es descriptiva (texto + tarjetas
  estáticas), el asistente real solo vive dentro de `_authenticated`.
- Tocar `backend/apps/mcp/` o `backend/apps/asistente/` — la landing solo
  lee sus `SKILL.md` como referencia de copy al momento de escribir el
  componente, no los importa ni los consulta en runtime.
