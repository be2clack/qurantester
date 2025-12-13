import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { ROLE_DASHBOARD_PATH } from '@/lib/constants/roles'

interface AuthGuardProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export async function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to user's own dashboard
    const redirectPath = ROLE_DASHBOARD_PATH[user.role]
    redirect(redirectPath)
  }

  return <>{children}</>
}
