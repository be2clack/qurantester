import type { BotContext } from '../bot'
import { prisma } from '@/lib/prisma'
import { parsePhoneNumber } from 'libphonenumber-js'
import { getMainMenuKeyboard } from '../keyboards/main-menu'
import { cleanupAllMessages, sendAndTrack } from '../utils/message-cleaner'
import { UserRole } from '@prisma/client'
import { getRoleLabel } from '@/lib/constants/roles'
import { showGenderSelection } from './registration'

/**
 * Handle contact message (phone number)
 */
export async function handleContact(ctx: BotContext): Promise<void> {
  // Only process if we're waiting for contact
  if (ctx.session.step !== 'awaiting_contact') {
    return
  }

  const contact = ctx.message?.contact
  const telegramUser = ctx.from

  if (!contact || !telegramUser) {
    await sendAndTrack(
      ctx,
      'Пожалуйста, отправьте свой контакт, используя кнопку ниже.',
      {},
      undefined,
      'error'
    )
    return
  }

  // Verify it's user's own contact
  if (contact.user_id !== telegramUser.id) {
    await sendAndTrack(
      ctx,
      'Пожалуйста, отправьте именно свой контакт, а не чужой.',
      {},
      undefined,
      'error'
    )
    return
  }

  // Parse and normalize phone number
  let phoneNumber: string
  const rawPhone = contact.phone_number.replace(/\D/g, '')

  try {
    // Try to parse with auto-detection first
    let parsed = parsePhoneNumber(`+${rawPhone}`)

    // If not valid, try with KZ country code for local numbers
    if (!parsed?.isValid() && rawPhone.length <= 10) {
      parsed = parsePhoneNumber(rawPhone, 'KZ')
    }

    phoneNumber = parsed?.format('E.164') || `+${rawPhone}`
  } catch {
    phoneNumber = `+${rawPhone}`
  }

  // Check if user exists by phone
  let user = await prisma.user.findUnique({
    where: { phone: phoneNumber }
  })

  if (!user) {
    // NEW USER - Create with PENDING role and ask for details
    user = await prisma.user.create({
      data: {
        phone: phoneNumber,
        telegramId: BigInt(telegramUser.id),
        telegramUsername: telegramUser.username || null,
        firstName: contact.first_name || null,
        lastName: contact.last_name || null,
        role: UserRole.PENDING,
      }
    })

    // Save phone to session and ask for full name
    ctx.session.registrationPhone = phoneNumber
    ctx.session.step = 'awaiting_name'

    await cleanupAllMessages(ctx)

    const message = `<b>📝 Регистрация</b>

Ваш номер: <code>${phoneNumber}</code>

Пожалуйста, введите ваше <b>ФИО</b> (Фамилия Имя Отчество):

<i>Например: Иванов Иван Иванович</i>`

    await sendAndTrack(
      ctx,
      message,
      { parse_mode: 'HTML' },
      user.id,
      'registration'
    )
    return
  }

  // Check if user is PENDING
  if (user.role === UserRole.PENDING) {
    // Update Telegram data
    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramId: BigInt(telegramUser.id),
        telegramUsername: telegramUser.username || null,
      }
    })

    // Show waiting message
    await cleanupAllMessages(ctx)

    const message = `<b>⏳ Ожидание подтверждения</b>

Ваш номер: <code>${phoneNumber}</code>
${user.firstName ? `ФИО: ${user.firstName} ${user.lastName || ''}` : ''}

Ваша заявка находится на рассмотрении у администратора.

Вы получите уведомление, когда ваш аккаунт будет активирован.

<i>Если прошло много времени, обратитесь к вашему устазу.</i>`

    await sendAndTrack(
      ctx,
      message,
      { parse_mode: 'HTML' },
      user.id,
      'pending'
    )
    return
  }

  // Update existing user with Telegram data
  user = await prisma.user.update({
    where: { id: user.id },
    data: {
      telegramId: BigInt(telegramUser.id),
      telegramUsername: telegramUser.username || null,
      firstName: user.firstName || contact.first_name || null,
      lastName: user.lastName || contact.last_name || null,
    }
  })

  // Update session
  ctx.session.step = 'browsing_menu'
  ctx.session.currentMenuPath = 'main'

  // Cleanup and show main menu
  await cleanupAllMessages(ctx)

  const message = buildWelcomeMessage(user)

  await sendAndTrack(
    ctx,
    message,
    {
      reply_markup: getMainMenuKeyboard(user.role),
      parse_mode: 'HTML'
    },
    user.id,
    'menu'
  )
}

/**
 * Handle name input during registration
 */
export async function handleNameInput(ctx: BotContext): Promise<void> {
  if (ctx.session.step !== 'awaiting_name') {
    return
  }

  const text = ctx.message?.text?.trim()
  if (!text || text.length < 3) {
    await sendAndTrack(
      ctx,
      'Пожалуйста, введите корректное ФИО (минимум 3 символа).',
      {},
      undefined,
      'error'
    )
    return
  }

  // Save name to session
  ctx.session.registrationName = text
  ctx.session.step = 'awaiting_birthdate'

  const message = `<b>📅 Дата рождения</b>

ФИО: <b>${text}</b>

Теперь введите вашу <b>дату рождения</b> в формате:
<code>ДД.ММ.ГГГГ</code>

<i>Например: 15.03.1990</i>`

  await sendAndTrack(
    ctx,
    message,
    { parse_mode: 'HTML' },
    undefined,
    'registration'
  )
}

/**
 * Handle birth date input during registration
 */
export async function handleBirthDateInput(ctx: BotContext): Promise<void> {
  if (ctx.session.step !== 'awaiting_birthdate') {
    return
  }

  const text = ctx.message?.text?.trim()
  if (!text) {
    await sendAndTrack(
      ctx,
      'Пожалуйста, введите дату рождения в формате ДД.ММ.ГГГГ',
      {},
      undefined,
      'error'
    )
    return
  }

  // Parse date (DD.MM.YYYY format)
  const dateMatch = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!dateMatch) {
    await sendAndTrack(
      ctx,
      'Неверный формат даты. Используйте формат ДД.ММ.ГГГГ\n\nНапример: 15.03.1990',
      {},
      undefined,
      'error'
    )
    return
  }

  const [, day, month, year] = dateMatch
  const birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))

  // Validate date
  if (isNaN(birthDate.getTime()) || birthDate > new Date() || birthDate.getFullYear() < 1920) {
    await sendAndTrack(
      ctx,
      'Некорректная дата. Проверьте правильность и попробуйте снова.',
      {},
      undefined,
      'error'
    )
    return
  }

  // Show gender selection screen (date will be saved in session)
  await showGenderSelection(ctx, text)
}

/**
 * Build welcome message for existing user
 */
function buildWelcomeMessage(
  user: {
    firstName: string | null
    lastName: string | null
    phone: string
    role: UserRole
  }
): string {
  const name = user.firstName || 'пользователь'
  const role = getRoleLabel(user.role)

  return `<b>✅ Добро пожаловать, ${name}!</b>

Ваш аккаунт привязан к Telegram.

📱 Телефон: ${user.phone}
👤 Роль: ${role}

Выберите действие:`
}
