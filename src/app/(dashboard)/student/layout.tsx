import { AppSidebar } from '@/components/app-sidebar'
import { Header } from '@/components/layouts/header'
import { StudentBottomNav } from '@/components/student-bottom-nav'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { redirect } from 'next/navigation'

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Allow admin and ustaz to view student pages too
  const allowedRoles: UserRole[] = [UserRole.STUDENT, UserRole.ADMIN, UserRole.USTAZ]
  if (!allowedRoles.includes(user.role)) {
    redirect('/parent')
  }

  return (
    <SidebarProvider>
      {/* Sidebar hidden on mobile, visible on md+ */}
      <div className="hidden md:block">
        <AppSidebar
          role={UserRole.STUDENT}
          user={{
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone
          }}
        />
      </div>
      <SidebarInset className="md:peer-data-[state=collapsed]:ml-0">
        <Header title="Мой прогресс" />
        <main className="flex-1 overflow-auto p-3 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
        {/* Bottom navigation for mobile */}
        <StudentBottomNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
