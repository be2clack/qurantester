import type { BotContext } from '../bot'
import { prisma } from '@/lib/prisma'
import { UserRole, LessonType } from '@prisma/client'
import { cleanupAllMessages, sendAndTrack, deleteMessagesByType } from '../utils/message-cleaner'
import {
  getRoleSelectionKeyboard,
  getUstazListKeyboard,
  getUstazConfirmKeyboard,
  getBackToRoleKeyboard,
  getMainMenuKeyboard
} from '../keyboards/main-menu'

/**
 * Show role selection screen
 */
export async function showRoleSelection(ctx: BotContext, birthDateStr: string): Promise<void> {
  ctx.session.registrationBirthDate = birthDateStr
  ctx.session.step = 'awaiting_role'

  await deleteMessagesByType(ctx, 'registration')

  const message = `<b>👤 Выберите вашу роль</b>

Кем вы являетесь в системе?

📚 <b>Студент</b> - если вы изучаете Коран
👨‍🏫 <b>Устаз</b> - если вы преподаватель
👨‍👩‍👧 <b>Родитель</b> - если вы родитель ученика`

  await sendAndTrack(
    ctx,
    message,
    {
      reply_markup: getRoleSelectionKeyboard(),
      parse_mode: 'HTML'
    },
    undefined,
    'registration'
  )
}

/**
 * Handle role selection callback
 */
export async function handleRoleSelection(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data?.startsWith('reg:role:')) return

  const role = data.replace('reg:role:', '') as 'STUDENT' | 'USTAZ' | 'PARENT'
  await ctx.answerCallbackQuery()

  if (role === 'STUDENT') {
    // Show list of ustaz to choose from
    await showUstazList(ctx)
  } else if (role === 'PARENT') {
    // Ask for child's phone number
    await showChildPhoneInput(ctx)
  } else if (role === 'USTAZ') {
    // Complete registration as ustaz (pending approval)
    await completeUstazRegistration(ctx)
  }
}

/**
 * Show list of ustaz for student to choose
 */
async function showUstazList(ctx: BotContext): Promise<void> {
  ctx.session.step = 'awaiting_ustaz_selection'

  // Get all active ustaz with their groups count
  const ustazList = await prisma.user.findMany({
    where: {
      role: UserRole.USTAZ,
      isActive: true,
      ustazGroups: {
        some: { isActive: true }
      }
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      _count: {
        select: { ustazGroups: true }
      }
    },
    orderBy: { firstName: 'asc' }
  })

  if (ustazList.length === 0) {
    const message = `<b>⚠️ Нет доступных устазов</b>

К сожалению, в системе пока нет активных устазов.

Пожалуйста, свяжитесь с администратором для регистрации.`

    await ctx.editMessageText(message, {
      reply_markup: getBackToRoleKeyboard(),
      parse_mode: 'HTML'
    })
    return
  }

  const message = `<b>👨‍🏫 Выберите вашего устаза</b>

Выберите устаза, у которого хотите обучаться:

<i>Вы будете добавлены во все группы выбранного устаза.</i>`

  await ctx.editMessageText(message, {
    reply_markup: getUstazListKeyboard(ustazList),
    parse_mode: 'HTML'
  })
}

/**
 * Handle ustaz selection callback
 */
export async function handleUstazSelection(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data?.startsWith('reg:ustaz:')) return

  const ustazId = data.replace('reg:ustaz:', '')
  await ctx.answerCallbackQuery()

  // Get ustaz details with their groups
  const ustaz = await prisma.user.findUnique({
    where: { id: ustazId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      ustazGroups: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          lessonType: true,
          _count: {
            select: { students: true }
          }
        }
      }
    }
  })

  if (!ustaz || ustaz.ustazGroups.length === 0) {
    await ctx.answerCallbackQuery({ text: 'Устаз не найден или нет групп', show_alert: true })
    return
  }

  ctx.session.selectedUstazId = ustazId
  ctx.session.step = 'awaiting_ustaz_confirm'

  const ustazName = [ustaz.firstName, ustaz.lastName].filter(Boolean).join(' ') || 'Устаз'

  // Group by lesson type
  const lessonTypeNames: Record<LessonType, string> = {
    [LessonType.MEMORIZATION]: 'Заучивание',
    [LessonType.REVISION]: 'Повторение',
    [LessonType.TRANSLATION]: 'Перевод',
  }

  const groupsList = ustaz.ustazGroups
    .map(g => `• ${g.name} (${lessonTypeNames[g.lessonType]}) - ${g._count.students} студентов`)
    .join('\n')

  const message = `<b>✅ Подтвердите выбор устаза</b>

👨‍🏫 <b>Устаз:</b> ${ustazName}
📱 <b>Телефон:</b> ${ustaz.phone}

<b>Группы устаза:</b>
${groupsList}

<i>Вы будете добавлены во все ${ustaz.ustazGroups.length} групп(ы) этого устаза.</i>`

  await ctx.editMessageText(message, {
    reply_markup: getUstazConfirmKeyboard(ustazId),
    parse_mode: 'HTML'
  })
}

