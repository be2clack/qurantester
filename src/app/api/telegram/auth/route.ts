import { NextRequest, NextResponse } from 'next/server'
import {
  validateTelegramInitData,
  parseTelegramUser,
  findUserByTelegramId,
  getBotToken,
  canParseInitData,
} from '@/lib/telegram-auth'
import { generateAuthToken, setAuthCookie, getDashboardPath } from '@/lib/auth'

// Allow fallback auth (less secure, for development)
const ALLOW_FALLBACK_AUTH = process.env.NODE_ENV !== 'production' || process.env.ALLOW_TELEGRAM_FALLBACK === 'true'

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

    console.log('[Telegram Auth] Request received:', {
      hasInitData: !!initData,
      hasTelegramId: !!telegramId,
      initDataLength: initData?.length,
    })

    // Get bot token
    const botToken = getBotToken()
    if (!botToken) {
      console.error('[Telegram Auth] Bot token not configured')
      return NextResponse.json(
        { error: 'Bot token not configured' },
        { status: 500 }
      )
    }

    let userId: number | null = null
    let authMethod: string = 'unknown'

    // Method 1: Validate initData (preferred, secure)
    if (initData) {
      const validation = validateTelegramInitData(initData, botToken)

      if (validation.valid) {
        authMethod = 'initData_validated'
        const telegramUser = parseTelegramUser(initData)
        if (telegramUser?.id) {
          userId = telegramUser.id
        }
      } else {
        console.warn('[Telegram Auth] Validation failed:', validation.reason)

        // Fallback: Try to parse user anyway (less secure)
        if (ALLOW_FALLBACK_AUTH && canParseInitData(initData)) {
          authMethod = 'initData_fallback'
          const telegramUser = parseTelegramUser(initData)
          if (telegramUser?.id) {
            userId = telegramUser.id
            console.log('[Telegram Auth] Using fallback auth for user:', userId)
          }
        }
      }
    }

    // Method 2: Direct telegramId (fallback, less secure)
    if (!userId && telegramId && ALLOW_FALLBACK_AUTH) {
      authMethod = 'telegramId_direct'
      userId = parseInt(telegramId)
      console.log('[Telegram Auth] Using direct telegramId auth:', userId)
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
