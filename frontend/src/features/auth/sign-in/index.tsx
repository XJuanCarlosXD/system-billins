import { useSearch } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import {
  Receipt,
  Boxes,
  CreditCard,
  Wallet,
  BookOpen,
  Banknote,
  Coins,
  Building2,
  ShoppingCart,
  Users,
  Wrench,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { UserAuthForm } from './components/user-auth-form'

const MODULES = [
  { Icon: Receipt, label: 'Facturación', from: '#3b82f6', to: '#06b6d4' },
  { Icon: Boxes, label: 'Inventario', from: '#10b981', to: '#22c55e' },
  { Icon: CreditCard, label: 'Cuentas por Cobrar', from: '#f59e0b', to: '#f97316' },
  { Icon: Wallet, label: 'Cuentas por Pagar', from: '#ef4444', to: '#ec4899' },
  { Icon: BookOpen, label: 'Contabilidad', from: '#8b5cf6', to: '#6366f1' },
  { Icon: Banknote, label: 'Bancos / Cheques', from: '#14b8a6', to: '#06b6d4' },
  { Icon: Coins, label: 'Caja Chica', from: '#eab308', to: '#f59e0b' },
  { Icon: Building2, label: 'Activos Fijos', from: '#6366f1', to: '#8b5cf6' },
  { Icon: ShoppingCart, label: 'Órdenes de Compra', from: '#06b6d4', to: '#3b82f6' },
  { Icon: Users, label: 'Nómina', from: '#ec4899', to: '#f43f5e' },
  { Icon: Wrench, label: 'Mantenimiento', from: '#64748b', to: '#475569' },
]

// Posiciones random pre-calculadas (estables entre renders)
const POSITIONS = MODULES.map((_, i) => {
  const angle = (i / MODULES.length) * Math.PI * 2
  return {
    leftPct: 50 + Math.cos(angle) * (28 + (i % 3) * 8),
    topPct: 50 + Math.sin(angle) * (32 + (i % 2) * 6),
    delay: i * 0.18,
    duration: 8 + (i % 4) * 2,
  }
})

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <div className='relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 dark:from-slate-950 dark:via-blue-950/20 dark:to-indigo-950/30'>
      {/* Background grid sutil */}
      <div
        className='pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.08]'
        style={{
          backgroundImage:
            'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Halos de color que flotan */}
      <motion.div
        className='pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-blue-400/30 blur-3xl dark:bg-blue-500/20'
        animate={{ x: [0, 40, -20, 0], y: [0, 30, -10, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className='pointer-events-none absolute -right-32 -bottom-32 h-[480px] w-[480px] rounded-full bg-indigo-400/30 blur-3xl dark:bg-indigo-500/20'
        animate={{ x: [0, -30, 20, 0], y: [0, -20, 30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Iconos de modulos flotando */}
      <div className='pointer-events-none absolute inset-0 hidden sm:block'>
        {MODULES.map((m, i) => {
          const pos = POSITIONS[i]
          const Icon = m.Icon
          return (
            <motion.div
              key={m.label}
              className='absolute -translate-x-1/2 -translate-y-1/2'
              style={{ left: `${pos.leftPct}%`, top: `${pos.topPct}%` }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: [0, 0.6, 0.6, 0],
                scale: [0.6, 1, 1, 0.6],
                y: [0, -12, 0, 12, 0],
              }}
              transition={{
                duration: pos.duration,
                delay: pos.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <div
                className='flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg ring-1 ring-white/30 backdrop-blur-md dark:ring-white/10'
                style={{
                  background: `linear-gradient(135deg, ${m.from}, ${m.to})`,
                }}
                title={m.label}
              >
                <Icon className='h-5 w-5 text-white' />
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Card login centrado */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className='relative z-10 w-full max-w-md'
      >
        <Card className='border-white/40 bg-white/85 shadow-2xl shadow-blue-500/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80'>
          <CardContent className='space-y-6 p-8'>
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className='flex flex-col items-center text-center'
            >
              <motion.img
                src='/images/zentory-logo.png'
                alt='ZentoryERP'
                className='mb-3 h-16 w-16 rounded-2xl object-contain shadow-md ring-1 ring-black/5 dark:ring-white/10'
                initial={{ rotate: -8, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{
                  delay: 0.25,
                  duration: 0.7,
                  ease: 'backOut',
                }}
              />
              <h1 className='bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400'>
                ZentoryERP
              </h1>
              <p className='mt-1.5 max-w-xs text-sm text-muted-foreground'>
                Plataforma integral de facturación, inventario, contabilidad,
                cuentas y reportes — todo en un solo sistema.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <UserAuthForm redirectTo={redirect} />
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 0.65, duration: 0.4 }}
              className='text-center text-[11px] text-muted-foreground'
            >
              Usa tu usuario y contraseña corporativos. Si olvidaste tu clave,
              contacta al administrador.
            </motion.p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
