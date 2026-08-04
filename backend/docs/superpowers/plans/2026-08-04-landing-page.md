# Landing Page Pública Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una landing page pública en `/` (Framer Motion, light/dark, responsive mobile-first, botón a login, grid de los 11 módulos y una sección del Asistente IA/MCP), moviendo el dashboard actual de `/` a `/dashboard`.

**Architecture:** Feature nueva `frontend/src/features/landing/` compuesta por 6 sub-componentes de presentación (header, hero, benefits, modules, asistente, footer) más un archivo de datos estático `module-copy.ts`. Cero llamadas a API. El cambio de routing usa TanStack Router file-based routing: `routes/index.tsx` (público, nuevo) monta `Landing`; `routes/_authenticated/index.tsx` se renombra a `routes/_authenticated/dashboard.tsx`. Todos los sitios que hoy navegan a `to: '/'` asumiendo que ahí vive el dashboard se actualizan a `/dashboard`.

**Tech Stack:** React + TypeScript, TanStack Router (file-based, plugin `@tanstack/router-plugin/vite` regenera `routeTree.gen.ts`), Tailwind, shadcn/ui (`Card`, `Button`), `framer-motion` (ya en `package.json`), Vitest + `vitest-browser-react` + Playwright provider para tests.

**Spec:** `backend/docs/superpowers/specs/2026-08-04-landing-page-design.md`

---

## Task 1: Feature `Landing` (componentes + datos + test)

Construye toda la landing como componentes independientes, sin tocar
routing todavía. No requiere ningún cambio en el resto del repo — es
código nuevo, sin imports desde afuera.

**Files:**
- Create: `frontend/src/features/landing/module-copy.ts`
- Create: `frontend/src/features/landing/components/landing-header.tsx`
- Create: `frontend/src/features/landing/components/landing-hero.tsx`
- Create: `frontend/src/features/landing/components/landing-benefits.tsx`
- Create: `frontend/src/features/landing/components/landing-modules.tsx`
- Create: `frontend/src/features/landing/components/landing-asistente.tsx`
- Create: `frontend/src/features/landing/components/landing-footer.tsx`
- Create: `frontend/src/features/landing/index.tsx`
- Test: `frontend/src/features/landing/landing.test.tsx`

- [ ] **Step 1: Escribir el test (falla porque nada existe todavía)**

```tsx
// frontend/src/features/landing/landing.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { Landing } from './index'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({
      children,
      to,
      className,
      ...rest
    }: {
      children?: React.ReactNode
      to: string
      className?: string
    }) => (
      <a href={to} className={className} {...rest}>
        {children}
      </a>
    ),
  }
})

describe('Landing', () => {
  it('renders login CTAs pointing to /sign-in', async () => {
    const screen = await render(<Landing />)
    const loginLinks = screen.getByRole('link', { name: /iniciar sesión/i })
    await expect
      .element(loginLinks.first())
      .toHaveAttribute('href', '/sign-in')
  })

  it('renders all 11 business modules', async () => {
    const screen = await render(<Landing />)
    for (const title of [
      'Facturacion',
      'Cuentas por Cobrar',
      'Cuentas por Pagar',
      'Ordenes de Compra',
      'Licitaciones',
      'Inventario',
      'Bancos / Cheques',
      'Caja Chica',
      'Nomina',
      'Activos Fijos',
      'Contabilidad',
    ]) {
      await expect.element(screen.getByText(title)).toBeInTheDocument()
    }
  })

  it('renders AI assistant skill examples', async () => {
    const screen = await render(<Landing />)
    await expect.element(screen.getByText('Facturar')).toBeInTheDocument()
    await expect
      .element(screen.getByText('Consultar cuenta cliente'))
      .toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd frontend && npx vitest run src/features/landing/landing.test.tsx --browser.headless`
Expected: FAIL — no se puede resolver el módulo `./index` (no existe).

- [ ] **Step 3: Crear el archivo de datos `module-copy.ts`**

