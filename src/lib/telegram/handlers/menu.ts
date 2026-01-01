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
  getActiveTaskKeyboard,
  getRevisionPageSelectKeyboard,
  getRevisionSubmitKeyboard,
  getRevisionReviewKeyboard,
  getMemorizationStagesKeyboard,
  getMemorizationLinesKeyboard,
  getMemorizationConnectionKeyboard,
  getStageShortName,
  StudentMenuInfo,
  LessonTypeInfo,
  getLessonTypeName,
  getLinesForLevelName,
  type StageProgressInfo,
  type LineProgressInfo,
} from '../keyboards/main-menu'
import { generateWebAuthLink } from '@/lib/auth'
import { STAGES } from '@/lib/constants/quran'
import { getPageTotalLines, getOrCreateQuranPage } from '@/lib/quran-pages'
import { getPrimarySurahByPage } from '@/lib/constants/surahs'
import { StageNumber, GroupLevel, LessonType } from '@prisma/client'
import {
  getQuranPageContent,
  getGroupMushafSettings,
  getDefaultMushafSettings,
  formatQuranLinesForTelegram,
} from '../utils/quran-content'
import {
  handleGenderSelection,
  handleRoleSelection,
  handleGroupSelection,
  handleGroupConfirm,
  handleBackToGroupList,
  handleBackToRole,
  handleProgressPageOffset,
  handleProgressPageSelection,
  handleProgressLineSelection,
  handleProgressStageSelection,
  handleBackToProgressPage,
  handleBackToProgressLine,
  handleBackToGroupConfirmFromProgress,
} from './registration'
import { processSubmissionAndNotify, showNextPendingSubmissionToUstaz, checkDeliveryStatus, retryDelivery } from './submission'
import {
  startMufradatGame,
  handleMufradatAnswer,
  handleMufradatQuit,
  showMufradatGameMenu,
  showMufradatStats,
} from './mufradat-game'
import { getPageVerses, getMedinaLines } from '@/lib/quran-api'

/**
 * Russian pluralization helper
 * @param n - number
 * @param forms - [one, few, many] e.g. ['раз', 'раза', 'раз'] or ['день', 'дня', 'дней']
 */
function pluralize(n: number, forms: [string, string, string]): string {
  const n100 = Math.abs(n) % 100
  const n10 = n100 % 10

  if (n100 >= 11 && n100 <= 19) {
    return forms[2]  // 11-19 → "раз", "дней"
  }
  if (n10 === 1) {
    return forms[0]  // 1, 21, 31 → "раз", "день"
  }
  if (n10 >= 2 && n10 <= 4) {
    return forms[1]  // 2-4, 22-24 → "раза", "дня"
  }
  return forms[2]    // 0, 5-9, 10-20 → "раз", "дней"
}

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
      case 'revision':
        // Revision page selection and submission
        await handleRevisionCallback(ctx, user, action, id)
        break
      case 'revision_review':
        // Ustaz reviewing revision submission
        await handleRevisionReviewCallback(ctx, user, action, id)
        callbackAnswered = true
        break
      case 'cancel':
        await handleCancel(ctx, user)
        break
      case 'translation':
        // Translation page selection callbacks
        await handleTranslationCallback(ctx, user, action, id)
        break
      case 'mufradat':
        // Mufradat game callbacks
        await handleMufradatCallback(ctx, user, action, id)
        break
      case 'mem_stages':
        // Show memorization stages for a page
        await handleMemStagesCallback(ctx, user, action, id)
        break
      case 'mem_stage':
        // Show specific stage details (lines or connection)
        await handleMemStageCallback(ctx, user, action, id)
        break
      case 'mem_line':
        // Start task for specific line
        await handleMemLineCallback(ctx, user, action, id)
        break
      case 'mem_start':
        // Start connection/full page submission
        await handleMemStartCallback(ctx, user, action, id)
        break
      case 'mem_next_stage':
        // Advance to next stage
        await handleMemNextStageCallback(ctx, user, action, id)
        break
      case 'noop':
        // Do nothing, just answer callback
        break
      case 'close_notification':
        // Close/delete the notification message
        try {
          await ctx.deleteMessage()
        } catch (e) {
          // Ignore if can't delete
        }
        callbackAnswered = true
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
    case 'revision':
      await showRevisionPages(ctx, user)
      break
    case 'mufradat':
      await showMufradatMenu(ctx, user)
      break
    case 'sync':
      await showSyncStatus(ctx, user)
      break
    case 'retry_delivery':
      await handleRetryDelivery(ctx, user, id)
      break
    default:
      await showStudentMenuEdit(ctx, user)
  }
}

async function showStudentMenuEdit(ctx: BotContext, user: any): Promise<void> {
  // Clean up any old messages before showing menu - prevent duplicates
  await deleteMessagesByType(ctx, 'review_result')
  await deleteMessagesByType(ctx, 'notification')
  await deleteMessagesByType(ctx, 'submission_confirm')

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
      revisionSubmissions: {
        where: { status: SubmissionStatus.PASSED },
        select: { id: true }
      }
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
        id: true,
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
          taskId: activeTask.id,
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

  // Check for pending submissions to show sync button
  const pendingSubmissionsCount = await prisma.submission.count({
    where: {
      studentId: user.id,
      status: SubmissionStatus.PENDING,
    }
  })

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
    hasPendingSubmissions: pendingSubmissionsCount > 0,
  }

  const stageName = STAGES[fullUser.currentStage as keyof typeof STAGES]?.nameRuFull || fullUser.currentStage

  // Get gender emoji from primary group
  const genderEmoji = primaryGroup?.gender === 'FEMALE' ? '🧕' : '👨'

  let message = `<b>Ассаляму алейкум, ${fullUser.firstName || 'пользователь'}!</b>\n\n`
  message += `📖 <b>Главное меню</b>\n\n`

  // Show progress - either from groups or from user
  if (lessonTypes.length > 0) {
    message += `<b>📚 Мой прогресс:</b>\n`
    for (const lt of lessonTypes) {
      const stageShort = lt.currentStage.replace('STAGE_', '').replace('_', '.')
      const groupGender = fullUser.studentGroups.find(sg => sg.groupId === lt.groupId)?.group.gender
      const emoji = groupGender === 'FEMALE' ? '🧕' : '👨'
      const typeName = getLessonTypeName(lt.type)
      const levelInfo = lt.groupLevel && lt.type === LessonType.MEMORIZATION
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
        message += `${emoji} ${typeName}${levelInfo}: <b>стр. ${lt.currentPage}</b>, этап ${stageShort} [${lt.taskProgress.current}/${lt.taskProgress.required}]${surahStr}\n`
      } else {
        message += `${emoji} ${typeName}${levelInfo}: <b>стр. ${lt.currentPage}</b>, этап ${stageShort}${surahStr}\n`
      }
    }

    // Show revision stats
    const revisionCount = fullUser.revisionSubmissions?.length || 0
    if (revisionCount > 0) {
      message += `\n🔄 Повторений сдано: <b>${revisionCount}</b>\n`
    }
    message += `\n`
  } else {
    message += `📍 Текущий прогресс: <b>стр. ${fullUser.currentPage}, строка ${fullUser.currentLine}</b>\n`
    message += `📊 Этап: <b>${stageName}</b>\n\n`
  }

  // Ustaz info
  if (menuInfo.ustazName) {
    message += `━━━━━━━━━━━━━━━━━━\n`
    message += `${genderEmoji} Группа: <b>${primaryGroup?.name}</b>\n`
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

async function showCurrentTask(ctx: BotContext, user: any): Promise<void> {
  // Clean up any old messages before showing task menu - prevent duplicates
  await deleteMessagesByType(ctx, 'review_result')
  await deleteMessagesByType(ctx, 'notification')
  await deleteMessagesByType(ctx, 'submission_confirm')

  const task = await prisma.task.findFirst({
    where: {
      studentId: user.id,
      status: TaskStatus.IN_PROGRESS,
    },
    include: {
      page: true,
      group: true,
    }
  })

  if (!task) {
    // No active task - get data from StudentGroup for accurate progress
    const studentGroup = await prisma.studentGroup.findFirst({
      where: {
        studentId: user.id,
        isActive: true,
        group: { lessonType: LessonType.MEMORIZATION }
      },
      include: {
        group: true
      }
    })

    if (!studentGroup) {
      await ctx.editMessageText(
        '❌ <b>Ошибка</b>\n\nВы не состоите в группе.\n\n<i>Обратитесь к администратору.</i>',
        { parse_mode: 'HTML', reply_markup: getBackKeyboard('student:menu', '◀️ В меню') }
      )
      return
    }

    // Use showStartTaskForGroup which handles QRC pre-check logic
    await showStartTaskForGroup(ctx, user, studentGroup)
    return
  }

  // Check QRC pre-check for learning stages (1.1 and 2.1)
  const group = task.group
  if (group?.qrcPreCheckEnabled) {
    const isLearningStage = task.stage === 'STAGE_1_1' || task.stage === 'STAGE_2_1'

    if (isLearningStage) {
      // Check if pre-check is passed
      const preCheck = await prisma.qRCPreCheck.findUnique({
        where: {
          studentId_groupId_pageNumber_startLine_endLine_stage: {
            studentId: user.id,
            groupId: group.id,
            pageNumber: task.page?.pageNumber || 1,
            startLine: task.startLine,
            endLine: task.endLine,
            stage: task.stage as StageNumber,
          }
        }
      })

      if (!preCheck?.passed) {
        // Show AI pre-check interface
        const lineRange = task.startLine === task.endLine
          ? `строка ${task.startLine}`
          : `строки ${task.startLine}-${task.endLine}`

        let message = `📝 <b>Текущее задание</b>\n\n`
        message += `📖 Страница ${task.page?.pageNumber || 1}, ${lineRange}\n`
        message += `📚 ${STAGES[task.stage as keyof typeof STAGES]?.nameRuFull || task.stage}\n\n`

        message += `🤖 <b>Требуется AI предпроверка</b>\n\n`
        message += `Перед отправкой работ на проверку устазу, пройдите AI проверку чтения.\n\n`
        message += `<i>Порог прохождения: ${group.qrcPassThreshold || 70}%</i>`

        const keyboard = new InlineKeyboard()
        const messageId = ctx.callbackQuery?.message?.message_id || 0
        const webAppUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://qurantester.vercel.app'}/telegram/qrc-check?groupId=${group.id}&page=${task.page?.pageNumber || 1}&startLine=${task.startLine}&endLine=${task.endLine}&stage=${task.stage}&msgId=${messageId}`
        keyboard.webApp('🎙 Пройти AI проверку', webAppUrl).row()
        // Back to lines list for learning stages
        keyboard.text('◀️ К строкам', `mem_stage:${group.id}:${task.page?.pageNumber || 1}:${task.stage}`)

        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        })
        return
      }
    }
  }

  const lineRange = task.startLine === task.endLine
    ? `строка ${task.startLine}`
    : `строки ${task.startLine}-${task.endLine}`

  // Count pending submissions (waiting for ustaz review)
  const pendingSubmissionCount = await prisma.submission.count({
    where: {
      taskId: task.id,
      status: SubmissionStatus.PENDING,
    }
  })

  // Calculate remaining based on PASSED + PENDING, not just currentCount
  // This accounts for failed submissions that need to be re-submitted
  const remaining = task.requiredCount - task.passedCount - pendingSubmissionCount
  const progressPercent = ((task.passedCount / task.requiredCount) * 100).toFixed(0)
  const progressBar = buildProgressBar(parseInt(progressPercent))

  // Build format hint - use group settings only (group already defined above)

  // Calculate deadline (only show warning if deadlineEnabled)
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

  // If deadlines are disabled, don't show deadline at all
  const deadlineEnabled = group?.deadlineEnabled ?? true
  let deadlineStr: string = ''
  if (deadlineEnabled) {
    if (timeLeft > 0) {
      deadlineStr = `⏰ До <b>${deadlineDateStr} ${deadlineTimeStr}</b> (<b>${hoursLeft}ч ${minutesLeft}м</b>)`
    } else {
      deadlineStr = `⚠️ <b>Срок истёк!</b>`
    }
  }
  let formatHint = ''
  if (group) {
    if (group.allowVoice && group.allowVideoNote) {
      formatHint = '🎤 голос или 📹 кружок'
    } else if (group.allowVoice) {
      formatHint = '🎤 голосовое сообщение'
    } else if (group.allowVideoNote) {
      formatHint = '📹 видео-кружок'
    } else if (group.allowText) {
      formatHint = '📝 текст'
    } else {
      formatHint = '🎤 голос или 📹 кружок' // default
    }
  } else {
    formatHint = '🎤 голос или 📹 кружок' // default
  }

  let message = `📝 <b>Текущее задание</b>\n\n`
  message += `📖 Страница ${task.page?.pageNumber || 1}, ${lineRange}\n`
  message += `📚 ${STAGES[task.stage as keyof typeof STAGES]?.nameRuFull || task.stage}\n\n`
  message += `${progressBar}\n`
  message += `✅ Принято: <b>${task.passedCount}/${task.requiredCount}</b>\n`

  if (pendingSubmissionCount > 0) {
    message += `⏳ На проверке: <b>${pendingSubmissionCount}</b>\n`
  }

  // Only show failedCount if there are still submissions needed
  if (task.failedCount > 0 && remaining > 0) {
    message += `❌ На пересдачу: <b>${task.failedCount}</b>\n`
  }

  if (remaining > 0) {
    message += `📤 Осталось отправить: <b>${remaining}</b>\n`
  }

  // MAIN LOGIC: Check task state (failedCount is history, not a blocker)
  const isTaskComplete = remaining === 0 && pendingSubmissionCount === 0
  const allSentWaitingReview = remaining === 0 && pendingSubmissionCount > 0

  if (isTaskComplete) {
    // ALL PASSED - task complete!
    message += `\n🎉 <b>Все записи приняты!</b>\n`
    message += `<i>Нажмите кнопку ниже для перехода.</i>`
  } else if (allSentWaitingReview) {
    // All sent, waiting for review
    message += `\n✅ <b>Все записи отправлены!</b>\n`
    message += `<i>Ожидайте проверку устаза.</i>`
  } else if (remaining > 0) {
    // Need more submissions
    if (deadlineStr) {
      message += `\n${deadlineStr}\n\n`
    } else {
      message += `\n`
    }
    message += `📤 Принимается: ${formatHint}\n\n`
    if (task.failedCount > 0) {
      message += `<i>⚠️ У вас есть записи на пересдачу. Отправьте ${remaining} записей.</i>`
    } else {
      message += `<i>Отправьте запись чтения.</i>`
    }
  }

  // Show cancel button only when there are pending submissions and not all sent yet
  const showCancelButton = pendingSubmissionCount > 0 && remaining > 0

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getActiveTaskKeyboard(task.id, showCancelButton, isTaskComplete, allSentWaitingReview)
  })
}

/**
 * Get number of lines based on group level
 * Level 1 (BEGINNER): 1 line at a time
 * Level 2 (INTERMEDIATE): 3 lines at a time
 * Level 3 (ADVANCED): 7 lines at a time
 */
