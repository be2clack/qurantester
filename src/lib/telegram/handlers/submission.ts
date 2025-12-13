import type { BotContext } from '../bot'
import { prisma } from '@/lib/prisma'
import { TaskStatus, SubmissionStatus } from '@prisma/client'
import { sendAndTrack, deleteUserMessage } from '../utils/message-cleaner'
import { getStudentTaskKeyboard, getBackKeyboard } from '../keyboards/main-menu'

/**
 * Handle voice message submission
 */
export async function handleVoiceSubmission(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id
  const voice = ctx.message?.voice

  if (!telegramId || !voice) return

  // Find user
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) }
  })

  if (!user) {
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '❌ Пользователь не найден. Используйте /start',
      {},
      undefined,
      'error'
    )
    return
  }

  // Get active task
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
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '❌ У вас нет активного задания.\n\nНажмите "▶️ Начать задание" в меню.',
      { reply_markup: getBackKeyboard('student:menu', '◀️ В меню') },
      user.id,
      'notification'
    )
    return
  }

  // Check if lesson allows voice
  if (!task.lesson.allowVoice) {
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '❌ <b>Неверный формат!</b>\n\nОтправьте 📹 видео-кружок.',
      { reply_markup: getBackKeyboard('student:menu', '◀️ В меню'), parse_mode: 'HTML' },
      user.id,
      'notification'
    )
    return
  }

  // Check if task is already complete
  if (task.currentCount >= task.requiredCount) {
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '✅ Все записи отправлены!\n\nОжидайте проверку устаза.',
      { reply_markup: getBackKeyboard('student:menu', '◀️ В меню') },
      user.id,
      'notification'
    )
    return
  }

  // Check for previous pending submission and notify ustaz (confirming previous)
  const previousPending = await prisma.submission.findFirst({
    where: {
      taskId: task.id,
      studentId: user.id,
      status: SubmissionStatus.PENDING,
    },
    orderBy: { createdAt: 'desc' }
  })

  if (previousPending) {
    // Notify ustaz about the previous submission (now confirmed by this new one)
    await notifyUstazAboutSubmission(task, previousPending, user)
  }

  // Create submission
  const submission = await prisma.submission.create({
    data: {
      taskId: task.id,
      studentId: user.id,
      fileId: voice.file_id,
      fileType: 'voice',
      duration: voice.duration,
      status: SubmissionStatus.PENDING,
      telegramMsgId: ctx.message?.message_id ? BigInt(ctx.message.message_id) : null,
    }
  })

  // Update task count
  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data: {
      currentCount: { increment: 1 },
    }
  })

  // Send confirmation
  const remaining = task.requiredCount - updatedTask.currentCount
  const progressPercent = ((updatedTask.currentCount / task.requiredCount) * 100).toFixed(0)

  const message = buildSubmissionConfirmation(
    task.page.pageNumber,
    task.startLine,
    task.endLine,
    updatedTask.currentCount,
    task.requiredCount,
    remaining,
    progressPercent
  )

  await sendAndTrack(
    ctx,
    message,
    {
      reply_markup: getStudentTaskKeyboard(task.id, true),
      parse_mode: 'HTML'
    },
    user.id,
    'submission_confirm'
  )
}

/**
 * Handle video note (circle) submission
 */
export async function handleVideoNoteSubmission(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id
  const videoNote = ctx.message?.video_note

  if (!telegramId || !videoNote) return

  // Find user
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) }
  })

  if (!user) {
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '❌ Пользователь не найден. Используйте /start',
      {},
      undefined,
      'error'
    )
    return
  }

  // Get active task
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
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '❌ У вас нет активного задания.\n\nНажмите "▶️ Начать задание" в меню.',
      { reply_markup: getBackKeyboard('student:menu', '◀️ В меню') },
      user.id,
      'notification'
    )
    return
  }

  // Check if lesson allows video notes
  if (!task.lesson.allowVideoNote) {
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '❌ <b>Неверный формат!</b>\n\nОтправьте 🎤 голосовое сообщение.',
      { reply_markup: getBackKeyboard('student:menu', '◀️ В меню'), parse_mode: 'HTML' },
      user.id,
      'notification'
    )
    return
  }

  // Check if task is already complete
  if (task.currentCount >= task.requiredCount) {
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '✅ Все записи отправлены!\n\nОжидайте проверку устаза.',
      { reply_markup: getBackKeyboard('student:menu', '◀️ В меню') },
      user.id,
      'notification'
    )
    return
  }

  // Check for previous pending submission and notify ustaz (confirming previous)
  const previousPending = await prisma.submission.findFirst({
    where: {
      taskId: task.id,
      studentId: user.id,
      status: SubmissionStatus.PENDING,
    },
    orderBy: { createdAt: 'desc' }
  })

  if (previousPending) {
    // Notify ustaz about the previous submission (now confirmed by this new one)
    await notifyUstazAboutSubmission(task, previousPending, user)
  }

  // Create submission
  const submission = await prisma.submission.create({
    data: {
      taskId: task.id,
      studentId: user.id,
      fileId: videoNote.file_id,
      fileType: 'video_note',
      duration: videoNote.duration,
      status: SubmissionStatus.PENDING,
      telegramMsgId: ctx.message?.message_id ? BigInt(ctx.message.message_id) : null,
    }
  })

  // Update task count
  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data: {
      currentCount: { increment: 1 },
    }
  })

  // Send confirmation
  const remaining = task.requiredCount - updatedTask.currentCount
  const progressPercent = ((updatedTask.currentCount / task.requiredCount) * 100).toFixed(0)

  const message = buildSubmissionConfirmation(
    task.page.pageNumber,
    task.startLine,
    task.endLine,
    updatedTask.currentCount,
    task.requiredCount,
    remaining,
    progressPercent
  )

  await sendAndTrack(
    ctx,
    message,
    {
      reply_markup: getStudentTaskKeyboard(task.id, true),
      parse_mode: 'HTML'
    },
    user.id,
    'submission_confirm'
  )
}

