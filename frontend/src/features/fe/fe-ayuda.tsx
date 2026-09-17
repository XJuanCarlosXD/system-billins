// Tab de Ayuda de Facturación Electrónica -- mismo renderer markdown que
// usa el módulo de Manuales (frontend/src/features/man/man-manuales.tsx),
// pero con contenido embebido en el código (ver fe-ayuda-contenido.ts)
// en vez de una fila en MAN.TMANUAL (tabla legacy sin endpoint de
// creación, ver Task 7 del plan de este panel).
import { Card, CardContent } from '@/components/ui/card'
import { renderMarkdown } from '@/features/docs/md'
import { FE_AYUDA_MARKDOWN } from '@/features/fe/fe-ayuda-contenido'

export function FeAyuda() {
  return (
    <Card>
      <CardContent className='pt-6'>
        <article
          className='prose prose-sm dark:prose-invert max-w-none'
          dangerouslySetInnerHTML={{ __html: renderMarkdown(FE_AYUDA_MARKDOWN) }}
        />
      </CardContent>
    </Card>
  )
}