function getLinesForLevel(groupLevel: GroupLevel): number {
  switch (groupLevel) {
    case GroupLevel.LEVEL_1:
      return 1
    case GroupLevel.LEVEL_2:
      return 3
    case GroupLevel.LEVEL_3:
      return 7
    default:
      return 1
  }
}

/**
 * Get line range for a stage based on group level and current position
 *
 * ЛОГИКА ЭТАПОВ:
 * - Этапы изучения (1.1, 2.1): сдаём по linesPerTask строк за раз, двигаемся по строкам
 * - Этапы соединения (1.2, 2.2, 3): сдаём ВСЕ строки диапазона сразу
 *
 * ОСОБЫЕ СЛУЧАИ ДЛЯ УРОВНЕЙ:
 * - Level 2 (3 строки): в этапе 1.1 делим 7 строк на 3+4, в этапе 2.1 делим 8 строк на 4+4
 * - Level 3 (7 строк): этап 1.1 - все 7 сразу, этап 2.1 - все 8 сразу
 */
async function getLineRangeForStage(
  stage: StageNumber,
  pageNumber: number,
  groupLevel: GroupLevel,
  currentLine: number = 1
): Promise<{ startLine: number; endLine: number }> {
  const totalLines = await getPageTotalLines(pageNumber)
  const linesPerTask = getLinesForLevel(groupLevel)
  const firstHalfEnd = Math.min(7, totalLines)
  const secondHalfLines = totalLines > 7 ? totalLines - 7 : 0 // 8 lines for standard pages

  // For pages with <= 7 lines (like Fatiha), simplified flow
  if (totalLines <= 7) {
    // Learning stage: use linesPerTask from current position
    if (stage === StageNumber.STAGE_1_1) {
      // Level 3: all lines at once
      if (groupLevel === GroupLevel.LEVEL_3) {
        return { startLine: 1, endLine: totalLines }
      }
      // Level 2: smart batching (e.g., 3+4 for 7 lines)
      if (groupLevel === GroupLevel.LEVEL_2) {
        const firstBatchSize = Math.floor(totalLines / 2)
        if (currentLine <= firstBatchSize) {
          return { startLine: 1, endLine: firstBatchSize }
        } else {
          return { startLine: firstBatchSize + 1, endLine: totalLines }
        }
      }
      // Level 1: one line at a time
      const startLine = Math.max(currentLine, 1)
      const endLine = Math.min(startLine + linesPerTask - 1, totalLines)
      return { startLine, endLine }
    }
    // Connection/full page stage: all lines
    return { startLine: 1, endLine: totalLines }
  }

  switch (stage) {
    // ===== ЭТАПЫ ИЗУЧЕНИЯ (по группам строк) =====
    case StageNumber.STAGE_1_1:
      // Изучение строк 1-7
      {
        // Level 3: все 7 строк сразу
        if (groupLevel === GroupLevel.LEVEL_3) {
          return { startLine: 1, endLine: firstHalfEnd }
        }
        // Level 2: делим на 3+4 (первый батч 3 строки, второй батч 4 строки)
        if (groupLevel === GroupLevel.LEVEL_2) {
          const firstBatchEnd = 3 // lines 1-3
          if (currentLine <= firstBatchEnd) {
            return { startLine: 1, endLine: firstBatchEnd }
          } else {
            return { startLine: firstBatchEnd + 1, endLine: firstHalfEnd } // lines 4-7
          }
        }
        // Level 1: по одной строке
        const startLine = Math.max(currentLine, 1)
        const endLine = Math.min(startLine + linesPerTask - 1, firstHalfEnd)
        return { startLine, endLine }
      }

    case StageNumber.STAGE_2_1:
      // Изучение строк 8-15 (8 строк)
      {
        // Level 3: все 8 строк сразу
        if (groupLevel === GroupLevel.LEVEL_3) {
          return { startLine: 8, endLine: totalLines }
        }
        // Level 2: делим на 4+4 (первый батч 8-11, второй батч 12-15)
        if (groupLevel === GroupLevel.LEVEL_2) {
          const midPoint = 8 + Math.floor(secondHalfLines / 2) - 1 // = 11 for 8 lines
          if (currentLine <= midPoint) {
            return { startLine: 8, endLine: midPoint }
          } else {
            return { startLine: midPoint + 1, endLine: totalLines }
          }
        }
        // Level 1: по одной строке
        const startLine = Math.max(currentLine, 8)
        const endLine = Math.min(startLine + linesPerTask - 1, totalLines)
        return { startLine, endLine }
      }

    // ===== ЭТАПЫ СОЕДИНЕНИЯ (все строки сразу) =====
    case StageNumber.STAGE_1_2:
      // Соединение строк 1-7: ВСЕ строки первой половины сразу
      return { startLine: 1, endLine: firstHalfEnd }

    case StageNumber.STAGE_2_2:
      // Соединение строк 8-15: ВСЕ строки второй половины сразу
      return { startLine: 8, endLine: totalLines }

    case StageNumber.STAGE_3:
      // Вся страница: ВСЕ строки сразу
      return { startLine: 1, endLine: totalLines }

    default:
      return { startLine: 1, endLine: totalLines }
  }
}

