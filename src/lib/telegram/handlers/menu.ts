import type { BotContext } from '../bot'
import { InlineKeyboard } from 'grammy'
import { prisma } from '@/lib/prisma'
import { TaskStatus, SubmissionStatus } from '@prisma/client'
import { sendAndTrack, cleanupAllMessages } from '../utils/message-cleaner'
import {
  getMainMenuKeyboard,
  getBackKeyboard,
  getStudentTaskKeyboard,
  getUstazSubmissionKeyboard,
  getPaginationKeyboard,
  getStartStageKeyboard,
  getActiveTaskKeyboard,
  StudentMenuInfo
} from '../keyboards/main-menu'
import { generateWebAuthLink } from '@/lib/auth'
import { STAGES, getLinesPerPage } from '@/lib/constants/quran'
import { StageNumber, GroupLevel } from '@prisma/client'

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
        await handleReviewCallback(ctx, user, action, id)
        break
      case 'auth':
        await handleAuthCallback(ctx, user, action)
        break
      case 'cancel':
        await handleCancel(ctx, user)
        break
      case 'noop':
        // Do nothing, just answer callback
        break
      default:
        await ctx.answerCallbackQuery({ text: 'Неизвестное действие' })
    }
  } catch (error: any) {
    // Ignore "message not modified" errors
    if (error?.description?.includes('message is not modified')) {
      // Message is already the same, just answer callback
    } else {
      console.error('Callback error:', error)
      await ctx.answerCallbackQuery({ text: 'Произошла ошибка' })
      return
    }
  }

  await ctx.answerCallbackQuery()
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
      await showStudentGroup(ctx, user)
      break
    case 'quran':
      await showQuranPage(ctx, user, user.currentPage)
      break
    default:
      await showStudentMenuEdit(ctx, user)
  }
}

async function showStudentMenuEdit(ctx: BotContext, user: any): Promise<void> {
  // Fetch full user data with group and statistics
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
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

  if (fullUser.studentGroup) {
    totalInGroup = fullUser.studentGroup._count.students

    const groupStudents = await prisma.user.findMany({
      where: { groupId: fullUser.studentGroup.id },
      select: { id: true, currentPage: true, currentLine: true },
      orderBy: [
        { currentPage: 'desc' },
        { currentLine: 'desc' }
      ]
    })

    rankInGroup = groupStudents.findIndex(s => s.id === user.id) + 1
  }

  const menuInfo: StudentMenuInfo = {
    hasActiveTask: !!activeTask,
    currentCount: activeTask?.currentCount,
    requiredCount: activeTask?.requiredCount,
    groupName: fullUser.studentGroup?.name,
    ustazName: fullUser.studentGroup?.ustaz?.firstName || undefined,
    ustazUsername: fullUser.studentGroup?.ustaz?.telegramUsername || undefined,
    ustazTelegramId: fullUser.studentGroup?.ustaz?.telegramId ? Number(fullUser.studentGroup.ustaz.telegramId) : undefined,
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

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(fullUser.role, menuInfo)
  })
}