```ts
// frontend/src/features/landing/module-copy.ts
export const MODULE_DESCRIPTIONS: Record<string, string> = {
  fat: 'Facturas, cotizaciones, conduces, cuadre de caja y cierre mensual con NCF/e-CF.',
  cxc: 'Clientes, cobros, estados de cuenta, envejecimiento de cartera y comisiones por vendedor.',
  cxp: 'Proveedores, aplicación de pagos, retenciones y reportes 606.',
  odc: 'Órdenes y requisiciones a proveedores, integradas con Inventario y Cuentas por Pagar.',
  lic: 'Gestión de procesos de licitación y propuestas.',
  inv: 'Entradas, salidas, existencias por almacén y ajustes, multi-empresa.',
  chc: 'Conciliación bancaria, emisión y control de cheques.',
  acc: 'Reposiciones, asientos y cierre de caja chica con reportes.',
  sdn: 'Movimientos, vacaciones, cheques de pago e informes DGII.',
  acf: 'Compra, depreciación, retiro y cierre de activos fijos.',
  cnt: 'Asientos, mayor general y cierres contables consolidando todos los módulos.',
}

export type SkillExample = {
  name: string
  example: string
  description: string
}

export const SKILL_EXAMPLES: SkillExample[] = [
  {
    name: 'Facturar',
    example: 'Factura a {cliente}',
    description: 'Crear una factura de venta nueva en FAT (NCF B01-B15).',
  },
  {
    name: 'Cotizar',
    example: 'Cotizar para {cliente}',
    description:
      'Crear una cotización en FAT (sin NCF — no genera transacción contable).',
  },
  {
    name: 'Consultar cuenta cliente',
    example: '¿Cuánto debe {cliente}?',
    description:
      'Estado de cuenta de un cliente CXC con saldo, aging y movimientos.',
  },
  {
    name: 'Devolución de ventas',
    example: 'El cliente devolvió mercancía',
    description: 'Preparar una devolución de ventas (factura FT, FC o AF).',
  },
]
```

- [ ] **Step 4: Crear `landing-header.tsx`**

```tsx
// frontend/src/features/landing/components/landing-header.tsx
import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'

export function LandingHeader() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className='relative z-10 flex items-center justify-between px-4 py-4 sm:px-10'
    >
      <div className='flex items-center gap-2'>
        <img
          src='/images/zentory-logo.png'
          alt='ZentoryERP'
          className='h-8 w-8 shrink-0 rounded-lg object-contain'
        />
        <span className='hidden text-lg font-bold tracking-tight sm:inline'>
          ZentoryERP
        </span>
      </div>
      <div className='flex items-center gap-1.5 sm:gap-2'>
        <ThemeSwitch />
        <Button asChild size='sm'>
          <Link to='/sign-in'>Iniciar sesión</Link>
        </Button>
      </div>
    </motion.header>
  )
}
```

- [ ] **Step 5: Crear `landing-hero.tsx`**

```tsx
// frontend/src/features/landing/components/landing-hero.tsx
import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LandingHero() {
  return (
    <section className='relative z-10 flex flex-col items-center px-6 pt-16 pb-20 text-center sm:pt-24'>
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className='bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-5xl md:text-6xl dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400'
      >
        ZentoryERP — Gestión empresarial todo en uno
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className='mt-5 max-w-xl px-2 text-base text-muted-foreground sm:px-0 sm:text-lg'
      >
        Plataforma integral de facturación, inventario, contabilidad,
        cuentas y reportes — todo en un solo sistema.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.5, ease: 'backOut' }}
        className='mt-8'
      >
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          <Button asChild size='lg' className='gap-2 px-8 text-base'>
            <Link to='/sign-in'>
              <LogIn className='h-5 w-5' />
              Iniciar sesión
            </Link>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  )
}
```

- [ ] **Step 6: Crear `landing-benefits.tsx`**

```tsx
// frontend/src/features/landing/components/landing-benefits.tsx
import { motion } from 'framer-motion'
import { Bot, Building2, Layers, Palette, ShieldCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const BENEFITS = [
  { Icon: Layers, label: '11 módulos integrados' },
  {
    Icon: Bot,
    label: 'Asistente IA vía MCP en cada módulo',
    anchor: '#asistente',
  },
  { Icon: ShieldCheck, label: 'Cumplimiento NCF / e-CF DGII' },
  { Icon: Building2, label: 'Multi-empresa y multi-punto' },
  { Icon: Palette, label: 'Modo claro y oscuro' },
]

export function LandingBenefits() {
  return (
    <section className='relative z-10 px-6 pb-16 sm:px-10'>
      <div className='mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-5'>
        {BENEFITS.map((b, i) => {
          const Icon = b.Icon
          const content = (
            <Card className='h-full border-white/40 bg-background/70 backdrop-blur-sm dark:border-white/10'>
              <CardContent className='flex flex-col items-center gap-2 p-4 text-center'>
                <Icon className='h-6 w-6 text-blue-600 dark:text-blue-400' />
                <span className='text-xs font-medium sm:text-sm'>
                  {b.label}
                </span>
              </CardContent>
            </Card>
          )
          return (
            <motion.div
              key={b.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
            >
              {b.anchor ? <a href={b.anchor}>{content}</a> : content}
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 7: Crear `landing-modules.tsx`**

```tsx
// frontend/src/features/landing/components/landing-modules.tsx
import { motion } from 'framer-motion'
import { sidebarData } from '@/components/layout/data/sidebar-data'
import { Card, CardContent } from '@/components/ui/card'
import { MODULE_DESCRIPTIONS } from '../module-copy'