/**
 * Handle ustaz confirmation callback
 */
export async function handleUstazConfirm(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data?.startsWith('reg:confirm_ustaz:')) return

  const ustazId = data.replace('reg:confirm_ustaz:', '')
  await ctx.answerCallbackQuery()

  const telegramId = ctx.from?.id
  if (!telegramId) return

  // Parse saved data from session
  const fullName = ctx.session.registrationName || ''
  const birthDateStr = ctx.session.registrationBirthDate || ''
  const parts = fullName.split(/\s+/)
  const lastName = parts[0] || ''
  const firstName = parts.slice(1).join(' ') || parts[0]

  // Parse birth date
  const dateMatch = birthDateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  let birthDate: Date | undefined
  if (dateMatch) {
    const [, day, month, year] = dateMatch
    birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  // Get ustaz and their groups
  const ustaz = await prisma.user.findUnique({
    where: { id: ustazId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      ustazGroups: {
        where: { isActive: true },
        select: { id: true, name: true, lessonType: true }
      }
    }
  })

  if (!ustaz || ustaz.ustazGroups.length === 0) {
    await ctx.editMessageText(
      'Устаз или группы не найдены. Попробуйте /start',
      { parse_mode: 'HTML' }
    )
    return
  }

  try {
    // Update user with role and ustaz
    const user = await prisma.user.update({
      where: { telegramId: BigInt(telegramId) },
      data: {
        firstName,
        lastName,
        birthDate,
        role: UserRole.STUDENT,
        ustazId: ustaz.id,
      }
    })

    // Create StudentGroup entries for all ustaz's groups
    for (const group of ustaz.ustazGroups) {
      await prisma.studentGroup.create({
        data: {
          studentId: user.id,
          groupId: group.id,
        }
      })
    }

    // Clear registration data from session
    ctx.session.registrationPhone = undefined
    ctx.session.registrationName = undefined
    ctx.session.registrationBirthDate = undefined
    ctx.session.selectedUstazId = undefined
    ctx.session.step = 'browsing_menu'
    ctx.session.currentMenuPath = 'main'

    await cleanupAllMessages(ctx)

    const ustazName = [ustaz.firstName, ustaz.lastName].filter(Boolean).join(' ') || 'Устаз'
    const groupNames = ustaz.ustazGroups.map(g => g.name).join(', ')

    const message = `<b>✅ Регистрация завершена!</b>

<b>ФИО:</b> ${lastName} ${firstName}
<b>Роль:</b> Студент
<b>Устаз:</b> ${ustazName}
<b>Группы:</b> ${groupNames}

<b>Добро пожаловать!</b> Выберите действие:`

    await sendAndTrack(
      ctx,
      message,
      {
        reply_markup: getMainMenuKeyboard(UserRole.STUDENT),
        parse_mode: 'HTML'
      },
      user.id,
      'menu'
    )
  } catch (error) {
    console.error('Error completing student registration:', error)
    await ctx.editMessageText(
      'Произошла ошибка при регистрации. Попробуйте /start',
      { parse_mode: 'HTML' }
    )
  }
}

/**
 * Handle back to ustaz list
 */
export async function handleBackToUstazList(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery()
  await showUstazList(ctx)
}

/**
 * Handle back to role selection
 */
export async function handleBackToRole(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery()

  ctx.session.step = 'awaiting_role'

  const message = `<b>👤 Выберите вашу роль</b>

Кем вы являетесь в системе?

📚 <b>Студент</b> - если вы изучаете Коран
👨‍🏫 <b>Устаз</b> - если вы преподаватель
👨‍👩‍👧 <b>Родитель</b> - если вы родитель ученика`

  await ctx.editMessageText(message, {
    reply_markup: getRoleSelectionKeyboard(),
    parse_mode: 'HTML'
  })
}

/**
 * Show child phone input for parent registration
 */
async function showChildPhoneInput(ctx: BotContext): Promise<void> {
  ctx.session.step = 'awaiting_child_phone'

  const message = `<b>👨‍👩‍👧 Регистрация родителя</b>

Введите номер телефона вашего ребенка в формате:
<code>+77001234567</code>

<i>Ребенок должен быть уже зарегистрирован в системе как студент.</i>`

  await ctx.editMessageText(message, {
    reply_markup: getBackToRoleKeyboard(),
    parse_mode: 'HTML'
  })
}

/**
 * Handle child phone input for parent registration
 */
