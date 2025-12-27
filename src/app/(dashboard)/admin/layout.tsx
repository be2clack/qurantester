import { AppSidebar } from '@/components/app-sidebar'
import { AdminBottomNav } from '@/components/admin-bottom-nav'
import { Header } from '@/components/layouts/header'
import { TelegramFullscreen } from '@/components/telegram-fullscreen'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== UserRole.ADMIN) {
    redirect('/student')
  }

  return (
    <SidebarProvider>
      <TelegramFullscreen />
      {/* Sidebar hidden on mobile, visible on md+ */}
      <div className="hidden md:block">
        <AppSidebar
          role={UserRole.ADMIN}
          user={{
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone
          }}
        />
      </div>
      <SidebarInset className="md:peer-data-[state=collapsed]:ml-0">
        <Header title="Панель администратора" />
        <main className="flex-1 overflow-auto p-3 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
        {/* Bottom navigation for mobile */}
        <AdminBottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
