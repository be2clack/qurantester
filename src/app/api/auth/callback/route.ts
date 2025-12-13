import { NextRequest, NextResponse } from 'next/server'
import { validateToken, setAuthCookie, getDashboardPath } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing_token', req.url))
  }

  const user = await validateToken(token)

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', req.url))
  }

  // Set auth cookie
  await setAuthCookie(token)

  // Redirect based on role
  const dashboardPath = getDashboardPath(user.role)

  return NextResponse.redirect(new URL(dashboardPath, req.url))
}