export function LandingModules() {
  return (
    <section className='relative z-10 px-6 pb-8 sm:px-10'>
      <div className='mx-auto max-w-5xl'>
        <h2 className='text-center text-2xl font-bold tracking-tight sm:text-3xl'>
          Todos los módulos, en un solo sistema
        </h2>
        <div className='mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {sidebarData.modules.map((m, i) => {
            const Icon = m.icon
            return (
              <motion.div
                key={m.code}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 3) * 0.08, duration: 0.4 }}
              >
                <Card className='h-full border-white/40 bg-background/70 backdrop-blur-sm dark:border-white/10'>
                  <CardContent className='flex items-start gap-3 p-5'>
                    <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white'>
                      <Icon className='h-5 w-5' />
                    </div>
                    <div>
                      <h3 className='font-semibold'>{m.title}</h3>
                      <p className='mt-1 text-sm text-muted-foreground'>
                        {MODULE_DESCRIPTIONS[m.code]}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
        <p className='mt-8 text-center text-xs text-muted-foreground'>
          Los 11 módulos son operables también desde el{' '}
          <a href='#asistente' className='underline underline-offset-2'>
            Asistente IA integrado ↓
          </a>
        </p>
      </div>
    </section>
  )
}
```

- [ ] **Step 8: Crear `landing-asistente.tsx`**

```tsx
// frontend/src/features/landing/components/landing-asistente.tsx
import { motion } from 'framer-motion'
import { Bot } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { SKILL_EXAMPLES } from '../module-copy'