async function showTaskHistory(ctx: BotContext, user: any): Promise<void> {
  const tasks = await prisma.task.findMany({
    where: { studentId: user.id },
    include: {
      page: true,
      group: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 15
  })

  // Get revision submissions
  const revisionSubmissions = await prisma.revisionSubmission.findMany({
    where: { studentId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  // Get mufradat submissions
  const mufradatSubmissions = await prisma.submission.findMany({
    where: {
      studentId: user.id,
      submissionType: 'MUFRADAT_GAME'
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  if (tasks.length === 0 && revisionSubmissions.length === 0 && mufradatSubmissions.length === 0) {
    await ctx.editMessageText(
      '📋 <b>История заданий</b>\n\n<i>История заданий пуста.</i>',
      { parse_mode: 'HTML', reply_markup: getBackKeyboard('student:menu', '◀️ В меню') }
    )
    return
  }

  let message = '<b>📋 История заданий</b>\n\n'

  // Memorization tasks
  if (tasks.length > 0) {
    message += '<b>📖 Заучивание:</b>\n'
    for (const task of tasks) {
      const status = getTaskStatusEmoji(task.status)
      const lineRange = task.startLine === task.endLine
        ? `стр. ${task.startLine}`
        : `стр. ${task.startLine}-${task.endLine}`
      const date = task.createdAt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })

      message += `${status} ${task.page?.pageNumber || 1}-${lineRange} (${task.passedCount}/${task.requiredCount}) ${date}\n`
    }
    message += '\n'
  }

  // Revision submissions
  if (revisionSubmissions.length > 0) {
    message += '<b>🔄 Повторение:</b>\n'
    for (const rev of revisionSubmissions) {
      const status = rev.status === 'PASSED' ? '✅' : rev.status === 'FAILED' ? '❌' : '⏳'
      const date = rev.createdAt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
      message += `${status} Стр. ${rev.pageNumber} ${date}\n`
    }
    message += '\n'
  }

  // Mufradat submissions
  if (mufradatSubmissions.length > 0) {
    message += '<b>📝 Переводы:</b>\n'
    for (const muf of mufradatSubmissions) {
      const status = muf.status === 'PASSED' ? '✅' : muf.status === 'FAILED' ? '❌' : '⏳'
      const date = muf.createdAt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
      const score = muf.gameScore ?? 0
      message += `${status} ${score}% (${muf.gameCorrect}/${muf.gameTotal}) ${date}\n`
    }
  }

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getBackKeyboard('student:menu', '◀️ В меню')
  })
}

async function showProgress(ctx: BotContext, user: any): Promise<void> {
  // Get user statistics
  const stats = await prisma.userStatistics.findUnique({
    where: { userId: user.id }
  })

  // Get all student groups with progress
  const studentGroups = await prisma.studentGroup.findMany({
    where: { studentId: user.id, isActive: true },
    include: {
      group: {
        include: { ustaz: true }
      }
    }
  })

  // Get mufradat game statistics
  const mufradatStats = await prisma.submission.aggregate({
    where: {
      studentId: user.id,
      submissionType: 'MUFRADAT_GAME'
    },
    _count: true,
    _avg: { gameScore: true }
  })

  const mufradatPassed = await prisma.submission.count({
    where: {
      studentId: user.id,
      submissionType: 'MUFRADAT_GAME',
      status: 'PASSED'
    }
  })

  // Use memorization group's progress for overall page (most relevant)
  const memGroup = studentGroups.find(sg => sg.group.lessonType === LessonType.MEMORIZATION)
  const currentPage = memGroup?.currentPage || user.currentPage
  const currentLine = memGroup?.currentLine || user.currentLine

  const totalPages = 602
  const completedPages = currentPage - 1
  const progressPercent = ((completedPages / totalPages) * 100).toFixed(2)

  let message = `<b>📈 Мой прогресс</b>\n\n`

  // Overall progress
  message += `📖 <b>Общий прогресс</b>\n`
  message += `   Позиция: стр. ${currentPage}, строка ${currentLine}\n`
  message += `   Пройдено: ${completedPages}/${totalPages} стр. (${progressPercent}%)\n\n`

  // Get revision stats
  const revisionStats = await prisma.revisionSubmission.groupBy({
    by: ['status'],
    where: { studentId: user.id },
    _count: true
  })
  const revisionPassed = revisionStats.find(r => r.status === 'PASSED')?._count || 0
  const revisionTotal = revisionStats.reduce((sum, r) => sum + r._count, 0)

  // Progress by lesson type
  if (studentGroups.length > 0) {
    message += `📚 <b>По типам уроков:</b>\n`
    for (const sg of studentGroups) {
      const typeName = getLessonTypeName(sg.group.lessonType)
      const stageShort = sg.currentStage.replace('STAGE_', '').replace('_', '.')
      const levelInfo = sg.group.level ? getLinesForLevelName(sg.group.level as GroupLevel) : ''

      if (sg.group.lessonType === LessonType.TRANSLATION) {
        // Special info for mufradat
        const avgScore = mufradatStats._avg.gameScore
          ? Math.round(mufradatStats._avg.gameScore)
          : 0
        message += `\n🎮 <b>${typeName}</b>\n`
        message += `   📍 Стр. ${sg.currentPage}, этап ${stageShort}\n`
        message += `   🎯 Игр сыграно: ${mufradatStats._count}\n`
        message += `   ✅ Пройдено: ${mufradatPassed}\n`
        message += `   📊 Средний балл: ${avgScore}%\n`
      } else if (sg.group.lessonType === LessonType.REVISION) {
        // Special info for revision
        message += `\n🔄 <b>${typeName}</b>\n`
        message += `   📍 Страниц сдано: ${revisionPassed}/${revisionTotal}\n`
        message += `   📊 Страниц в день: ${sg.group.revisionPagesPerDay}\n`
      } else {
        // Memorization
        message += `\n📖 <b>${typeName}</b>\n`
        message += `   📍 Стр. ${sg.currentPage}, строка ${sg.currentLine}\n`
        message += `   📊 Этап ${stageShort}\n`
        if (levelInfo) {
          message += `   📐 Уровень: ${levelInfo} за раз\n`
        }
      }
    }
    message += `\n`
  }

  // General statistics
  if (stats) {
    message += `━━━━━━━━━━━━━━━━━━\n`
    message += `✅ Заданий выполнено: ${stats.totalTasksCompleted}\n`
    message += `❌ Заданий не сдано: ${stats.totalTasksFailed}\n`

    const weekTrend = stats.thisWeekProgress - stats.lastWeekProgress
    const trendEmoji = weekTrend > 0 ? '📈' : weekTrend < 0 ? '📉' : '➡️'
    message += `${trendEmoji} Эта неделя: ${stats.thisWeekProgress} (${weekTrend >= 0 ? '+' : ''}${weekTrend})\n`

    if (stats.globalRank) {
      message += `🏆 Рейтинг: #${stats.globalRank}\n`
    }
  }

  // Add ustaz chat buttons
  const keyboard = new InlineKeyboard()
  const ustazWithUsername = studentGroups.find(sg => sg.group.ustaz?.telegramUsername)
  if (ustazWithUsername) {
    keyboard.url(
      `💬 Написать устазу`,
      `https://t.me/${ustazWithUsername.group.ustaz!.telegramUsername}`
    ).row()
  }
  keyboard.text('◀️ В меню', 'student:menu')

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: keyboard
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
      group: true
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

  // For MEMORIZATION lesson type, show new stages UI
  if (studentGroup.group.lessonType === LessonType.MEMORIZATION) {
    await showMemorizationStages(ctx, user, studentGroup)
    return
  }

  // For other lesson types (REVISION), use old flow
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
 * Uses same logic as showCurrentTask to avoid duplication
 */
async function showTaskForGroup(ctx: BotContext, user: any, task: any, studentGroup: any): Promise<void> {
  const group = studentGroup.group
  const typeName = getLessonTypeName(group.lessonType)

  // Check QRC pre-check for learning stages (1.1 and 2.1)
  if (group?.qrcPreCheckEnabled) {
    const isLearningStage = task.stage === 'STAGE_1_1' || task.stage === 'STAGE_2_1'

    if (isLearningStage) {
      // Check if pre-check is passed
      const preCheck = await prisma.qRCPreCheck.findUnique({
        where: {
          studentId_groupId_pageNumber_startLine_endLine_stage: {
            studentId: user.id,
            groupId: group.id,
            pageNumber: task.page?.pageNumber || 1,
            startLine: task.startLine,
            endLine: task.endLine,
            stage: task.stage as StageNumber,
          }
        }
      })

      if (!preCheck?.passed) {
        // Show AI pre-check interface
        const lineRange = task.startLine === task.endLine
          ? `строка ${task.startLine}`
          : `строки ${task.startLine}-${task.endLine}`

        let message = `📝 <b>${typeName}</b>\n\n`
        message += `📖 Страница ${task.page?.pageNumber || 1}, ${lineRange}\n`
        message += `📚 ${STAGES[task.stage as keyof typeof STAGES]?.nameRuFull || task.stage}\n\n`

        message += `🤖 <b>Требуется AI предпроверка</b>\n\n`
        message += `Перед отправкой работ на проверку устазу, пройдите AI проверку чтения.\n\n`
        message += `<i>Порог прохождения: ${group.qrcPassThreshold || 70}%</i>`

        const keyboard = new InlineKeyboard()
        const messageId = ctx.callbackQuery?.message?.message_id || 0
        const webAppUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://qurantester.vercel.app'}/telegram/qrc-check?groupId=${group.id}&page=${task.page?.pageNumber || 1}&startLine=${task.startLine}&endLine=${task.endLine}&stage=${task.stage}&msgId=${messageId}`
        keyboard.webApp('🎙 Пройти AI проверку', webAppUrl).row()
        // Back to lines list for learning stages
        keyboard.text('◀️ К строкам', `mem_stage:${group.id}:${task.page?.pageNumber || 1}:${task.stage}`)

        await ctx.editMessageText(message, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        })
        return
      }
    }
  }

  const lineRange = task.startLine === task.endLine
    ? `строка ${task.startLine}`
    : `строки ${task.startLine}-${task.endLine}`

  // Count pending submissions (waiting for ustaz review)
  const pendingSubmissionCount = await prisma.submission.count({
    where: {
      taskId: task.id,
      status: SubmissionStatus.PENDING,
    }
  })

  // Calculate remaining based on PASSED + PENDING, not just currentCount
  // This accounts for failed submissions that need to be re-submitted
  const remaining = task.requiredCount - task.passedCount - pendingSubmissionCount
  const progressPercent = ((task.passedCount / task.requiredCount) * 100).toFixed(0)
  const progressBar = buildProgressBar(parseInt(progressPercent))

  // Calculate deadline (only show warning if deadlineEnabled)
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

  // If deadlines are disabled, don't show deadline at all
  const deadlineEnabled = group.deadlineEnabled ?? true
  let deadlineStr: string = ''
  if (deadlineEnabled) {
    if (timeLeft > 0) {
      deadlineStr = `⏰ До <b>${deadlineDateStr} ${deadlineTimeStr}</b> (<b>${hoursLeft}ч ${minutesLeft}м</b>)`
    } else {
      deadlineStr = `⚠️ <b>Срок истёк!</b>`
    }
  }

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
  message += `📖 Страница ${task.page?.pageNumber || 1}, ${lineRange}\n`
  message += `📚 ${STAGES[task.stage as keyof typeof STAGES]?.nameRuFull || task.stage}\n\n`
  message += `${progressBar}\n`
  message += `✅ Принято: <b>${task.passedCount}/${task.requiredCount}</b>\n`

  if (pendingSubmissionCount > 0) {
    message += `⏳ На проверке: <b>${pendingSubmissionCount}</b>\n`
  }

  // Only show failedCount if there are still submissions needed
  if (task.failedCount > 0 && remaining > 0) {
    message += `❌ На пересдачу: <b>${task.failedCount}</b>\n`
  }

  if (remaining > 0) {
    message += `📤 Осталось отправить: <b>${remaining}</b>\n`
  }

  // MAIN LOGIC: Check task state (failedCount is history, not a blocker)
  const isTaskComplete = remaining === 0 && pendingSubmissionCount === 0
  const allSentWaitingReview = remaining === 0 && pendingSubmissionCount > 0

  if (isTaskComplete) {
    // ALL PASSED - task complete!
    message += `\n🎉 <b>Все записи приняты!</b>\n`
    message += `<i>Нажмите кнопку ниже для перехода.</i>`
  } else if (allSentWaitingReview) {
    // All sent, waiting for review
    message += `\n✅ <b>Все записи отправлены!</b>\n`
    message += `<i>Ожидайте проверку устаза.</i>`
  } else if (remaining > 0) {
    // Need more submissions
    if (deadlineStr) {
      message += `\n${deadlineStr}\n\n`
    } else {
      message += `\n`
    }
    message += `📤 Принимается: ${formatHint}\n\n`
    if (task.failedCount > 0) {
      message += `<i>⚠️ У вас есть записи на пересдачу. Отправьте ${remaining} записей.</i>`
    } else {
      message += `<i>Отправьте запись чтения.</i>`
    }
  }

  // Show cancel button only when there are pending submissions and not all sent yet
  const showCancelButton = pendingSubmissionCount > 0 && remaining > 0

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getActiveTaskKeyboard(task.id, showCancelButton, isTaskComplete, allSentWaitingReview)
  })
}

/**
 * Show start task option for a specific group
 */
async function showStartTaskForGroup(ctx: BotContext, user: any, studentGroup: any): Promise<void> {
  const group = studentGroup.group
  const typeName = getLessonTypeName(group.lessonType)
  const stageName = STAGES[studentGroup.currentStage as keyof typeof STAGES]?.nameRuFull || studentGroup.currentStage

  // Check if QRC pre-check is needed for learning stages (1.1 and 2.1)
  const isLearningStage = studentGroup.currentStage === StageNumber.STAGE_1_1 ||
                          studentGroup.currentStage === StageNumber.STAGE_2_1
  const qrcPreCheckEnabled = group.qrcPreCheckEnabled === true

  // Calculate line range for pre-check
  const linesPerTask = getLinesForLevel(group.level as GroupLevel)
  const totalLines = await getPageTotalLines(studentGroup.currentPage)
  const firstHalfEnd = Math.min(7, totalLines)

  let startLine: number
  let endLine: number

  if (studentGroup.currentStage === StageNumber.STAGE_1_1) {
    startLine = Math.max(studentGroup.currentLine, 1)
    endLine = Math.min(startLine + linesPerTask - 1, firstHalfEnd)
  } else if (studentGroup.currentStage === StageNumber.STAGE_2_1) {
    startLine = Math.max(studentGroup.currentLine, 8)
    endLine = Math.min(startLine + linesPerTask - 1, totalLines)
  } else {
    startLine = 1
    endLine = totalLines
  }

  // Check if pre-check is passed (only for learning stages with QRC enabled)
  let needsPreCheck = false
  let preCheckPassed = false

  if (isLearningStage && qrcPreCheckEnabled) {
    const existingPreCheck = await prisma.qRCPreCheck.findUnique({
      where: {
        studentId_groupId_pageNumber_startLine_endLine_stage: {
          studentId: user.id,
          groupId: group.id,
          pageNumber: studentGroup.currentPage,
          startLine,
          endLine,
          stage: studentGroup.currentStage as StageNumber,
        }
      }
    })

    preCheckPassed = existingPreCheck?.passed === true
    needsPreCheck = !preCheckPassed
  }

  let message = `▶️ <b>Начать ${typeName}</b>\n\n`
  message += `📍 Текущий прогресс: <b>стр. ${studentGroup.currentPage}, строка ${studentGroup.currentLine}</b>\n`
  message += `📊 Этап: <b>${stageName}</b>\n`

  if (needsPreCheck) {
    message += `\n🤖 <b>AI предпроверка</b>\n`
    message += `<i>Перед сдачей работ пройдите AI проверку чтения.</i>\n`
    message += `<i>Порог: ${group.qrcPassThreshold || 70}%</i>\n\n`
    message += `Нажмите кнопку ниже для проверки.`
  } else if (preCheckPassed) {
    message += `\n✅ <b>AI проверка пройдена!</b>\n\n`
    message += `Нажмите кнопку ниже, чтобы начать изучение.`
  } else {
    message += `\nНажмите кнопку ниже, чтобы начать изучение.`
  }

  const keyboard = new InlineKeyboard()

  if (needsPreCheck) {
    // WebApp button for QRC pre-check
    // Include message_id so webapp can delete this message after passing
    const messageId = ctx.callbackQuery?.message?.message_id || 0
    const webAppUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://qurantester.vercel.app'}/telegram/qrc-check?groupId=${group.id}&page=${studentGroup.currentPage}&startLine=${startLine}&endLine=${endLine}&stage=${studentGroup.currentStage}&msgId=${messageId}`
    keyboard.webApp('🎙 Пройти AI проверку', webAppUrl).row()
  } else {
    // Use mem_line callback to create/show task for the specific line
    // This allows working on multiple lines concurrently
    keyboard.text('▶️ Начать изучать этап', `mem_line:${group.id}:${studentGroup.currentPage}:${studentGroup.currentStage}:${startLine}`).row()
  }

  keyboard.text('◀️ К строкам', `mem_stage:${group.id}:${studentGroup.currentPage}:${studentGroup.currentStage}`)

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
    },
    include: {
      page: true,
      group: true,
    }
  })

  if (existingTask) {
    // Navigate to the active task instead of showing an error
    await showTaskForGroup(ctx, user, existingTask, studentGroup)
    return
  }

  const group = studentGroup.group

  // Find or create the QuranPage
  let page = await prisma.quranPage.findUnique({
    where: { pageNumber: studentGroup.currentPage }
  })

  if (!page) {
    page = await getOrCreateQuranPage(studentGroup.currentPage)
  }

  // Auto-correct invalid stage for short pages (<=7 lines)
  const pageLines = await getPageTotalLines(studentGroup.currentPage)
  let correctedStage = studentGroup.currentStage as StageNumber
  let correctedLine = studentGroup.currentLine

  if (pageLines <= 7) {
    // For pages with <=7 lines, stages 1.2, 2.1, 2.2 are invalid
    // Only valid stages: STAGE_1_1 and STAGE_3
    if (correctedStage === StageNumber.STAGE_1_2 ||
        correctedStage === StageNumber.STAGE_2_1 ||
        correctedStage === StageNumber.STAGE_2_2) {
      // Auto-correct to STAGE_3
      correctedStage = StageNumber.STAGE_3
      correctedLine = 1

      // Update the database
      await prisma.studentGroup.update({
        where: { id: studentGroup.id },
        data: {
          currentStage: correctedStage,
          currentLine: correctedLine
        }
      })

      // Also update the local reference
      studentGroup.currentStage = correctedStage
      studentGroup.currentLine = correctedLine
    }
  }

  // Calculate line range based on stage and group level
  const { startLine, endLine } = await getLineRangeForStage(
    correctedStage,
    studentGroup.currentPage,
    group.level as GroupLevel,
    correctedLine
  )

  // Calculate deadline based on stage and group settings (in hours)
  const stageHours = getStageHoursFromGroup(correctedStage, group)
  const deadline = new Date()
  deadline.setTime(deadline.getTime() + stageHours * 60 * 60 * 1000)

  // Create the task
  const task = await prisma.task.create({
    data: {
      groupId: group.id,
      studentId: user.id,
      pageId: page.id,
      startLine,
      endLine,
      stage: correctedStage,
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
  const currentStage = correctedStage
  const isLearningStage = currentStage === StageNumber.STAGE_1_1 || currentStage === StageNumber.STAGE_2_1
  const totalLines = await getPageTotalLines(page.pageNumber)
  const firstHalfEnd = Math.min(7, totalLines)
  const lineRange = startLine === endLine
    ? `строку ${startLine}`
    : `строки ${startLine}-${endLine}`

  // Определяем актуальное название этапа
  let stageName = ''
  if (currentStage === StageNumber.STAGE_1_1) {
    stageName = `Этап 1.1: Изучение строки ${startLine} из ${firstHalfEnd}`
  } else if (currentStage === StageNumber.STAGE_1_2) {
    stageName = `Этап 1.2: Соединение строк 1-${firstHalfEnd}`
  } else if (currentStage === StageNumber.STAGE_2_1) {
    stageName = `Этап 2.1: Изучение строки ${startLine} из ${totalLines}`
  } else if (currentStage === StageNumber.STAGE_2_2) {
    stageName = `Этап 2.2: Соединение строк 8-${totalLines}`
  } else if (currentStage === StageNumber.STAGE_3) {
    stageName = `Этап 3: Вся страница 1-${totalLines}`
  } else {
    stageName = STAGES[currentStage as keyof typeof STAGES]?.nameRuFull || currentStage
  }

  // Build format hint - ТОЛЬКО из настроек группы!
  let formatHint = ''
  const allowVoice = group.allowVoice ?? false
  const allowVideoNote = group.allowVideoNote ?? false
  const allowText = group.allowText ?? false

  if (allowVoice && allowVideoNote) {
    formatHint = '🎤 голосовое сообщение или 📹 видео-кружок'
  } else if (allowVoice) {
    formatHint = '🎤 голосовое сообщение'
  } else if (allowVideoNote) {
    formatHint = '📹 видео-кружок'
  } else if (allowText) {
    formatHint = '📝 текстовое сообщение'
  } else {
    // Если ничего не включено - по умолчанию голосовое
    formatHint = '🎤 голосовое сообщение'
  }

  // Get surah name and level
  const surah = getPrimarySurahByPage(page.pageNumber)
  const surahStr = surah ? ` <b>${surah.nameArabic}</b>` : ''
  const levelInfo = getLinesForLevelName(group.level as GroupLevel)

  // Количество повторений из настроек группы
  const repetitions = group.repetitionCount || 80

  // Pluralization for Russian
  const repsPlural = pluralize(repetitions, ['раз', 'раза', 'раз'])
  const days = stageHours >= 24 ? Math.round(stageHours / 24) : 0
  const daysPlural = pluralize(days, ['день', 'дня', 'дней'])
  const hoursPlural = pluralize(stageHours, ['час', 'часа', 'часов'])

  // Определяем тип задания для пояснения
  let taskTypeHint = ''
  if (isLearningStage) {
    taskTypeHint = `\n💡 <i>Изучение: сдавайте ${lineRange} (${repetitions} ${repsPlural})</i>`
  } else if (currentStage === StageNumber.STAGE_3) {
    taskTypeHint = `\n💡 <i>Соединение: читайте ВСЮ страницу целиком</i>`
  } else {
    taskTypeHint = `\n💡 <i>Соединение: читайте ${lineRange} ВСЕ ВМЕСТЕ</i>`
  }

  // Fetch Arabic text for the lines
  let arabicTextSection = ''
  try {
    const pageData = await getPageVerses(page.pageNumber)
    const allLines = getMedinaLines(pageData.verses)
    const targetLines = allLines.filter(l => l.lineNumber >= startLine && l.lineNumber <= endLine)

    if (targetLines.length > 0) {
      arabicTextSection = '\n\n📜 <b>Текст для сдачи:</b>\n'
      for (const line of targetLines) {
        // Filter out verse numbers from text
        const cleanText = (line.textArabic || '')
          .replace(/[\u0660-\u0669\u06F0-\u06F9\u06DD]/g, '') // Remove Arabic digits
          .replace(/\s+/g, ' ')
          .trim()
        if (cleanText) {
          arabicTextSection += `<code>${cleanText}</code>\n`
        }
      }
    }
  } catch (err) {
    console.warn('[Task] Failed to fetch Arabic text:', err)
    // Continue without Arabic text
  }

  let message = `✅ <b>Задание создано!</b>\n\n`
  message += `📖 <b>${typeName}</b>\n\n`
  message += `📄 Страница ${page.pageNumber}${surahStr}\n`
  message += `📝 Сдать: <b>${lineRange}</b>\n`
  message += `📚 ${stageName}\n`
  if (isLearningStage) {
    message += `📐 Уровень: <b>${levelInfo}</b> за раз\n`
  }
  message += taskTypeHint
  message += arabicTextSection
  message += `\n\n📊 Повторений: <b>${repetitions} ${repsPlural}</b>\n`
  message += `⏰ Срок: <b>${days > 0 ? days + ' ' + daysPlural : stageHours + ' ' + hoursPlural}</b>\n\n`
  message += `📤 Отправьте ${formatHint}.`

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getActiveTaskKeyboard(task.id, false)
  })

  // Track this message for cleanup when submission is received
  const messageId = ctx.callbackQuery?.message?.message_id
  if (messageId) {
    const { trackMessage } = await import('../utils/message-cleaner')
    await trackMessage(ctx, messageId, user.id, 'task_info')
  }
}

/**
 * Get hours for a stage from group settings
 */
