import { cn } from '@/lib/utils'

type MainProps = React.HTMLAttributes<HTMLElement> & {
  fixed?: boolean
  /** @deprecated — el ancho ahora es siempre full por defecto. Acepta el prop para no romper consumidores existentes. */
  fluid?: boolean
  ref?: React.Ref<HTMLElement>
}

export function Main({ fixed, className, ...props }: MainProps) {
  return (
    <main
      data-layout={fixed ? 'fixed' : 'auto'}
      className={cn(
        // Antes habia un max-w-7xl en pantallas grandes que dejaba un
        // wasteland en monitores anchos (sobre todo /settings). Ahora todas
        // las vistas usan el ancho disponible del SidebarInset.
        'w-full px-4 py-6',
        fixed && 'flex grow flex-col overflow-hidden',
        className
      )}
      {...props}
    />
  )
}