/**
 * Handle text message submission
 */
export async function handleTextSubmission(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id
  const text = ctx.message?.text

  if (!telegramId || !text) return

  // Find user
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) }
  })

  if (!user) {
    return // Just ignore if not registered
  }

  // Only process for students
  if (user.role !== 'STUDENT') {
    return
  }

  // Get active task
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
    // No task - just delete the message, don't spam
    await deleteUserMessage(ctx)
    return
  }

  // Check if lesson allows text
  if (!task.lesson.allowText) {
    await deleteUserMessage(ctx)

    // Build format hint
    let formatHint = ''
    if (task.lesson.allowVoice && task.lesson.allowVideoNote) {
      formatHint = '🎤 голосовое сообщение или 📹 видео-кружок'
    } else if (task.lesson.allowVoice) {
      formatHint = '🎤 голосовое сообщение'
    } else if (task.lesson.allowVideoNote) {
      formatHint = '📹 видео-кружок'
    }

    await sendAndTrack(
      ctx,
      `❌ <b>Неверный формат!</b>\n\nОтправьте ${formatHint}.`,
      { reply_markup: getBackKeyboard('student:menu', '◀️ В меню'), parse_mode: 'HTML' },
      user.id,
      'error'
    )
    return
  }

  // Check if task is already complete
  if (task.currentCount >= task.requiredCount) {
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '✅ Все записи отправлены!\n\nОжидайте проверку устаза.',
      { reply_markup: getBackKeyboard('student:menu', '◀️ В меню') },
      user.id,
      'notification'
    )
    return
  }

  // Check for previous pending submission and notify ustaz (confirming previous)
  const previousPending = await prisma.submission.findFirst({
    where: {
      taskId: task.id,
      studentId: user.id,
      status: SubmissionStatus.PENDING,
    },
    orderBy: { createdAt: 'desc' }
  })

  if (previousPending) {
    // Notify ustaz about the previous submission (now confirmed by this new one)
    await notifyUstazAboutSubmission(task, previousPending, user)
  }

  // Create submission (store text content as fileId for simplicity)
  const submission = await prisma.submission.create({
    data: {
      taskId: task.id,
      studentId: user.id,
      fileId: `text:${text.substring(0, 100)}`, // Store prefix of text
      fileType: 'text',
      status: SubmissionStatus.PENDING,
      telegramMsgId: ctx.message?.message_id ? BigInt(ctx.message.message_id) : null,
    }
  })

  // Update task count
  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data: {
      currentCount: { increment: 1 },
    }
  })

  // Send confirmation
  const remaining = task.requiredCount - updatedTask.currentCount
  const progressPercent = ((updatedTask.currentCount / task.requiredCount) * 100).toFixed(0)

  const message = buildSubmissionConfirmation(
    task.page.pageNumber,
    task.startLine,
    task.endLine,
    updatedTask.currentCount,
    task.requiredCount,
    remaining,
    progressPercent
  )

  await sendAndTrack(
    ctx,
    message,
    {
      reply_markup: getStudentTaskKeyboard(task.id, true),
      parse_mode: 'HTML'
    },
    user.id,
    'submission_confirm'
  )
}

/**
 * Handle rejected message types (photos, documents, videos, audio files, stickers)
 */