function getStageHoursFromGroup(stage: StageNumber, group: any): number {
  switch (stage) {
    case StageNumber.STAGE_1_1:
    case StageNumber.STAGE_1_2:
      return group.stage1Hours || 24

    case StageNumber.STAGE_2_1:
    case StageNumber.STAGE_2_2:
      return group.stage2Hours || 48

    case StageNumber.STAGE_3:
      return group.stage3Hours || 48

    default:
      return 24
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

  let message = `<b>👨‍🏫 Панель устаза</b>\n\n`

  // Groups with gender emoji
  if (groups.length > 0) {
    message += `<b>📚 Группы:</b>\n`
    for (const g of groups) {
      const genderEmoji = g.gender === 'MALE' ? '👨' : '🧕'
      message += `• ${genderEmoji} ${g.name} (${g._count.students} студ.)\n`
    }
    message += `\n`
  }

  message += `👥 Всего студентов: <b>${totalStudents}</b>\n\n`

  // Pending work
  message += `<b>📝 На проверку:</b>\n`
  message += `• Заучивание: <b>${pendingMemorizationCount}</b>\n`
  message += `• Повторение: <b>${pendingRevisionCount}</b>\n\n`
  message += `Выберите действие:`

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
    const { InlineKeyboard } = await import('grammy')
    const closeKeyboard = new InlineKeyboard().text('✖️ Закрыть', 'close_notification')
    await ctx.editMessageText(
      '📝 <b>Работы на проверку</b>\n\n<i>✅ Все работы проверены!</i>',
      {
        parse_mode: 'HTML',
        reply_markup: closeKeyboard
      }
    )
    return
  }

  // Show first submission with file and buttons together
  const first = submissions[0]
  const studentName = first.student.firstName?.trim() || 'Студент'
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

  // Calculate progress - clamp to 0-100 to avoid negative values
  const progressPercent = Math.round((first.task.currentCount / first.task.requiredCount) * 100)
  const clampedPercent = Math.min(100, Math.max(0, progressPercent))
  const progressBar = `[${'▓'.repeat(Math.round(clampedPercent / 10))}${'░'.repeat(10 - Math.round(clampedPercent / 10))}]`

  let caption = `📝 <b>Работа 1/${submissions.length}</b>\n\n`
  if (groupName) caption += `📚 <b>${groupName}</b>\n`
  caption += `👤 ${studentName}\n`
  caption += `📖 Стр. ${first.task.page?.pageNumber || 1}, ${lineRange}\n`
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

// ============== PROGRESS ADVANCEMENT ==============

/**
 * Advance student to next line/stage/page after completing a task
 */
async function advanceStudentProgress(studentId: string, task: any): Promise<void> {
  try {
    // Get group (from task.group or task.lesson.group)
    let group = task.group
    if (!group && task.lessonId) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: task.lessonId },
        include: { group: true }
      })
      group = lesson?.group
    }

    if (!group) return

    // Get student's group membership
    const studentGroup = await prisma.studentGroup.findFirst({
      where: {
        studentId,
        groupId: group.id,
        isActive: true
      }
    })

    if (!studentGroup) return

    const totalLines = await getPageTotalLines(studentGroup.currentPage)
    const linesPerTask = getLinesForLevel(group.level as GroupLevel)
    const currentStage = studentGroup.currentStage as StageNumber
    const firstHalfEnd = Math.min(7, totalLines)

    // Calculate next position
    let newLine = studentGroup.currentLine
    let newStage = currentStage
    let newPage = studentGroup.currentPage
    let progressMessage = ''

    // Определяем тип этапа: ИЗУЧЕНИЕ или СОЕДИНЕНИЕ
    const isLearningStage = currentStage === StageNumber.STAGE_1_1 || currentStage === StageNumber.STAGE_2_1

    // Для страниц с ≤7 строками: пропускаем этапы 2.1 и 2.2
    const isSimplePage = totalLines <= 7

    if (isLearningStage) {
      // ===== ЭТАПЫ ИЗУЧЕНИЯ (1.1, 2.1) =====
      // Проверяем есть ли ещё строки для изучения в текущем этапе
      const stageEndLine = currentStage === StageNumber.STAGE_1_1 ? firstHalfEnd : totalLines
      const stageStartLine = currentStage === StageNumber.STAGE_1_1 ? 1 : 8
      const stageTotalLines = stageEndLine - stageStartLine + 1

      // Определяем следующий батч на основе уровня
      let hasMoreBatches = false
      let nextBatchStart = 0
      let nextBatchEnd = 0

      if (group.level === GroupLevel.LEVEL_3) {
        // Level 3: один батч на весь этап
        hasMoreBatches = false
      } else if (group.level === GroupLevel.LEVEL_2) {
        // Level 2: два батча
        if (currentStage === StageNumber.STAGE_1_1) {
          // Stage 1.1: 3+4 (строки 1-3, затем 4-7)
          if (task.endLine <= 3) {
            hasMoreBatches = true
            nextBatchStart = 4
            nextBatchEnd = firstHalfEnd
          }
        } else {
          // Stage 2.1: 4+4 (строки 8-11, затем 12-15)
          const midPoint = 8 + Math.floor((totalLines - 7) / 2) - 1 // = 11
          if (task.endLine <= midPoint) {
            hasMoreBatches = true
            nextBatchStart = midPoint + 1
            nextBatchEnd = totalLines
          }
        }
      } else {
        // Level 1: по одной строке
        const nextLineInStage = task.endLine + 1
        if (nextLineInStage <= stageEndLine) {
          hasMoreBatches = true
          nextBatchStart = nextLineInStage
          nextBatchEnd = nextLineInStage
        }
      }

      if (hasMoreBatches) {
        // Ещё есть строки - продвигаемся к следующей группе строк
        newLine = nextBatchStart
        const lineRange = nextBatchStart === nextBatchEnd ? `строка ${nextBatchStart}` : `строки ${nextBatchStart}-${nextBatchEnd}`
        progressMessage = `📈 <b>Продолжайте изучение!</b>\n\nСледующее задание: ${lineRange}`
      } else {
        // Все строки этапа изучены - переход к соединению
        if (currentStage === StageNumber.STAGE_1_1) {
          if (isSimplePage) {
            // Для коротких страниц: 1.1 -> сразу STAGE_3 (вся страница)
            newStage = StageNumber.STAGE_3
            newLine = 1
            progressMessage = `🎉 <b>Этап 1.1 завершён!</b>\n\n` +
              `Вы изучили все строки 1-${totalLines} по отдельности.\n\n` +
              `📚 <b>Следующий этап 3: Вся страница</b>\n` +
              `Теперь сдавайте <b>ВСЮ СТРАНИЦУ</b> целиком (строки 1-${totalLines}).`
          } else {
            // Обычные страницы: 1.1 -> 1.2
            newStage = StageNumber.STAGE_1_2
            newLine = 1
            progressMessage = `🎉 <b>Этап 1.1 завершён!</b>\n\n` +
              `Вы изучили все строки 1-${firstHalfEnd} по отдельности.\n\n` +
              `📚 <b>Следующий этап 1.2: Соединение</b>\n` +
              `Теперь сдавайте строки 1-${firstHalfEnd} <b>ВСЕ ВМЕСТЕ</b>.`
          }
        } else {
          // STAGE_2_1 -> STAGE_2_2
          newStage = StageNumber.STAGE_2_2
          newLine = 8
          progressMessage = `🎉 <b>Этап 2.1 завершён!</b>\n\n` +
            `Вы изучили все строки 8-${totalLines} по отдельности.\n\n` +
            `📚 <b>Следующий этап 2.2: Соединение</b>\n` +
            `Теперь сдавайте строки 8-${totalLines} <b>ВСЕ ВМЕСТЕ</b>.`
        }
      }
    } else {
      // ===== ЭТАПЫ СОЕДИНЕНИЯ (1.2, 2.2, 3) =====
      // После выполнения сразу переходим к следующему этапу
      switch (currentStage) {
        case StageNumber.STAGE_1_2:
          if (isSimplePage) {
            // Для коротких страниц: 1.2 -> STAGE_3 (вся страница = то же самое)
            newStage = StageNumber.STAGE_3
            newLine = 1
            progressMessage = `🎉 <b>Этап 1.2 завершён!</b>\n\n` +
              `Вы освоили соединение строк 1-${totalLines}.\n\n` +
              `📚 <b>Следующий этап 3: Вся страница</b>\n` +
              `Последний этап! Сдавайте <b>ВСЮ СТРАНИЦУ</b> целиком.`
          } else {
            // Обычные страницы: 1.2 -> 2.1
            newStage = StageNumber.STAGE_2_1
            newLine = 8
            progressMessage = `🎉 <b>Этап 1.2 завершён!</b>\n\n` +
              `Вы освоили соединение строк 1-${firstHalfEnd}.\n\n` +
              `📚 <b>Следующий этап 2.1: Изучение</b>\n` +
              `Теперь учите строки 8-${totalLines} ${linesPerTask === 1 ? 'по одной' : `по ${linesPerTask}`}.`
          }
          break

        case StageNumber.STAGE_2_2:
          // 2.2 -> 3: переход к полной странице
          newStage = StageNumber.STAGE_3
          newLine = 1
          progressMessage = `🎉 <b>Этап 2.2 завершён!</b>\n\n` +
            `Вы освоили соединение строк 8-${totalLines}.\n\n` +
            `📚 <b>Следующий этап 3: Вся страница</b>\n` +
            `Теперь сдавайте <b>ВСЮ СТРАНИЦУ</b> целиком (1-${totalLines}).`
          break

        case StageNumber.STAGE_3:
          // Страница полностью выучена - переход на следующую!
          newPage = studentGroup.currentPage + 1
          newStage = StageNumber.STAGE_1_1
          newLine = 1
          const nextPageLines = await getPageTotalLines(newPage)
          const nextFirstHalfEnd = Math.min(7, nextPageLines)
          progressMessage = `🏆 <b>СТРАНИЦА ${studentGroup.currentPage} ВЫУЧЕНА!</b>\n\n` +
            `Поздравляем! Вы полностью освоили страницу.\n\n` +
            `🚀 <b>Переход на страницу ${newPage}</b>\n` +
            `Начинаем с этапа 1.1 - изучение строк 1-${nextFirstHalfEnd}.`
          break
      }
    }

    // Update StudentGroup
    await prisma.studentGroup.update({
      where: { id: studentGroup.id },
      data: {
        currentLine: newLine,
        currentStage: newStage,
        currentPage: newPage
      }
    })

    // Also update legacy User fields for compatibility
    await prisma.user.update({
      where: { id: studentId },
      data: {
        currentLine: newLine,
        currentStage: newStage,
        currentPage: newPage
      }
    })

    // Notify student about progression
    if (progressMessage) {
      const student = await prisma.user.findUnique({
        where: { id: studentId }
      })

      if (student?.telegramId) {
        const { bot } = await import('../bot')
        const { InlineKeyboard } = await import('grammy')
        const { deleteMessagesByTypeForChat, trackMessageForChat } = await import('../utils/message-cleaner')
        const { getPrimarySurahByPage } = await import('@/lib/constants/surahs')
        const { getLinesForLevelName } = await import('../keyboards/main-menu')

        // Delete old submission confirms to keep chat clean (but not menus - we're about to send one)
        const botToken = process.env.TELEGRAM_BOT_TOKEN
        if (botToken) {
          await deleteMessagesByTypeForChat(Number(student.telegramId), 'submission_confirm', botToken)
        }

        // Get surah name
        const surah = getPrimarySurahByPage(newPage)
        const surahStr = surah ? ` ${surah.nameArabic}` : ''
        const levelStr = getLinesForLevelName(group.level as GroupLevel)

        let message = `✅ <b>Задание выполнено!</b>\n\n`
        message += `${progressMessage}\n\n`
        message += `━━━━━━━━━━━━━━━━━━\n`
        message += `📖 Страница ${newPage}${surahStr}\n`
        message += `📐 Уровень: ${levelStr}\n`
        message += `━━━━━━━━━━━━━━━━━━`

        const keyboard = new InlineKeyboard()
          .text('▶️ Начать следующее задание', 'student:start_stage')
          .row()
          .text('◀️ В меню', 'student:menu')

        const sentMsg = await bot.api.sendMessage(Number(student.telegramId), message, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        })

        // Track as menu for cleanup
        await trackMessageForChat(Number(student.telegramId), sentMsg.message_id, studentId, 'menu')
      }
    }
  } catch (error) {
    console.error('Failed to advance student progress:', error)
  }
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

    // Check if task is completed - all required submissions passed
    // Note: failedCount tracks history, doesn't block completion if all passed
    if (task.passedCount >= task.requiredCount) {
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

      // Move student to next line/stage/page
      await advanceStudentProgress(submission.studentId, task)
    }

    // Answer callback
    await ctx.answerCallbackQuery({
      text: status === SubmissionStatus.PASSED ? '✅ Принято' : '❌ Отклонено'
    })

    // Delete the review message and the video note (if reply) to keep ustaz chat clean
    try {
      const msg = ctx.callbackQuery?.message
      const chatId = ctx.chat!.id
      const messageIdsToDelete: number[] = []

      // If this message is a reply to the video note, delete the video note too
      if (msg && 'reply_to_message' in msg && msg.reply_to_message) {
        try {
          await ctx.api.deleteMessage(chatId, msg.reply_to_message.message_id)
          messageIdsToDelete.push(msg.reply_to_message.message_id)
        } catch (e) {
          // Video note might already be deleted
        }
      }

      // Delete the review message
      if (msg?.message_id) {
        messageIdsToDelete.push(msg.message_id)
      }
      await ctx.deleteMessage()

      // Also clean from tracking database
      if (messageIdsToDelete.length > 0) {
        await prisma.botMessage.deleteMany({
          where: {
            chatId: BigInt(chatId),
            messageId: { in: messageIdsToDelete.map(id => BigInt(id)) }
          }
        })
      }
    } catch (e) {
      // Ignore if can't delete
    }

    // Notify student about result
    try {
      const student = submission.task.student
      if (student.telegramId) {
        const { bot } = await import('../bot')
        const { deleteMessagesByTypeForChat } = await import('../utils/message-cleaner')
        const botToken = process.env.TELEGRAM_BOT_TOKEN
        const studentChatId = Number(student.telegramId)

        // If rejected, delete old submission confirmation messages to avoid confusion
        if (status === SubmissionStatus.FAILED && botToken) {
          await deleteMessagesByTypeForChat(studentChatId, 'submission_confirm', botToken)
        }

        const lineRange = submission.task.startLine === submission.task.endLine
          ? `строка ${submission.task.startLine}`
          : `строки ${submission.task.startLine}-${submission.task.endLine}`

        // Check if task is now complete
        const taskComplete = task.passedCount >= task.requiredCount
        const remaining = task.requiredCount - task.passedCount

        let message: string
        const { InlineKeyboard } = await import('grammy')
        const notificationKeyboard = new InlineKeyboard()

        if (taskComplete && status === SubmissionStatus.PASSED) {
          // Task completed! advanceStudentProgress already sent a notification
          // Just clean up old submission confirms, but NOT menus (the new notification is tracked as menu)
          if (botToken) {
            await deleteMessagesByTypeForChat(studentChatId, 'submission_confirm', botToken)
          }
          // Don't send additional notification - advanceStudentProgress already handled it
          return
        } else if (status === SubmissionStatus.FAILED) {
          // Rejected - need resubmission
          message = `❌ <b>Запись отклонена</b>\n\n`
          message += `📖 Стр. ${submission.task.page?.pageNumber || 1}, ${lineRange}\n`
          message += `📊 Принято: <b>${task.passedCount}/${task.requiredCount}</b>\n`
          message += `❌ На пересдачу: <b>${task.failedCount}</b>\n\n`
          message += `<i>Отправьте запись повторно.</i>`

          notificationKeyboard.text('✖️ Закрыть', 'close_notification')
        } else {
          // Passed but more needed
          message = `✅ <b>Запись принята</b>\n\n`
          message += `📖 Стр. ${submission.task.page?.pageNumber || 1}, ${lineRange}\n`
          message += `📊 Принято: <b>${task.passedCount}/${task.requiredCount}</b>`

          if (remaining > 0) {
            message += `\n⏳ Осталось: <b>${remaining}</b>`
          }

          notificationKeyboard.text('✖️ Закрыть', 'close_notification')
        }

        const sentMsg = await bot.api.sendMessage(studentChatId, message, {
          parse_mode: 'HTML',
          reply_markup: notificationKeyboard
        })

        // Track message for cleanup (no auto-delete since we have close button)
        const { trackMessageForChat } = await import('../utils/message-cleaner')
        await trackMessageForChat(
          Number(student.telegramId),
          sentMsg.message_id,
          student.id,
          'review_result'
        )
      }
    } catch (e) {
      console.error('Failed to notify student:', e)
    }

    // Show next submission from queue or "all done" message
    const ustazChatId = ctx.chat!.id
    const hasMore = await showNextPendingSubmissionToUstaz(ustazChatId, user.id)

    if (!hasMore) {
      // No more pending submissions - show "all done" message
      const { InlineKeyboard } = await import('grammy')

      const doneKeyboard = new InlineKeyboard()
        .text('✖️ Закрыть', 'close_notification')

      await ctx.reply(
        `✅ <b>Все работы проверены!</b>\n\nНет ожидающих работ на проверку.`,
        {
          parse_mode: 'HTML',
          reply_markup: doneKeyboard
        }
      )
    }
  }
}

