import { AuthGuard } from '@/components/auth/auth-guard'
import { Sidebar, adminNavItems } from '@/components/layouts/sidebar'
import { Header } from '@/components/layouts/header'
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
    <div className="flex h-screen">
      <Sidebar
        items={adminNavItems}
        title="QuranTester"
        subtitle="Администратор"
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} title="Панель администратора" />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
