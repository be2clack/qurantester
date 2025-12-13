import { Sidebar, studentNavItems } from '@/components/layouts/sidebar'
import { Header } from '@/components/layouts/header'
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
    <div className="flex h-screen">
      <Sidebar
        items={studentNavItems}
        title="QuranTester"
        subtitle="Студент"
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} title="Мой прогресс" />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