// ============== SYNC STATUS HANDLERS ==============

/**
 * Show sync status for student's submissions
 */
async function showSyncStatus(ctx: BotContext, user: any): Promise<void> {
  const status = await checkDeliveryStatus(user.id)

  let message = `🔄 <b>Статус синхронизации</b>\n\n`

  if (status.totalPending === 0) {
    message += `✅ Нет работ на проверке.\n`
    message += `<i>Все ваши работы уже проверены устазом.</i>`
  } else {
    message += `📥 На проверке: <b>${status.totalPending}</b>\n`
    if (status.delivered > 0) {
      message += `✅ Доставлено устазу: <b>${status.delivered}</b>\n`
    }
    if (status.failed > 0) {
      message += `⚠️ Ошибки доставки: <b>${status.failed}</b>\n`
    }

    // Show failed submissions with retry option
    if (status.failedSubmissions.length > 0) {
      message += `\n❌ <b>Проблемы с доставкой:</b>\n`
      for (const failed of status.failedSubmissions.slice(0, 5)) {
        message += `• Стр. ${failed.pageNumber}, строки ${failed.startLine}-${failed.endLine}\n`
        if (failed.error) {
          message += `  <i>${failed.error.substring(0, 50)}${failed.error.length > 50 ? '...' : ''}</i>\n`
        }
      }
      message += `\n<i>Нажмите кнопку ниже для повторной отправки.</i>`
    }
  }

  const keyboard = new InlineKeyboard()

  // Add retry buttons for failed submissions
  if (status.failedSubmissions.length > 0) {
    keyboard.text('🔄 Повторить все', `student:retry_delivery:all`)
    keyboard.row()
  }

  keyboard.text('◀️ Назад', 'student:menu')

  await sendAndTrack(
    ctx,
    message,
    {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    },
    user.id,
    'menu'
  )
}

/**
 * Handle retry delivery request
 */
async function handleRetryDelivery(ctx: BotContext, user: any, id?: string): Promise<void> {
  if (id === 'all') {
    // Retry all failed deliveries
    const status = await checkDeliveryStatus(user.id)
    let successCount = 0
    let failCount = 0

    for (const failed of status.failedSubmissions) {
      const result = await retryDelivery(failed.submissionId)
      if (result.success) {
        successCount++
      } else {
        failCount++
      }
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Проверить снова', 'student:sync')
      .row()
      .text('◀️ В меню', 'student:menu')

    let message = ''
    if (successCount > 0 && failCount === 0) {
      message = `✅ <b>Успешно!</b>\n\n` +
        `Все ${successCount} работ отправлены устазу повторно.`
    } else if (successCount > 0) {
      message = `⚠️ <b>Частично успешно</b>\n\n` +
        `Отправлено: <b>${successCount}</b>\n` +
        `Ошибки: <b>${failCount}</b>\n\n` +
        `<i>Попробуйте ещё раз позже.</i>`
    } else {
      message = `❌ <b>Ошибка</b>\n\n` +
        `Не удалось отправить работы устазу.\n` +
        `<i>Попробуйте позже или обратитесь к администратору.</i>`
    }

    await sendAndTrack(
      ctx,
      message,
      {
        reply_markup: keyboard,
        parse_mode: 'HTML'
      },
      user.id,
      'menu'
    )
  } else if (id) {
    // Retry specific submission
    const result = await retryDelivery(id)

    const keyboard = new InlineKeyboard()
      .text('🔄 Статус синхронизации', 'student:sync')
      .row()
      .text('◀️ В меню', 'student:menu')

    if (result.success) {
      await sendAndTrack(
        ctx,
        `✅ <b>Работа отправлена!</b>\n\nУстаз получит уведомление о проверке.`,
        {
          reply_markup: keyboard,
          parse_mode: 'HTML'
        },
        user.id,
        'menu'
      )
    } else {
      await sendAndTrack(
        ctx,
        `❌ <b>Ошибка отправки</b>\n\n${result.error || 'Попробуйте позже.'}`,
        {
          reply_markup: keyboard,
          parse_mode: 'HTML'
        },
        user.id,
        'menu'
      )
    }
  }
}

// ============== MUFRADAT (TRANSLATIONS) HANDLERS ==============

/**
 * Show mufradat menu - accessible to all students
 */
async function showMufradatMenu(ctx: BotContext, user: any, offset: number = 0): Promise<void> {
  const { getTranslationPageSelectKeyboard } = await import('../keyboards/main-menu')

  // Get student's TRANSLATION group to get settings
  const translationGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      isActive: true,
      group: { lessonType: LessonType.TRANSLATION }
    },
    include: { group: true }
  })

  // Get student's MEMORIZATION group progress to determine learned pages
  const memorizationGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      isActive: true,
      group: { lessonType: LessonType.MEMORIZATION }
    },
    include: { group: true }
  })

  // Use memorization progress or fallback to user's progress
  const currentPage = memorizationGroup?.currentPage ?? user.currentPage
  const groupId = translationGroup?.groupId || memorizationGroup?.groupId

  if (!groupId) {
    // No groups - show generic info
    const message = `📝 <b>Переводы (Муфрадат)</b>\n\n` +
      `🎮 Игра «Угадай слово» для изучения арабских слов.\n\n` +
      `❗ <i>Чтобы играть, нужно присоединиться к группе.</i>`

    try {
      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: getBackKeyboard('student:menu', '◀️ В меню')
      })
    } catch {
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: getBackKeyboard('student:menu', '◀️ В меню')
      })
    }
    return
  }

  // Learned pages are all pages before current page (pages 1 to currentPage-1)
  // If currentPage is 1, we still allow page 1
  const learnedPages: number[] = []
  const maxPage = Math.max(currentPage - 1, 1) // At least page 1
  for (let i = 1; i <= maxPage; i++) {
    learnedPages.push(i)
  }

  // Get today's date for daily progress
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get today's progress for all pages
  const todayProgress = await prisma.translationPageProgress.findMany({
    where: {
      studentId: user.id,
      groupId,
      date: today,
    },
    select: {
      pageNumber: true,
      bestScore: true,
    }
  })

  // Build progress map
  const pageProgress = new Map<number, number>()
  for (const p of todayProgress) {
    pageProgress.set(p.pageNumber, p.bestScore)
  }

  // Calculate overall stats for today
  const pagesCompleted = todayProgress.filter(p => p.bestScore >= 80).length
  const totalPages = learnedPages.length
  const avgScore = todayProgress.length > 0
    ? Math.round(todayProgress.reduce((sum, p) => sum + p.bestScore, 0) / todayProgress.length)
    : 0

  // Get total words learned stats (all time)
  const allTimeStats = await prisma.translationPageProgress.aggregate({
    where: { studentId: user.id },
    _sum: { wordsCorrect: true },
    _count: true,
  })

  let message = `📝 <b>Переводы (Муфрадат)</b>\n\n`
  message += `📊 <b>Сегодня:</b>\n`
  message += `   Страниц пройдено: ${pagesCompleted}/${totalPages}\n`
  if (todayProgress.length > 0) {
    message += `   Средний балл: ${avgScore}%\n`
  }
  message += `\n`
  message += `📚 <b>Всего изучено:</b> ${allTimeStats._sum.wordsCorrect ?? 0} слов\n\n`
  message += `<i>Выберите страницу для практики:</i>\n`
  message += `<i>(✅ = пройдено сегодня, % = текущий прогресс)</i>`

  const keyboard = getTranslationPageSelectKeyboard(learnedPages, offset, 15, pageProgress)

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  } catch (error: any) {
    if (error?.description?.includes("can't be edited") ||
        error?.description?.includes('message to edit not found')) {
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      })
    }
  }
}

// ============== REVISION HANDLERS ==============

/**
 * Show list of learned pages for revision
 */
async function showRevisionPages(ctx: BotContext, user: any, offset: number = 0): Promise<void> {
  // Get student's REVISION group to get settings
  const revisionGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      isActive: true,
      group: { lessonType: LessonType.REVISION }
    },
    include: { group: true }
  })

  // Get student's MEMORIZATION group progress to determine learned pages
  const memorizationGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      isActive: true,
      group: { lessonType: LessonType.MEMORIZATION }
    },
    include: { group: true }
  })

  // Use group progress or fallback to user's progress
  const currentPage = memorizationGroup?.currentPage ?? user.currentPage
  const revisionPagesPerDay = revisionGroup?.group?.revisionPagesPerDay ?? 3
  const revisionAllPages = revisionGroup?.group?.revisionAllPages ?? false
  const revisionButtonOnly = revisionGroup?.group?.revisionButtonOnly ?? false

  // Learned pages are all pages before current page
  // If on page 5, learned pages are 1, 2, 3, 4
  const learnedPages: number[] = []
  for (let i = 1; i < currentPage; i++) {
    learnedPages.push(i)
  }

  // Calculate required pages for today
  const requiredPagesCount = revisionAllPages
    ? learnedPages.length  // Must revise ALL learned pages
    : revisionPagesPerDay  // Must revise fixed number per day

  if (learnedPages.length === 0) {
    const message = `🔄 <b>Повторение</b>\n\n` +
      `📚 У вас пока нет выученных страниц.\n\n` +
      `<i>Продолжайте изучение, и выученные страницы появятся здесь для повторения.</i>`

    try {
      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: getBackKeyboard('student:menu', '◀️ В меню')
      })
    } catch (error: any) {
      if (error?.description?.includes("can't be edited") ||
          error?.description?.includes('message to edit not found')) {
        await ctx.reply(message, {
          parse_mode: 'HTML',
          reply_markup: getBackKeyboard('student:menu', '◀️ В меню')
        })
      }
    }
    return
  }

  // Get today's date
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let todayPassed = 0
  let todayPending = 0
  let todayFailed = 0
  let todayMarkedPages: number[] = []

  if (revisionButtonOnly && revisionGroup) {
    // For button-only mode, use DailyRevisionLog
    const todayLogs = await prisma.dailyRevisionLog.findMany({
      where: {
        studentId: user.id,
        groupId: revisionGroup.groupId,
        date: today,
      }
    })
    todayMarkedPages = todayLogs.map(l => l.pageNumber)
    todayPassed = todayLogs.filter(l => l.ustazAckedAt).length
    todayPending = todayLogs.filter(l => !l.ustazAckedAt).length
  } else {
    // For voice mode, use RevisionSubmission
    const todaySubmissions = await prisma.revisionSubmission.findMany({
      where: {
        studentId: user.id,
        date: today,
      },
      select: {
        pageNumber: true,
        status: true,
      }
    })

    todayPassed = todaySubmissions.filter(s => s.status === SubmissionStatus.PASSED).length
    todayPending = todaySubmissions.filter(s => s.status === SubmissionStatus.PENDING).length
    todayFailed = todaySubmissions.filter(s => s.status === SubmissionStatus.FAILED).length
    todayMarkedPages = todaySubmissions.map(s => s.pageNumber)
  }

  // Get revision stats for this student (all time)
  const revisionStats = await prisma.revisionSubmission.groupBy({
    by: ['pageNumber', 'status'],
    where: { studentId: user.id },
    _count: true
  })

  // Count total revisions per page
  const pageStats: Record<number, { passed: number; failed: number; pending: number }> = {}
  for (const stat of revisionStats) {
    if (!pageStats[stat.pageNumber]) {
      pageStats[stat.pageNumber] = { passed: 0, failed: 0, pending: 0 }
    }
    if (stat.status === SubmissionStatus.PASSED) {
      pageStats[stat.pageNumber].passed = stat._count
    } else if (stat.status === SubmissionStatus.FAILED) {
      pageStats[stat.pageNumber].failed = stat._count
    } else {
      pageStats[stat.pageNumber].pending = stat._count
    }
  }

  // Calculate total revisions
  const totalRevisions = revisionStats.reduce((sum, s) => sum + s._count, 0)
  const passedRevisions = revisionStats
    .filter(s => s.status === SubmissionStatus.PASSED)
    .reduce((sum, s) => sum + s._count, 0)

  // Build today's progress message
  const markedCount = todayPassed + todayPending  // Total marked today
  const remainingToday = Math.max(0, requiredPagesCount - markedCount)
  const todayComplete = remainingToday === 0

  let todayProgressText = ''
  if (revisionAllPages) {
    // Show all pages mode info
    if (todayComplete) {
      todayProgressText = `✅ <b>Все страницы повторены!</b>\n`
    } else {
      todayProgressText = `📅 <b>Сегодня:</b> ${markedCount}/${requiredPagesCount} стр.\n`
      if (todayPending > 0) {
        todayProgressText += `⏳ ${todayPending} ожидают подтверждения\n`
      }
      todayProgressText += `📝 Осталось повторить: <b>${remainingToday}</b> стр.\n`
    }
    todayProgressText += `\n<i>Режим: повторить все выученные страницы</i>\n`
  } else {
    if (todayComplete) {
      todayProgressText = `✅ <b>Норма на сегодня выполнена!</b>\n`
    } else {
      todayProgressText = `📅 <b>Сегодня:</b> ${todayPassed}/${requiredPagesCount} стр.`
      if (todayPending > 0) {
        todayProgressText += ` (⏳ ${todayPending} на проверке)`
      }
      todayProgressText += `\n`
      if (remainingToday > 0) {
        todayProgressText += `📝 Осталось сдать: <b>${remainingToday}</b> стр.\n`
      }
    }
  }

  const message = `🔄 <b>Повторение</b>\n\n` +
    todayProgressText +
    `\n━━━━━━━━━━━━━━━━━━\n` +
    `📚 Выучено страниц: <b>${learnedPages.length}</b>\n` +
    `✅ Всего повторений: <b>${totalRevisions}</b> (сдано: ${passedRevisions})\n\n` +
    `<i>Выберите страницу для повторения:</i>`

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: getRevisionPageSelectKeyboard(learnedPages, offset, 15, todayMarkedPages)
    })
  } catch (error: any) {
    if (error?.description?.includes("can't be edited") ||
        error?.description?.includes('message to edit not found')) {
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: getRevisionPageSelectKeyboard(learnedPages, offset, 15, todayMarkedPages)
      })
    }
  }
}

