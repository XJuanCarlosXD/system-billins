import type { ReactNode } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

// Panel lateral (sidebar deslizante) para el detalle de UN documento en las
// pantallas de Consulta de Documentos. Nace en CxP (frontend/src/features/cxp/documentos.tsx)
// y se extrae aquí para que INV/CxC/ODC/FAT usen el mismo shell en vez de
// cada quien su propio Dialog/modal centrado.
//
// SheetContent trae 'sm:max-w-sm' (384px) de base -- un max-w-[Xvw] sin el
// prefijo sm: nunca lo vence (mismo gotcha que otros modales del proyecto,
// ver memoria cxp-reversar-responsive). h-full (no max-h-[Xvh]) para que
// ocupe el alto completo del viewport igual que un panel lateral real, en
// vez de flotar con un hueco abajo; header fijo + body con su propio scroll.
export function DocumentoDetalleSheet({
  open, onOpenChange, title, loading, children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  loading?: boolean
  children?: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[40vw] h-full flex flex-col gap-0 p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        {loading && (
          <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
        )}
        {!loading && (
          <div className="flex-1 overflow-y-auto px-6 py-5 text-sm space-y-6">
            {children}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