export function LandingAsistente() {
  return (
    <section id='asistente' className='relative z-10 px-6 py-16 sm:px-10'>
      <div className='mx-auto max-w-5xl text-center'>
        <Bot className='mx-auto h-8 w-8 text-blue-600 dark:text-blue-400' />
        <h2 className='mt-3 text-2xl font-bold tracking-tight sm:text-3xl'>
          Un asistente que también trabaja por ti
        </h2>
        <p className='mx-auto mt-3 max-w-2xl text-muted-foreground'>
          Cada módulo se conecta a un asistente de IA vía MCP que puede
          facturar, cotizar, aplicar notas y consultar cuentas — con tu
          confirmación antes de cada acción.
        </p>
        <div className='mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {SKILL_EXAMPLES.map((skill, i) => (
            <motion.div
              key={skill.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              whileHover={{ scale: 1.02 }}
            >
              <Card className='h-full border-white/40 bg-background/70 text-left backdrop-blur-sm dark:border-white/10'>
                <CardContent className='p-4'>
                  <h3 className='font-semibold'>{skill.name}</h3>
                  <p className='mt-1 text-xs text-muted-foreground italic'>
                    "{skill.example}"
                  </p>
                  <p className='mt-2 text-sm text-muted-foreground'>
                    {skill.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        <p className='mt-6 text-xs text-muted-foreground'>
          + notas de crédito/débito CxC y onboarding de nueva empresa
        </p>
      </div>
    </section>
  )
}
```

- [ ] **Step 9: Crear `landing-footer.tsx`**

```tsx
// frontend/src/features/landing/components/landing-footer.tsx
export function LandingFooter() {
  return (
    <footer className='relative z-10 px-6 py-8 text-center text-xs text-muted-foreground sm:px-10'>
      © 2026 ZentoryERP
    </footer>
  )
}
```

- [ ] **Step 10: Crear `index.tsx` (compone todo + fondo animado)**

```tsx
// frontend/src/features/landing/index.tsx
import { motion } from 'framer-motion'
import { LandingAsistente } from './components/landing-asistente'
import { LandingBenefits } from './components/landing-benefits'
import { LandingFooter } from './components/landing-footer'
import { LandingHeader } from './components/landing-header'
import { LandingHero } from './components/landing-hero'
import { LandingModules } from './components/landing-modules'

export function Landing() {
  return (
    <div className='relative min-h-svh overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950/20 dark:to-indigo-950/30'>
      <div
        className='pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.08]'
        style={{
          backgroundImage:
            'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <motion.div
        className='pointer-events-none absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-blue-400/30 blur-3xl dark:bg-blue-500/20'
        animate={{ x: [0, 40, -20, 0], y: [0, 30, -10, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className='pointer-events-none absolute top-96 -right-32 h-[480px] w-[480px] rounded-full bg-indigo-400/30 blur-3xl dark:bg-indigo-500/20'
        animate={{ x: [0, -30, 20, 0], y: [0, -20, 30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />

      <LandingHeader />
      <LandingHero />
      <LandingBenefits />
      <LandingModules />
      <LandingAsistente />
      <LandingFooter />
    </div>
  )
}
```

- [ ] **Step 11: Correr el test y confirmar que pasa**

Run: `cd frontend && npx vitest run src/features/landing/landing.test.tsx --browser.headless`
Expected: PASS — 3 tests verdes.

- [ ] **Step 12: Lint**

Run: `cd frontend && npx eslint src/features/landing`
Expected: sin errores. Si hay warnings de imports no usados o formato, corregir antes de continuar.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/features/landing
git commit -m "feat(landing): construir feature Landing (hero, beneficios, modulos, asistente IA)"
```

---

## Task 2: Mover el dashboard a `/dashboard` y montar `Landing` en `/`

**Files:**
- Create: `frontend/src/routes/_authenticated/dashboard.tsx`
- Delete: `frontend/src/routes/_authenticated/index.tsx`
- Create: `frontend/src/routes/index.tsx`
- Modify: `frontend/src/routeTree.gen.ts` (regenerado, no a mano)

- [ ] **Step 1: Crear la ruta `/dashboard`**

```tsx
// frontend/src/routes/_authenticated/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '@/features/dashboard'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: Dashboard,
})
```

- [ ] **Step 2: Eliminar la ruta vieja**

```bash
rm frontend/src/routes/_authenticated/index.tsx
```

- [ ] **Step 3: Crear la ruta pública `/`**

```tsx
// frontend/src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Landing } from '@/features/landing'

export const Route = createFileRoute('/')({
  component: Landing,
})
```

- [ ] **Step 4: Regenerar `routeTree.gen.ts`**

El plugin `@tanstack/router-plugin/vite` regenera el árbol de rutas
cuando Vite arranca. `npm run build` corre `tsc -b` ANTES de `vite
build`, así que typecheckearía contra el árbol viejo. Por eso se corre
`vite build` directo primero:

Run: `cd frontend && npx vite build`
Expected: build exitoso. Confirmar que `src/routeTree.gen.ts` ya no
referencia `/_authenticated/` (index) y sí contiene `/_authenticated/dashboard`
y una ruta raíz `/` apuntando a `Landing`:

Run: `grep -c "dashboard" frontend/src/routeTree.gen.ts && grep -c "Landing" frontend/src/routeTree.gen.ts`
Expected: ambos > 0.

- [ ] **Step 5: Typecheck completo**

Run: `cd frontend && npx tsc -b`
Expected: sin errores (confirma que ningún otro archivo referencia
todavía el `RouteId` viejo `/_authenticated/`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/_authenticated/dashboard.tsx \
        frontend/src/routes/index.tsx \
        frontend/src/routeTree.gen.ts
git rm frontend/src/routes/_authenticated/index.tsx
git commit -m "feat(routing): mover dashboard a /dashboard y montar Landing en /"
```

---

## Task 3: Actualizar navegaciones que asumían dashboard en `/`

Los 8 sitios listados en la spec (sección 2.1) navegan a `to: '/'`
esperando llegar al dashboard. Ahora que `/` es la landing pública,
todos pasan a `/dashboard`.

**Files:**
- Modify: `frontend/src/features/auth/sign-in/components/user-auth-form.tsx:64`
- Modify: `frontend/src/features/auth/otp/components/otp-form.tsx:51`
- Modify: `frontend/src/routes/(auth)/sign-in.tsx`
- Modify: `frontend/src/components/layout/app-sidebar.tsx:130`
- Modify: `frontend/src/components/layout/app-title.tsx:24`
- Modify: `frontend/src/features/errors/forbidden.tsx`
- Modify: `frontend/src/features/errors/general-error.tsx`
- Modify: `frontend/src/features/errors/not-found-error.tsx`
- Modify: `frontend/src/features/errors/unauthorized-error.tsx`
- Modify: `frontend/src/routes/_authenticated/403.tsx`
- Modify: `frontend/src/features/auth/otp/components/otp-form.test.tsx:53`
- Modify: `frontend/src/features/auth/sign-in/components/user-auth-form.test.tsx:106`

- [ ] **Step 1: `user-auth-form.tsx` — default de redirect tras login**

En `frontend/src/features/auth/sign-in/components/user-auth-form.tsx:64`,
cambiar:

```ts
navigate({ to: redirectTo || '/', replace: true })
```

por:

```ts
navigate({ to: redirectTo || '/dashboard', replace: true })
```

- [ ] **Step 2: `otp-form.tsx` — navegación tras verificar OTP**

En `frontend/src/features/auth/otp/components/otp-form.tsx:51`, cambiar:

```ts
navigate({ to: '/' })
```

por:

```ts
navigate({ to: '/dashboard' })
```

- [ ] **Step 3: `sign-in.tsx` — default cuando ya hay sesión**

En `frontend/src/routes/(auth)/sign-in.tsx`, cambiar:

```ts
if (authed) {
  throw redirect({ to: (search.redirect as string) || '/' })
}
```

por:

```ts
if (authed) {
  throw redirect({ to: (search.redirect as string) || '/dashboard' })
}
```

- [ ] **Step 4: `app-sidebar.tsx` — logo del sidebar**

En `frontend/src/components/layout/app-sidebar.tsx:130`, dentro de
`ModuleHomeLink`, cambiar:

```tsx
<Link to='/' onClick={() => setOpenMobile(false)}>
```

por:

```tsx
<Link to='/dashboard' onClick={() => setOpenMobile(false)}>
```

- [ ] **Step 5: `app-title.tsx` — título del sidebar**

En `frontend/src/components/layout/app-title.tsx:24`, cambiar:

```tsx
<Link
  to='/'
  onClick={() => setOpenMobile(false)}
  className='grid flex-1 text-start text-sm leading-tight'
>
```

por:

```tsx
<Link
  to='/dashboard'
  onClick={() => setOpenMobile(false)}
  className='grid flex-1 text-start text-sm leading-tight'
>
```

- [ ] **Step 6: Los 4 componentes de error compartidos**

En cada uno de `frontend/src/features/errors/forbidden.tsx`,
`general-error.tsx`, `not-found-error.tsx`, `unauthorized-error.tsx`,
cambiar la línea:

```tsx
<Button onClick={() => navigate({ to: '/' })}>Back to Home</Button>
```

por:

```tsx
<Button onClick={() => navigate({ to: '/dashboard' })}>Back to Home</Button>
```

(Es la misma línea literal en los 4 archivos — aplicar el mismo cambio
en cada uno.)

- [ ] **Step 7: `_authenticated/403.tsx`**

En `frontend/src/routes/_authenticated/403.tsx`, cambiar:

```tsx
<Button onClick={() => nav({ to: '/' })}>Ir al inicio</Button>
```

por:

```tsx
<Button onClick={() => nav({ to: '/dashboard' })}>Ir al inicio</Button>
```

- [ ] **Step 8: Actualizar `otp-form.test.tsx`**

En `frontend/src/features/auth/otp/components/otp-form.test.tsx:53`,
cambiar:

```ts
expect(navigate).toHaveBeenCalledWith({ to: '/' })
```

por:

```ts
expect(navigate).toHaveBeenCalledWith({ to: '/dashboard' })
```

- [ ] **Step 9: Actualizar `user-auth-form.test.tsx`**

En
`frontend/src/features/auth/sign-in/components/user-auth-form.test.tsx:106`,
cambiar:

```ts
expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true })
```

por:

```ts
expect(navigate).toHaveBeenCalledWith({ to: '/dashboard', replace: true })
```

- [ ] **Step 10: Correr los tests afectados**

Run: `cd frontend && npx vitest run src/features/auth --browser.headless`
Expected: PASS — todos los tests de `otp-form` y `user-auth-form` en
verde con la nueva expectativa `/dashboard`.

- [ ] **Step 11: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: sin errores.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/features/auth/sign-in/components/user-auth-form.tsx \
        frontend/src/features/auth/sign-in/components/user-auth-form.test.tsx \
        frontend/src/features/auth/otp/components/otp-form.tsx \
        frontend/src/features/auth/otp/components/otp-form.test.tsx \
        "frontend/src/routes/(auth)/sign-in.tsx" \
        frontend/src/components/layout/app-sidebar.tsx \
        frontend/src/components/layout/app-title.tsx \
        frontend/src/features/errors/forbidden.tsx \
        frontend/src/features/errors/general-error.tsx \
        frontend/src/features/errors/not-found-error.tsx \
        frontend/src/features/errors/unauthorized-error.tsx \
        frontend/src/routes/_authenticated/403.tsx
git commit -m "fix(routing): apuntar navegaciones post-login/error a /dashboard"
```

---

## Task 4: Verificación final

Sin cambios de código — confirma que todo el frontend sigue sano de
punta a punta después de los 3 tasks anteriores.

- [ ] **Step 1: Suite completa de tests**

Run: `cd frontend && npm test`
Expected: PASS — 0 fallos.

- [ ] **Step 2: Lint completo**

Run: `cd frontend && npm run lint`
Expected: 0 errores.

- [ ] **Step 3: Build de producción**

Run: `cd frontend && npm run build`
Expected: build exitoso (`tsc -b && vite build` completa sin errores).

- [ ] **Step 4: Verificación manual en dev server**

Run: `cd frontend && npm run dev` (en background)

Abrir `http://localhost:5173/` en el navegador:
- Debe mostrar la landing (sin rebotar a `/sign-in`).
- Click en "Iniciar sesión" (header o hero) debe llevar a `/sign-in`.
- El toggle de tema (sol/luna) debe alternar light/dark correctamente.
- Verificar que el grid muestra las 11 tarjetas de módulos y la sección
  del Asistente IA con las 4 skills de ejemplo.
- Iniciar sesión con un usuario válido y confirmar que redirige a
  `/dashboard` (no a `/`) y que el dashboard carga normalmente.
- Con las DevTools en modo responsive (probar 375px iPhone SE/mini y
  390px iPhone 12/13), confirmar: sin scroll horizontal (los halos
  animados no se salen del viewport gracias a `overflow-hidden` en el
  contenedor raíz de `Landing`), header no se rompe (el texto
  "ZentoryERP" se oculta bajo `sm:` y solo queda logo + toggle de tema +
  botón "Iniciar sesión"), grids de beneficios/módulos/skills caen a 1-2
  columnas legibles, título del hero no se corta ni desborda.

Detener el dev server al terminar.

---

## Self-Review

**Cobertura de la spec:**
- §1 (reuso ThemeProvider/ThemeSwitch/framer-motion/estilo sign-in) →
  Task 1, todos los componentes.
- §2 (routing + 8 referencias a `/`) → Task 2 (routing) + Task 3 (las 8
  referencias, con archivo:línea exactos verificados contra el código
  actual).
- §3.1–3.6 (header, hero, beneficios, grid módulos, asistente IA,
  footer) → Task 1, un componente por sección.
- Tabla de descripciones de los 11 módulos y las 4 skills de ejemplo →
  `module-copy.ts`, contenido copiado literal de la spec.
- §4 (fuera de alcance: sin llamadas a API, sin tocar `apps/mcp` ni
  `apps/asistente`, sin embeber chat funcional) → ningún task toca
  backend ni hace fetch; `landing-asistente.tsx` es 100% estático.

**Placeholders:** ninguno — cada step tiene código completo, sin TODO
ni "similar a...".

**Consistencia de tipos:** `MODULE_DESCRIPTIONS` usa las mismas 11
claves (`fat, cxc, cxp, odc, lic, inv, chc, acc, sdn, acf, cnt`) que
`sidebarData.modules` en `sidebar-data.ts` — verificado por grep contra
el archivo real antes de escribir el plan. `SkillExample` se define y
consume solo dentro de `module-copy.ts` → `landing-asistente.tsx`, sin
otro sitio que necesite el tipo.