/**
 * Handle revision callbacks (page selection, offset navigation)
 */
async function handleRevisionCallback(
  ctx: BotContext,
  user: any,
  action: string,
  value?: string
): Promise<void> {
  // action is actually the second part of "revision:page:5" -> "page"
  // value is the third part -> "5"
  if (action === 'page' && value) {
    await showRevisionSubmitMode(ctx, user, parseInt(value))
  } else if (action === 'offset' && value) {
    await showRevisionPages(ctx, user, parseInt(value))
  } else if (action === 'mark' && value) {
    await handleRevisionMarkButton(ctx, user, parseInt(value))
  } else if (action === 'ack' && value) {
    await handleRevisionAcknowledge(ctx, user, value)
  }
}

/**
 * Handle student clicking "Повторил" button (button-only mode)
 */
async function handleRevisionMarkButton(ctx: BotContext, user: any, pageNumber: number): Promise<void> {
  // Get student's REVISION group
  const revisionGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      isActive: true,
      group: { lessonType: LessonType.REVISION }
    },
    include: {
      group: {
        include: {
          ustaz: true
        }
      }
    }
  })

  if (!revisionGroup?.group?.revisionButtonOnly) {
    await ctx.answerCallbackQuery({ text: 'Режим не активен', show_alert: true })
    return
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Check if already marked today
  const existingLog = await prisma.dailyRevisionLog.findUnique({
    where: {
      studentId_groupId_date_pageNumber: {
        studentId: user.id,
        groupId: revisionGroup.groupId,
        date: today,
        pageNumber
      }
    }
  })

  if (existingLog) {
    await ctx.answerCallbackQuery({ text: 'Уже отмечено сегодня!', show_alert: true })
    return
  }

  // Create revision log entry
  const revisionLog = await prisma.dailyRevisionLog.create({
    data: {
      studentId: user.id,
      groupId: revisionGroup.groupId,
      date: today,
      pageNumber,
    }
  })

  await ctx.answerCallbackQuery({ text: '✅ Отмечено!' })

  // Update the message to show it's marked
  const message = `🔄 <b>Повторение страницы ${pageNumber}</b>\n\n` +
    `✅ <b>Отмечено!</b>\n` +
    `<i>Устаз получит уведомление.</i>`

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('◀️ Назад', 'revision:offset:0')
    })
  } catch (e) {
    // Ignore edit errors
  }

  // Notify ustaz
  await notifyUstazAboutRevisionMark(user, revisionGroup.group, revisionLog)
}

/**
 * Notify ustaz about student marking a page as revised
 */
async function notifyUstazAboutRevisionMark(
  student: any,
  group: any,
  revisionLog: any
): Promise<void> {
  try {
    if (!group.ustaz?.telegramId) return

    const { bot } = await import('../bot')
    const ustazChatId = Number(group.ustaz.telegramId)
    const studentName = student.firstName?.trim() || 'Студент'

    const message = `📖 <b>Повторение отмечено</b>\n\n` +
      `📚 Группа: <b>${group.name}</b>\n` +
      `👤 Студент: ${studentName}\n` +
      `📄 Страница: <b>${revisionLog.pageNumber}</b>\n\n` +
      `<i>Студент отметил, что повторил эту страницу.</i>`

    const keyboard = new InlineKeyboard()
      .text('👍 Принял', `revision:ack:${revisionLog.id}`)

    await bot.api.sendMessage(ustazChatId, message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  } catch (error) {
    console.error('Failed to notify ustaz about revision mark:', error)
  }
}

/**
 * Handle ustaz clicking "Принял" button for revision mark
 */
async function handleRevisionAcknowledge(ctx: BotContext, user: any, logId: string): Promise<void> {
  // Find the revision log
  const revisionLog = await prisma.dailyRevisionLog.findUnique({
    where: { id: logId },
    include: { student: true, group: true }
  })

  if (!revisionLog) {
    await ctx.answerCallbackQuery({ text: 'Запись не найдена', show_alert: true })
    try { await ctx.deleteMessage() } catch (e) {}
    return
  }

  // Check if already acknowledged
  if (revisionLog.ustazAckedAt) {
    await ctx.answerCallbackQuery({ text: 'Уже подтверждено', show_alert: true })
    try { await ctx.deleteMessage() } catch (e) {}
    return
  }

  // Update the log
  await prisma.dailyRevisionLog.update({
    where: { id: logId },
    data: {
      ustazAckedAt: new Date(),
      status: 'ACKNOWLEDGED'
    }
  })

  await ctx.answerCallbackQuery({ text: '✅ Подтверждено' })

  // Update message
  const studentName = revisionLog.student.firstName?.trim() || 'Студент'
  const message = `📖 <b>Повторение принято</b>\n\n` +
    `📚 Группа: <b>${revisionLog.group.name}</b>\n` +
    `👤 Студент: ${studentName}\n` +
    `📄 Страница: <b>${revisionLog.pageNumber}</b>\n\n` +
    `✅ <b>Подтверждено</b>`

  try {
    await ctx.editMessageText(message, { parse_mode: 'HTML' })
  } catch (e) {
    // Ignore edit errors
  }

  // Notify student (optional)
  try {
    const { bot } = await import('../bot')
    const studentChatId = Number(revisionLog.student.telegramId)
    if (studentChatId) {
      await bot.api.sendMessage(studentChatId,
        `✅ Устаз подтвердил повторение страницы ${revisionLog.pageNumber}!`,
        { parse_mode: 'HTML' }
      )
    }
  } catch (e) {
    // Ignore
  }
}

/**
 * Show revision submit mode for a specific page
 */
async function showRevisionSubmitMode(ctx: BotContext, user: any, pageNumber: number): Promise<void> {
  // Get student's REVISION group to get settings
  const revisionGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      isActive: true,
      group: { lessonType: LessonType.REVISION }
    },
    include: { group: true }
  })

  const buttonOnlyMode = revisionGroup?.group?.revisionButtonOnly ?? false

  // Update session to track revision mode
  ctx.session.step = buttonOnlyMode ? 'idle' : 'awaiting_revision'
  ctx.session.revisionPageNumber = pageNumber

  // Check if already marked today (for button-only mode)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayLog = await prisma.dailyRevisionLog.findUnique({
    where: {
      studentId_groupId_date_pageNumber: {
        studentId: user.id,
        groupId: revisionGroup?.groupId || '',
        date: today,
        pageNumber
      }
    }
  })

  // Get revision history for this page
  const revisions = await prisma.revisionSubmission.findMany({
    where: {
      studentId: user.id,
      pageNumber
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  let historyText = ''
  if (revisions.length > 0) {
    historyText = '\n\n<b>Последние повторения:</b>\n'
    for (const rev of revisions) {
      const date = rev.createdAt.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Asia/Bishkek'
      })
      const statusEmoji = rev.status === SubmissionStatus.PASSED ? '✅'
        : rev.status === SubmissionStatus.FAILED ? '❌' : '⏳'
      historyText += `${statusEmoji} ${date}\n`
    }
  }

  // Check if there's a pending revision
  const pendingRevision = revisions.find(r => r.status === SubmissionStatus.PENDING)
  let pendingText = ''
  if (pendingRevision) {
    pendingText = '\n\n⏳ <b>Ожидает проверки устаза</b>'
  }

  let message: string
  let keyboard: InlineKeyboard

  if (buttonOnlyMode) {
    // Button-only mode - just show button to mark as revised
    if (todayLog) {
      const statusEmoji = todayLog.ustazAckedAt ? '✅' : '⏳'
      const statusText = todayLog.ustazAckedAt
        ? 'Устаз подтвердил'
        : 'Ожидает подтверждения устаза'
      message = `🔄 <b>Повторение страницы ${pageNumber}</b>\n\n` +
        `${statusEmoji} <b>Сегодня уже отмечено!</b>\n` +
        `<i>${statusText}</i>\n` +
        `${historyText}`

      keyboard = new InlineKeyboard()
        .text('◀️ Назад', 'revision:offset:0')
    } else {
      message = `🔄 <b>Повторение страницы ${pageNumber}</b>\n\n` +
        `📖 Нажмите кнопку после того как повторите эту страницу.\n` +
        `<i>Устаз получит уведомление о вашем повторении.</i>\n` +
        `${historyText}`

      keyboard = new InlineKeyboard()
        .text('✅ Повторил', `revision:mark:${pageNumber}`).row()
        .text('◀️ Назад', 'revision:offset:0')
    }
  } else {
    // Voice/video mode
    message = `🔄 <b>Повторение страницы ${pageNumber}</b>\n\n` +
      `📖 Отправьте голосовое сообщение или видео-кружок с чтением этой страницы.\n` +
      `${historyText}${pendingText}`

    keyboard = getRevisionSubmitKeyboard(pageNumber)
  }

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  } catch (error: any) {
    if (error?.description?.includes("can't be edited") ||
        error?.description?.includes('message to edit not found')) {
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard
      })
    }
  }
}

/**
 * Handle ustaz reviewing revision submission
 */
async function handleRevisionReviewCallback(
  ctx: BotContext,
  user: any,
  action: string,
  revisionId: string
): Promise<void> {
  if (action !== 'pass' && action !== 'fail') return

  const status = action === 'pass' ? SubmissionStatus.PASSED : SubmissionStatus.FAILED

  // Find revision first
  const existingRevision = await prisma.revisionSubmission.findUnique({
    where: { id: revisionId }
  })

  if (!existingRevision) {
    await ctx.answerCallbackQuery({ text: 'Запись не найдена', show_alert: true })
    try {
      await ctx.deleteMessage()
    } catch (e) {
      // Ignore
    }
    return
  }

  // Check if already reviewed
  if (existingRevision.status !== SubmissionStatus.PENDING) {
    await ctx.answerCallbackQuery({ text: 'Уже проверено', show_alert: true })
    try {
      await ctx.deleteMessage()
    } catch (e) {
      // Ignore
    }
    return
  }

  // Update revision
  const revision = await prisma.revisionSubmission.update({
    where: { id: revisionId },
    data: {
      status,
      reviewerId: user.id,
      reviewedAt: new Date()
    },
    include: {
      student: true
    }
  })

  // Update daily revision progress
  if (existingRevision.date) {
    const updateData = status === SubmissionStatus.PASSED
      ? { pagesPassed: { increment: 1 } }
      : { pagesFailed: { increment: 1 } }

    // Try to update existing progress record
    const progress = await prisma.dailyRevisionProgress.findUnique({
      where: {
        studentId_date: {
          studentId: existingRevision.studentId,
          date: existingRevision.date,
        }
      }
    })

    if (progress) {
      const newPassed = status === SubmissionStatus.PASSED
        ? progress.pagesPassed + 1
        : progress.pagesPassed
      const isComplete = newPassed >= progress.pagesRequired

      await prisma.dailyRevisionProgress.update({
        where: {
          studentId_date: {
            studentId: existingRevision.studentId,
            date: existingRevision.date,
          }
        },
        data: {
          ...updateData,
          isComplete,
        }
      })
    }
  }

  // Answer callback
  await ctx.answerCallbackQuery({
    text: status === SubmissionStatus.PASSED ? '✅ Принято' : '❌ Отклонено'
  })

  // Delete the review message and video note (if reply)
  try {
    const msg = ctx.callbackQuery?.message
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

  // Notify student
  try {
    const student = revision.student
    if (student.telegramId) {
      const { bot } = await import('../bot')
      const resultEmoji = status === SubmissionStatus.PASSED ? '✅' : '❌'
      const resultText = status === SubmissionStatus.PASSED ? 'принято' : 'отклонено'

      const message = `${resultEmoji} <b>Повторение ${resultText}</b>\n\n` +
        `📖 Страница: <b>${revision.pageNumber}</b>\n\n` +
        `<i>Продолжайте повторять выученные страницы!</i>`

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
    console.error('Failed to notify student about revision:', e)
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
    case 'confirm':
      await confirmAndSendToUstaz(ctx, user, taskId)
      break
    case 'advance':
      await advanceToNextStage(ctx, user, taskId)
      break
  }
}

/**
 * Advance student to the next stage after task completion
 */
async function advanceToNextStage(ctx: BotContext, user: any, taskId: string): Promise<void> {
  // Find the task
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      page: true,
      group: true,
    }
  })

  if (!task) {
    await ctx.answerCallbackQuery({ text: 'Задание не найдено', show_alert: true })
    return
  }

  // Verify task is complete (all submissions passed)
  if (task.passedCount < task.requiredCount) {
    await ctx.answerCallbackQuery({ text: 'Задание ещё не завершено', show_alert: true })
    return
  }

  // Mark task as completed if not already
  if (task.status !== TaskStatus.PASSED) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.PASSED,
        completedAt: new Date()
      }
    })
  }

  // Advance student progress to next stage/page
  await advanceStudentProgress(user.id, task)

  await ctx.answerCallbackQuery({ text: '✅ Переходим к следующему этапу!' })

  // Show the student menu with updated progress
  await showStudentMenuEdit(ctx, user)
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
  message += `📖 Страница ${task.page?.pageNumber || 1}, ${lineRange}\n\n`
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

/**
 * Confirm and send pending submission to ustaz
 * Called when student presses "Подтвердить работу" button on last submission
 * Now uses processSubmissionAndNotify for AI verification support
 */
