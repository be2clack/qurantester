import type { BotContext } from '../bot'
import { InlineKeyboard } from 'grammy'
import { prisma } from '@/lib/prisma'
import { TaskStatus, SubmissionStatus } from '@prisma/client'
import { sendAndTrack, cleanupAllMessages, deleteMessagesByType } from '../utils/message-cleaner'
import {
  getMainMenuKeyboard,
  getBackKeyboard,
  getStudentTaskKeyboard,
  getUstazSubmissionKeyboard,
  getPaginationKeyboard,
  getStartStageKeyboard,
  getActiveTaskKeyboard,
  StudentMenuInfo,
  LessonTypeInfo,
  getLessonTypeName,
} from '../keyboards/main-menu'
import { generateWebAuthLink } from '@/lib/auth'
import { STAGES, getLinesPerPage } from '@/lib/constants/quran'
import { StageNumber, GroupLevel, LessonType } from '@prisma/client'
import {
  getQuranPageContent,
  getGroupMushafSettings,
  getDefaultMushafSettings,
  formatQuranLinesForTelegram,
} from '../utils/quran-content'
import {
  handleRoleSelection,
  handleUstazSelection,
  handleUstazConfirm,
  handleBackToUstazList,
  handleBackToRole,
} from './registration'
import {
  startMufradatGame,
  handleMufradatAnswer,
  handleMufradatQuit,
  showMufradatGameMenu,
} from './mufradat-game'

/**
 * Handle all callback queries (menu navigation)
 */
export async function handleCallbackQuery(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data
  if (!data) return

  const telegramId = ctx.from?.id
  if (!telegramId) return

  // Find user
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) }
  })

  if (!user) {
    await ctx.answerCallbackQuery({ text: 'Сессия истекла. Используйте /start' })
    return
  }

  // Parse callback data
  const [category, action, id] = data.split(':')

  let callbackAnswered = false

  try {
    switch (category) {
      case 'admin':
        await handleAdminCallback(ctx, user, action, id)
        break
      case 'ustaz':
        await handleUstazCallback(ctx, user, action, id)
        break
      case 'student':
        await handleStudentCallback(ctx, user, action, id)
        break
      case 'parent':
        await handleParentCallback(ctx, user, action, id)
        break
      case 'task':
        await handleTaskCallback(ctx, user, action, id)
        break
      case 'review':
        // Review handler answers callback itself
        await handleReviewCallback(ctx, user, action, id)
        callbackAnswered = true
        break
      case 'auth':
        await handleAuthCallback(ctx, user, action)
        break
      case 'reg':
        // Registration callbacks - handle role/group selection
        await handleRegistrationCallback(ctx, action, id)
        callbackAnswered = true
        break
      case 'lesson_type':
        // Lesson type selection for students with multi-group
        await handleLessonTypeCallback(ctx, user, action, id)
        break
      case 'start_group_task':
        // Start task for specific group
        await startGroupTask(ctx, user, action)
        break
      case 'cancel':
        await handleCancel(ctx, user)
        break
      case 'mufradat':
        // Mufradat game callbacks
        await handleMufradatCallback(ctx, user, action, id)
        break
      case 'noop':
        // Do nothing, just answer callback
        break
      default:
        await ctx.answerCallbackQuery({ text: 'Неизвестное действие' })
        callbackAnswered = true
    }
  } catch (error: any) {
    // Ignore "message not modified" errors
    if (error?.description?.includes('message is not modified')) {
      // Message is already the same, just answer callback
    } else {
      console.error('Callback error:', error)
      if (!callbackAnswered) {
        await ctx.answerCallbackQuery({ text: 'Произошла ошибка' })
      }
      return
    }
  }

  if (!callbackAnswered) {
    await ctx.answerCallbackQuery()
  }
}

// ============== STUDENT HANDLERS ==============

async function handleStudentCallback(
  ctx: BotContext,
  user: any,
  action: string,
  id?: string
): Promise<void> {
  switch (action) {
    case 'menu':
      await showStudentMenuEdit(ctx, user)
      break
    case 'current_task':
      await showCurrentTask(ctx, user)
      break
    case 'start_stage':
      await startStage(ctx, user)
      break
    case 'tasks':
      await showTaskHistory(ctx, user)
      break
    case 'progress':
      await showProgress(ctx, user)
      break
    case 'group':
    case 'groups':
      await showStudentGroups(ctx, user)
      break
    case 'quran':
      await showQuranPage(ctx, user, user.currentPage)
      break
    default:
      await showStudentMenuEdit(ctx, user)
  }
}

async function showStudentMenuEdit(ctx: BotContext, user: any): Promise<void> {
  // Fetch full user data with ALL groups and statistics
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
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

  if (!fullUser) return

  // Build lesson types info from student's groups
  const lessonTypes: LessonTypeInfo[] = []
  const primaryGroup = fullUser.studentGroups[0]?.group

  for (const sg of fullUser.studentGroups) {
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
      }
    })

    lessonTypes.push({
      type: group.lessonType,
      groupId: group.id,
      groupName: group.name,
      currentPage: sg.currentPage,
      currentLine: sg.currentLine,
      currentStage: sg.currentStage,
      hasActiveTask: !!activeTask,
      taskProgress: activeTask ? {
        current: activeTask.currentCount,
        required: activeTask.requiredCount
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

    const groupStudents = await prisma.studentGroup.findMany({
      where: { groupId: primaryGroup.id, isActive: true },
      select: {
        studentId: true,
        student: { select: { currentPage: true, currentLine: true } }
      }
    })

    const sorted = groupStudents.sort((a, b) => {
      if (b.student.currentPage !== a.student.currentPage) return b.student.currentPage - a.student.currentPage
      return b.student.currentLine - a.student.currentLine
    })

    rankInGroup = sorted.findIndex(s => s.studentId === user.id) + 1
  }

  const menuInfo: StudentMenuInfo = {
    hasActiveTask: !!activeTask,
    currentCount: activeTask?.currentCount,
    requiredCount: activeTask?.requiredCount,
    groupName: primaryGroup?.name,
    ustazName: primaryGroup?.ustaz?.firstName || undefined,
    ustazUsername: primaryGroup?.ustaz?.telegramUsername || undefined,
    ustazTelegramId: primaryGroup?.ustaz?.telegramId ? Number(primaryGroup.ustaz.telegramId) : undefined,
    rankInGroup,
    totalInGroup,
    totalTasksCompleted: fullUser.statistics?.totalTasksCompleted,
    lessonTypes: lessonTypes.length > 0 ? lessonTypes : undefined,
  }

  const stageName = STAGES[fullUser.currentStage as keyof typeof STAGES]?.nameRu || fullUser.currentStage

  let message = `<b>Ассаляму алейкум, ${fullUser.firstName || 'пользователь'}!</b>\n\n`
  message += `📖 <b>Главное меню</b>\n\n`

  // Show progress - either from groups or from user
  if (lessonTypes.length > 0) {
    message += `<b>📚 Мои уроки:</b>\n`
    for (const lt of lessonTypes) {
      const typeName = getLessonTypeName(lt.type)
      const stageShort = lt.currentStage.replace('STAGE_', '').replace('_', '.')
      if (lt.hasActiveTask && lt.taskProgress) {
        message += `• ${typeName}: стр. ${lt.currentPage}, этап ${stageShort} [${lt.taskProgress.current}/${lt.taskProgress.required}]\n`
      } else {
        message += `• ${typeName}: стр. ${lt.currentPage}, этап ${stageShort}\n`
      }
    }
    message += `\n`
  } else {
    message += `📍 Текущий прогресс: <b>стр. ${fullUser.currentPage}, строка ${fullUser.currentLine}</b>\n`
    message += `📊 Этап: <b>${stageName}</b>\n\n`
  }

  // Ustaz info
  if (menuInfo.ustazName) {
    message += `━━━━━━━━━━━━━━━━━━\n`
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

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: getMainMenuKeyboard(fullUser.role, menuInfo)
    })
  } catch (error: any) {
    // If can't edit, delete and send new
    if (error?.description?.includes("can't be edited") ||
        error?.description?.includes('message to edit not found')) {
      try {
        await ctx.deleteMessage()
      } catch (e) {
        // Ignore if can't delete
      }
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(fullUser.role, menuInfo)
      })
    } else {
      throw error
    }
  }
}

