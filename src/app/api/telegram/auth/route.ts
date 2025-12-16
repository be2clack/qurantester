import { NextRequest, NextResponse } from 'next/server'
import {
  validateTelegramInitData,
  parseTelegramUser,
  findUserByTelegramId,
  getBotToken,
} from '@/lib/telegram-auth'
import { generateAuthToken, setAuthCookie, getDashboardPath } from '@/lib/auth'

/**
 * POST /api/telegram/auth
 *
 * Authenticate user from Telegram Web App
 * 1. Validate initData signature
 * 2. Find user by Telegram ID
 * 3. Generate auth token and set cookie
 * 4. Return redirect URL
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { initData, telegramId } = body

    // Get bot token
    const botToken = getBotToken()
    if (!botToken) {
      return NextResponse.json(
        { error: 'Bot token not configured' },
        { status: 500 }
      )
    }

    let userId: number | null = null

    // Method 1: Validate initData (preferred, secure)
    if (initData) {
      const isValid = validateTelegramInitData(initData, botToken)

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid initData signature' },
          { status: 401 }
        )
      }

      const telegramUser = parseTelegramUser(initData)
      if (!telegramUser?.id) {
        return NextResponse.json(
          { error: 'Failed to parse user data' },
          { status: 400 }
        )
      }

      userId = telegramUser.id
    }
    // Method 2: Direct telegramId (fallback, less secure)
    else if (telegramId) {
      userId = parseInt(telegramId)
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'initData or telegramId required' },
        { status: 400 }
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
