import type { BotContext } from '../bot'
import { prisma } from '@/lib/prisma'
import { generateAuthToken } from '@/lib/auth'
import { UserRole } from '@prisma/client'

/**
 * Handle /weblogin command
 * Generate a one-time login link for ADMIN and USTAZ roles
 */
export async function handleWebLogin(ctx: BotContext) {
  const telegramId = ctx.from?.id
  if (!telegramId) {
    await ctx.reply('Ошибка: не удалось определить пользователя')
    return
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) }
  })

  if (!user) {
    await ctx.reply(
      'Вы не зарегистрированы в системе.\n' +
      'Используйте /start для регистрации.'
    )
    return
  }

  // Only allow ADMIN and USTAZ
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.USTAZ) {
    await ctx.reply(
      'Эта команда доступна только для администраторов и устазов.\n' +
      'Студенты и родители используют кнопку «🌐 Веб» в меню.'
    )
    return
  }

  // Generate auth token
  const token = await generateAuthToken(user.id)
  const webUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qurantester.vercel.app'
  const loginLink = `${webUrl}/api/auth/callback?token=${token}`

  await ctx.reply(
    '🔐 <b>Ссылка для входа в веб-панель</b>\n\n' +
    `<a href="${loginLink}">👉 Нажмите здесь для входа</a>\n\n` +
    '⚠️ Ссылка действительна 7 дней и работает только один раз.',
    { parse_mode: 'HTML' }
  )
}
