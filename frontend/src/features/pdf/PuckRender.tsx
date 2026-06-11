import { Render } from '@measured/puck'
import type { Data } from '@measured/puck'
import { puckConfig, PdfDataProvider, type PuckBlockProps } from './blocks'
import type { PrintPayload } from './types'

type Props = {
  template: Data<PuckBlockProps>
  data: PrintPayload | null
  pageSize?: 'A4' | 'LETTER' | 'POS80'
  pageOrientation?: 'P' | 'L'
}

export function PuckRender({ template, data, pageSize = 'A4', pageOrientation = 'P' }: Props) {
  const orientation = pageOrientation === 'L' ? 'landscape' : 'portrait'
  return (
    <PdfDataProvider value={data}>
      <div className={`pdf-page pdf-page--${pageSize} pdf-page--${orientation}`}>
        <Render config={puckConfig as any} data={template as any} />
      </div>
    </PdfDataProvider>
  )
}
