import type { BotContext } from '../bot'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { UserRole } from '@prisma/client'

/**
 * Handle /setpassword command
 * Only for ADMIN and USTAZ roles
 */
export async function handleSetPassword(ctx: BotContext) {
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
      'Веб-вход доступен только для администраторов и устазов.\n' +
      'Студенты и родители используют авторизацию через Telegram.'
    )
    return
  }

  // Set session step
  ctx.session.step = 'awaiting_password'

  await ctx.reply(
    '🔐 <b>Установка пароля для веб-входа</b>\n\n' +
    'Введите новый пароль (минимум 6 символов).\n\n' +
    '⚠️ <b>Важно:</b> Это сообщение будет удалено после установки пароля.\n\n' +
    'Для отмены отправьте /cancel',
    { parse_mode: 'HTML' }
  )
}

/**
 * Handle password input
 */
export async function handlePasswordInput(ctx: BotContext) {
  const telegramId = ctx.from?.id
  const password = ctx.message?.text

  if (!telegramId || !password) {
    await ctx.reply('Ошибка: не удалось обработать пароль')
    ctx.session.step = 'idle'
    return
  }

  // Delete user's message containing password
  try {
    await ctx.deleteMessage()
  } catch {
    // Ignore if can't delete
  }

  // Validate password
  if (password.length < 6) {
    await ctx.reply(
      '❌ Пароль должен содержать минимум 6 символов.\n\n' +
      'Попробуйте ещё раз или отправьте /cancel для отмены.'
    )
    return
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) }
  })

  if (!user) {
    await ctx.reply('Ошибка: пользователь не найден')
    ctx.session.step = 'idle'
    return
  }

  // Hash and save password
  const passwordHash = hashPassword(password)

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  })

  // Reset session
  ctx.session.step = 'idle'

  const webUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qurantester.vercel.app'

  await ctx.reply(
    '✅ <b>Пароль успешно установлен!</b>\n\n' +
    'Теперь вы можете войти через браузер:\n' +
    `<a href="${webUrl}/login">${webUrl}/login</a>\n\n` +
    '<b>Данные для входа:</b>\n' +
    `📱 Телефон: <code>${user.phone}</code>\n` +
    '🔑 Пароль: который вы только что ввели',
    { parse_mode: 'HTML' }
  )
}

/**
 * Handle /cancel command during password setup
 */
export async function handleCancelPassword(ctx: BotContext) {
  if (ctx.session.step === 'awaiting_password') {
    ctx.session.step = 'idle'
    await ctx.reply('❌ Установка пароля отменена.')
    return true
  }
  return false
}
