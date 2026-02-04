import { AppSidebar } from '@/components/app-sidebar'
import { Header } from '@/components/layouts/header'
import { UstazBottomNav } from '@/components/ustaz-bottom-nav'
import { TelegramFullscreen } from '@/components/telegram-fullscreen'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { redirect } from 'next/navigation'

export default async function UstazLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== UserRole.USTAZ && user.role !== UserRole.ADMIN) {
    redirect('/student')
  }

  return (
    <SidebarProvider>
      <TelegramFullscreen />
      {/* Sidebar hidden on mobile, visible on md+ */}
      <div className="hidden md:block">
        <AppSidebar
          role={UserRole.USTAZ}
          user={{
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone
          }}
        />
      </div>
      <SidebarInset className="md:peer-data-[state=collapsed]:ml-0" style={{ paddingTop: 'var(--tg-safe-top)' }}>
        <Header title="Панель устаза" />
        <main className="flex-1 overflow-auto p-3 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
        {/* Bottom navigation for mobile */}
        <UstazBottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
