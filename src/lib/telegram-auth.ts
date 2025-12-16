import crypto from 'crypto'
import { prisma } from './prisma'

/**
 * Validate Telegram WebApp initData
 *
 * Telegram signs initData with HMAC-SHA256:
 * 1. Take all params except hash
 * 2. Sort by key
 * 3. Form string "key1=value1\nkey2=value2"
 * 4. Create secret: HMAC-SHA256("WebAppData", botToken)
 * 5. Calculate hash: HMAC-SHA256(secretKey, dataCheckString)
 * 6. Compare with provided hash
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string
): boolean {
  try {
    const urlParams = new URLSearchParams(initData)
    const hash = urlParams.get('hash')

    if (!hash) {
      console.error('[Telegram Auth] Hash not found in initData')
      return false
    }

    urlParams.delete('hash')

    // Sort params and form data-check-string
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    // Create secret key
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest()

    // Calculate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    const isValid = calculatedHash === hash

    if (!isValid) {
      console.error('[Telegram Auth] Hash mismatch')
    }

    return isValid
  } catch (error) {
    console.error('[Telegram Auth] Error validating initData:', error)
    return false
  }
}

/**
 * Parse Telegram user from initData
 */
export interface TelegramUser {
  id: number
  firstName: string
  lastName?: string
  username?: string
  languageCode?: string
}

export function parseTelegramUser(initData: string): TelegramUser | null {
  try {
    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')

    if (!userStr) {
      console.error('[Telegram Auth] User param not found')
      return null
    }

    const user = JSON.parse(userStr)

    return {
      id: user.id,
      firstName: user.first_name || '',
      lastName: user.last_name,
      username: user.username,
      languageCode: user.language_code,
    }
  } catch (error) {
    console.error('[Telegram Auth] Error parsing user:', error)
    return null
  }
}

/**
 * Find user in database by Telegram ID
 */
export async function findUserByTelegramId(telegramId: bigint | number) {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        telegramId: true,
        telegramUsername: true,
      }
    })

    return user
  } catch (error) {
    console.error('[Telegram Auth] Error finding user:', error)
    return null
  }
}

/**
 * Get bot token from environment
 */
export function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null
}