async function showStudentMenu(ctx: BotContext, user: any): Promise<void> {
  await cleanupAllMessages(ctx)

  // Fetch full user data with group and statistics
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
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
        },
        take: 1
      },
      statistics: true,
    }
  })

  if (!fullUser) return

  // Get active task info
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
  const primaryGroup = fullUser.studentGroups[0]?.group

  if (primaryGroup) {
    totalInGroup = primaryGroup._count.students

    const groupStudents = await prisma.studentGroup.findMany({
      where: { groupId: primaryGroup.id, isActive: true },
      select: {
        studentId: true,
        student: { select: { currentPage: true, currentLine: true } }
      }
    })

    const sorted = groupStudents.sort((a, b) => {
      if (b.student.currentPage !== a.student.currentPage) return b.student.currentPage - a.student.currentPage
      return b.student.currentLine - a.student.currentLine
    })

    rankInGroup = sorted.findIndex(s => s.studentId === user.id) + 1
  }

  const menuInfo: StudentMenuInfo = {
    hasActiveTask: !!activeTask,
    currentCount: activeTask?.currentCount,
    requiredCount: activeTask?.requiredCount,
    groupName: primaryGroup?.name,
    ustazName: primaryGroup?.ustaz?.firstName || undefined,
    ustazUsername: primaryGroup?.ustaz?.telegramUsername || undefined,
    ustazTelegramId: primaryGroup?.ustaz?.telegramId ? Number(primaryGroup.ustaz.telegramId) : undefined,
    rankInGroup,
    totalInGroup,
    totalTasksCompleted: fullUser.statistics?.totalTasksCompleted,
  }

  const stageName = STAGES[fullUser.currentStage as keyof typeof STAGES]?.nameRu || fullUser.currentStage

  let message = `<b>Ассаляму алейкум, ${fullUser.firstName || 'пользователь'}!</b>\n\n`
  message += `📖 <b>Главное меню</b>\n\n`
  message += `📍 Текущий прогресс: <b>стр. ${fullUser.currentPage}, строка ${fullUser.currentLine}</b>\n`
  message += `📊 Этап: <b>${stageName}</b>\n\n`

  // Group and ustaz info
  if (menuInfo.groupName) {
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

  await sendAndTrack(
    ctx,
    message,
    {
      reply_markup: getMainMenuKeyboard(fullUser.role, menuInfo),
      parse_mode: 'HTML'
    },
    fullUser.id,
    'menu'
  )
}

async function showCurrentTask(ctx: BotContext, user: any): Promise<void> {
  const task = await prisma.task.findFirst({
    where: {
      studentId: user.id,
      status: TaskStatus.IN_PROGRESS,
    },
    include: {
      page: true,
      lesson: true,
      group: true,
    }
  })

  if (!task) {
    // No active task - show option to start stage
    const stageName = STAGES[user.currentStage as keyof typeof STAGES]?.nameRu || user.currentStage

    const message = `▶️ <b>Начать задание</b>\n\n` +
      `📍 Текущий прогресс: <b>стр. ${user.currentPage}, строка ${user.currentLine}</b>\n` +
      `📊 Этап: <b>${stageName}</b>\n\n` +
      `Нажмите кнопку ниже, чтобы начать изучение.`

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: getStartStageKeyboard()
    })
    return
  }

  const lineRange = task.startLine === task.endLine
    ? `строка ${task.startLine}`
    : `строки ${task.startLine}-${task.endLine}`

  const progressPercent = ((task.currentCount / task.requiredCount) * 100).toFixed(0)
  const progressBar = buildProgressBar(parseInt(progressPercent))
  const remaining = task.requiredCount - task.currentCount

  // Calculate deadline
  const now = new Date()
  const deadline = new Date(task.deadline)
  const timeLeft = deadline.getTime() - now.getTime()
  const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)))
  const minutesLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)))
  const deadlineTimeStr = deadline.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bishkek'
  })
  const deadlineDateStr = deadline.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Bishkek'
  })
  const deadlineStr = timeLeft > 0
    ? `⏰ До <b>${deadlineDateStr} ${deadlineTimeStr}</b> (<b>${hoursLeft}ч ${minutesLeft}м</b>)`
    : `⚠️ <b>Срок истёк!</b>`

  // Build format hint - use group settings (primary) or lesson settings (fallback)
  const settings = task.group || task.lesson
  let formatHint = ''
  if (settings) {
    if (settings.allowVoice && settings.allowVideoNote) {
      formatHint = '🎤 голос или 📹 кружок'
    } else if (settings.allowVoice) {
      formatHint = '🎤 голосовое сообщение'
    } else if (settings.allowVideoNote) {
      formatHint = '📹 видео-кружок'
    } else if (settings.allowText) {
      formatHint = '📝 текст'
    }
  } else {
    formatHint = '🎤 голос или 📹 кружок' // default
  }

  let message = `📝 <b>Текущее задание</b>\n\n`
  message += `📖 Страница ${task.page.pageNumber}, ${lineRange}\n`
  message += `📚 ${STAGES[task.stage as keyof typeof STAGES]?.nameRu || task.stage}\n\n`
  message += `${progressBar}\n`
  message += `📊 Отправлено: <b>${task.currentCount}/${task.requiredCount}</b>\n`
  message += `⏳ Осталось: <b>${remaining}</b>\n`

  if (task.passedCount > 0 || task.failedCount > 0) {
    message += `✅ Принято: <b>${task.passedCount}</b>\n`
    message += `❌ На пересдачу: <b>${task.failedCount}</b>\n`
  }

  message += `\n${deadlineStr}\n\n`
  message += `📤 Принимается: ${formatHint}\n\n`
  message += `<i>Отправьте запись чтения.</i>`

  // Check if there's a pending submission for cancel button
  const hasPending = await prisma.submission.findFirst({
    where: {
      taskId: task.id,
      studentId: user.id,
      status: SubmissionStatus.PENDING,
    }
  })

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getActiveTaskKeyboard(task.id, !!hasPending)
  })
}

/**
 * Start studying current stage - auto-create task
 */
async function startStage(ctx: BotContext, user: any): Promise<void> {
  // Check if user already has an active task
  const existingTask = await prisma.task.findFirst({
    where: {
      studentId: user.id,
      status: TaskStatus.IN_PROGRESS,
    }
  })

  if (existingTask) {
    await ctx.answerCallbackQuery({ text: 'У вас уже есть активное задание!' })
    await showCurrentTask(ctx, user)
    return
  }

  // Get user with group info
  const userWithGroup = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      studentGroups: {
        where: { isActive: true },
        include: {
          group: {
            include: {
              lessons: {
                where: { isActive: true },
                take: 1
              }
            }
          }
        },
        take: 1
      }
    }
  })

  const primaryStudentGroup = userWithGroup?.studentGroups[0]
  if (!primaryStudentGroup) {
    await ctx.editMessageText(
      '❌ <b>Ошибка</b>\n\nВы не состоите в группе.\n\n<i>Обратитесь к администратору.</i>',
      { parse_mode: 'HTML', reply_markup: getBackKeyboard('student:menu', '◀️ В меню') }
    )
    return
  }

  const lesson = primaryStudentGroup.group.lessons[0]
  if (!lesson) {
    await ctx.editMessageText(
      '❌ <b>Ошибка</b>\n\nВ вашей группе нет активного урока.\n\n<i>Обратитесь к устазу.</i>',
      { parse_mode: 'HTML', reply_markup: getBackKeyboard('student:menu', '◀️ В меню') }
    )
    return
  }

  // Find or create the QuranPage
  let page = await prisma.quranPage.findUnique({
    where: { pageNumber: user.currentPage }
  })

  if (!page) {
    page = await prisma.quranPage.create({
      data: {
        pageNumber: user.currentPage,
        totalLines: getLinesPerPage(user.currentPage)
      }
    })
  }

  // Calculate line range based on stage
  const { startLine, endLine } = getLineRangeForStage(
    user.currentStage as StageNumber,
    user.currentPage,
    primaryStudentGroup.group.level as GroupLevel
  )

  // Calculate deadline based on stage and group level
  const stageDays = getStageDays(user.currentStage as StageNumber, lesson)
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + stageDays)

  // Create the task
  const task = await prisma.task.create({
    data: {
      lessonId: lesson.id,
      studentId: user.id,
      pageId: page.id,
      startLine,
      endLine,
      stage: user.currentStage,
      status: TaskStatus.IN_PROGRESS,
      requiredCount: lesson.repetitionCount,
      deadline,
    },
    include: {
      page: true,
      lesson: true,
    }
  })

  // Create statistics record if not exists
  await prisma.userStatistics.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {}
  })

  const stageName = STAGES[user.currentStage as keyof typeof STAGES]?.nameRu || user.currentStage
  const lineRange = startLine === endLine
    ? `строку ${startLine}`
    : `строки ${startLine}-${endLine}`

  // Build format hint
  let formatHint = ''
  if (lesson.allowVoice && lesson.allowVideoNote) {
    formatHint = '🎤 голосовое сообщение или 📹 видео-кружок'
  } else if (lesson.allowVoice) {
    formatHint = '🎤 голосовое сообщение'
  } else if (lesson.allowVideoNote) {
    formatHint = '📹 видео-кружок'
  } else if (lesson.allowText) {
    formatHint = '📝 текстовое сообщение'
  }

  let message = `✅ <b>Задание создано!</b>\n\n`
  message += `📖 Страница ${page.pageNumber}, ${lineRange}\n`
  message += `📚 ${stageName}\n\n`
  message += `📊 Нужно сдать: <b>${lesson.repetitionCount} раз</b>\n`
  message += `⏰ Срок: <b>${stageDays} дней</b>\n\n`
  message += `📤 Отправьте ${formatHint}.`

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getActiveTaskKeyboard(task.id, false)
  })
}

