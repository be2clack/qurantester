import crypto from 'crypto'
import { prisma } from './prisma'

// Max age for auth_date (24 hours in seconds)
const MAX_AUTH_AGE = 86400

/**
 * Validate Telegram WebApp initData
 *
 * Telegram signs initData with HMAC-SHA256:
 * 1. Take all params except hash
 * 2. Sort by key alphabetically
 * 3. Form string "key1=value1\nkey2=value2" (values URL-DECODED!)
 * 4. Create secret: HMAC-SHA256("WebAppData", botToken)
 * 5. Calculate hash: HMAC-SHA256(secretKey, dataCheckString)
 * 6. Compare with provided hash
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string
): { valid: boolean; reason?: string } {
  try {
    // Parse initData manually to control URL decoding
    // Format: key1=value1&key2=value2&hash=xxx
    const params: Record<string, string> = {}
    const pairs = initData.split('&')

    for (const pair of pairs) {
      const idx = pair.indexOf('=')
      if (idx > 0) {
        const key = pair.substring(0, idx)
        // URL-decode the value (Telegram expects decoded values in check string)
        const value = decodeURIComponent(pair.substring(idx + 1))
        params[key] = value
      }
    }

    const hash = params['hash']
    if (!hash) {
      return { valid: false, reason: 'Hash not found in initData' }
    }

    // Check auth_date is not too old
    const authDate = params['auth_date']
    if (authDate) {
      const authTimestamp = parseInt(authDate)
      const now = Math.floor(Date.now() / 1000)
      if (now - authTimestamp > MAX_AUTH_AGE) {
        return { valid: false, reason: 'Auth data is too old' }
      }
    }

    // Build data-check-string: sort keys, exclude hash, join with newlines
    const dataCheckString = Object.keys(params)
      .filter(key => key !== 'hash')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('\n')

    // Create secret key: HMAC-SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest()

    // Calculate hash: HMAC-SHA256(secretKey, dataCheckString)
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    const isValid = calculatedHash.toLowerCase() === hash.toLowerCase()

    if (!isValid) {
      console.error('[Telegram Auth] Hash mismatch:', {
        expected: hash.substring(0, 16) + '...',
        calculated: calculatedHash.substring(0, 16) + '...',
        dataCheckStringLength: dataCheckString.length,
        keysCount: Object.keys(params).length - 1,
      })
      return { valid: false, reason: 'Hash mismatch' }
    }

    return { valid: true }
  } catch (error) {
    console.error('[Telegram Auth] Error validating initData:', error)
    return { valid: false, reason: 'Validation error' }
  }
}

/**
 * Simple validation that just checks if we can parse user data
 * Use this as fallback when hash validation fails
 * (Less secure, but useful for development/debugging)
 */
export function canParseInitData(initData: string): boolean {
  try {
    const user = parseTelegramUser(initData)
    return user !== null && typeof user.id === 'number'
  } catch {
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