async function showStudentMenu(ctx: BotContext, user: any): Promise<void> {
  await cleanupAllMessages(ctx)

  // Fetch full user data with group and statistics
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
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

  if (fullUser.studentGroup) {
    totalInGroup = fullUser.studentGroup._count.students

    const groupStudents = await prisma.user.findMany({
      where: { groupId: fullUser.studentGroup.id },
      select: { id: true, currentPage: true, currentLine: true },
      orderBy: [
        { currentPage: 'desc' },
        { currentLine: 'desc' }
      ]
    })

    rankInGroup = groupStudents.findIndex(s => s.id === user.id) + 1
  }

  const menuInfo: StudentMenuInfo = {
    hasActiveTask: !!activeTask,
    currentCount: activeTask?.currentCount,
    requiredCount: activeTask?.requiredCount,
    groupName: fullUser.studentGroup?.name,
    ustazName: fullUser.studentGroup?.ustaz?.firstName || undefined,
    ustazUsername: fullUser.studentGroup?.ustaz?.telegramUsername || undefined,
    ustazTelegramId: fullUser.studentGroup?.ustaz?.telegramId ? Number(fullUser.studentGroup.ustaz.telegramId) : undefined,
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
  const deadlineStr = timeLeft > 0
    ? `⏰ Осталось: <b>${hoursLeft}ч ${minutesLeft}м</b>`
    : `⚠️ <b>Срок истёк!</b>`

  // Build format hint
  let formatHint = ''
  if (task.lesson.allowVoice && task.lesson.allowVideoNote) {
    formatHint = '🎤 голос или 📹 кружок'
  } else if (task.lesson.allowVoice) {
    formatHint = '🎤 голосовое сообщение'
  } else if (task.lesson.allowVideoNote) {
    formatHint = '📹 видео-кружок'
  } else if (task.lesson.allowText) {
    formatHint = '📝 текст'
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
      studentGroup: {
        include: {
          lessons: {
            where: { isActive: true },
            take: 1
          }
        }
      }
    }
  })

  if (!userWithGroup?.studentGroup) {
    await ctx.editMessageText(
      '❌ <b>Ошибка</b>\n\nВы не состоите в группе.\n\n<i>Обратитесь к администратору.</i>',
      { parse_mode: 'HTML', reply_markup: getBackKeyboard('student:menu', '◀️ В меню') }
    )
    return
  }

  const lesson = userWithGroup.studentGroup.lessons[0]
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
    userWithGroup.studentGroup.level as GroupLevel
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

async function showStudentGroup(ctx: BotContext, user: any): Promise<void> {
  // Get user with group and all group students
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      studentGroup: {
        include: {
          ustaz: true,
          students: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              currentPage: true,
              currentLine: true,
            },
            orderBy: [
              { currentPage: 'desc' },
              { currentLine: 'desc' }
            ]
          }
        }
      }
    }
  })

  if (!fullUser?.studentGroup) {
    await ctx.editMessageText(
      '📚 <b>Моя группа</b>\n\n<i>Вы не состоите в группе.</i>',
      { parse_mode: 'HTML', reply_markup: getBackKeyboard('student:menu', '◀️ В меню') }
    )
    return
  }

  const group = fullUser.studentGroup
  const students = group.students
  const myRank = students.findIndex(s => s.id === user.id) + 1

  let message = `📚 <b>Моя группа: ${group.name}</b>\n\n`
  message += `👨‍🏫 Устаз: <b>${group.ustaz?.firstName || 'Не назначен'}</b>\n`
  message += `👥 Студентов: <b>${students.length}</b>\n`
  message += `🏆 Ваш рейтинг: <b>${myRank} из ${students.length}</b>\n\n`

  message += `━━━━━━━━━━━━━━━━━━\n`
  message += `<b>Рейтинг группы:</b>\n\n`

  // Show top 10 students
  const topStudents = students.slice(0, 10)
  for (let i = 0; i < topStudents.length; i++) {
    const student = topStudents[i]
    const rank = i + 1
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`
    const isMe = student.id === user.id
    const name = student.firstName || 'Студент'
    const progress = `стр. ${student.currentPage}:${student.currentLine}`

    if (isMe) {
      message += `${medal} <b>➤ ${name}</b> — ${progress}\n`
    } else {
      message += `${medal} ${name} — ${progress}\n`
    }
  }

  if (students.length > 10) {
    message += `\n<i>...и ещё ${students.length - 10} студентов</i>`
  }

  // Add ustaz chat button if available
  const keyboard = new InlineKeyboard()
  if (group.ustaz?.telegramUsername) {
    keyboard.url(`💬 Написать устазу`, `https://t.me/${group.ustaz.telegramUsername}`).row()
  } else if (group.ustaz?.telegramId) {
    keyboard.url(`💬 Написать устазу`, `tg://user?id=${group.ustaz.telegramId}`).row()
  }
  keyboard.text('◀️ В меню', 'student:menu')

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: keyboard
  })
}