/**
 * Get line range for a stage
 */
function getLineRangeForStage(
  stage: StageNumber,
  pageNumber: number,
  groupLevel: GroupLevel
): { startLine: number; endLine: number } {
  const totalLines = getLinesPerPage(pageNumber)

  // For pages with <= 7 lines, use all lines for all stages
  if (totalLines <= 7) {
    return { startLine: 1, endLine: totalLines }
  }

  // Standard 15-line pages
  switch (stage) {
    case StageNumber.STAGE_1_1:
    case StageNumber.STAGE_1_2:
      // Lines 1-7
      return { startLine: 1, endLine: 7 }

    case StageNumber.STAGE_2_1:
    case StageNumber.STAGE_2_2:
      // Lines 8-15
      return { startLine: 8, endLine: totalLines }

    case StageNumber.STAGE_3:
      // All lines
      return { startLine: 1, endLine: totalLines }

    default:
      return { startLine: 1, endLine: totalLines }
  }
}

/**
 * Get days for a stage from lesson settings
 */
function getStageDays(stage: StageNumber, lesson: any): number {
  switch (stage) {
    case StageNumber.STAGE_1_1:
    case StageNumber.STAGE_1_2:
      return lesson.stage1Days || 1

    case StageNumber.STAGE_2_1:
    case StageNumber.STAGE_2_2:
      return lesson.stage2Days || 2

    case StageNumber.STAGE_3:
      return lesson.stage3Days || 2

    default:
      return 1
  }
}

async function showTaskHistory(ctx: BotContext, user: any): Promise<void> {
  const tasks = await prisma.task.findMany({
    where: { studentId: user.id },
    include: { page: true },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  if (tasks.length === 0) {
    await ctx.editMessageText(
      '📋 <b>История заданий</b>\n\n<i>История заданий пуста.</i>',
      { parse_mode: 'HTML', reply_markup: getBackKeyboard('student:menu', '◀️ В меню') }
    )
    return
  }

  let message = '<b>📋 История заданий</b>\n\n'

  for (const task of tasks) {
    const status = getTaskStatusEmoji(task.status)
    const lineRange = task.startLine === task.endLine
      ? `стр. ${task.startLine}`
      : `стр. ${task.startLine}-${task.endLine}`

    message += `${status} ${task.page.pageNumber}-${lineRange} (${task.passedCount}/${task.requiredCount})\n`
  }

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('student:menu', '◀️ В меню')
  })
}

async function showProgress(ctx: BotContext, user: any): Promise<void> {
  const stats = await prisma.userStatistics.findUnique({
    where: { userId: user.id }
  })

  const totalPages = 602
  const completedPages = user.currentPage - 1
  const progressPercent = ((completedPages / totalPages) * 100).toFixed(2)

  let message = `<b>📈 Мой прогресс</b>\n\n`
  message += `📖 Текущая позиция: <b>стр. ${user.currentPage}, строка ${user.currentLine}</b>\n`
  message += `📊 Пройдено страниц: ${completedPages} из ${totalPages} (${progressPercent}%)\n\n`

  if (stats) {
    message += `✅ Заданий выполнено: ${stats.totalTasksCompleted}\n`
    message += `❌ Заданий не сдано: ${stats.totalTasksFailed}\n\n`

    const weekTrend = stats.thisWeekProgress - stats.lastWeekProgress
    const trendEmoji = weekTrend > 0 ? '📈' : weekTrend < 0 ? '📉' : '➡️'
    message += `${trendEmoji} Эта неделя: ${stats.thisWeekProgress} (${weekTrend >= 0 ? '+' : ''}${weekTrend})\n`

    if (stats.globalRank) {
      message += `🏆 Рейтинг: #${stats.globalRank}\n`
    }
  }

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('student:menu', '◀️ В меню')
  })
}

async function showStudentGroups(ctx: BotContext, user: any): Promise<void> {
  // Get user with ALL groups
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
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
      }
    }
  })

  const studentGroups = fullUser?.studentGroups || []
  if (studentGroups.length === 0) {
    await ctx.editMessageText(
      '📚 <b>Мои группы</b>\n\n<i>Вы не состоите ни в одной группе.</i>',
      { parse_mode: 'HTML', reply_markup: getBackKeyboard('student:menu', '◀️ В меню') }
    )
    return
  }

  let message = `📚 <b>Мои группы</b>\n\n`

  for (const sg of studentGroups) {
    const group = sg.group
    const typeName = getLessonTypeName(group.lessonType)
    const stageShort = sg.currentStage.replace('STAGE_', '').replace('_', '.')

    message += `<b>${typeName}</b> — ${group.name}\n`
    message += `   📍 Стр. ${sg.currentPage}, этап ${stageShort}\n`
    message += `   👨‍🏫 ${group.ustaz?.firstName || 'Устаз не назначен'}\n`
    message += `   👥 ${group._count.students} студентов\n\n`
  }

  // Add ustaz chat button if available (from first group)
  const keyboard = new InlineKeyboard()
  const firstGroup = studentGroups[0]?.group
  if (firstGroup?.ustaz?.telegramUsername) {
    keyboard.url(`💬 Написать устазу`, `https://t.me/${firstGroup.ustaz.telegramUsername}`).row()
  }
  keyboard.text('◀️ В меню', 'student:menu')

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  })
}

/**
 * Handle lesson type callback - show/start task for specific lesson type
 */
async function handleLessonTypeCallback(
  ctx: BotContext,
  user: any,
  lessonType: string,
  groupId?: string
): Promise<void> {
  if (!groupId) {
    await ctx.answerCallbackQuery({ text: 'Группа не найдена' })
    return
  }

  // Check if user belongs to this group
  const studentGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      groupId,
      isActive: true
    },
    include: {
      group: {
        include: {
          ustaz: true
        }
      }
    }
  })

  if (!studentGroup) {
    await ctx.answerCallbackQuery({ text: 'Вы не состоите в этой группе' })
    return
  }

  // For TRANSLATION lesson type, show mufradat game instead of regular task flow
  if (studentGroup.group.lessonType === LessonType.TRANSLATION) {
    await showMufradatGameMenu(ctx, user, studentGroup)
    return
  }

  // Check for active task in this group
  const activeTask = await prisma.task.findFirst({
    where: {
      studentId: user.id,
      groupId,
      status: TaskStatus.IN_PROGRESS,
    },
    include: {
      page: true,
      group: true,
    }
  })

  if (activeTask) {
    // Show active task for this lesson type
    await showTaskForGroup(ctx, user, activeTask, studentGroup)
  } else {
    // Show option to start new task
    await showStartTaskForGroup(ctx, user, studentGroup)
  }
}

/**
 * Show active task for a specific group
 */
