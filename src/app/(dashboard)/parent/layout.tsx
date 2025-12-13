import { Sidebar, parentNavItems } from '@/components/layouts/sidebar'
import { Header } from '@/components/layouts/header'
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
    <div className="flex h-screen">
      <Sidebar
        items={parentNavItems}
        title="QuranTester"
        subtitle="Родитель"
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} title="Успеваемость детей" />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
