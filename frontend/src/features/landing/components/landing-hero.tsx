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
