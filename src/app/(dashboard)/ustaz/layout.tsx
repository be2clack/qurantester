import { Sidebar, ustazNavItems } from '@/components/layouts/sidebar'
import { Header } from '@/components/layouts/header'
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
    <div className="flex h-screen">
      <Sidebar
        items={ustazNavItems}
        title="QuranTester"
        subtitle="Устаз"
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} title="Панель устаза" />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