export async function handleChildPhoneInput(ctx: BotContext): Promise<void> {
  if (ctx.session.step !== 'awaiting_child_phone') return

  const text = ctx.message?.text?.trim()
  if (!text) return

  const telegramId = ctx.from?.id
  if (!telegramId) return

  // Normalize phone number
  let phone = text.replace(/\D/g, '')
  if (!phone.startsWith('+')) {
    phone = '+' + phone
  }

  // Validate format
  if (!/^\+\d{10,15}$/.test(phone)) {
    await sendAndTrack(
      ctx,
      `<b>❌ Неверный формат номера</b>

Введите номер в формате: <code>+77001234567</code>`,
      {
        reply_markup: getBackToRoleKeyboard(),
        parse_mode: 'HTML'
      },
      undefined,
      'error'
    )
    return
  }

  // Find child by phone
  const child = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    }
  })

  if (!child) {
    await sendAndTrack(
      ctx,
      `<b>❌ Ребенок не найден</b>

Пользователь с номером <code>${phone}</code> не найден в системе.

Убедитесь, что ребенок зарегистрирован, и попробуйте снова.`,
      {
        reply_markup: getBackToRoleKeyboard(),
        parse_mode: 'HTML'
      },
      undefined,
      'error'
    )
    return
  }

  if (child.role !== UserRole.STUDENT) {
    await sendAndTrack(
      ctx,
      `<b>❌ Не студент</b>

Пользователь с номером <code>${phone}</code> не является студентом.

Вы можете быть родителем только для студентов.`,
      {
        reply_markup: getBackToRoleKeyboard(),
        parse_mode: 'HTML'
      },
      undefined,
      'error'
    )
    return
  }

  // Parse saved data from session
  const fullName = ctx.session.registrationName || ''
  const birthDateStr = ctx.session.registrationBirthDate || ''
  const parts = fullName.split(/\s+/)
  const lastName = parts[0] || ''
  const firstName = parts.slice(1).join(' ') || parts[0]

  // Parse birth date
  const dateMatch = birthDateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  let birthDate: Date | undefined
  if (dateMatch) {
    const [, day, month, year] = dateMatch
    birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  try {
    // Update parent user with role and link to child
    const parent = await prisma.user.update({
      where: { telegramId: BigInt(telegramId) },
      data: {
        firstName,
        lastName,
        birthDate,
        role: UserRole.PARENT,
        parentOf: {
          connect: { id: child.id }
        }
      }
    })

    // Clear registration data from session
    ctx.session.registrationPhone = undefined
    ctx.session.registrationName = undefined
    ctx.session.registrationBirthDate = undefined
    ctx.session.step = 'browsing_menu'
    ctx.session.currentMenuPath = 'main'

    await cleanupAllMessages(ctx)

    const childName = [child.firstName, child.lastName].filter(Boolean).join(' ') || 'Студент'

    const message = `<b>✅ Регистрация завершена!</b>

<b>ФИО:</b> ${lastName} ${firstName}
<b>Роль:</b> Родитель
<b>Ребенок:</b> ${childName}

<b>Добро пожаловать!</b> Выберите действие:`

    await sendAndTrack(
      ctx,
      message,
      {
        reply_markup: getMainMenuKeyboard(UserRole.PARENT),
        parse_mode: 'HTML'
      },
      parent.id,
      'menu'
    )
  } catch (error) {
    console.error('Error completing parent registration:', error)
    await sendAndTrack(
      ctx,
      'Произошла ошибка при регистрации. Попробуйте /start',
      {},
      undefined,
      'error'
    )
  }
}

/**
 * Complete registration as ustaz (pending admin approval)
 */
async function completeUstazRegistration(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return

  // Parse saved data from session
  const fullName = ctx.session.registrationName || ''
  const birthDateStr = ctx.session.registrationBirthDate || ''
  const parts = fullName.split(/\s+/)
  const lastName = parts[0] || ''
  const firstName = parts.slice(1).join(' ') || parts[0]

  // Parse birth date
  const dateMatch = birthDateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  let birthDate: Date | undefined
  if (dateMatch) {
    const [, day, month, year] = dateMatch
    birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  try {
    // Update user with ustaz role but inactive until admin approves
    const user = await prisma.user.update({
      where: { telegramId: BigInt(telegramId) },
      data: {
        firstName,
        lastName,
        birthDate,
        role: UserRole.USTAZ,
        isActive: false, // Needs admin approval
      }
    })

    // Clear registration data from session
    ctx.session.registrationPhone = undefined
    ctx.session.registrationName = undefined
    ctx.session.registrationBirthDate = undefined
    ctx.session.step = 'idle'

    await cleanupAllMessages(ctx)

    const message = `<b>📝 Заявка отправлена!</b>

<b>ФИО:</b> ${lastName} ${firstName}
<b>Роль:</b> Устаз

<b>⏳ Ожидайте подтверждения</b>

Ваша заявка на роль устаза отправлена на рассмотрение администратору.

Вы получите уведомление, когда ваш аккаунт будет активирован.

<i>После активации нажмите /start для начала работы.</i>`

    await sendAndTrack(
      ctx,
      message,
      { parse_mode: 'HTML' },
      user.id,
      'registration_complete'
    )
  } catch (error) {
    console.error('Error completing ustaz registration:', error)
    await ctx.editMessageText(
      'Произошла ошибка при регистрации. Попробуйте /start',
      { parse_mode: 'HTML' }
    )
  }
}
