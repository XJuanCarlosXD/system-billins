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
