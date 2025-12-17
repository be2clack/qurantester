import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateAuthToken, setAuthCookie, getDashboardPath } from '@/lib/auth'
import { UserRole } from '@prisma/client'

/**
 * POST /api/auth/login
 * Web login for admins and ustaz
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, password } = body

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'Требуется телефон и пароль' },
        { status: 400 }
      )
    }

    // Normalize phone
    const normalizedPhone = phone.replace(/\D/g, '')

    // Find user
    const user = await prisma.user.findUnique({
      where: { phone: normalizedPhone }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Неверный телефон или пароль' },
        { status: 401 }
      )
    }

    // Only allow ADMIN and USTAZ roles for web login
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.USTAZ) {
      return NextResponse.json(
        { error: 'Веб-вход доступен только для администраторов и устазов' },
        { status: 403 }
      )
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Аккаунт деактивирован' },
        { status: 403 }
      )
    }

    // Check if user has password set
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'Пароль не установлен. Используйте команду /setpassword в Telegram боте' },
        { status: 403 }
      )
    }

    // Verify password
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: 'Неверный телефон или пароль' },
        { status: 401 }
      )
    }

    // Generate token and set cookie
    const token = await generateAuthToken(user.id)
    await setAuthCookie(token)

    console.log('[Web Login] User logged in:', {
      userId: user.id,
      role: user.role,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      redirectUrl: getDashboardPath(user.role),
    })
  } catch (error) {
    console.error('[Web Login] Error:', error)
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    )
  }
}
