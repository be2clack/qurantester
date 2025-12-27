import type { BotContext } from '../bot'
import { prisma } from '@/lib/prisma'
import { UserRole, LessonType, Gender } from '@prisma/client'
import { cleanupAllMessages, sendAndTrack, deleteMessagesByType } from '../utils/message-cleaner'
import {
  getGenderSelectionKeyboard,
  getRoleSelectionKeyboard,
  getGroupListKeyboard,
  getGroupConfirmKeyboard,
  getBackToRoleKeyboard,
  getMainMenuKeyboard,
  getProgressPageKeyboard,
  getProgressLineKeyboard,
  getProgressStageKeyboard,
} from '../keyboards/main-menu'

/**
 * Show gender selection screen
 */
export async function showGenderSelection(ctx: BotContext, birthDateStr: string): Promise<void> {
  ctx.session.registrationBirthDate = birthDateStr
  ctx.session.step = 'awaiting_gender'

  await deleteMessagesByType(ctx, 'registration')

  const message = `<b>👤 Укажите ваш пол</b>

Выберите один из вариантов:`

  await sendAndTrack(
    ctx,
    message,
    {
      reply_markup: getGenderSelectionKeyboard(),
      parse_mode: 'HTML'
    },
    undefined,
    'registration'
  )
}

/**
 * Handle gender selection callback
 */
export async function handleGenderSelection(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data?.startsWith('reg:gender:')) return

  const gender = data.replace('reg:gender:', '') as 'MALE' | 'FEMALE'
  await ctx.answerCallbackQuery()

  ctx.session.registrationGender = gender

  // Show role selection
  await showRoleSelection(ctx)
}

/**
 * Show role selection screen
 */
export async function showRoleSelection(ctx: BotContext): Promise<void> {
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
 * Handle role selection callback
 */
export async function handleRoleSelection(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data?.startsWith('reg:role:')) return

  const role = data.replace('reg:role:', '') as 'STUDENT' | 'USTAZ' | 'PARENT'
  await ctx.answerCallbackQuery()

  if (role === 'STUDENT') {
    // Show list of groups to choose from
    await showGroupList(ctx)
  } else if (role === 'PARENT') {
    // Ask for child's phone number
    await showChildPhoneInput(ctx)
  } else if (role === 'USTAZ') {
    // Complete registration as ustaz (pending approval)
    await completeUstazRegistration(ctx)
  }
}

/**
 * Show list of groups for student to choose
 */
async function showGroupList(ctx: BotContext): Promise<void> {
  ctx.session.step = 'awaiting_group_selection'

  // Get all active groups with their ustaz
  const groups = await prisma.group.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      lessonType: true,
      ustaz: {
        select: {
          firstName: true,
          lastName: true,
        }
      },
      _count: {
        select: { students: true }
      }
    },
    orderBy: [{ name: 'asc' }]
  })

  if (groups.length === 0) {
    const message = `<b>⚠️ Нет доступных групп</b>

К сожалению, в системе пока нет активных групп.

Пожалуйста, свяжитесь с администратором для регистрации.`

    await ctx.editMessageText(message, {
      reply_markup: getBackToRoleKeyboard(),
      parse_mode: 'HTML'
    })
    return
  }

  const message = `<b>📚 Выберите группу</b>

Выберите группу, в которую хотите записаться:`

  await ctx.editMessageText(message, {
    reply_markup: getGroupListKeyboard(groups),
    parse_mode: 'HTML'
  })
}

/**
 * Handle group selection callback
 */