async function showTaskForGroup(ctx: BotContext, user: any, task: any, studentGroup: any): Promise<void> {
  const group = studentGroup.group
  const typeName = getLessonTypeName(group.lessonType)

  const lineRange = task.startLine === task.endLine
    ? `строка ${task.startLine}`
    : `строки ${task.startLine}-${task.endLine}`

  const progressPercent = ((task.currentCount / task.requiredCount) * 100).toFixed(0)
  const progressBar = buildProgressBar(parseInt(progressPercent))
  const remaining = task.requiredCount - task.currentCount

  // Calculate deadline
  const now = new Date()
  const deadline = new Date(task.deadline)
  const timeLeft = deadline.getTime() - now.getTime()
  const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)))
  const minutesLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)))
  const deadlineTimeStr = deadline.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bishkek'
  })
  const deadlineDateStr = deadline.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Bishkek'
  })
  const deadlineStr = timeLeft > 0
    ? `⏰ До <b>${deadlineDateStr} ${deadlineTimeStr}</b> (<b>${hoursLeft}ч ${minutesLeft}м</b>)`
    : `⚠️ <b>Срок истёк!</b>`

  // Build format hint
  let formatHint = ''
  if (group.allowVoice && group.allowVideoNote) {
    formatHint = '🎤 голос или 📹 кружок'
  } else if (group.allowVoice) {
    formatHint = '🎤 голосовое сообщение'
  } else if (group.allowVideoNote) {
    formatHint = '📹 видео-кружок'
  } else if (group.allowText) {
    formatHint = '📝 текст'
  } else {
    formatHint = '🎤 голос или 📹 кружок'
  }

  let message = `📝 <b>${typeName}</b>\n\n`
  message += `📖 Страница ${task.page.pageNumber}, ${lineRange}\n`
  message += `📚 ${STAGES[task.stage as keyof typeof STAGES]?.nameRu || task.stage}\n\n`
  message += `${progressBar}\n`
  message += `📊 Отправлено: <b>${task.currentCount}/${task.requiredCount}</b>\n`
  message += `⏳ Осталось: <b>${remaining}</b>\n`

  if (task.passedCount > 0 || task.failedCount > 0) {
    message += `✅ Принято: <b>${task.passedCount}</b>\n`
    message += `❌ На пересдачу: <b>${task.failedCount}</b>\n`
  }

  message += `\n${deadlineStr}\n\n`
  message += `📤 Принимается: ${formatHint}\n\n`
  message += `<i>Отправьте запись чтения.</i>`

  // Check if there's a pending submission for cancel button
  const hasPending = await prisma.submission.findFirst({
    where: {
      taskId: task.id,
      studentId: user.id,
      status: SubmissionStatus.PENDING,
    }
  })

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getActiveTaskKeyboard(task.id, !!hasPending)
  })
}

/**
 * Show start task option for a specific group
 */
async function showStartTaskForGroup(ctx: BotContext, user: any, studentGroup: any): Promise<void> {
  const group = studentGroup.group
  const typeName = getLessonTypeName(group.lessonType)
  const stageName = STAGES[studentGroup.currentStage as keyof typeof STAGES]?.nameRu || studentGroup.currentStage

  const message = `▶️ <b>Начать ${typeName}</b>\n\n` +
    `📍 Текущий прогресс: <b>стр. ${studentGroup.currentPage}, строка ${studentGroup.currentLine}</b>\n` +
    `📊 Этап: <b>${stageName}</b>\n\n` +
    `Нажмите кнопку ниже, чтобы начать изучение.`

  const keyboard = new InlineKeyboard()
    .text('▶️ Начать изучать этап', `start_group_task:${group.id}`).row()
    .text('◀️ В меню', 'student:menu')

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  })
}

/**
 * Start task for a specific group
 */
async function startGroupTask(ctx: BotContext, user: any, groupId: string): Promise<void> {
  // Get student's membership in this group
  const studentGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      groupId,
      isActive: true
    },
    include: {
      group: true
    }
  })

  if (!studentGroup) {
    await ctx.answerCallbackQuery({ text: 'Вы не состоите в этой группе', show_alert: true })
    return
  }

  // Check if user already has an active task in this group
  const existingTask = await prisma.task.findFirst({
    where: {
      studentId: user.id,
      groupId,
      status: TaskStatus.IN_PROGRESS,
    }
  })

  if (existingTask) {
    await ctx.answerCallbackQuery({ text: 'У вас уже есть активное задание!' })
    return
  }

  const group = studentGroup.group

  // Find or create the QuranPage
  let page = await prisma.quranPage.findUnique({
    where: { pageNumber: studentGroup.currentPage }
  })

  if (!page) {
    page = await prisma.quranPage.create({
      data: {
        pageNumber: studentGroup.currentPage,
        totalLines: getLinesPerPage(studentGroup.currentPage)
      }
    })
  }

  // Calculate line range based on stage
  const { startLine, endLine } = getLineRangeForStage(
    studentGroup.currentStage as StageNumber,
    studentGroup.currentPage,
    group.level as GroupLevel
  )

  // Calculate deadline based on stage and group settings
  const stageDays = getStageDaysFromGroup(studentGroup.currentStage as StageNumber, group)
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + stageDays)

  // Create the task
  const task = await prisma.task.create({
    data: {
      groupId: group.id,
      studentId: user.id,
      pageId: page.id,
      startLine,
      endLine,
      stage: studentGroup.currentStage,
      status: TaskStatus.IN_PROGRESS,
      requiredCount: group.repetitionCount,
      deadline,
    },
    include: {
      page: true,
      group: true,
    }
  })

  // Create statistics record if not exists
  await prisma.userStatistics.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {}
  })

  const typeName = getLessonTypeName(group.lessonType)
  const stageName = STAGES[studentGroup.currentStage as keyof typeof STAGES]?.nameRu || studentGroup.currentStage
  const lineRange = startLine === endLine
    ? `строку ${startLine}`
    : `строки ${startLine}-${endLine}`

  // Build format hint
  let formatHint = ''
  if (group.allowVoice && group.allowVideoNote) {
    formatHint = '🎤 голосовое сообщение или 📹 видео-кружок'
  } else if (group.allowVoice) {
    formatHint = '🎤 голосовое сообщение'
  } else if (group.allowVideoNote) {
    formatHint = '📹 видео-кружок'
  } else if (group.allowText) {
    formatHint = '📝 текстовое сообщение'
  } else {
    formatHint = '🎤 голосовое сообщение или 📹 видео-кружок'
  }

  let message = `✅ <b>Задание создано!</b>\n\n`
  message += `📖 <b>${typeName}</b>\n\n`
  message += `📄 Страница ${page.pageNumber}, ${lineRange}\n`
  message += `📚 ${stageName}\n\n`
  message += `📊 Нужно сдать: <b>${group.repetitionCount} раз</b>\n`
  message += `⏰ Срок: <b>${stageDays} дней</b>\n\n`
  message += `📤 Отправьте ${formatHint}.`

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getActiveTaskKeyboard(task.id, false)
  })
}

/**
 * Get days for a stage from group settings
 */
function getStageDaysFromGroup(stage: StageNumber, group: any): number {
  switch (stage) {
    case StageNumber.STAGE_1_1:
    case StageNumber.STAGE_1_2:
      return group.stage1Days || 1

    case StageNumber.STAGE_2_1:
    case StageNumber.STAGE_2_2:
      return group.stage2Days || 2

    case StageNumber.STAGE_3:
      return group.stage3Days || 2

    default:
      return 1
  }
}

async function showQuranPage(ctx: BotContext, user: any, pageNumber: number): Promise<void> {
  // Get mushaf settings based on user's first active group
  const studentGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      isActive: true
    },
    select: { groupId: true }
  })

  const settings = studentGroup?.groupId
    ? await getGroupMushafSettings(studentGroup.groupId)
    : getDefaultMushafSettings()

  // Fetch page content (from local DB or Medina API based on settings)
  const pageContent = await getQuranPageContent(pageNumber, settings)

  if (!pageContent) {
    await ctx.editMessageText(
      '📖 <b>Коран</b>\n\n<i>Страница не найдена.</i>',
      { parse_mode: 'HTML', reply_markup: getBackKeyboard('student:menu', '◀️ В меню') }
    )
    return
  }

  const mushafLabel = settings.mushafType === 'MEDINA_API' ? ' (Мединский)' : ''
  let message = `<b>📖 Страница ${pageNumber}${mushafLabel}</b>\n\n`
  message += `📄 Строк: ${pageContent.totalLines}\n\n`

  // Format and show first 5 lines
  const linesToShow = pageContent.lines.slice(0, 5)
  message += formatQuranLinesForTelegram(linesToShow, {
    showLineNumbers: true,
    showTranslation: settings.showTranslation
  })

  if (pageContent.lines.length > 5) {
    message += `\n\n<i>...и ещё ${pageContent.lines.length - 5} строк</i>`
  }

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('student:menu', '◀️ В меню')
  })
}

// ============== USTAZ HANDLERS ==============

async function handleUstazCallback(
  ctx: BotContext,
  user: any,
  action: string,
  id?: string
): Promise<void> {
  switch (action) {
    case 'menu':
      await showUstazMenuEdit(ctx, user)
      break
    case 'submissions':
      await showPendingSubmissions(ctx, user)
      break
    case 'next_submission':
      await showNextSubmission(ctx, user)
      break
    case 'groups':
      await showUstazGroups(ctx, user)
      break
    case 'students':
      await showUstazStudents(ctx, user)
      break
    case 'stats':
      await showUstazStats(ctx, user)
      break
    default:
      await showUstazMenuEdit(ctx, user)
  }
}

