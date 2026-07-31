import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { logErrorAutomatico, reportarErrorConCaptura } from '@/lib/report-error'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  reportado: boolean
  reportando: boolean
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reportando: false, reportado: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logErrorAutomatico(error.message, { detalle: `${error.stack}\n\n${info.componentStack}` })
  }

  handleReportar = async () => {
    if (!this.state.error) return
    this.setState({ reportando: true })
    try {
      await reportarErrorConCaptura(this.state.error.message, this.state.error.stack)
      this.setState({ reportado: true })
    } finally {
      this.setState({ reportando: false })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center'>
        <AlertTriangle className='h-12 w-12 text-destructive' />
        <h1 className='text-xl font-semibold'>Algo salió mal</h1>
        <p className='max-w-md text-sm text-muted-foreground'>
          Ocurrió un error inesperado en la pantalla. Ya quedó registrado
          automáticamente; si quieres ayudarnos a resolverlo más rápido,
          puedes adjuntar una captura de lo que estabas viendo.
        </p>
        <div className='flex gap-2'>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className='mr-2 h-4 w-4' /> Recargar página
          </Button>
          <Button
            variant='outline'
            disabled={this.state.reportando || this.state.reportado}
            onClick={this.handleReportar}
          >
            {this.state.reportado ? 'Reportado ✓' : this.state.reportando ? 'Reportando…' : 'Reportar este error'}
          </Button>
        </div>
      </div>
    )
  }
}
