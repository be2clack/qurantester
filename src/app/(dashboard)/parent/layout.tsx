import { AppSidebar } from '@/components/app-sidebar'
import { Header } from '@/components/layouts/header'
import { TelegramFullscreen } from '@/components/telegram-fullscreen'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { redirect } from 'next/navigation'

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const allowedRoles: UserRole[] = [UserRole.PARENT, UserRole.ADMIN]
  if (!allowedRoles.includes(user.role)) {
    redirect('/student')
  }

  return (
    <SidebarProvider>
      <TelegramFullscreen />
      <AppSidebar
        role={UserRole.PARENT}
        user={{
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone
        }}
      />
      <SidebarInset style={{ paddingTop: 'var(--tg-safe-top)' }}>
        <Header title="Успеваемость детей" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