export async function handleGroupSelection(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data?.startsWith('reg:group:')) return

  const groupId = data.replace('reg:group:', '')
  await ctx.answerCallbackQuery()

  // Get group details
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      lessonType: true,
      ustaz: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        }
      },
      _count: {
        select: { students: true }
      }
    }
  })

  if (!group) {
    await ctx.answerCallbackQuery({ text: 'Группа не найдена', show_alert: true })
    return
  }

  ctx.session.selectedGroupId = groupId
  ctx.session.step = 'awaiting_group_confirm'

  const ustazName = group.ustaz
    ? [group.ustaz.firstName, group.ustaz.lastName].filter(Boolean).join(' ')
    : 'Не назначен'

  const lessonTypeNames: Record<LessonType, string> = {
    [LessonType.MEMORIZATION]: 'Заучивание',
    [LessonType.REVISION]: 'Повторение',
    [LessonType.TRANSLATION]: 'Перевод',
  }

  const message = `<b>✅ Подтвердите выбор группы</b>

📚 <b>Группа:</b> ${group.name}
📖 <b>Тип:</b> ${lessonTypeNames[group.lessonType]}
👨‍🏫 <b>Устаз:</b> ${ustazName}
👥 <b>Студентов:</b> ${group._count.students}

<i>Вы будете добавлены в эту группу.</i>`

  await ctx.editMessageText(message, {
    reply_markup: getGroupConfirmKeyboard(groupId),
    parse_mode: 'HTML'
  })
}

/**
 * Handle group confirmation callback - now shows progress selection
 */
export async function handleGroupConfirm(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data?.startsWith('reg:confirm_group:')) return

  const groupId = data.replace('reg:confirm_group:', '')
  await ctx.answerCallbackQuery()

  // Store selected group ID and show progress selection
  ctx.session.selectedGroupId = groupId
  ctx.session.step = 'awaiting_progress_page'
  ctx.session.progressPageOffset = 0

  const message = `<b>📖 Укажите ваш текущий прогресс</b>

Выберите страницу Мусхафа, на которой вы сейчас находитесь:

<i>Если вы только начинаете - выберите страницу 1</i>`

  await ctx.editMessageText(message, {
    reply_markup: getProgressPageKeyboard(0),
    parse_mode: 'HTML'
  })
}

/**
 * Handle progress page offset navigation
 */
export async function handleProgressPageOffset(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data?.startsWith('reg:progress_offset:')) return

  const offset = parseInt(data.replace('reg:progress_offset:', ''))
  await ctx.answerCallbackQuery()

  ctx.session.progressPageOffset = offset

  const message = `<b>📖 Укажите ваш текущий прогресс</b>

Выберите страницу Мусхафа, на которой вы сейчас находитесь:

<i>Страницы ${offset + 1}-${Math.min(offset + 40, 604)}</i>`

  await ctx.editMessageText(message, {
    reply_markup: getProgressPageKeyboard(offset),
    parse_mode: 'HTML'
  })
}

/**
 * Handle progress page selection
 */
export async function handleProgressPageSelection(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data?.startsWith('reg:progress_page:')) return

  const page = parseInt(data.replace('reg:progress_page:', ''))
  await ctx.answerCallbackQuery()

  ctx.session.registrationPage = page
  ctx.session.step = 'awaiting_progress_line'

  const message = `<b>📖 Страница ${page}</b>

Выберите строку, на которой вы остановились:

<i>Строки нумеруются сверху вниз (1-15)</i>`

  await ctx.editMessageText(message, {
    reply_markup: getProgressLineKeyboard(page),
    parse_mode: 'HTML'
  })
}

/**
 * Handle progress line selection
 */
export async function handleProgressLineSelection(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data?.startsWith('reg:progress_line:')) return

  const parts = data.replace('reg:progress_line:', '').split(':')
  const page = parseInt(parts[0])
  const line = parseInt(parts[1])
  await ctx.answerCallbackQuery()

  ctx.session.registrationPage = page
  ctx.session.registrationLine = line
  ctx.session.step = 'awaiting_progress_stage'

  const message = `<b>📖 Страница ${page}, строка ${line}</b>

Выберите этап заучивания:

<b>1.1</b> - Чтение с листа
<b>1.2</b> - Проверка чтения
<b>2.1</b> - Заучивание наизусть
<b>2.2</b> - Проверка заучивания
<b>3</b> - Закрепление`

  await ctx.editMessageText(message, {
    reply_markup: getProgressStageKeyboard(page, line),
    parse_mode: 'HTML'
  })
}

/**
 * Handle progress stage selection - completes registration
 */
