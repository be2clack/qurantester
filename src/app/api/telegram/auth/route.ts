import { NextRequest, NextResponse } from 'next/server'
import {
  parseTelegramUser,
  findUserByTelegramId,
  canParseInitData,
} from '@/lib/telegram-auth'
import { generateAuthToken, setAuthCookie, getDashboardPath } from '@/lib/auth'

/**
 * POST /api/telegram/auth
 *
 * Authenticate user from Telegram Web App
 * Security: User must exist in database (registered via Telegram bot)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { initData, telegramId } = body

    console.log('[Telegram Auth] Request received:', {
      hasInitData: !!initData,
      hasTelegramId: !!telegramId,
    })

    let userId: number | null = null
    let authMethod: string = 'unknown'

    // Method 1: Parse user from initData
    if (initData && canParseInitData(initData)) {
      const telegramUser = parseTelegramUser(initData)
      if (telegramUser?.id) {
        userId = telegramUser.id
        authMethod = 'initData_parsed'
      }
    }

    // Method 2: Direct telegramId
    if (!userId && telegramId) {
      userId = parseInt(telegramId)
      authMethod = 'telegramId_direct'
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication failed. Invalid or expired data.' },
        { status: 401 }
      )
    }

    // Find user in database
    const user = await findUserByTelegramId(userId)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. Please use the Telegram bot first.' },
        { status: 404 }
      )
    }

    console.log('[Telegram Auth] User authenticated:', {
      userId: user.id,
      role: user.role,
      method: authMethod,
    })

    // Generate auth token
    const token = await generateAuthToken(user.id)

    // Set auth cookie
    await setAuthCookie(token)

    // Return success with redirect URL
    const redirectUrl = getDashboardPath(user.role)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      redirectUrl,
      token, // Include token for cookie setting on client if needed
    })

  } catch (error: any) {
    console.error('[Telegram Auth] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/telegram/auth
 *
 * Handle direct authentication via URL parameter (for testing or fallback)
 */
export async function GET(req: NextRequest) {
  const telegramId = req.nextUrl.searchParams.get('telegramId')

  if (!telegramId) {
    return NextResponse.json(
      { error: 'telegramId parameter required' },
      { status: 400 }
    )
  }

  // Find user
  const user = await findUserByTelegramId(parseInt(telegramId))

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    )
  }

  // Generate token and set cookie
  const token = await generateAuthToken(user.id)
  await setAuthCookie(token)

  // Redirect to dashboard
  const redirectUrl = getDashboardPath(user.role)
  return NextResponse.redirect(new URL(redirectUrl, req.nextUrl.origin))
}
