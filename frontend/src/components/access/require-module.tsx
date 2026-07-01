import { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAccess } from '@/hooks/use-access'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route guard that redirects to /403 when the user lacks access to `modulo`.
 * Admin users always pass through. While permissions load a skeleton is shown.
 */
export function RequireModule({ modulo, children }: { modulo: string; children: ReactNode }) {
  const { hasModule, isLoading } = useAccess()
  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    )
  }
  if (!hasModule(modulo)) return <Navigate to="/403" />
  return <>{children}</>
}