async function showUstazMenuEdit(ctx: BotContext, user: any): Promise<void> {
  const groups = await prisma.group.findMany({
    where: { ustazId: user.id },
    select: { id: true }
  })

  const groupIds = groups.map(g => g.id)

  const pendingCount = await prisma.submission.count({
    where: {
      status: SubmissionStatus.PENDING,
      sentToUstazAt: { not: null }, // Only count submissions that were sent to ustaz
      OR: [
        { task: { lesson: { groupId: { in: groupIds } } } },
        { task: { groupId: { in: groupIds } } }
      ]
    }
  })

  const message = `<b>👨‍🏫 Панель устаза</b>\n\n` +
    `📚 Групп: ${groups.length}\n` +
    `📝 Работ на проверку: <b>${pendingCount}</b>\n\n` +
    `Выберите действие:`

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: getMainMenuKeyboard(user.role)
    })
  } catch (error: any) {
    // If can't edit (e.g., voice message), delete and send new
    if (error?.description?.includes("can't be edited") ||
        error?.description?.includes('message to edit not found')) {
      try {
        await ctx.deleteMessage()
      } catch (e) {
        // Ignore if can't delete
      }
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(user.role)
      })
    } else {
      throw error // Re-throw other errors
    }
  }
}

async function showUstazMenu(ctx: BotContext, user: any): Promise<void> {
  await cleanupAllMessages(ctx)

  // Count pending submissions
  const groups = await prisma.group.findMany({
    where: { ustazId: user.id },
    select: { id: true }
  })

  const groupIds = groups.map(g => g.id)

  const pendingCount = await prisma.submission.count({
    where: {
      status: SubmissionStatus.PENDING,
      sentToUstazAt: { not: null }, // Only count submissions that were sent to ustaz
      OR: [
        { task: { lesson: { groupId: { in: groupIds } } } },
        { task: { groupId: { in: groupIds } } }
      ]
    }
  })

  const message = `<b>Панель устаза</b>\n\n` +
    `Групп: ${groups.length}\n` +
    `Работ на проверку: <b>${pendingCount}</b>\n\n` +
    `Выберите действие:`

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

async function showPendingSubmissions(ctx: BotContext, user: any): Promise<void> {
  // Get ustaz's groups
  const groups = await prisma.group.findMany({
    where: { ustazId: user.id },
    select: { id: true }
  })

  const groupIds = groups.map(g => g.id)

  // Get pending submissions - check both lesson.groupId and task.groupId
  // Only show submissions that were actually sent to ustaz (confirmed by student)
  const submissions = await prisma.submission.findMany({
    where: {
      status: SubmissionStatus.PENDING,
      sentToUstazAt: { not: null }, // Only show confirmed submissions
      OR: [
        {
          task: {
            lesson: {
              groupId: { in: groupIds }
            }
          }
        },
        {
          task: {
            groupId: { in: groupIds }
          }
        }
      ]
    },
    include: {
      student: {
        include: {
          studentGroups: {
            where: { isActive: true },
            include: {
              group: {
                select: { name: true }
              }
            },
            take: 1
          }
        }
      },
      task: {
        include: {
          page: true,
          group: true
        }
      }
    },
    orderBy: { createdAt: 'asc' },
    take: 10
  })

  if (submissions.length === 0) {
    await ctx.editMessageText(
      '📝 <b>Работы на проверку</b>\n\n<i>✅ Все работы проверены!</i>',
      {
        parse_mode: 'HTML',
        reply_markup: getBackKeyboard('ustaz:menu', '◀️ В меню')
      }
    )
    return
  }

  // Show first submission with file and buttons together
  const first = submissions[0]
  const studentName = first.student.firstName || 'Студент'
  const groupName = first.student.studentGroups[0]?.group?.name || first.task.group?.name || ''

  const lineRange = first.task.startLine === first.task.endLine
    ? `строка ${first.task.startLine}`
    : `строки ${first.task.startLine}-${first.task.endLine}`

  // Get stage name
  const stageNames: Record<string, string> = {
    STAGE_1_1: 'Этап 1.1',
    STAGE_1_2: 'Этап 1.2',
    STAGE_2_1: 'Этап 2.1',
    STAGE_2_2: 'Этап 2.2',
    STAGE_3: 'Этап 3',
  }
  const stageName = stageNames[first.task.stage] || first.task.stage

  // Calculate progress
  const progressPercent = Math.round((first.task.currentCount / first.task.requiredCount) * 100)
  const progressBar = `[${'▓'.repeat(Math.round(progressPercent / 10))}${'░'.repeat(10 - Math.round(progressPercent / 10))}]`

  let caption = `📝 <b>Работа 1/${submissions.length}</b>\n\n`
  if (groupName) caption += `📚 <b>${groupName}</b>\n`
  caption += `👤 ${studentName}\n`
  caption += `📖 Стр. ${first.task.page.pageNumber}, ${lineRange}\n`
  caption += `🎯 ${stageName}\n\n`
  caption += `${progressBar} ${progressPercent}%\n`
  caption += `📊 <b>${first.task.currentCount}/${first.task.requiredCount}</b>`

  // Add passed/failed counts if any
  if (first.task.passedCount > 0 || first.task.failedCount > 0) {
    caption += `\n✅ ${first.task.passedCount}`
    if (first.task.failedCount > 0) {
      caption += ` | ❌ ${first.task.failedCount}`
    }
  }

  // Add AI score if available
  if (first.aiScore !== null && first.aiScore !== undefined) {
    const scoreEmoji = first.aiScore >= 85 ? '🟢' : first.aiScore >= 50 ? '🟡' : '🔴'
    caption += `\n\n${scoreEmoji} <b>AI: ${Math.round(first.aiScore)}%</b>`
  }

  // Create review keyboard
  const reviewKeyboard = new InlineKeyboard()

  if (first.aiScore !== null && first.aiScore >= 85) {
    reviewKeyboard.text('✅ Принять (AI: ✓)', `review:pass:${first.id}`)
  } else if (first.aiScore !== null && first.aiScore < 50) {
    reviewKeyboard.text('❌ Отклонить (AI: ✗)', `review:fail:${first.id}`)
  } else {
    reviewKeyboard.text('✅ Сдал', `review:pass:${first.id}`)
  }
  reviewKeyboard.text('❌ Не сдал', `review:fail:${first.id}`).row()

  if (submissions.length > 1) {
    reviewKeyboard.text(`➡️ След. (${submissions.length - 1})`, 'ustaz:next_submission')
  }
  reviewKeyboard.text('◀️ Меню', 'ustaz:menu')

  // Delete old message first
  try {
    await ctx.deleteMessage()
  } catch (e) {
    // Ignore if can't delete
  }

  // Send file with caption and buttons
  try {
    // Handle mufradat game submissions (no file)
    if (first.submissionType === 'MUFRADAT_GAME' || !first.fileId) {
      const gameInfo = first.gameScore !== null
        ? `\n\n🎮 <b>Муфрадат:</b> ${first.gameCorrect}/${first.gameTotal} (${first.gameScore}%)`
        : ''
      await ctx.reply(caption + gameInfo, {
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard
      })
    } else if (first.fileType === 'voice') {
      await ctx.replyWithVoice(first.fileId, {
        caption,
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard
      })
    } else if (first.fileType === 'video_note') {
      // Video notes don't support captions - send video first, then message with buttons
      const videoMsg = await ctx.replyWithVideoNote(first.fileId)
      await ctx.reply(caption, {
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard,
        reply_parameters: { message_id: videoMsg.message_id }
      })
    } else if (first.fileType === 'text') {
      const textContent = first.fileId.replace('text:', '')
      const textMessage = caption + `\n\n💬 <i>${textContent}</i>`
      await ctx.reply(textMessage, {
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard
      })
    }
  } catch (error) {
    console.error('Failed to send submission file:', error)
    // Fallback to text message
    await ctx.reply(caption + '\n\n⚠️ Не удалось загрузить файл', {
      parse_mode: 'HTML',
      reply_markup: reviewKeyboard
    })
  }
}

async function showNextSubmission(ctx: BotContext, user: any): Promise<void> {
  await showPendingSubmissions(ctx, user)
}

/**
 * Show next pending submission after review (sends NEW message, doesn't edit)
 * Called after pass/fail action when old message was already deleted
 */
async function showNextPendingSubmissionAfterReview(ctx: BotContext, user: any): Promise<void> {
  // Delete any old menus to keep chat clean
  await deleteMessagesByType(ctx, 'menu')

  // Get ustaz's groups
  const groups = await prisma.group.findMany({
    where: { ustazId: user.id },
    select: { id: true }
  })

  const groupIds = groups.map(g => g.id)

  // Get next pending submission (only those that were sent to ustaz)
  const submissions = await prisma.submission.findMany({
    where: {
      status: SubmissionStatus.PENDING,
      sentToUstazAt: { not: null }, // Only show submissions that were actually sent to ustaz
      OR: [
        { task: { lesson: { groupId: { in: groupIds } } } },
        { task: { groupId: { in: groupIds } } }
      ]
    },
    include: {
      student: {
        include: {
          studentGroups: {
            where: { isActive: true },
            include: {
              group: { select: { name: true } }
            },
            take: 1
          }
        }
      },
      task: {
        include: { page: true, group: true }
      }
    },
    orderBy: { createdAt: 'asc' },
    take: 10
  })

  // No more submissions - show "all done" message
  if (submissions.length === 0) {
    await ctx.reply(
      '📝 <b>Работы на проверку</b>\n\n✅ <b>Все работы проверены!</b>\n\nОтличная работа! 🎉',
      {
        parse_mode: 'HTML',
        reply_markup: getBackKeyboard('ustaz:menu', '◀️ В меню')
      }
    )
    return
  }

  // Show next submission
  const first = submissions[0]
  const studentName = first.student.firstName || 'Студент'
  const groupName = first.student.studentGroups[0]?.group?.name || first.task.group?.name || ''

  const lineRange = first.task.startLine === first.task.endLine
    ? `строка ${first.task.startLine}`
    : `строки ${first.task.startLine}-${first.task.endLine}`

  const stageNames: Record<string, string> = {
    STAGE_1_1: 'Этап 1.1',
    STAGE_1_2: 'Этап 1.2',
    STAGE_2_1: 'Этап 2.1',
    STAGE_2_2: 'Этап 2.2',
    STAGE_3: 'Этап 3',
  }
  const stageName = stageNames[first.task.stage] || first.task.stage

  const progressPercent = Math.round((first.task.currentCount / first.task.requiredCount) * 100)
  const progressBar = `[${'▓'.repeat(Math.round(progressPercent / 10))}${'░'.repeat(10 - Math.round(progressPercent / 10))}]`

  let caption = `📝 <b>Работа 1/${submissions.length}</b>\n\n`
  if (groupName) caption += `📚 <b>${groupName}</b>\n`
  caption += `👤 ${studentName}\n`
  caption += `📖 Стр. ${first.task.page.pageNumber}, ${lineRange}\n`
  caption += `🎯 ${stageName}\n\n`
  caption += `${progressBar} ${progressPercent}%\n`
  caption += `📊 <b>${first.task.currentCount}/${first.task.requiredCount}</b>`

  if (first.task.passedCount > 0 || first.task.failedCount > 0) {
    caption += `\n✅ ${first.task.passedCount}`
    if (first.task.failedCount > 0) {
      caption += ` | ❌ ${first.task.failedCount}`
    }
  }

  if (first.aiScore !== null && first.aiScore !== undefined) {
    const scoreEmoji = first.aiScore >= 85 ? '🟢' : first.aiScore >= 50 ? '🟡' : '🔴'
    caption += `\n\n${scoreEmoji} <b>AI: ${Math.round(first.aiScore)}%</b>`
  }

  const reviewKeyboard = new InlineKeyboard()
  if (first.aiScore !== null && first.aiScore >= 85) {
    reviewKeyboard.text('✅ Принять (AI: ✓)', `review:pass:${first.id}`)
  } else if (first.aiScore !== null && first.aiScore < 50) {
    reviewKeyboard.text('❌ Отклонить (AI: ✗)', `review:fail:${first.id}`)
  } else {
    reviewKeyboard.text('✅ Сдал', `review:pass:${first.id}`)
  }
  reviewKeyboard.text('❌ Не сдал', `review:fail:${first.id}`).row()

  if (submissions.length > 1) {
    reviewKeyboard.text(`➡️ След. (${submissions.length - 1})`, 'ustaz:next_submission')
  }
  reviewKeyboard.text('◀️ Меню', 'ustaz:menu')

  // Send file with caption and buttons (using reply, not edit)
  try {
    // Handle MUFRADAT_GAME submissions (no file, just game results)
    if (first.submissionType === 'MUFRADAT_GAME' || !first.fileId) {
      let gameCaption = caption
      if (first.gameScore !== null) {
        const scoreEmoji = first.gameScore >= 80 ? '🟢' : first.gameScore >= 50 ? '🟡' : '🔴'
        gameCaption += `\n\n🎮 <b>Муфрадат игра:</b>\n`
        gameCaption += `${scoreEmoji} <b>${first.gameCorrect}/${first.gameTotal}</b> (${first.gameScore}%)`
      }
      await ctx.reply(gameCaption, {
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard
      })
    } else if (first.fileType === 'voice') {
      await ctx.replyWithVoice(first.fileId, {
        caption,
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard
      })
    } else if (first.fileType === 'video_note') {
      const videoMsg = await ctx.replyWithVideoNote(first.fileId)
      await ctx.reply(caption, {
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard,
        reply_parameters: { message_id: videoMsg.message_id }
      })
    } else if (first.fileType === 'text') {
      const textContent = first.fileId.replace('text:', '')
      const textMessage = caption + `\n\n💬 <i>${textContent}</i>`
      await ctx.reply(textMessage, {
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard
      })
    }
  } catch (error) {
    console.error('Failed to send next submission:', error)
    await ctx.reply(caption + '\n\n⚠️ Не удалось загрузить файл', {
      parse_mode: 'HTML',
      reply_markup: reviewKeyboard
    })
  }
}

async function showUstazGroups(ctx: BotContext, user: any): Promise<void> {
  const groups = await prisma.group.findMany({
    where: { ustazId: user.id },
    include: {
      _count: { select: { students: true } }
    }
  })

  if (groups.length === 0) {
    await ctx.editMessageText(
      '📚 <b>Мои группы</b>\n\n<i>У вас пока нет групп.</i>',
      { parse_mode: 'HTML', reply_markup: getBackKeyboard('ustaz:menu', '◀️ В меню') }
    )
    return
  }

  let message = '<b>📚 Мои группы</b>\n\n'

  for (const group of groups) {
    message += `📚 ${group.name} (${group._count.students} студентов)\n`
  }

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('ustaz:menu', '◀️ В меню')
  })
}

