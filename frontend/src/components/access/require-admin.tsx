import { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAccess } from '@/hooks/use-access'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route guard that redirects to /403 unless the user is admin
 * (DBA / Regal General). Used for system-wide screens (gestion de
 * usuarios, historial global) that have no per-module permission.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading } = useAccess()
  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    )
  }
  if (!isAdmin) return <Navigate to="/403" />
  return <>{children}</>
}
