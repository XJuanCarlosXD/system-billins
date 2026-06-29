import { Outlet, useLocation } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SkipToMain } from '@/components/skip-to-main'
import { AsistenteFloatingButton } from '@/features/asistente/floating-button'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const { searchStr } = useLocation()
  const bare = /(^|[?&])bare=1(&|$)/.test(searchStr ?? '')

  return (
    <SearchProvider>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          {bare && (
            <style>{`[data-bare="1"] > header { display: none !important; }`}</style>
          )}
          <SkipToMain />
          {!bare && <AppSidebar />}
          <SidebarInset
            data-bare={bare ? '1' : undefined}
            className={cn(
              '@container/content',
              'has-data-[layout=fixed]:h-svh',
              'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]',
              bare && 'm-0 h-svh w-full rounded-none shadow-none'
            )}
          >
            {children ?? <Outlet />}
          </SidebarInset>
          {!bare && <AsistenteFloatingButton />}
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