async function confirmAndSendToUstaz(ctx: BotContext, user: any, taskId: string): Promise<void> {
  // Find pending submission for this task
  const pendingSubmission = await prisma.submission.findFirst({
    where: {
      taskId,
      studentId: user.id,
      status: SubmissionStatus.PENDING,
    },
    orderBy: { createdAt: 'desc' }
  })

  if (!pendingSubmission) {
    await ctx.answerCallbackQuery({ text: 'Нет записи для отправки', show_alert: true })
    return
  }

  // Get task with group/lesson info
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      page: true,
      lesson: {
        include: {
          group: { include: { ustaz: true } }
        }
      },
      group: { include: { ustaz: true } },
    }
  })

  if (!task) {
    await ctx.answerCallbackQuery({ text: 'Задание не найдено', show_alert: true })
    return
  }

  if (!pendingSubmission.fileId) {
    await ctx.answerCallbackQuery({ text: 'Файл не найден', show_alert: true })
    return
  }

  // Delete student's original message
  if (pendingSubmission.studentMsgId && ctx.chat?.id) {
    try {
      await ctx.api.deleteMessage(ctx.chat.id, Number(pendingSubmission.studentMsgId))
    } catch (e) {
      // Message might already be deleted
    }
  }

  try {
    // Use processSubmissionAndNotify for AI verification and notification
    // This handles AI processing, auto-pass/fail, and ustaz notification
    await processSubmissionAndNotify(task, pendingSubmission, user)

    await ctx.answerCallbackQuery({ text: '✅ Работа отправлена устазу!' })

    // Update message to show confirmation
    const lineRange = task.startLine === task.endLine
      ? `строка ${task.startLine}`
      : `строки ${task.startLine}-${task.endLine}`

    const confirmMessage = `✅ <b>Работа отправлена!</b>\n\n` +
      `📖 Страница ${task.page?.pageNumber || 1}, ${lineRange}\n` +
      `📊 Отправлено: <b>${task.currentCount}/${task.requiredCount}</b>\n\n` +
      `<i>Ожидайте проверку устаза.</i>`

    await ctx.editMessageText(confirmMessage, {
      parse_mode: 'HTML',
      reply_markup: getBackKeyboard('student:menu', '◀️ В меню')
    })
  } catch (error) {
    console.error('Failed to send to ustaz:', error)
    await ctx.answerCallbackQuery({ text: 'Ошибка отправки. Попробуйте снова.', show_alert: true })
  }
}

// ============== REGISTRATION CALLBACK HANDLER ==============

async function handleRegistrationCallback(
  ctx: BotContext,
  action: string,
  id?: string
): Promise<void> {
  const fullData = ctx.callbackQuery?.data || ''

  // Handle gender selection: reg:gender:MALE, reg:gender:FEMALE
  if (fullData.startsWith('reg:gender:')) {
    await handleGenderSelection(ctx)
    return
  }

  // Handle role selection: reg:role:STUDENT, reg:role:USTAZ, reg:role:PARENT
  if (fullData.startsWith('reg:role:')) {
    await handleRoleSelection(ctx)
    return
  }

  // Handle group selection: reg:group:{groupId}
  if (fullData.startsWith('reg:group:')) {
    await handleGroupSelection(ctx)
    return
  }

  // Handle group confirmation: reg:confirm_group:{groupId}
  if (fullData.startsWith('reg:confirm_group:')) {
    await handleGroupConfirm(ctx)
    return
  }

  // Handle back to group list
  if (fullData === 'reg:back_to_group_list') {
    await handleBackToGroupList(ctx)
    return
  }

  // Handle back to role selection
  if (fullData === 'reg:back_to_role') {
    await handleBackToRole(ctx)
    return
  }

  // Handle progress page offset navigation
  if (fullData.startsWith('reg:progress_offset:')) {
    await handleProgressPageOffset(ctx)
    return
  }

  // Handle progress page selection
  if (fullData.startsWith('reg:progress_page:')) {
    await handleProgressPageSelection(ctx)
    return
  }

  // Handle progress line selection
  if (fullData.startsWith('reg:progress_line:')) {
    await handleProgressLineSelection(ctx)
    return
  }

  // Handle progress stage selection
  if (fullData.startsWith('reg:progress_stage:')) {
    await handleProgressStageSelection(ctx)
    return
  }

  // Handle back to progress page
  if (fullData === 'reg:back_to_progress_page') {
    await handleBackToProgressPage(ctx)
    return
  }

  // Handle back to progress line
  if (fullData.startsWith('reg:back_to_progress_line:')) {
    await handleBackToProgressLine(ctx)
    return
  }

  // Handle back to group confirm from progress selection
  if (fullData === 'reg:back_to_group_confirm') {
    await handleBackToGroupConfirmFromProgress(ctx)
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
    case 'stats':
      // id is groupId
      if (id) {
        await showMufradatStats(ctx, user, id)
      }
      break
    default:
      await ctx.answerCallbackQuery({ text: 'Неизвестное действие игры' })
  }
}

// ============== TRANSLATION HANDLERS ==============

async function handleTranslationCallback(
  ctx: BotContext,
  user: any,
  action: string,
  value?: string
): Promise<void> {
  switch (action) {
    case 'offset':
      // Pagination - value is offset
      if (value) {
        await showMufradatMenu(ctx, user, parseInt(value))
      }
      break
    case 'page':
      // Start game for specific page
      if (value) {
        await startTranslationGameForPage(ctx, user, parseInt(value))
      }
      break
    case 'stats':
      // Show detailed stats
      await showTranslationDetailedStats(ctx, user)
      break
    default:
      await ctx.answerCallbackQuery({ text: 'Неизвестное действие' })
  }
}

/**
 * Start translation game for a specific page
 */
async function startTranslationGameForPage(ctx: BotContext, user: any, pageNumber: number): Promise<void> {
  // Get student's group
  let studentGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      isActive: true,
      group: { lessonType: LessonType.TRANSLATION }
    },
    include: { group: true }
  })

  if (!studentGroup) {
    studentGroup = await prisma.studentGroup.findFirst({
      where: {
        studentId: user.id,
        isActive: true,
        group: { lessonType: LessonType.MEMORIZATION }
      },
      include: { group: true }
    })
  }

  if (!studentGroup) {
    await ctx.answerCallbackQuery({ text: 'Группа не найдена', show_alert: true })
    return
  }

  // Store selected page in session for game
  ctx.session.translationSelectedPage = pageNumber

  // Start the mufradat game with pageNumber context
  await startMufradatGame(ctx, user, studentGroup.groupId, pageNumber)
}

/**
 * Show detailed translation statistics
 */
async function showTranslationDetailedStats(ctx: BotContext, user: any): Promise<void> {
  // Get all-time stats
  const allTimeProgress = await prisma.translationPageProgress.groupBy({
    by: ['pageNumber'],
    where: { studentId: user.id },
    _sum: { wordsCorrect: true, wordsWrong: true, attempts: true },
    _max: { bestScore: true },
  })

  // Get today's stats
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayProgress = await prisma.translationPageProgress.findMany({
    where: {
      studentId: user.id,
      date: today,
    },
    select: {
      pageNumber: true,
      wordsCorrect: true,
      wordsWrong: true,
      bestScore: true,
      attempts: true,
    }
  })

  // Calculate totals
  const totalWordsLearned = allTimeProgress.reduce((sum, p) => sum + (p._sum.wordsCorrect ?? 0), 0)
  const totalAttempts = allTimeProgress.reduce((sum, p) => sum + (p._sum.attempts ?? 0), 0)
  const pagesStudied = allTimeProgress.length
  const todayPagesStudied = todayProgress.filter(p => p.bestScore > 0).length
  const todayWordsLearned = todayProgress.reduce((sum, p) => sum + p.wordsCorrect, 0)

  let message = `📊 <b>Статистика переводов</b>\n\n`
  message += `<b>📅 Сегодня:</b>\n`
  message += `   Страниц изучено: ${todayPagesStudied}\n`
  message += `   Слов выучено: ${todayWordsLearned}\n\n`
  message += `<b>📚 Всего:</b>\n`
  message += `   Страниц изучено: ${pagesStudied}\n`
  message += `   Слов выучено: ${totalWordsLearned}\n`
  message += `   Попыток: ${totalAttempts}\n\n`

  if (todayProgress.length > 0) {
    message += `<b>📈 Результаты сегодня:</b>\n`
    for (const p of todayProgress.slice(0, 10)) {
      const bar = buildProgressBar(p.bestScore)
      message += `   Стр. ${p.pageNumber}: ${bar}\n`
    }
    if (todayProgress.length > 10) {
      message += `   <i>... и ещё ${todayProgress.length - 10} страниц</i>\n`
    }
  }

  const keyboard = getBackKeyboard('student:mufradat', '◀️ Назад к страницам')

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  } catch {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  }
}

// ============== MEMORIZATION STAGES UI ==============

/**
 * Show memorization stages for current page
 */
async function showMemorizationStages(ctx: BotContext, user: any, studentGroup: any): Promise<void> {
  const group = studentGroup.group
  const pageNumber = studentGroup.currentPage
  const currentStage = studentGroup.currentStage as StageNumber

  // Get surah name for this page
  const surah = getPrimarySurahByPage(pageNumber)
  const surahName = surah ? `Сура ${surah.nameArabic}` : `Страница ${pageNumber}`

  // Calculate total lines for this page
  const totalLines = await getPageTotalLines(pageNumber)
  const linesPerTask = getLinesForLevel(group.level as GroupLevel)

  // Check if student has multiple groups (for back button)
  const groupCount = await prisma.studentGroup.count({
    where: { studentId: user.id, isActive: true }
  })
  const hasMultipleGroups = groupCount > 1

  // Build stages info
  const stages: StageProgressInfo[] = await buildStagesProgress(
    user.id,
    group.id,
    pageNumber,
    currentStage,
    totalLines,
    linesPerTask
  )

  const message = `📖 <b>Страница ${pageNumber}</b> - ${surahName}\n\n` +
    `📊 Выберите этап для сдачи:\n\n` +
    `<i>Текущий этап: ${getStageShortName(currentStage)}</i>`

  const keyboard = getMemorizationStagesKeyboard(
    group.id,
    pageNumber,
    surahName,
    stages,
    getStageShortName(currentStage),
    hasMultipleGroups
  )

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  } catch {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  }
}

/**
 * Build progress info for all stages
 */
async function buildStagesProgress(
  studentId: string,
  groupId: string,
  pageNumber: number,
  currentStage: StageNumber,
  totalLines: number,
  linesPerTask: number
): Promise<StageProgressInfo[]> {
  const stages: StageProgressInfo[] = []
  const stageOrder = [
    StageNumber.STAGE_1_1,
    StageNumber.STAGE_1_2,
    StageNumber.STAGE_2_1,
    StageNumber.STAGE_2_2,
    StageNumber.STAGE_3
  ]

  // For short pages (<=7 lines), skip stages 1.2, 2.1, 2.2
  const isShortPage = totalLines <= 7
  const validStages = isShortPage
    ? [StageNumber.STAGE_1_1, StageNumber.STAGE_3]
    : stageOrder

  const currentStageIndex = validStages.indexOf(currentStage)

  for (const stage of validStages) {
    const stageIndex = validStages.indexOf(stage)
    const isCurrentStage = stage === currentStage
    const isLearningStage = stage === StageNumber.STAGE_1_1 || stage === StageNumber.STAGE_2_1
    const isPastStage = stageIndex < currentStageIndex
    const isLockedStage = stageIndex > currentStageIndex

    // Calculate lines for learning stages
    let linesCount = 0
    let completedLines = 0

    if (isLearningStage) {
      if (stage === StageNumber.STAGE_1_1) {
        linesCount = Math.min(7, totalLines)
      } else {
        linesCount = Math.max(0, totalLines - 7)
      }

      if (isPastStage) {
        completedLines = linesCount
      } else if (isCurrentStage) {
        // Count completed line progress records
        const lineProgress = await prisma.lineProgress.count({
          where: {
            studentId,
            groupId,
            pageNumber,
            stage,
            status: 'COMPLETED'
          }
        })
        completedLines = lineProgress
      }
    }

    // Check for pending tasks
    const hasPendingTask = await prisma.task.findFirst({
      where: {
        studentId,
        groupId,
        stage,
        page: { pageNumber },
        status: TaskStatus.IN_PROGRESS
      }
    })

    // Check for pending submissions
    const hasPendingSubmission = hasPendingTask ? await prisma.submission.findFirst({
      where: {
        taskId: hasPendingTask.id,
        status: SubmissionStatus.PENDING
      }
    }) : null

    let status: 'completed' | 'in_progress' | 'pending' | 'locked'
    if (isLockedStage) {
      status = 'locked'
    } else if (isPastStage) {
      status = 'completed'
    } else if (hasPendingSubmission) {
      status = 'pending'
    } else if (hasPendingTask) {
      status = 'in_progress'
    } else if (isCurrentStage) {
      status = 'in_progress'
    } else {
      status = 'completed'
    }

    stages.push({
      stage,
      totalLines: linesCount,
      completedLines,
      hasActiveTask: !!hasPendingTask,
      isCurrentStage,
      status
    })
  }

  return stages
}

/**
 * Handle mem_stages callback - show stages for a page
 */
async function handleMemStagesCallback(
  ctx: BotContext,
  user: any,
  action: string,
  id?: string
): Promise<void> {
  // Parse: groupId:pageNumber
  const [groupId, pageNumberStr] = [action, id]
  const pageNumber = parseInt(pageNumberStr || '1')

  const studentGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      groupId,
      isActive: true
    },
    include: { group: true }
  })

  if (!studentGroup) {
    await ctx.answerCallbackQuery({ text: 'Группа не найдена' })
    return
  }

  await showMemorizationStages(ctx, user, studentGroup)
}

/**
 * Handle mem_stage callback - show specific stage details
 */
async function handleMemStageCallback(
  ctx: BotContext,
  user: any,
  action: string,
  id?: string
): Promise<void> {
  // Parse: groupId:pageNumber:stage from full callback data
  const fullData = ctx.callbackQuery?.data || ''
  const parts = fullData.split(':')
  // mem_stage:groupId:pageNumber:stage
  if (parts.length < 4) {
    await ctx.answerCallbackQuery({ text: 'Неверные данные' })
    return
  }

  const groupId = parts[1]
  const pageNumber = parseInt(parts[2])
  const stage = parts[3] as StageNumber

  const studentGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      groupId,
      isActive: true
    },
    include: { group: true }
  })

  if (!studentGroup) {
    await ctx.answerCallbackQuery({ text: 'Группа не найдена' })
    return
  }

  const group = studentGroup.group
  const isLearningStage = stage === StageNumber.STAGE_1_1 || stage === StageNumber.STAGE_2_1

  if (isLearningStage) {
    // Show individual lines for learning stages
    await showMemorizationLines(ctx, user, studentGroup, pageNumber, stage)
  } else {
    // Show connection/full page submission UI
    await showMemorizationConnection(ctx, user, studentGroup, pageNumber, stage)
  }
}

/**
 * Show lines for a learning stage (1.1 or 2.1)
 */
