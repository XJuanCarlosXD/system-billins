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