export async function handleRejectedMessage(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id
  if (!telegramId) return

  // Find user
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) }
  })

  if (!user || user.role !== 'STUDENT') return

  // Delete the rejected message
  await deleteUserMessage(ctx)

  // Get active task to show correct format hint
  const task = await prisma.task.findFirst({
    where: {
      studentId: user.id,
      status: TaskStatus.IN_PROGRESS,
    },
    include: {
      lesson: true,
    }
  })

  if (!task) {
    // No task - just delete silently
    return
  }

  // Build format hint based on lesson settings
  let formatHint = ''
  if (task.lesson.allowVoice && task.lesson.allowVideoNote) {
    formatHint = '🎤 голосовое сообщение или 📹 видео-кружок'
  } else if (task.lesson.allowVoice) {
    formatHint = '🎤 голосовое сообщение'
  } else if (task.lesson.allowVideoNote) {
    formatHint = '📹 видео-кружок'
  } else if (task.lesson.allowText) {
    formatHint = '📝 текстовое сообщение'
  }

  await sendAndTrack(
    ctx,
    `❌ <b>Неверный формат!</b>\n\nОтправьте ${formatHint}.\n\n<i>Файлы, фото и аудио-файлы не принимаются.</i>`,
    { parse_mode: 'HTML', reply_markup: getBackKeyboard('student:menu', '◀️ В меню') },
    user.id,
    'error'
  )
}

/**
 * Build submission confirmation message
 */
function buildSubmissionConfirmation(
  pageNumber: number,
  startLine: number,
  endLine: number,
  currentCount: number,
  requiredCount: number,
  remaining: number,
  progressPercent: string
): string {
  const lineRange = startLine === endLine
    ? `строка ${startLine}`
    : `строки ${startLine}-${endLine}`

  const progressBar = buildProgressBar(parseInt(progressPercent))

  let message = `✅ <b>Запись получена!</b>\n\n`
  message += `📖 Страница ${pageNumber}, ${lineRange}\n\n`
  message += `${progressBar}\n`
  message += `📊 Отправлено: <b>${currentCount}/${requiredCount}</b>\n`

  if (remaining > 0) {
    message += `⏳ Осталось: <b>${remaining}</b>\n\n`
    message += `<i>Продолжайте отправлять записи.</i>`
  } else {
    message += `\n🎉 <b>Все записи отправлены!</b>\n`
    message += `<i>Ожидайте проверку устаза.</i>`
  }

  return message
}

/**
 * Build text progress bar
 */
function buildProgressBar(percent: number): string {
  const filled = Math.round(percent / 10)
  const empty = 10 - filled
  return `[${'▓'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`
}

/**
 * Notify ustaz about new submission with review buttons
 */
async function notifyUstazAboutSubmission(
  task: any,
  submission: any,
  student: any
): Promise<void> {
  try {
    // Get ustaz of the group with full info
    const lesson = await prisma.lesson.findUnique({
      where: { id: task.lessonId },
      include: {
        group: {
          include: { ustaz: true }
        }
      }
    })

    if (!lesson?.group.ustaz.telegramId) return

    // Import bot and InlineKeyboard
    const { bot } = await import('../bot')
    const { InlineKeyboard } = await import('grammy')

    const studentName = student.firstName || 'Студент'
    const groupName = lesson.group.name
    const lineRange = task.startLine === task.endLine
      ? `строка ${task.startLine}`
      : `строки ${task.startLine}-${task.endLine}`

    // Get stage name
    const stageNames: Record<string, string> = {
      STAGE_1_1: 'Этап 1.1',
      STAGE_1_2: 'Этап 1.2',
      STAGE_2_1: 'Этап 2.1',
      STAGE_2_2: 'Этап 2.2',
      STAGE_3: 'Этап 3',
    }
    const stageName = stageNames[task.stage] || task.stage

    const caption = `📥 <b>Новая работа на проверку</b>\n\n` +
      `📚 <b>${groupName}</b>\n` +
      `👤 ${studentName}\n` +
      `📖 Стр. ${task.page.pageNumber}, ${lineRange}\n` +
      `🎯 ${stageName}\n` +
      `📊 ${task.currentCount}/${task.requiredCount}`

    // Create review keyboard
    const reviewKeyboard = new InlineKeyboard()
      .text('✅ Сдал', `review:pass:${submission.id}`)
      .text('❌ Не сдал', `review:fail:${submission.id}`)

    const ustazChatId = Number(lesson.group.ustaz.telegramId)

    // Send the file with caption and review buttons
    if (submission.fileType === 'voice') {
      await bot.api.sendVoice(ustazChatId, submission.fileId, {
        caption,
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard
      })
    } else if (submission.fileType === 'video_note') {
      // Video notes don't support captions - send video first, then message as reply
      const videoMsg = await bot.api.sendVideoNote(ustazChatId, submission.fileId)
      // Send details as reply to the video note
      await bot.api.sendMessage(ustazChatId, caption, {
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard,
        reply_parameters: { message_id: videoMsg.message_id }
      })
    } else if (submission.fileType === 'text') {
      // For text submissions, show the text content
      const textContent = submission.fileId.replace('text:', '')
      const textMessage = caption + `\n\n💬 Текст: <i>${textContent}</i>`
      await bot.api.sendMessage(ustazChatId, textMessage, {
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard
      })
    }
  } catch (error) {
    console.error('Failed to notify ustaz:', error)
  }
}
