import { NextResponse } from 'next/server'
import { clearAuthCookie, getCurrentUser, revokeAllUserTokens } from '@/lib/auth'

export async function POST() {
  try {
    const user = await getCurrentUser()

    if (user) {
      // Revoke all tokens for this user
      await revokeAllUserTokens(user.id)
    }

    // Clear auth cookie
    await clearAuthCookie()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    )
  }
}

export async function GET() {
  await clearAuthCookie()
  return NextResponse.redirect(new URL('/login'))
}