export async function handleProgressStageSelection(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data?.startsWith('reg:progress_stage:')) return

  const parts = data.replace('reg:progress_stage:', '').split(':')
  const page = parseInt(parts[0])
  const line = parseInt(parts[1])
  const stage = parts[2] as 'STAGE_1_1' | 'STAGE_1_2' | 'STAGE_2_1' | 'STAGE_2_2' | 'STAGE_3'
  await ctx.answerCallbackQuery()

  const telegramId = ctx.from?.id
  if (!telegramId) return

  const groupId = ctx.session.selectedGroupId
  if (!groupId) {
    await ctx.editMessageText(
      'Ошибка: группа не выбрана. Попробуйте /start',
      { parse_mode: 'HTML' }
    )
    return
  }

  // Parse saved data from session
  const fullName = ctx.session.registrationName || ''
  const birthDateStr = ctx.session.registrationBirthDate || ''
  const parts2 = fullName.split(/\s+/)
  const lastName = parts2[0] || ''
  const firstName = parts2.slice(1).join(' ') || parts2[0]

  // Parse birth date
  const dateMatch = birthDateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  let birthDate: Date | undefined
  if (dateMatch) {
    const [, day, month, year] = dateMatch
    birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  // Get group with ustaz
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      lessonType: true,
      ustaz: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        }
      }
    }
  })

  if (!group) {
    await ctx.editMessageText(
      'Группа не найдена. Попробуйте /start',
      { parse_mode: 'HTML' }
    )
    return
  }

  try {
    // Get gender from session
    const gender = ctx.session.registrationGender as Gender | undefined

    // Update user with role, progress, and ustaz (if group has ustaz)
    const user = await prisma.user.update({
      where: { telegramId: BigInt(telegramId) },
      data: {
        firstName,
        lastName,
        birthDate,
        gender,
        role: UserRole.STUDENT,
        ustazId: group.ustaz?.id || null,
        currentPage: page,
        currentLine: line,
        currentStage: stage,
      }
    })

    // Create StudentGroup entry with progress
    await prisma.studentGroup.create({
      data: {
        studentId: user.id,
        groupId: group.id,
        currentPage: page,
        currentLine: line,
        currentStage: stage,
      }
    })

    // Clear registration data from session
    ctx.session.registrationPhone = undefined
    ctx.session.registrationName = undefined
    ctx.session.registrationBirthDate = undefined
    ctx.session.registrationGender = undefined
    ctx.session.selectedGroupId = undefined
    ctx.session.registrationPage = undefined
    ctx.session.registrationLine = undefined
    ctx.session.progressPageOffset = undefined
    ctx.session.step = 'browsing_menu'
    ctx.session.currentMenuPath = 'main'

    await cleanupAllMessages(ctx)

    const ustazName = group.ustaz
      ? [group.ustaz.firstName, group.ustaz.lastName].filter(Boolean).join(' ')
      : 'Не назначен'
    const genderIcon = gender === 'FEMALE' ? '🧕' : '👨'
    const stageNames: Record<string, string> = {
      'STAGE_1_1': '1.1',
      'STAGE_1_2': '1.2',
      'STAGE_2_1': '2.1',
      'STAGE_2_2': '2.2',
      'STAGE_3': '3',
    }

    const message = `<b>✅ Регистрация завершена!</b>

${genderIcon} <b>ФИО:</b> ${lastName} ${firstName}
<b>Роль:</b> Студент
<b>Группа:</b> ${group.name}
<b>Устаз:</b> ${ustazName}
<b>Прогресс:</b> стр. ${page}, строка ${line}, этап ${stageNames[stage]}

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
 * Handle back to progress page selection
 */
export async function handleBackToProgressPage(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery()

  ctx.session.step = 'awaiting_progress_page'
  const offset = ctx.session.progressPageOffset || 0

  const message = `<b>📖 Укажите ваш текущий прогресс</b>

Выберите страницу Мусхафа, на которой вы сейчас находитесь:

<i>Страницы ${offset + 1}-${Math.min(offset + 40, 604)}</i>`

  await ctx.editMessageText(message, {
    reply_markup: getProgressPageKeyboard(offset),
    parse_mode: 'HTML'
  })
}

/**
 * Handle back to progress line selection
 */
export async function handleBackToProgressLine(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data?.startsWith('reg:back_to_progress_line:')) return

  const page = parseInt(data.replace('reg:back_to_progress_line:', ''))
  await ctx.answerCallbackQuery()

  ctx.session.step = 'awaiting_progress_line'

  const message = `<b>📖 Страница ${page}</b>

Выберите строку, на которой вы остановились:

<i>Строки нумеруются сверху вниз (1-15)</i>`

  await ctx.editMessageText(message, {
    reply_markup: getProgressLineKeyboard(page),
    parse_mode: 'HTML'
  })
}

/**
 * Handle back to group confirm from progress selection
 */
export async function handleBackToGroupConfirmFromProgress(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery()

  const groupId = ctx.session.selectedGroupId
  if (!groupId) {
    await showGroupList(ctx)
    return
  }

  // Get group details
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      lessonType: true,
      ustaz: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        }
      },
      _count: {
        select: { students: true }
      }
    }
  })

  if (!group) {
    await showGroupList(ctx)
    return
  }

  ctx.session.step = 'awaiting_group_confirm'

  const ustazName = group.ustaz
    ? [group.ustaz.firstName, group.ustaz.lastName].filter(Boolean).join(' ')
    : 'Не назначен'

  const lessonTypeNames: Record<LessonType, string> = {
    [LessonType.MEMORIZATION]: 'Заучивание',
    [LessonType.REVISION]: 'Повторение',
    [LessonType.TRANSLATION]: 'Перевод',
  }

  const message = `<b>✅ Подтвердите выбор группы</b>

📚 <b>Группа:</b> ${group.name}
📖 <b>Тип:</b> ${lessonTypeNames[group.lessonType]}
👨‍🏫 <b>Устаз:</b> ${ustazName}
👥 <b>Студентов:</b> ${group._count.students}

<i>Вы будете добавлены в эту группу.</i>`

  await ctx.editMessageText(message, {
    reply_markup: getGroupConfirmKeyboard(groupId),
    parse_mode: 'HTML'
  })
}

/**
 * Handle back to group list
 */
export async function handleBackToGroupList(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery()
  await showGroupList(ctx)
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
    // Get gender from session
    const gender = ctx.session.registrationGender as Gender | undefined

    // Update parent user with role and link to child
    const parent = await prisma.user.update({
      where: { telegramId: BigInt(telegramId) },
      data: {
        firstName,
        lastName,
        birthDate,
        gender,
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
    ctx.session.registrationGender = undefined
    ctx.session.step = 'browsing_menu'
    ctx.session.currentMenuPath = 'main'

    await cleanupAllMessages(ctx)

    const childName = [child.firstName, child.lastName].filter(Boolean).join(' ') || 'Студент'
    const genderIcon = gender === 'FEMALE' ? '🧕' : '👨'

    const message = `<b>✅ Регистрация завершена!</b>

${genderIcon} <b>ФИО:</b> ${lastName} ${firstName}
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
    // Get gender from session
    const gender = ctx.session.registrationGender as Gender | undefined

    // Update user with ustaz role but inactive until admin approves
    const user = await prisma.user.update({
      where: { telegramId: BigInt(telegramId) },
      data: {
        firstName,
        lastName,
        birthDate,
        gender,
        role: UserRole.USTAZ,
        isActive: false, // Needs admin approval
      }
    })

    // Clear registration data from session
    ctx.session.registrationPhone = undefined
    ctx.session.registrationName = undefined
    ctx.session.registrationBirthDate = undefined
    ctx.session.registrationGender = undefined
    ctx.session.step = 'idle'

    await cleanupAllMessages(ctx)

    const genderIcon = gender === 'FEMALE' ? '🧕' : '👨'

    const message = `<b>📝 Заявка отправлена!</b>

${genderIcon} <b>ФИО:</b> ${lastName} ${firstName}
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
