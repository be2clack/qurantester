import type { BotContext } from '../bot'
import { prisma } from '@/lib/prisma'
import { TaskStatus, LessonType, SubmissionStatus } from '@prisma/client'
import { getContactKeyboard, getMainMenuKeyboard, StudentMenuInfo, LessonTypeInfo, getLessonTypeName, getLinesForLevelName, UstazMenuInfo } from '../keyboards/main-menu'
import { cleanupAllMessages, sendAndTrack, deleteMessagesByType } from '../utils/message-cleaner'
import { STAGES, getGlobalLineNumber } from '@/lib/constants/quran'
import { getPrimarySurahByPage } from '@/lib/constants/surahs'

/**
 * Handle /start command
 */
export async function handleStart(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return

  // Cleanup all previous messages (but keep /start)
  await cleanupAllMessages(ctx)

  // Additional cleanup for specific message types that might have been missed
  await deleteMessagesByType(ctx, 'menu')
  await deleteMessagesByType(ctx, 'submission_review')
  await deleteMessagesByType(ctx, 'submission_confirm')

  // Check if user exists by Telegram ID
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    include: {
      studentGroups: {
        where: { isActive: true },
        include: {
          group: {
            include: {
              ustaz: true,
              _count: { select: { students: true } }
            }
          }
        }
      },
      statistics: true,
    }
  })

  if (user) {
    // For students, get full menu info
    let menuInfo: StudentMenuInfo | undefined
    let ustazMenuInfo: UstazMenuInfo | undefined

    if (user.role === 'USTAZ') {
      // For ustaz, get groups and pending submission counts
      const groups = await prisma.group.findMany({
        where: { ustazId: user.id },
        select: { id: true, name: true, gender: true, _count: { select: { students: true } } }
      })

      const groupIds = groups.map(g => g.id)

      // Count pending memorization submissions
      const pendingMemorizationCount = await prisma.submission.count({
        where: {
          status: SubmissionStatus.PENDING,
          sentToUstazAt: { not: null },
          OR: [
            { task: { lesson: { groupId: { in: groupIds } } } },
            { task: { groupId: { in: groupIds } } }
          ]
        }
      })

      // Count pending revision submissions
      const pendingRevisionCount = await prisma.revisionSubmission.count({
        where: {
          status: SubmissionStatus.PENDING,
          student: {
            studentGroups: {
              some: { groupId: { in: groupIds } }
            }
          }
        }
      })

      // Count total students
      const totalStudents = groups.reduce((sum, g) => sum + g._count.students, 0)

      ustazMenuInfo = {
        groups: groups.map(g => ({
          id: g.id,
          name: g.name,
          gender: g.gender || undefined,
          studentCount: g._count.students
        })),
        totalStudents,
        pendingMemorizationCount,
        pendingRevisionCount
      }
    } else if (user.role === 'STUDENT') {
      // Build lesson types info from ALL student's groups
      const lessonTypes: LessonTypeInfo[] = []
      const primaryGroup = user.studentGroups[0]?.group

      for (const sg of user.studentGroups) {
        const group = sg.group

        // Get active task for this group
        const activeTask = await prisma.task.findFirst({
          where: {
            studentId: user.id,
            groupId: group.id,
            status: TaskStatus.IN_PROGRESS,
          },
          select: {
            currentCount: true,
            requiredCount: true,
            passedCount: true,
          }
        })

        // Count pending submissions for accurate progress
        let pendingCount = 0
        if (activeTask) {
          pendingCount = await prisma.submission.count({
            where: {
              task: {
                studentId: user.id,
                groupId: group.id,
                status: TaskStatus.IN_PROGRESS,
              },
              status: SubmissionStatus.PENDING,
            }
          })
        }

        lessonTypes.push({
          type: group.lessonType,
          groupId: group.id,
          groupName: group.name,
          groupLevel: group.level,
          currentPage: sg.currentPage,
          currentLine: sg.currentLine,
          currentStage: sg.currentStage,
          hasActiveTask: !!activeTask,
          taskProgress: activeTask ? {
            current: activeTask.currentCount,
            required: activeTask.requiredCount,
            passed: activeTask.passedCount,
            pending: pendingCount,
          } : undefined
        })
      }

      // Get any active task for legacy compatibility
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

      // Calculate rank in primary group
      let rankInGroup: number | undefined
      let totalInGroup: number | undefined

      if (primaryGroup) {
        totalInGroup = primaryGroup._count.students

        // Get all students in group sorted by progress
        const groupStudents = await prisma.studentGroup.findMany({
          where: {
            groupId: primaryGroup.id,
            isActive: true
          },
          include: {
            student: {
              select: { id: true, currentPage: true, currentLine: true }
            }
          }
        })

        const sortedStudents = groupStudents
          .map(sg => sg.student)
          .sort((a, b) => {
            if (b.currentPage !== a.currentPage) return b.currentPage - a.currentPage
            return b.currentLine - a.currentLine
          })

        rankInGroup = sortedStudents.findIndex(s => s.id === user.id) + 1
      }

      menuInfo = {
        hasActiveTask: !!activeTask,
        currentCount: activeTask?.currentCount,
        requiredCount: activeTask?.requiredCount,
        groupName: primaryGroup?.name,
        ustazName: primaryGroup?.ustaz?.firstName || undefined,
        ustazUsername: primaryGroup?.ustaz?.telegramUsername || undefined,
        ustazTelegramId: primaryGroup?.ustaz?.telegramId ? Number(primaryGroup.ustaz.telegramId) : undefined,
        rankInGroup,
        totalInGroup,
        totalTasksCompleted: user.statistics?.totalTasksCompleted,
        lessonTypes: lessonTypes.length > 0 ? lessonTypes : undefined,
      }
    }

    // User exists, show main menu
    const welcomeText = buildWelcomeMessage(user, menuInfo, ustazMenuInfo)

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
  studentGroups?: Array<{ group: { gender?: string } }>
}, menuInfo?: StudentMenuInfo, ustazMenuInfo?: UstazMenuInfo): string {
  const name = user.firstName || 'пользователь'

  // Get gender emoji from primary group
  const primaryGroupGender = user.studentGroups?.[0]?.group?.gender
  const genderEmoji = primaryGroupGender === 'FEMALE' ? '🧕' : '👨'

  let message = `<b>Ассаляму алейкум, ${name}!</b>\n\n`

  if (user.role === 'STUDENT') {
    message += `📖 <b>Главное меню</b>\n\n`

    // Show progress - either from groups (lessonTypes) or from user
    if (menuInfo?.lessonTypes && menuInfo.lessonTypes.length > 0) {
      message += `<b>📚 Мой прогресс:</b>\n`
      for (const lt of menuInfo.lessonTypes) {
        const typeName = getLessonTypeName(lt.type)
        const stageShort = lt.currentStage.replace('STAGE_', '').replace('_', '.')
        const levelStr = lt.groupLevel && lt.type === LessonType.MEMORIZATION
          ? ` (${getLinesForLevelName(lt.groupLevel)})`
          : ''

        // Get surah name for memorization
        let surahStr = ''
        if (lt.type === LessonType.MEMORIZATION && lt.currentPage) {
          const surah = getPrimarySurahByPage(lt.currentPage)
          if (surah) {
            surahStr = ` 📖 ${surah.nameArabic}`
          }
        }

        if (lt.hasActiveTask && lt.taskProgress) {
          const { passed, required, pending } = lt.taskProgress
          const remaining = required - passed - pending

          let statusStr: string
          if (passed >= required) {
            // All passed - task complete!
            statusStr = `✅ сдано!`
          } else if (remaining === 0 && pending > 0) {
            // All submitted, waiting for review
            statusStr = `⏳ ${passed}/${required}`
          } else {
            // In progress - show passed/required
            statusStr = `📝 ${passed}/${required}`
          }

          message += `${genderEmoji} ${typeName}${levelStr}: <b>стр. ${lt.currentPage}</b>, этап ${stageShort} ${statusStr}${surahStr}\n`
        } else {
          message += `${genderEmoji} ${typeName}${levelStr}: <b>стр. ${lt.currentPage}</b>, этап ${stageShort}${surahStr}\n`
        }
      }
      message += `\n`
    } else {
      const stageName = STAGES[user.currentStage as keyof typeof STAGES]?.nameRuFull || user.currentStage
      message += `📍 Текущий прогресс: <b>стр. ${user.currentPage}, строка ${user.currentLine}</b>\n`
      message += `📊 Этап: <b>${stageName}</b>\n\n`
    }

    // Ustaz info
    if (menuInfo?.ustazName) {
      message += `━━━━━━━━━━━━━━━━━━\n`
      if (menuInfo.groupName) {
        message += `${genderEmoji} Группа: <b>${menuInfo.groupName}</b>\n`
      }
      message += `👨‍🏫 Устаз: <b>${menuInfo.ustazName}</b>\n`
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

    if (ustazMenuInfo) {
      // Groups with gender emoji
      if (ustazMenuInfo.groups.length > 0) {
        message += `<b>📚 Группы:</b>\n`
        for (const g of ustazMenuInfo.groups) {
          const genderEmoji = g.gender === 'MALE' ? '👨' : '🧕'
          message += `• ${genderEmoji} ${g.name} (${g.studentCount} студ.)\n`
        }
        message += `\n`
      }

      message += `👥 Всего студентов: <b>${ustazMenuInfo.totalStudents}</b>\n\n`

      // Pending work
      message += `<b>📝 На проверку:</b>\n`
      message += `• Заучивание: <b>${ustazMenuInfo.pendingMemorizationCount}</b>\n`
      message += `• Повторение: <b>${ustazMenuInfo.pendingRevisionCount}</b>\n\n`
    }

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
