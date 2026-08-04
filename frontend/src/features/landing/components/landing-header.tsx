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
