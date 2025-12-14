import type { BotContext } from '../bot'
import { prisma } from '@/lib/prisma'
import { TaskStatus, SubmissionStatus } from '@prisma/client'
import { sendAndTrack, deleteUserMessage, deleteMessagesByType, deleteMessagesByTypeForChat } from '../utils/message-cleaner'
import { getStudentTaskKeyboard, getBackKeyboard } from '../keyboards/main-menu'

// Note: submission_confirm messages are NOT auto-deleted by cron
// They are deleted when student sends next submission or navigates away
// Only review_result notifications are auto-deleted (30 seconds after sent)

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
      lesson: {
        include: {
          group: {
            include: { ustaz: true }
          }
        }
      },
      group: {
        include: { ustaz: true }
      },
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

  // Use group settings (primary) or lesson settings (fallback)
  const settings = task.group || task.lesson

  // Check if lesson allows voice
  if (!settings?.allowVoice) {
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
  // This is intentional: student confirms previous submission by sending a new one
  const previousPending = await prisma.submission.findFirst({
    where: {
      taskId: task.id,
      studentId: user.id,
      status: SubmissionStatus.PENDING,
    },
    orderBy: { createdAt: 'desc' }
  })

  if (previousPending) {
    // Delete previous student message (the audio/video that was just confirmed)
    if (previousPending.studentMsgId && ctx.chat?.id) {
      try {
        await ctx.api.deleteMessage(ctx.chat.id, Number(previousPending.studentMsgId))
      } catch (e) {
        // Message might already be deleted
      }
    }
    // Notify ustaz about the previous submission (now confirmed by this new one)
    await processSubmissionAndNotify(task, previousPending, user)
  }

  // Delete previous confirmation message to keep chat clean
  // Note: Keep menu - don't delete it, student needs it after confirmation auto-deletes
  await deleteMessagesByType(ctx, 'submission_confirm')

  // Create new submission (will be confirmed by next submission or task completion)
  // Student's message is kept until confirmed by next submission
  const submission = await prisma.submission.create({
    data: {
      taskId: task.id,
      studentId: user.id,
      fileId: voice.file_id,
      fileType: 'voice',
      duration: voice.duration,
      status: SubmissionStatus.PENDING,
      studentMsgId: ctx.message?.message_id ? BigInt(ctx.message.message_id) : null,
    }
  })

  // Update task count
  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data: {
      currentCount: { increment: 1 },
    }
  })

  // Send confirmation (auto-delete after N minutes)
  const remaining = task.requiredCount - updatedTask.currentCount
  const progressPercent = ((updatedTask.currentCount / task.requiredCount) * 100).toFixed(0)

  const message = buildSubmissionConfirmation(
    task.page.pageNumber,
    task.startLine,
    task.endLine,
    updatedTask.currentCount,
    task.requiredCount,
    remaining,
    progressPercent,
    task.deadline
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
    // No auto-delete - stays until next submission or navigation
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
      lesson: {
        include: {
          group: {
            include: { ustaz: true }
          }
        }
      },
      group: {
        include: { ustaz: true }
      },
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

  // Use group settings (primary) or lesson settings (fallback)
  const settings = task.group || task.lesson

  // Check if lesson allows video notes
  if (!settings?.allowVideoNote) {
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
  // This is intentional: student confirms previous submission by sending a new one
  const previousPending = await prisma.submission.findFirst({
    where: {
      taskId: task.id,
      studentId: user.id,
      status: SubmissionStatus.PENDING,
    },
    orderBy: { createdAt: 'desc' }
  })

  if (previousPending) {
    // Delete previous student message (the audio/video that was just confirmed)
    if (previousPending.studentMsgId && ctx.chat?.id) {
      try {
        await ctx.api.deleteMessage(ctx.chat.id, Number(previousPending.studentMsgId))
      } catch (e) {
        // Message might already be deleted
      }
    }
    // Notify ustaz about the previous submission (now confirmed by this new one)
    await processSubmissionAndNotify(task, previousPending, user)
  }

  // Delete previous confirmation message to keep chat clean
  // Note: Keep menu - don't delete it, student needs it after confirmation auto-deletes
  await deleteMessagesByType(ctx, 'submission_confirm')

  // Create new submission (will be confirmed by next submission or task completion)
  // Student's message is kept until confirmed by next submission
  const submission = await prisma.submission.create({
    data: {
      taskId: task.id,
      studentId: user.id,
      fileId: videoNote.file_id,
      fileType: 'video_note',
      duration: videoNote.duration,
      status: SubmissionStatus.PENDING,
      studentMsgId: ctx.message?.message_id ? BigInt(ctx.message.message_id) : null,
    }
  })

  // Update task count
  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data: {
      currentCount: { increment: 1 },
    }
  })

  // Send confirmation (auto-delete after N minutes)
  const remaining = task.requiredCount - updatedTask.currentCount
  const progressPercent = ((updatedTask.currentCount / task.requiredCount) * 100).toFixed(0)

  const message = buildSubmissionConfirmation(
    task.page.pageNumber,
    task.startLine,
    task.endLine,
    updatedTask.currentCount,
    task.requiredCount,
    remaining,
    progressPercent,
    task.deadline
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
    // No auto-delete - stays until next submission or navigation
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
      lesson: {
        include: {
          group: {
            include: { ustaz: true }
          }
        }
      },
      group: {
        include: { ustaz: true }
      },
    }
  })

  if (!task) {
    // No task - just delete the message, don't spam
    await deleteUserMessage(ctx)
    return
  }

  // Use group settings (primary) or lesson settings (fallback)
  const settings = task.group || task.lesson

  // Check if lesson allows text
  if (!settings?.allowText) {
    await deleteUserMessage(ctx)

    // Build format hint
    let formatHint = ''
    if (settings?.allowVoice && settings?.allowVideoNote) {
      formatHint = '🎤 голосовое сообщение или 📹 видео-кружок'
    } else if (settings?.allowVoice) {
      formatHint = '🎤 голосовое сообщение'
    } else if (settings?.allowVideoNote) {
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
  // This is intentional: student confirms previous submission by sending a new one
  const previousPending = await prisma.submission.findFirst({
    where: {
      taskId: task.id,
      studentId: user.id,
      status: SubmissionStatus.PENDING,
    },
    orderBy: { createdAt: 'desc' }
  })

  if (previousPending) {
    // Delete previous student message (the text that was just confirmed)
    if (previousPending.studentMsgId && ctx.chat?.id) {
      try {
        await ctx.api.deleteMessage(ctx.chat.id, Number(previousPending.studentMsgId))
      } catch (e) {
        // Message might already be deleted
      }
    }
    // Notify ustaz about the previous submission (now confirmed by this new one)
    await processSubmissionAndNotify(task, previousPending, user)
  }

  // Delete previous confirmation message to keep chat clean
  // Note: Keep menu - don't delete it, student needs it after confirmation auto-deletes
  await deleteMessagesByType(ctx, 'submission_confirm')

  // Create new submission (will be confirmed by next submission or task completion)
  // Student's message is kept until confirmed by next submission
  const submission = await prisma.submission.create({
    data: {
      taskId: task.id,
      studentId: user.id,
      fileId: `text:${text.substring(0, 100)}`, // Store prefix of text
      fileType: 'text',
      status: SubmissionStatus.PENDING,
      studentMsgId: ctx.message?.message_id ? BigInt(ctx.message.message_id) : null,
    }
  })

  // Update task count
  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data: {
      currentCount: { increment: 1 },
    }
  })

  // Send confirmation (auto-delete after N minutes)
  const remaining = task.requiredCount - updatedTask.currentCount
  const progressPercent = ((updatedTask.currentCount / task.requiredCount) * 100).toFixed(0)

  const message = buildSubmissionConfirmation(
    task.page.pageNumber,
    task.startLine,
    task.endLine,
    updatedTask.currentCount,
    task.requiredCount,
    remaining,
    progressPercent,
    task.deadline
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
    // No auto-delete - stays until next submission or navigation
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
      group: true,
    }
  })

  if (!task) {
    // No task - just delete silently
    return
  }

  // Use group settings (primary) or lesson settings (fallback)
  const settings = task.group || task.lesson

  // Build format hint based on settings
  let formatHint = ''
  if (settings?.allowVoice && settings?.allowVideoNote) {
    formatHint = '🎤 голосовое сообщение или 📹 видео-кружок'
  } else if (settings?.allowVoice) {
    formatHint = '🎤 голосовое сообщение'
  } else if (settings?.allowVideoNote) {
    formatHint = '📹 видео-кружок'
  } else if (settings?.allowText) {
    formatHint = '📝 текстовое сообщение'
  } else {
    formatHint = '🎤 голосовое сообщение или 📹 видео-кружок' // default
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
  progressPercent: string,
  deadline?: Date
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
    message += `⏳ Осталось: <b>${remaining}</b>\n`
  } else {
    message += `\n🎉 <b>Все записи отправлены!</b>\n`
    message += `<i>Ожидайте проверку устаза.</i>`
    return message
  }

  // Add deadline info
  if (deadline) {
    const now = new Date()
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

    if (timeLeft > 0) {
      message += `\n⏰ До <b>${deadlineDateStr} ${deadlineTimeStr}</b>`
      message += ` (<b>${hoursLeft}ч ${minutesLeft}м</b>)\n`
    } else {
      message += `\n⚠️ <b>Срок истёк!</b>\n`
    }
  }

  message += `\n<i>Продолжайте отправлять записи.</i>`

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
 * Process submission and notify ustaz based on AI verification mode
 */