async function showQuranPage(ctx: BotContext, user: any, pageNumber: number): Promise<void> {
  const page = await prisma.quranPage.findUnique({
    where: { pageNumber },
    include: {
      lines: {
        orderBy: { lineNumber: 'asc' }
      }
    }
  })

  if (!page) {
    await ctx.editMessageText(
      '📖 <b>Коран</b>\n\n<i>Страница не найдена.</i>',
      { parse_mode: 'HTML', reply_markup: getBackKeyboard('student:menu', '◀️ В меню') }
    )
    return
  }

  let message = `<b>📖 Страница ${pageNumber}</b>\n\n`
  message += `📄 Строк: ${page.totalLines}\n\n`

  // Show line content if available
  for (const line of page.lines.slice(0, 5)) {
    if (line.textArabic) {
      message += `${line.lineNumber}. ${line.textArabic}\n`
    }
  }

  if (page.lines.length > 5) {
    message += `\n<i>...и ещё ${page.lines.length - 5} строк</i>`
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

  const pendingCount = await prisma.submission.count({
    where: {
      status: SubmissionStatus.PENDING,
      task: {
        lesson: {
          groupId: { in: groups.map(g => g.id) }
        }
      }
    }
  })

  const message = `<b>👨‍🏫 Панель устаза</b>\n\n` +
    `📚 Групп: ${groups.length}\n` +
    `📝 Работ на проверку: <b>${pendingCount}</b>\n\n` +
    `Выберите действие:`

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(user.role)
  })
}

async function showUstazMenu(ctx: BotContext, user: any): Promise<void> {
  await cleanupAllMessages(ctx)

  // Count pending submissions
  const groups = await prisma.group.findMany({
    where: { ustazId: user.id },
    select: { id: true }
  })

  const pendingCount = await prisma.submission.count({
    where: {
      status: SubmissionStatus.PENDING,
      task: {
        lesson: {
          groupId: { in: groups.map(g => g.id) }
        }
      }
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

  // Get pending submissions
  const submissions = await prisma.submission.findMany({
    where: {
      status: SubmissionStatus.PENDING,
      task: {
        lesson: {
          groupId: { in: groups.map(g => g.id) }
        }
      }
    },
    include: {
      student: true,
      task: {
        include: { page: true }
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

  let message = `<b>📝 Работы на проверку</b>\n\n`
  message += `Всего: ${submissions.length}\n\n`

  // Show first submission details
  const first = submissions[0]
  const studentName = first.student.firstName || 'Студент'

  message += `<b>Следующая работа:</b>\n`
  message += `👤 ${studentName}\n`
  message += `📖 Страница ${first.task.page.pageNumber}\n`
  message += `🎙 ${first.fileType === 'voice' ? 'Голосовое' : 'Кружок'}\n`

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getUstazSubmissionKeyboard(first.id)
  })

  // Send the audio/video to ustaz
  try {
    if (first.fileType === 'voice') {
      await ctx.replyWithVoice(first.fileId)
    } else {
      await ctx.replyWithVideoNote(first.fileId)
    }
  } catch (error) {
    console.error('Failed to send submission file:', error)
  }
}

async function showNextSubmission(ctx: BotContext, user: any): Promise<void> {
  await showPendingSubmissions(ctx, user)
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
      studentGroup: {
        ustazId: user.id
      }
    },
    include: {
      studentGroup: true
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

  const [totalStudents, completedTasks, pendingSubmissions] = await Promise.all([
    prisma.user.count({
      where: { groupId: { in: groups.map(g => g.id) } }
    }),
    prisma.task.count({
      where: {
        status: TaskStatus.PASSED,
        lesson: { groupId: { in: groups.map(g => g.id) } }
      }
    }),
    prisma.submission.count({
      where: {
        status: SubmissionStatus.PENDING,
        task: { lesson: { groupId: { in: groups.map(g => g.id) } } }
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
      include: { lesson: true }
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

        await bot.api.sendMessage(Number(student.telegramId), message, {
          parse_mode: 'HTML'
        })
      }
    } catch (e) {
      console.error('Failed to notify student:', e)
    }
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

  // Build format hint
  let formatHint = ''
  if (task.lesson.allowVoice && task.lesson.allowVideoNote) {
    formatHint = '🎤 голос или 📹 кружок'
  } else if (task.lesson.allowVoice) {
    formatHint = '🎤 голосовое'
  } else if (task.lesson.allowVideoNote) {
    formatHint = '📹 кружок'
  } else if (task.lesson.allowText) {
    formatHint = '📝 текст'
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