async function showUstazStudents(ctx: BotContext, user: any): Promise<void> {
  const students = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      studentGroups: {
        some: {
          isActive: true,
          group: {
            ustazId: user.id
          }
        }
      }
    },
    include: {
      studentGroups: {
        where: { isActive: true },
        include: {
          group: true
        }
      }
    },
    orderBy: { firstName: 'asc' }
  })

  if (students.length === 0) {
    await ctx.editMessageText(
      '👥 <b>Мои студенты</b>\n\n<i>У вас пока нет студентов.</i>',
      { parse_mode: 'HTML', reply_markup: getBackKeyboard('ustaz:menu', '◀️ В меню') }
    )
    return
  }

  let message = '<b>👥 Мои студенты</b>\n\n'

  for (const student of students.slice(0, 15)) {
    const name = student.firstName || 'Студент'
    const progress = `${student.currentPage}-${student.currentLine}`
    message += `👤 ${name} (стр. ${progress})\n`
  }

  if (students.length > 15) {
    message += `\n<i>...и ещё ${students.length - 15}</i>`
  }

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('ustaz:menu', '◀️ В меню')
  })
}

async function showUstazStats(ctx: BotContext, user: any): Promise<void> {
  const groups = await prisma.group.findMany({
    where: { ustazId: user.id },
    select: { id: true }
  })

  const groupIds = groups.map(g => g.id)

  const [totalStudents, completedTasks, pendingSubmissions] = await Promise.all([
    prisma.studentGroup.count({
      where: {
        groupId: { in: groupIds },
        isActive: true
      }
    }),
    prisma.task.count({
      where: {
        status: TaskStatus.PASSED,
        OR: [
          { lesson: { groupId: { in: groupIds } } },
          { groupId: { in: groupIds } }
        ]
      }
    }),
    prisma.submission.count({
      where: {
        status: SubmissionStatus.PENDING,
        OR: [
          { task: { lesson: { groupId: { in: groupIds } } } },
          { task: { groupId: { in: groupIds } } }
        ]
      }
    })
  ])

  const message = `<b>📊 Статистика</b>\n\n` +
    `👥 Студентов: ${totalStudents}\n` +
    `✅ Заданий выполнено: ${completedTasks}\n` +
    `⏳ Работ на проверку: ${pendingSubmissions}`

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('ustaz:menu', '◀️ В меню')
  })
}

