import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  children: ReactNode
  /** Cambia el resetKey para volver a montar el panel desde cero (limpia el error). */
  resetKey?: string | number
}

type State = { error: Error | null }

/**
 * Error boundary alrededor del render del panel activo en /settings.
 *
 * Sin esto, un error sincrono dentro de un panel (loop infinito, throw en
 * render, etc) tumbaba toda la pagina y aparecia el browser-tab freeze. Con
 * el boundary, el panel que truena queda contenido y el resto de la UI
 * (sidebar, header, otras categorias) sigue navegable.
 *
 * El boundary se resetea automaticamente cuando `resetKey` cambia, lo cual
 * nos permite reintentar al cambiar de pestana o presionar "Reintentar".
 */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('[settings panel] error capturado:', error)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className='flex flex-col items-center justify-center gap-3 py-12 text-center'>
          <AlertTriangle className='h-8 w-8 text-amber-500' />
          <div>
            <p className='font-semibold'>Este panel se cayó.</p>
            <p className='mt-1 text-sm text-muted-foreground'>
              {this.state.error.message || 'Error desconocido.'}
            </p>
          </div>
          <Button variant='outline' size='sm' onClick={this.reset}>
            <RotateCcw className='me-1.5 h-3.5 w-3.5' />
            Reintentar
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
