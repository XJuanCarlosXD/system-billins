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