// ============== REVIEW HANDLERS ==============

async function handleReviewCallback(
  ctx: BotContext,
  user: any,
  action: string,
  submissionId: string
): Promise<void> {
  if (action === 'pass' || action === 'fail') {
    const status = action === 'pass' ? SubmissionStatus.PASSED : SubmissionStatus.FAILED

    // Find submission first to check if it exists
    const existingSubmission = await prisma.submission.findUnique({
      where: { id: submissionId }
    })

    if (!existingSubmission) {
      await ctx.answerCallbackQuery({ text: 'Запись не найдена', show_alert: true })
      // Delete the message since it's stale
      try {
        await ctx.deleteMessage()
      } catch (e) {
        // Ignore if can't delete
      }
      return
    }

    // Check if already reviewed
    if (existingSubmission.status !== SubmissionStatus.PENDING) {
      await ctx.answerCallbackQuery({ text: 'Уже проверено', show_alert: true })
      // Delete the message
      try {
        await ctx.deleteMessage()
      } catch (e) {
        // Ignore if can't delete
      }
      return
    }

    // Update submission
    const submission = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        status,
        reviewedAt: new Date()
      },
      include: {
        task: {
          include: {
            lesson: true,
            student: true,
            page: true
          }
        }
      }
    })

    // Update task counters
    const updateData = status === SubmissionStatus.PASSED
      ? { passedCount: { increment: 1 } }
      : { failedCount: { increment: 1 } }

    const task = await prisma.task.update({
      where: { id: submission.taskId },
      data: updateData,
      include: { lesson: true, group: true }
    })

    // Check if task is completed - must pass ALL required count with no failures
    if (task.passedCount >= task.requiredCount && task.failedCount === 0) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.PASSED,
          completedAt: new Date()
        }
      })

      // Update user statistics
      await prisma.userStatistics.upsert({
        where: { userId: submission.studentId },
        create: {
          userId: submission.studentId,
          totalTasksCompleted: 1,
          thisWeekProgress: 1,
          thisMonthProgress: 1
        },
        update: {
          totalTasksCompleted: { increment: 1 },
          thisWeekProgress: { increment: 1 },
          thisMonthProgress: { increment: 1 }
        }
      })

      // TODO: Move user to next line/stage/page
    }

    // Answer callback
    await ctx.answerCallbackQuery({
      text: status === SubmissionStatus.PASSED ? '✅ Принято' : '❌ Отклонено'
    })

    // Delete the review message and the video note (if reply) to keep ustaz chat clean
    try {
      const msg = ctx.callbackQuery?.message
      // If this message is a reply to the video note, delete the video note too
      if (msg && 'reply_to_message' in msg && msg.reply_to_message) {
        try {
          await ctx.api.deleteMessage(ctx.chat!.id, msg.reply_to_message.message_id)
        } catch (e) {
          // Video note might already be deleted
        }
      }
      await ctx.deleteMessage()
    } catch (e) {
      // Ignore if can't delete
    }

    // Notify student about result
    try {
      const student = submission.task.student
      if (student.telegramId) {
        const { bot } = await import('../bot')
        const resultEmoji = status === SubmissionStatus.PASSED ? '✅' : '❌'
        const resultText = status === SubmissionStatus.PASSED ? 'принята' : 'отклонена'
        const lineRange = submission.task.startLine === submission.task.endLine
          ? `строка ${submission.task.startLine}`
          : `строки ${submission.task.startLine}-${submission.task.endLine}`

        let message = `${resultEmoji} <b>Запись ${resultText}</b>\n\n`
        message += `📖 Стр. ${submission.task.page.pageNumber}, ${lineRange}\n`
        message += `📊 Принято: <b>${task.passedCount}/${task.requiredCount}</b>`

        if (task.failedCount > 0) {
          message += `\n❌ На пересдачу: <b>${task.failedCount}</b>`
        }

        // Add deadline info
        const deadline = new Date(submission.task.deadline)
        const now = new Date()
        const timeLeft = deadline.getTime() - now.getTime()
        const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)))
        const minutesLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60)))

        // Format deadline time
        const deadlineTimeStr = deadline.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Bishkek'
        })
        const deadlineDateStr = deadline.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short',
          timeZone: 'Asia/Bishkek'
        })

        if (timeLeft > 0) {
          message += `\n\n⏰ До <b>${deadlineDateStr} ${deadlineTimeStr}</b>`
          message += `\n⏳ Осталось: <b>${hoursLeft}ч ${minutesLeft}м</b>`
        } else {
          message += `\n\n⚠️ <b>Срок истёк!</b>`
        }

        const sentMsg = await bot.api.sendMessage(Number(student.telegramId), message, {
          parse_mode: 'HTML'
        })

        // Track message for auto-delete after 30 seconds
        const { trackMessageForChat } = await import('../utils/message-cleaner')
        await trackMessageForChat(
          Number(student.telegramId),
          sentMsg.message_id,
          student.id,
          'review_result',
          0.5 // Delete after 30 seconds
        )
      }
    } catch (e) {
      console.error('Failed to notify student:', e)
    }

    // Show next submission or "all done" message
    await showNextPendingSubmissionAfterReview(ctx, user)
  }
}

// ============== ADMIN HANDLERS ==============

async function handleAdminCallback(
  ctx: BotContext,
  user: any,
  action: string,
  id?: string
): Promise<void> {
  switch (action) {
    case 'menu':
      await showAdminMenu(ctx, user)
      break
    case 'users':
      await showAdminUsers(ctx, user)
      break
    case 'groups':
      await showAdminGroups(ctx, user)
      break
    case 'stats':
      await showAdminStats(ctx, user)
      break
    case 'lessons':
    case 'settings':
      await ctx.editMessageText(
        '📱 <b>Эта функция доступна в веб-версии</b>\n\nНажмите "🌐 Войти в веб" для доступа к полному функционалу.',
        { parse_mode: 'HTML', reply_markup: getBackKeyboard('admin:menu', '◀️ В меню') }
      )
      break
    default:
      await showAdminMenu(ctx, user)
  }
}

async function showAdminMenu(ctx: BotContext, user: any): Promise<void> {
  const [userCount, groupCount, pendingCount] = await Promise.all([
    prisma.user.count(),
    prisma.group.count(),
    prisma.submission.count({ where: { status: SubmissionStatus.PENDING } })
  ])

  const message = `<b>👑 Панель администратора</b>\n\n` +
    `👥 Пользователей: ${userCount}\n` +
    `📚 Групп: ${groupCount}\n` +
    `⏳ На проверке: ${pendingCount}\n\n` +
    `Выберите действие:`

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(user.role)
  })
}

async function showAdminUsers(ctx: BotContext, user: any): Promise<void> {
  const counts = await prisma.user.groupBy({
    by: ['role'],
    _count: true
  })

  let message = '<b>👥 Пользователи</b>\n\n'
  for (const count of counts) {
    const roleEmoji = count.role === 'ADMIN' ? '👑' : count.role === 'USTAZ' ? '👨‍🏫' : count.role === 'STUDENT' ? '📖' : '👨‍👩‍👧'
    message += `${roleEmoji} ${count.role}: ${count._count}\n`
  }

  message += '\n<i>Управление пользователями доступно в веб-версии.</i>'

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('admin:menu', '◀️ В меню')
  })
}

async function showAdminGroups(ctx: BotContext, user: any): Promise<void> {
  const groups = await prisma.group.findMany({
    include: {
      ustaz: true,
      _count: { select: { students: true } }
    }
  })

  let message = '<b>📚 Группы</b>\n\n'

  if (groups.length === 0) {
    message += '<i>Групп пока нет</i>'
  } else {
    for (const group of groups.slice(0, 10)) {
      const ustazName = group.ustaz?.firstName || 'Устаз'
      message += `📚 ${group.name} - ${ustazName} (${group._count.students} студентов)\n`
    }
  }

  message += '\n<i>Управление группами доступно в веб-версии.</i>'

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('admin:menu', '◀️ В меню')
  })
}

async function showAdminStats(ctx: BotContext, user: any): Promise<void> {
  const [users, groups, tasks, submissions] = await Promise.all([
    prisma.user.count(),
    prisma.group.count(),
    prisma.task.count(),
    prisma.submission.count()
  ])

  const message = `<b>📊 Общая статистика</b>\n\n` +
    `👥 Пользователей: ${users}\n` +
    `📚 Групп: ${groups}\n` +
    `📝 Заданий: ${tasks}\n` +
    `🎙 Записей: ${submissions}`

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('admin:menu', '◀️ В меню')
  })
}