async function showMemorizationLines(
  ctx: BotContext,
  user: any,
  studentGroup: any,
  pageNumber: number,
  stage: StageNumber
): Promise<void> {
  const group = studentGroup.group
  const totalLines = await getPageTotalLines(pageNumber)
  const linesPerTask = getLinesForLevel(group.level as GroupLevel)

  // Calculate line range for this stage
  let startLine: number
  let endLine: number

  if (stage === StageNumber.STAGE_1_1) {
    startLine = 1
    endLine = Math.min(7, totalLines)
  } else {
    startLine = 8
    endLine = totalLines
  }

  // Get line progress
  const lineProgressRecords = await prisma.lineProgress.findMany({
    where: {
      studentId: user.id,
      groupId: group.id,
      pageNumber,
      stage,
    }
  })

  // Check for active tasks per line
  const activeTasks = await prisma.task.findMany({
    where: {
      studentId: user.id,
      groupId: group.id,
      stage,
      page: { pageNumber },
      status: TaskStatus.IN_PROGRESS
    },
    include: {
      submissions: {
        where: { status: SubmissionStatus.PENDING }
      }
    }
  })

  // Build lines info
  const lines: LineProgressInfo[] = []
  let lastUnlockedLine = startLine - 1  // Last line that unlocks the next

  // Find last line that unlocks next (completed OR pending with all submissions sent)
  for (const lp of lineProgressRecords) {
    if (lp.status === 'COMPLETED' && lp.lineNumber > lastUnlockedLine) {
      lastUnlockedLine = lp.lineNumber
    }
  }
  // Also check for pending tasks (all submissions sent, waiting review)
  for (const task of activeTasks) {
    const requiredCount = group.repetitionCountLearning || group.repetitionCount || 80
    const allSubmitted = task.currentCount >= requiredCount ||
                         (task.passedCount + task.submissions.length) >= requiredCount
    if (allSubmitted && task.startLine > lastUnlockedLine) {
      lastUnlockedLine = task.startLine
    }
  }

  const requiredCount = group.repetitionCountLearning || group.repetitionCount || 80

  for (let lineNum = startLine; lineNum <= endLine; lineNum += linesPerTask) {
    const lineEndNum = Math.min(lineNum + linesPerTask - 1, endLine)
    const progress = lineProgressRecords.find(lp => lp.lineNumber === lineNum)
    const activeTask = activeTasks.find(t => t.startLine === lineNum)
    const hasPendingSubmission = activeTask && activeTask.submissions.length > 0
    const allSubmitted = activeTask && (activeTask.currentCount >= requiredCount ||
                         (activeTask.passedCount + activeTask.submissions.length) >= requiredCount)

    let status: 'not_started' | 'in_progress' | 'pending' | 'completed' | 'failed'
    if (progress?.status === 'COMPLETED') {
      status = 'completed'
    } else if (progress?.status === 'FAILED') {
      status = 'failed'
    } else if (allSubmitted) {
      status = 'pending'  // All submitted, waiting review
    } else if (hasPendingSubmission) {
      status = 'in_progress'  // Has some pending, but not all
    } else if (activeTask) {
      status = 'in_progress'
    } else if (progress?.status === 'IN_PROGRESS') {
      status = 'in_progress'
    } else {
      status = 'not_started'
    }

    // Line is active if:
    // - Already started (completed, in_progress, pending, failed)
    // - OR previous line is completed/pending (all submitted)
    const isActive = status === 'completed' ||
      status === 'in_progress' ||
      status === 'pending' ||
      status === 'failed' ||
      lineNum <= lastUnlockedLine + linesPerTask

    lines.push({
      lineNumber: lineNum,
      status,
      passedCount: progress?.passedCount || activeTask?.passedCount || 0,
      requiredCount,
      isActive
    })
  }

  const stageName = getStageShortName(stage)
  const message = `📖 <b>Страница ${pageNumber}</b> - ${stageName}\n` +
    `📊 Требуется повторений: <b>${requiredCount}</b>\n\n` +
    `📝 Выберите строку для сдачи:\n\n` +
    `<i>Легенда: ✅ сдано, ⏳ на проверке, 📝 в процессе, ○ не начато</i>`

  const keyboard = getMemorizationLinesKeyboard(group.id, pageNumber, stage, lines)

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  } catch {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  }
}

/**
 * Show connection/full page stage UI (1.2, 2.2, 3)
 */
async function showMemorizationConnection(
  ctx: BotContext,
  user: any,
  studentGroup: any,
  pageNumber: number,
  stage: StageNumber
): Promise<void> {
  const group = studentGroup.group
  const stageName = getStageShortName(stage)

  // Get required count based on stage type
  let requiredCount: number
  if (stage === StageNumber.STAGE_1_2 || stage === StageNumber.STAGE_2_2) {
    requiredCount = group.repetitionCountConnection || group.repetitionCount || 80
  } else {
    requiredCount = group.repetitionCountFull || group.repetitionCount || 80
  }

  // Check for active task
  const activeTask = await prisma.task.findFirst({
    where: {
      studentId: user.id,
      groupId: group.id,
      stage,
      page: { pageNumber },
      status: TaskStatus.IN_PROGRESS
    }
  })

  let passedCount = 0
  let pendingCount = 0

  if (activeTask) {
    passedCount = activeTask.passedCount
    pendingCount = await prisma.submission.count({
      where: {
        taskId: activeTask.id,
        status: SubmissionStatus.PENDING
      }
    })
  }

  let status: 'not_started' | 'in_progress' | 'pending' | 'completed'
  if (passedCount >= requiredCount) {
    status = 'completed'
  } else if (pendingCount > 0) {
    status = 'pending'
  } else if (activeTask) {
    status = 'in_progress'
  } else {
    status = 'not_started'
  }

  const remaining = requiredCount - passedCount - pendingCount
  const progressPercent = Math.round((passedCount / requiredCount) * 100)
  const progressBar = buildProgressBar(progressPercent)

  let message = `📖 <b>Страница ${pageNumber}</b> - ${stageName}\n\n`
  message += `${progressBar}\n`
  message += `✅ Принято: <b>${passedCount}/${requiredCount}</b>\n`

  if (pendingCount > 0) {
    message += `⏳ На проверке: <b>${pendingCount}</b>\n`
  }

  if (remaining > 0) {
    message += `📤 Осталось: <b>${remaining}</b>\n`
  }

  if (status === 'pending') {
    message += `\n<i>Ожидайте проверку устаза.</i>`
  } else if (status === 'completed') {
    message += `\n🎉 <b>Этап завершён!</b>`
  } else {
    message += `\n<i>Отправьте запись всей страницы.</i>`
  }

  const keyboard = getMemorizationConnectionKeyboard(
    group.id,
    pageNumber,
    stage,
    passedCount,
    requiredCount,
    pendingCount,
    status
  )

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  } catch {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  }
}

/**
 * Handle mem_line callback - start task for specific line
 */
async function handleMemLineCallback(
  ctx: BotContext,
  user: any,
  action: string,
  id?: string
): Promise<void> {
  // Parse: mem_line:groupId:pageNumber:stage:lineNumber
  const fullData = ctx.callbackQuery?.data || ''
  const parts = fullData.split(':')
  if (parts.length < 5) {
    await ctx.answerCallbackQuery({ text: 'Неверные данные' })
    return
  }

  const groupId = parts[1]
  const pageNumber = parseInt(parts[2])
  const stage = parts[3] as StageNumber
  const lineNumber = parseInt(parts[4])

  const studentGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      groupId,
      isActive: true
    },
    include: { group: true }
  })

  if (!studentGroup) {
    await ctx.answerCallbackQuery({ text: 'Группа не найдена' })
    return
  }

  const group = studentGroup.group

  // Check if already has an active task for THIS SPECIFIC LINE and STAGE
  // This allows students to work on multiple lines concurrently
  const existingTask = await prisma.task.findFirst({
    where: {
      studentId: user.id,
      groupId,
      status: TaskStatus.IN_PROGRESS,
      startLine: lineNumber,
      stage,
    },
    include: { page: true, group: true }
  })

  if (existingTask) {
    // Show existing task for this line
    await showTaskForGroup(ctx, user, existingTask, studentGroup)
    return
  }

  // Create or get the QuranPage
  let page = await prisma.quranPage.findUnique({
    where: { pageNumber }
  })

  if (!page) {
    page = await getOrCreateQuranPage(pageNumber)
  }

  // Calculate line range
  const linesPerTask = getLinesForLevel(group.level as GroupLevel)
  const totalLines = await getPageTotalLines(pageNumber)

  let endLine: number
  if (stage === StageNumber.STAGE_1_1) {
    endLine = Math.min(lineNumber + linesPerTask - 1, Math.min(7, totalLines))
  } else {
    endLine = Math.min(lineNumber + linesPerTask - 1, totalLines)
  }

  // Calculate deadline
  const stageHours = getStageHoursFromGroup(stage, group)
  const deadline = new Date()
  deadline.setTime(deadline.getTime() + stageHours * 60 * 60 * 1000)

  // Get required count for learning stage
  const requiredCount = group.repetitionCountLearning || group.repetitionCount || 80

  // Create task
  const task = await prisma.task.create({
    data: {
      groupId: group.id,
      studentId: user.id,
      pageId: page.id,
      startLine: lineNumber,
      endLine,
      stage,
      status: TaskStatus.IN_PROGRESS,
      requiredCount,
      deadline,
    },
    include: {
      page: true,
      group: true,
    }
  })

  // Create/update line progress
  await prisma.lineProgress.upsert({
    where: {
      studentId_groupId_pageNumber_lineNumber_stage: {
        studentId: user.id,
        groupId: group.id,
        pageNumber,
        lineNumber,
        stage
      }
    },
    create: {
      studentId: user.id,
      groupId: group.id,
      pageNumber,
      lineNumber,
      stage,
      status: 'IN_PROGRESS',
      requiredCount,
      startedAt: new Date()
    },
    update: {
      status: 'IN_PROGRESS',
      startedAt: new Date()
    }
  })

  await showTaskForGroup(ctx, user, task, studentGroup)
}

/**
 * Handle mem_start callback - start connection/full page task
 */
async function handleMemStartCallback(
  ctx: BotContext,
  user: any,
  action: string,
  id?: string
): Promise<void> {
  // Parse: mem_start:groupId:pageNumber:stage
  const fullData = ctx.callbackQuery?.data || ''
  const parts = fullData.split(':')
  if (parts.length < 4) {
    await ctx.answerCallbackQuery({ text: 'Неверные данные' })
    return
  }

  const groupId = parts[1]
  const pageNumber = parseInt(parts[2])
  const stage = parts[3] as StageNumber

  const studentGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      groupId,
      isActive: true
    },
    include: { group: true }
  })

  if (!studentGroup) {
    await ctx.answerCallbackQuery({ text: 'Группа не найдена' })
    return
  }

  const group = studentGroup.group

  // Check if already has an active task for THIS SPECIFIC STAGE
  // This allows students to work on different stages concurrently
  const existingTask = await prisma.task.findFirst({
    where: {
      studentId: user.id,
      groupId,
      status: TaskStatus.IN_PROGRESS,
      stage,
    },
    include: { page: true, group: true }
  })

  if (existingTask) {
    await showTaskForGroup(ctx, user, existingTask, studentGroup)
    return
  }

  // Create or get the QuranPage
  let page = await prisma.quranPage.findUnique({
    where: { pageNumber }
  })

  if (!page) {
    page = await getOrCreateQuranPage(pageNumber)
  }

  // Get line range for full stage
  const totalLines = await getPageTotalLines(pageNumber)
  let startLine: number
  let endLine: number

  if (stage === StageNumber.STAGE_1_2) {
    startLine = 1
    endLine = Math.min(7, totalLines)
  } else if (stage === StageNumber.STAGE_2_2) {
    startLine = 8
    endLine = totalLines
  } else {
    // STAGE_3
    startLine = 1
    endLine = totalLines
  }

  // Get required count based on stage
  let requiredCount: number
  if (stage === StageNumber.STAGE_1_2 || stage === StageNumber.STAGE_2_2) {
    requiredCount = group.repetitionCountConnection || group.repetitionCount || 80
  } else {
    requiredCount = group.repetitionCountFull || group.repetitionCount || 80
  }

  // Calculate deadline
  const stageHours = getStageHoursFromGroup(stage, group)
  const deadline = new Date()
  deadline.setTime(deadline.getTime() + stageHours * 60 * 60 * 1000)

  // Create task
  const task = await prisma.task.create({
    data: {
      groupId: group.id,
      studentId: user.id,
      pageId: page.id,
      startLine,
      endLine,
      stage,
      status: TaskStatus.IN_PROGRESS,
      requiredCount,
      deadline,
    },
    include: {
      page: true,
      group: true,
    }
  })

  await showTaskForGroup(ctx, user, task, studentGroup)
}

/**
 * Handle mem_next_stage callback - advance to next stage
 */
async function handleMemNextStageCallback(
  ctx: BotContext,
  user: any,
  action: string,
  id?: string
): Promise<void> {
  // Parse: mem_next_stage:groupId:pageNumber:stage
  const fullData = ctx.callbackQuery?.data || ''
  const parts = fullData.split(':')
  if (parts.length < 4) {
    await ctx.answerCallbackQuery({ text: 'Неверные данные' })
    return
  }

  const groupId = parts[1]
  const pageNumber = parseInt(parts[2])
  const currentStage = parts[3] as StageNumber

  const studentGroup = await prisma.studentGroup.findFirst({
    where: {
      studentId: user.id,
      groupId,
      isActive: true
    },
    include: { group: true }
  })

  if (!studentGroup) {
    await ctx.answerCallbackQuery({ text: 'Группа не найдена' })
    return
  }

  // Calculate next stage
  const totalLines = await getPageTotalLines(pageNumber)
  const isShortPage = totalLines <= 7
  const nextStage = getNextStage(currentStage, isShortPage)

  if (nextStage) {
    // Update student progress
    await prisma.studentGroup.update({
      where: { id: studentGroup.id },
      data: {
        currentStage: nextStage,
        currentLine: nextStage === StageNumber.STAGE_2_1 ? 8 : 1
      }
    })

    // Refresh the view
    studentGroup.currentStage = nextStage
    await showMemorizationStages(ctx, user, studentGroup)
  } else {
    // Page complete - move to next page
    await prisma.studentGroup.update({
      where: { id: studentGroup.id },
      data: {
        currentPage: pageNumber + 1,
        currentStage: StageNumber.STAGE_1_1,
        currentLine: 1
      }
    })

    studentGroup.currentPage = pageNumber + 1
    studentGroup.currentStage = StageNumber.STAGE_1_1
    await showMemorizationStages(ctx, user, studentGroup)
  }
}

/**
 * Get next stage in sequence
 */
function getNextStage(currentStage: StageNumber, isShortPage: boolean): StageNumber | null {
  if (isShortPage) {
    if (currentStage === StageNumber.STAGE_1_1) return StageNumber.STAGE_3
    return null // Page complete
  }

  switch (currentStage) {
    case StageNumber.STAGE_1_1: return StageNumber.STAGE_1_2
    case StageNumber.STAGE_1_2: return StageNumber.STAGE_2_1
    case StageNumber.STAGE_2_1: return StageNumber.STAGE_2_2
    case StageNumber.STAGE_2_2: return StageNumber.STAGE_3
    case StageNumber.STAGE_3: return null // Page complete
    default: return null
  }
}

// ============== CANCEL HANDLER ==============

async function handleCancel(ctx: BotContext, user: any): Promise<void> {
  ctx.session.step = 'browsing_menu'
  await showStudentMenuEdit(ctx, user)
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
  // Clamp percent to 0-100 range to avoid negative repeat values
  const clampedPercent = Math.min(100, Math.max(0, percent))
  const filled = Math.round(clampedPercent / 10)
  const empty = 10 - filled
  return `[${'▓'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`
}