async function processSubmissionAndNotify(
  task: any,
  submission: any,
  student: any
): Promise<void> {
  try {
    // Get group with AI settings
    let group = task.group
    if (!group && task.lessonId) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: task.lessonId },
        include: {
          group: {
            include: { ustaz: true }
          }
        }
      })
      group = lesson?.group
    }

    if (!group) {
      // Fallback: try to get group from task.groupId
      if (task.groupId) {
        group = await prisma.group.findUnique({
          where: { id: task.groupId },
          include: { ustaz: true }
        })
      }
    }

    if (!group) return

    const verificationMode = group.verificationMode || 'MANUAL'
    const aiProvider = group.aiProvider || 'NONE'

    // For now, all modes notify ustaz (AI verification to be implemented)
    // In the future:
    // - MANUAL: Always notify ustaz
    // - SEMI_AUTO: Run AI check, then notify ustaz with AI score hint
    // - FULL_AUTO: Run AI check, auto-accept/reject based on thresholds, notify ustaz only if in middle range

    // TODO: Implement AI verification when AI providers are ready
    // For now, always notify ustaz regardless of mode
    await notifyUstazAboutSubmission(task, submission, student, group)
  } catch (error) {
    console.error('Failed to process submission:', error)
  }
}

/**
 * Notify ustaz about new submission with review buttons
 */
