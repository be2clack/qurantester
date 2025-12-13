import { AppSidebar } from '@/components/app-sidebar'
import { Header } from '@/components/layouts/header'
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
      <AppSidebar
        role={UserRole.USTAZ}
        user={{
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone
        }}
      />
      <SidebarInset>
        <Header title="Панель устаза" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
