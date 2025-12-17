import { prisma } from './prisma'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { cache } from 'react'
import type { User } from '@prisma/client'
import { ROLE_DASHBOARD_PATH } from './constants/roles'

const TOKEN_EXPIRY_HOURS = 24 * 7 // 7 days
const COOKIE_NAME = 'auth_token'

/**
 * Generate a secure auth token for web authentication
 */
export async function generateAuthToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

  // Delete any existing tokens for this user (optional: keep multiple sessions)
  await prisma.authToken.deleteMany({
    where: { userId }
  })

  await prisma.authToken.create({
    data: {
      token,
      userId,
      expiresAt,
    }
  })

  return token
}

/**
 * Validate a token and return the user if valid
 */
export async function validateToken(token: string): Promise<User | null> {
  const authToken = await prisma.authToken.findUnique({
    where: { token },
    include: { user: true }
  })

  if (!authToken) return null

  // Check if token is expired
  if (authToken.expiresAt < new Date()) {
    // Delete expired token
    await prisma.authToken.delete({ where: { token } })
    return null
  }

  // Check if user is active
  if (!authToken.user.isActive) {
    return null
  }

  return authToken.user
}

/**
 * Get current user from cookie (cached per request)
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    if (!token) return null

    return await validateToken(token)
  } catch {
    return null
  }
})

/**
 * Set auth cookie after successful login
 */
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies()

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_EXPIRY_HOURS * 60 * 60,
    path: '/',
  })
}

/**
 * Clear auth cookie on logout
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

/**
 * Generate web auth link for Telegram bot
 */
export async function generateWebAuthLink(userId: string): Promise<string> {
  const token = await generateAuthToken(userId)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/api/auth/callback?token=${token}`
}

/**
 * Get redirect path based on user role
 */
export function getDashboardPath(role: string): string {
  return ROLE_DASHBOARD_PATH[role as keyof typeof ROLE_DASHBOARD_PATH] || '/student'
}

/**
 * Delete expired tokens (cleanup job)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.authToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  })
  return result.count
}

/**
 * Revoke all tokens for a user (force logout everywhere)
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.authToken.deleteMany({
    where: { userId }
  })
}

/**
 * Check if user has required role
 */
export function hasRole(user: User | null, roles: string[]): boolean {
  if (!user) return false
  return roles.includes(user.role)
}

/**
 * Middleware helper to require authentication
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

/**
 * Middleware helper to require specific roles
 */
export async function requireRole(roles: string[]): Promise<User> {
  const user = await requireAuth()
  if (!hasRole(user, roles)) {
    throw new Error('Forbidden')
  }
  return user
}
