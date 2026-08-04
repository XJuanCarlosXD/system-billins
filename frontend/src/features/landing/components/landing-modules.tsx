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