// ============== PARENT HANDLERS ==============

async function handleParentCallback(
  ctx: BotContext,
  user: any,
  action: string,
  id?: string
): Promise<void> {
  switch (action) {
    case 'menu':
      await showParentMenu(ctx, user)
      break
    case 'children':
      await showParentChildren(ctx, user)
      break
    case 'stats':
      await showParentStats(ctx, user)
      break
    default:
      await showParentMenu(ctx, user)
  }
}

async function showParentMenu(ctx: BotContext, user: any): Promise<void> {
  const children = await prisma.user.findMany({
    where: { childOf: { some: { id: user.id } } },
    select: { id: true }
  })

  const message = `<b>👨‍👩‍👧 Панель родителя</b>\n\n` +
    `👶 Детей: ${children.length}\n\n` +
    `Выберите действие:`

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(user.role)
  })
}

async function showParentChildren(ctx: BotContext, user: any): Promise<void> {
  const children = await prisma.user.findMany({
    where: {
      childOf: { some: { id: user.id } }
    },
    include: {
      statistics: true
    }
  })

  if (children.length === 0) {
    await ctx.editMessageText(
      '👶 <b>Мои дети</b>\n\nУ вас не добавлено детей.\n\n<i>Обратитесь к администратору.</i>',
      {
        parse_mode: 'HTML',
        reply_markup: getBackKeyboard('parent:menu', '◀️ В меню')
      }
    )
    return
  }

  let message = '<b>👶 Мои дети</b>\n\n'

  for (const child of children) {
    const name = child.firstName || 'Ребенок'
    const progress = `${child.currentPage}-${child.currentLine}`
    message += `👤 ${name} (стр. ${progress})\n`

    if (child.statistics) {
      message += `   ✅ Выполнено: ${child.statistics.totalTasksCompleted}\n`
    }
  }

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('parent:menu', '◀️ В меню')
  })
}

async function showParentStats(ctx: BotContext, user: any): Promise<void> {
  await showParentChildren(ctx, user)
}

// ============== AUTH HANDLERS ==============

async function handleAuthCallback(
  ctx: BotContext,
  user: any,
  action: string
): Promise<void> {
  if (action === 'web') {
    const link = await generateWebAuthLink(user.id)

    const message = `<b>🌐 Вход в веб-версию</b>\n\n` +
      `Нажмите кнопку ниже для входа в панель управления.\n\n` +
      `<i>Ссылка действительна 7 дней.</i>`

    // Create keyboard with URL button
    const keyboard = new InlineKeyboard()
      .url('🔗 Открыть веб-панель', link).row()
      .text('◀️ В меню', `${user.role.toLowerCase()}:menu`)

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  }
}

// ============== TASK HANDLERS ==============

async function handleTaskCallback(
  ctx: BotContext,
  user: any,
  action: string,
  taskId: string
): Promise<void> {
  switch (action) {
    case 'cancel_last':
      await cancelLastSubmission(ctx, user, taskId)
      break
    case 'progress':
      await showCurrentTask(ctx, user)
      break
  }
}

/**
 * Cancel the last pending submission
 */
async function cancelLastSubmission(ctx: BotContext, user: any, taskId: string): Promise<void> {
  // Find the last pending submission for this task
  const lastSubmission = await prisma.submission.findFirst({
    where: {
      taskId,
      studentId: user.id,
      status: SubmissionStatus.PENDING,
    },
    orderBy: { createdAt: 'desc' }
  })

  if (!lastSubmission) {
    await ctx.answerCallbackQuery({ text: 'Нет записей для отмены', show_alert: true })
    return
  }

  // Delete the submission
  await prisma.submission.delete({
    where: { id: lastSubmission.id }
  })

  // Decrement task count
  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      currentCount: { decrement: 1 }
    },
    include: {
      page: true,
      lesson: true,
      group: true,
    }
  })

  // Try to delete the original message from Telegram
  if (lastSubmission.telegramMsgId) {
    try {
      await ctx.api.deleteMessage(ctx.chat!.id, Number(lastSubmission.telegramMsgId))
    } catch (e) {
      // Message might already be deleted or too old
    }
  }

  await ctx.answerCallbackQuery({ text: '✅ Запись отменена' })

  // Show updated task status
  const remaining = task.requiredCount - task.currentCount
  const progressPercent = ((task.currentCount / task.requiredCount) * 100).toFixed(0)

  const lineRange = task.startLine === task.endLine
    ? `строка ${task.startLine}`
    : `строки ${task.startLine}-${task.endLine}`

  const progressBar = buildProgressBar(parseInt(progressPercent))

  let message = `↩️ <b>Запись отменена</b>\n\n`
  message += `📖 Страница ${task.page.pageNumber}, ${lineRange}\n\n`
  message += `${progressBar}\n`
  message += `📊 Отправлено: <b>${task.currentCount}/${task.requiredCount}</b>\n`
  message += `⏳ Осталось: <b>${remaining}</b>\n\n`
  message += `<i>Отправьте запись чтения.</i>`

  // Build format hint - use group settings (primary) or lesson settings (fallback)
  const settings = task.group || task.lesson
  let formatHint = ''
  if (settings) {
    if (settings.allowVoice && settings.allowVideoNote) {
      formatHint = '🎤 голос или 📹 кружок'
    } else if (settings.allowVoice) {
      formatHint = '🎤 голосовое'
    } else if (settings.allowVideoNote) {
      formatHint = '📹 кружок'
    } else if (settings.allowText) {
      formatHint = '📝 текст'
    }
  } else {
    formatHint = '🎤 голос или 📹 кружок' // default
  }
  message += `\n📤 Принимается: ${formatHint}`

  // Check if there's still a pending submission
  const hasPending = await prisma.submission.findFirst({
    where: {
      taskId,
      studentId: user.id,
      status: SubmissionStatus.PENDING,
    }
  })

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getActiveTaskKeyboard(taskId, !!hasPending)
  })
}

// ============== REGISTRATION CALLBACK HANDLER ==============

async function handleRegistrationCallback(
  ctx: BotContext,
  action: string,
  id?: string
): Promise<void> {
  const fullData = ctx.callbackQuery?.data || ''

  // Handle role selection: reg:role:STUDENT, reg:role:USTAZ, reg:role:PARENT
  if (fullData.startsWith('reg:role:')) {
    await handleRoleSelection(ctx)
    return
  }

  // Handle ustaz selection: reg:ustaz:{ustazId}
  if (fullData.startsWith('reg:ustaz:')) {
    await handleUstazSelection(ctx)
    return
  }

  // Handle ustaz confirmation: reg:confirm_ustaz:{ustazId}
  if (fullData.startsWith('reg:confirm_ustaz:')) {
    await handleUstazConfirm(ctx)
    return
  }

  // Handle back to ustaz list
  if (fullData === 'reg:back_to_ustaz_list') {
    await handleBackToUstazList(ctx)
    return
  }

  // Handle back to role selection
  if (fullData === 'reg:back_to_role') {
    await handleBackToRole(ctx)
    return
  }

  await ctx.answerCallbackQuery({ text: 'Неизвестное действие регистрации' })
}

// ============== MUFRADAT GAME HANDLER ==============

async function handleMufradatCallback(
  ctx: BotContext,
  user: any,
  action: string,
  id?: string
): Promise<void> {
  switch (action) {
    case 'start':
      // id is groupId
      if (id) {
        await startMufradatGame(ctx, user, id)
      }
      break
    case 'answer':
      // id is answer index
      if (id !== undefined) {
        await handleMufradatAnswer(ctx, user, parseInt(id))
      }
      break
    case 'quit':
      await handleMufradatQuit(ctx, user)
      break
    default:
      await ctx.answerCallbackQuery({ text: 'Неизвестное действие игры' })
  }
}

// ============== CANCEL HANDLER ==============

async function handleCancel(ctx: BotContext, user: any): Promise<void> {
  ctx.session.step = 'browsing_menu'
  await showStudentMenu(ctx, user)
}

// ============== HELPERS ==============

function getTaskStatusEmoji(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.IN_PROGRESS: return '🔄'
    case TaskStatus.SUBMITTED: return '📤'
    case TaskStatus.PASSED: return '✅'
    case TaskStatus.FAILED: return '❌'
    default: return '❓'
  }
}

function buildProgressBar(percent: number): string {
  const filled = Math.round(percent / 10)
  const empty = 10 - filled
  return `[${'▓'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`
}
