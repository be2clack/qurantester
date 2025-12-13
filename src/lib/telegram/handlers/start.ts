import type { BotContext } from '../bot'
import { prisma } from '@/lib/prisma'
import { TaskStatus } from '@prisma/client'
import { getContactKeyboard, getMainMenuKeyboard, StudentMenuInfo } from '../keyboards/main-menu'
import { cleanupAllMessages, sendAndTrack } from '../utils/message-cleaner'
import { STAGES, getGlobalLineNumber } from '@/lib/constants/quran'

/**
 * Handle /start command
 */
export async function handleStart(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return

  // Cleanup all previous messages (but keep /start)
  await cleanupAllMessages(ctx)

  // Check if user exists by Telegram ID
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    include: {
      studentGroup: {
        include: {
          ustaz: true,
          _count: { select: { students: true } }
        }
      },
      statistics: true,
    }
  })

  if (user) {
    // For students, get full menu info
    let menuInfo: StudentMenuInfo | undefined

    if (user.role === 'STUDENT') {
      const activeTask = await prisma.task.findFirst({
        where: {
          studentId: user.id,
          status: TaskStatus.IN_PROGRESS,
        },
        select: {
          currentCount: true,
          requiredCount: true,
        }
      })

      // Calculate rank in group
      let rankInGroup: number | undefined
      let totalInGroup: number | undefined

      if (user.studentGroup) {
        totalInGroup = user.studentGroup._count.students

        // Get all students in group sorted by progress
        const groupStudents = await prisma.user.findMany({
          where: { groupId: user.studentGroup.id },
          select: { id: true, currentPage: true, currentLine: true },
          orderBy: [
            { currentPage: 'desc' },
            { currentLine: 'desc' }
          ]
        })

        rankInGroup = groupStudents.findIndex(s => s.id === user.id) + 1
      }

      menuInfo = {
        hasActiveTask: !!activeTask,
        currentCount: activeTask?.currentCount,
        requiredCount: activeTask?.requiredCount,
        groupName: user.studentGroup?.name,
        ustazName: user.studentGroup?.ustaz?.firstName || undefined,
        ustazUsername: user.studentGroup?.ustaz?.telegramUsername || undefined,
        ustazTelegramId: user.studentGroup?.ustaz?.telegramId ? Number(user.studentGroup.ustaz.telegramId) : undefined,
        rankInGroup,
        totalInGroup,
        totalTasksCompleted: user.statistics?.totalTasksCompleted,
      }
    }

    // User exists, show main menu
    const welcomeText = buildWelcomeMessage(user, menuInfo)

    await sendAndTrack(
      ctx,
      welcomeText,
      {
        reply_markup: getMainMenuKeyboard(user.role, menuInfo),
        parse_mode: 'HTML'
      },
      user.id,
      'menu'
    )

    ctx.session.step = 'browsing_menu'
    ctx.session.currentMenuPath = 'main'
  } else {
    // New user or not linked, request contact
    ctx.session.step = 'awaiting_contact'

    await sendAndTrack(
      ctx,
      buildRegistrationMessage(),
      {
        reply_markup: getContactKeyboard(),
        parse_mode: 'HTML'
      },
      undefined,
      'registration'
    )
  }
}

/**
 * Build welcome message for existing user
 */
function buildWelcomeMessage(user: {
  firstName: string | null
  lastName: string | null
  role: string
  currentPage: number
  currentLine: number
  currentStage: string
}, menuInfo?: StudentMenuInfo): string {
  const name = user.firstName || 'пользователь'

  let message = `<b>Ассаляму алейкум, ${name}!</b>\n\n`

  if (user.role === 'STUDENT') {
    const stageName = STAGES[user.currentStage as keyof typeof STAGES]?.nameRu || user.currentStage
    message += `📖 <b>Главное меню</b>\n\n`
    message += `📍 Текущий прогресс: <b>стр. ${user.currentPage}, строка ${user.currentLine}</b>\n`
    message += `📊 Этап: <b>${stageName}</b>\n\n`

    // Group and ustaz info
    if (menuInfo?.groupName) {
      message += `━━━━━━━━━━━━━━━━━━\n`
      message += `📚 Группа: <b>${menuInfo.groupName}</b>\n`
      if (menuInfo.ustazName) {
        message += `👨‍🏫 Устаз: <b>${menuInfo.ustazName}</b>\n`
      }
      if (menuInfo.rankInGroup && menuInfo.totalInGroup) {
        message += `🏆 Рейтинг: <b>${menuInfo.rankInGroup} из ${menuInfo.totalInGroup}</b>\n`
      }
      if (menuInfo.totalTasksCompleted !== undefined && menuInfo.totalTasksCompleted > 0) {
        message += `✅ Выполнено заданий: <b>${menuInfo.totalTasksCompleted}</b>\n`
      }
      message += `━━━━━━━━━━━━━━━━━━\n\n`
    }

    message += `Выберите действие:`
  } else if (user.role === 'USTAZ') {
    message += `👨‍🏫 <b>Панель устаза</b>\n\n`
    message += `Выберите действие:`
  } else if (user.role === 'ADMIN') {
    message += `👑 <b>Панель администратора</b>\n\n`
    message += `Выберите действие:`
  } else if (user.role === 'PARENT') {
    message += `👨‍👩‍👧 <b>Панель родителя</b>\n\n`
    message += `Выберите действие:`
  } else {
    message += `⏳ <b>Ожидание подтверждения</b>\n\n`
    message += `Ваш аккаунт ожидает подтверждения администратором.`
  }

  return message
}

/**
 * Build registration message for new users
 */
function buildRegistrationMessage(): string {
  return `<b>Ассаляму алейкум!</b>

Добро пожаловать в систему изучения Корана.

Для начала работы отправьте свой номер телефона, нажав кнопку ниже.

<i>Ваш номер будет использован для идентификации в системе.</i>`
}