async function notifyUstazAboutSubmission(
  task: any,
  submission: any,
  student: any,
  group?: any
): Promise<void> {
  try {
    // Get group with ustaz if not passed
    if (!group) {
      group = task.group
      if (!group && task.lessonId) {
        const lesson = await prisma.lesson.findUnique({
          where: { id: task.lessonId },
          include: {
            group: {
              include: { ustaz: true }
            }
          }
        })
        group = lesson?.group
      }
    }

    if (!group?.ustaz?.telegramId) return

    // Import bot and InlineKeyboard
    const { bot } = await import('../bot')
    const { InlineKeyboard } = await import('grammy')

    const ustazChatId = Number(group.ustaz.telegramId)
    const botToken = process.env.TELEGRAM_BOT_TOKEN

    // Delete ustaz menu to keep chat clean (avoid duplicate menus after review)
    if (botToken) {
      await deleteMessagesByTypeForChat(ustazChatId, 'menu', botToken)
    }

    const studentName = student.firstName || 'Студент'
    const groupName = group.name
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

    // Calculate progress
    const progressPercent = Math.round((task.currentCount / task.requiredCount) * 100)
    const progressBar = `[${'▓'.repeat(Math.round(progressPercent / 10))}${'░'.repeat(10 - Math.round(progressPercent / 10))}]`

    let caption = `📥 <b>Новая работа</b>\n\n`
    caption += `📚 <b>${groupName}</b>\n`
    caption += `👤 ${studentName}\n`
    caption += `📖 Стр. ${task.page.pageNumber}, ${lineRange}\n`
    caption += `🎯 ${stageName}\n\n`
    caption += `${progressBar} ${progressPercent}%\n`
    caption += `📊 <b>${task.currentCount}/${task.requiredCount}</b>`

    // Add passed/failed counts if any
    if (task.passedCount > 0 || task.failedCount > 0) {
      caption += `\n✅ ${task.passedCount}`
      if (task.failedCount > 0) {
        caption += ` | ❌ ${task.failedCount}`
      }
    }

    // Add AI score if available (from submission)
    if (submission.aiScore !== null && submission.aiScore !== undefined) {
      const scoreEmoji = submission.aiScore >= 85 ? '🟢' : submission.aiScore >= 50 ? '🟡' : '🔴'
      caption += `\n\n${scoreEmoji} <b>AI: ${Math.round(submission.aiScore)}%</b>`
      if (submission.aiTranscript) {
        caption += `\n<i>${submission.aiTranscript.substring(0, 100)}${submission.aiTranscript.length > 100 ? '...' : ''}</i>`
      }
    }

    // Create review keyboard with AI score hint
    const reviewKeyboard = new InlineKeyboard()

    if (submission.aiScore !== null && submission.aiScore >= 85) {
      reviewKeyboard.text('✅ Принять (AI: ✓)', `review:pass:${submission.id}`)
    } else if (submission.aiScore !== null && submission.aiScore < 50) {
      reviewKeyboard.text('❌ Отклонить (AI: ✗)', `review:fail:${submission.id}`)
    } else {
      reviewKeyboard.text('✅ Сдал', `review:pass:${submission.id}`)
    }

    reviewKeyboard.text('❌ Не сдал', `review:fail:${submission.id}`)

    // Send the file with caption and review buttons
    if (submission.fileType === 'voice') {
      await bot.api.sendVoice(ustazChatId, submission.fileId, {
        caption,
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard
      })
    } else if (submission.fileType === 'video_note') {
      // Video notes don't support captions - send video first, then message with buttons
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
      const textMessage = caption + `\n\n💬 <i>${textContent}</i>`
      await bot.api.sendMessage(ustazChatId, textMessage, {
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard
      })
    }

    // Mark submission as sent to ustaz
    await prisma.submission.update({
      where: { id: submission.id },
      data: { sentToUstazAt: new Date() }
    })
  } catch (error) {
    console.error('Failed to notify ustaz:', error)
  }
}
