import type { BotContext } from '../bot'
import { prisma } from '@/lib/prisma'
import { TaskStatus, SubmissionStatus } from '@prisma/client'
import { sendAndTrack, deleteUserMessage, deleteMessagesByType, deleteMessagesByTypeForChat } from '../utils/message-cleaner'
import { getStudentTaskKeyboard, getBackKeyboard, getRevisionSubmitKeyboard, getRevisionReviewKeyboard } from '../keyboards/main-menu'

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

  // Check if in revision mode
  if (ctx.session.step === 'awaiting_revision' && ctx.session.revisionPageNumber) {
    await handleRevisionSubmission(ctx, user, 'voice', voice.file_id, voice.duration)
    return
  }

  // Try to use the task from session (set when student views a task screen)
  let task: any = null
  const sessionTaskId = ctx.session.pendingTaskId

  if (sessionTaskId) {
    // First try to find the specific task the student was viewing
    const sessionTask = await prisma.task.findFirst({
      where: {
        id: sessionTaskId,
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
        _count: {
          select: {
            submissions: { where: { status: SubmissionStatus.PENDING } }
          }
        }
      }
    })

    // Check if this task still needs submissions
    if (sessionTask) {
      const pendingCount = sessionTask._count.submissions
      const needsMore = sessionTask.requiredCount - sessionTask.passedCount - pendingCount > 0
      if (needsMore) {
        task = sessionTask
      }
    }
  }

  // If no task from session (or it's full), fall back to finding any task that needs submissions
  if (!task) {
    const allTasks = await prisma.task.findMany({
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
        _count: {
          select: {
            submissions: { where: { status: SubmissionStatus.PENDING } }
          }
        }
      },
      orderBy: { createdAt: 'desc' } // Prefer most recently created
    })

    if (allTasks.length === 0) {
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

    // Find task that still needs more submissions
    task = allTasks.find(t => {
      const pendingCount = t._count.submissions
      return t.requiredCount - t.passedCount - pendingCount > 0
    })
  }

  if (!task) {
    // All tasks have their submissions sent (pending review)
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '✅ Все записи отправлены!\n\nОжидайте проверку устаза.',
      { reply_markup: getBackKeyboard('close_notification', '✖️ Закрыть') },
      user.id,
      'notification'
    )
    return
  }

  // Use group settings (primary) or lesson's group (fallback) or lesson itself
  // task.group - if task was created directly for a group
  // task.lesson?.group - if task was created through a lesson, get the lesson's group settings
  // task.lesson - fallback to lesson settings if no group
  const settings = task.group || task.lesson?.group || task.lesson

  // Check if lesson allows voice
  if (!settings?.allowVoice) {
    await deleteUserMessage(ctx)
    await deleteMessagesByType(ctx, 'menu')
    await sendAndTrack(
      ctx,
      '❌ <b>Неверный формат!</b>\n\nОтправьте 📹 видео-кружок.',
      { reply_markup: getBackKeyboard('student:menu', '◀️ В меню'), parse_mode: 'HTML' },
      user.id,
      'notification'
    )
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
            stage: task.stage,
          }
        }
      })

      if (!preCheck?.passed) {
        await deleteUserMessage(ctx)
        await sendAndTrack(
          ctx,
          '🤖 <b>Требуется AI предпроверка</b>\n\n' +
          'Перед отправкой работ на проверку устазу, необходимо пройти AI проверку чтения.\n\n' +
          '<i>Откройте меню и нажмите "🎙 Пройти AI проверку".</i>',
          { reply_markup: getBackKeyboard('student:menu', '◀️ В меню'), parse_mode: 'HTML' },
          user.id,
          'notification'
        )
        return
      }
    }
  }

  // Count pending submissions for this task
  const pendingCount = await prisma.submission.count({
    where: {
      taskId: task.id,
      status: SubmissionStatus.PENDING,
    }
  })

  // Check if more submissions are needed
  // Formula: required - passed - pending = remaining needed
  const neededSubmissions = task.requiredCount - task.passedCount - pendingCount
  if (neededSubmissions <= 0) {
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '✅ Все записи отправлены!\n\nОжидайте проверку устаза.',
      { reply_markup: getBackKeyboard('close_notification', '✖️ Закрыть') },
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
    // Don't await - run in background to prevent webhook timeout
    processSubmissionAndNotify(task, previousPending, user).catch(err => {
      console.error('[Submission] Background processing error:', err)
    })
  }

  // Check if this is a resubmission (student had failed submissions and is sending more)
  const isResubmission = task.failedCount > 0 && !previousPending

  // Delete ALL previous messages to keep chat clean - no duplicates ever
  await deleteMessagesByType(ctx, 'submission_confirm')
  await deleteMessagesByType(ctx, 'menu')
  await deleteMessagesByType(ctx, 'task_info')  // Delete "Задание создано" message
  await deleteMessagesByType(ctx, 'review_result')
  await deleteMessagesByType(ctx, 'notification')

  // Check for duplicate submission (webhook retry protection)
  const messageId = ctx.message?.message_id
  if (messageId) {
    const existingSubmission = await prisma.submission.findFirst({
      where: {
        studentMsgId: BigInt(messageId),
        taskId: task.id,
      }
    })
    if (existingSubmission) {
      console.log(`[Submission] Duplicate detected for message ${messageId}, skipping`)
      return
    }
  }

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

  // For resubmissions, immediately notify ustaz (no need to wait for confirmation)
  // Don't await - run in background to prevent webhook timeout
  if (isResubmission) {
    processSubmissionAndNotify(task, submission, user).catch(err => {
      console.error('[Submission] Background resubmission error:', err)
    })
  }

  // Send confirmation (auto-delete after N minutes)
  // Calculate remaining correctly: required - passed - pending (including this new one)
  // pendingCount was queried before creating submission, so add 1 for this new submission
  const actualPendingCount = pendingCount + 1
  const remaining = task.requiredCount - task.passedCount - actualPendingCount
  const progressPercent = ((task.passedCount / task.requiredCount) * 100).toFixed(0)
  const isLastSubmission = remaining <= 0

  const deadlineEnabled = task.group?.deadlineEnabled ?? task.lesson?.group?.deadlineEnabled ?? true
  const message = buildSubmissionConfirmation(
    task.page?.pageNumber || 1,
    task.startLine,
    task.endLine,
    task.passedCount + actualPendingCount,
    task.requiredCount,
    Math.max(0, remaining),
    progressPercent,
    task.deadline,
    isLastSubmission,
    deadlineEnabled
  )

  await sendAndTrack(
    ctx,
    message,
    {
      reply_markup: getStudentTaskKeyboard(task.id, true, isLastSubmission),
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

  // Check if in revision mode
  if (ctx.session.step === 'awaiting_revision' && ctx.session.revisionPageNumber) {
    await handleRevisionSubmission(ctx, user, 'video_note', videoNote.file_id, videoNote.duration)
    return
  }

  // Try to use the task from session (set when student views a task screen)
  let task: any = null
  const sessionTaskId = ctx.session.pendingTaskId

  if (sessionTaskId) {
    // First try to find the specific task the student was viewing
    const sessionTask = await prisma.task.findFirst({
      where: {
        id: sessionTaskId,
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
        _count: {
          select: {
            submissions: { where: { status: SubmissionStatus.PENDING } }
          }
        }
      }
    })

    // Check if this task still needs submissions
    if (sessionTask) {
      const pendingCount = sessionTask._count.submissions
      const needsMore = sessionTask.requiredCount - sessionTask.passedCount - pendingCount > 0
      if (needsMore) {
        task = sessionTask
      }
    }
  }

  // If no task from session (or it's full), fall back to finding any task that needs submissions
  if (!task) {
    const allTasks = await prisma.task.findMany({
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
        _count: {
          select: {
            submissions: { where: { status: SubmissionStatus.PENDING } }
          }
        }
      },
      orderBy: { createdAt: 'desc' } // Prefer most recently created
    })

    if (allTasks.length === 0) {
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

    // Find task that still needs more submissions
    task = allTasks.find(t => {
      const pendingCount = t._count.submissions
      return t.requiredCount - t.passedCount - pendingCount > 0
    })
  }

  if (!task) {
    // All tasks have their submissions sent (pending review)
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '✅ Все записи отправлены!\n\nОжидайте проверку устаза.',
      { reply_markup: getBackKeyboard('close_notification', '✖️ Закрыть') },
      user.id,
      'notification'
    )
    return
  }

  // Use group settings (primary) or lesson settings (fallback)
  const settings = task.group || task.lesson?.group || task.lesson

  // Check if lesson allows video notes
  if (!settings?.allowVideoNote) {
    await deleteUserMessage(ctx)
    await deleteMessagesByType(ctx, 'menu')
    await sendAndTrack(
      ctx,
      '❌ <b>Неверный формат!</b>\n\nОтправьте 🎤 голосовое сообщение.',
      { reply_markup: getBackKeyboard('student:menu', '◀️ В меню'), parse_mode: 'HTML' },
      user.id,
      'notification'
    )
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
            stage: task.stage,
          }
        }
      })

      if (!preCheck?.passed) {
        await deleteUserMessage(ctx)
        await sendAndTrack(
          ctx,
          '🤖 <b>Требуется AI предпроверка</b>\n\n' +
          'Перед отправкой работ на проверку устазу, необходимо пройти AI проверку чтения.\n\n' +
          '<i>Откройте меню и нажмите "🎙 Пройти AI проверку".</i>',
          { reply_markup: getBackKeyboard('student:menu', '◀️ В меню'), parse_mode: 'HTML' },
          user.id,
          'notification'
        )
        return
      }
    }
  }

  // Count pending submissions for this task
  const pendingCount = await prisma.submission.count({
    where: {
      taskId: task.id,
      status: SubmissionStatus.PENDING,
    }
  })

  // Check if more submissions are needed
  // Formula: required - passed - pending = remaining needed
  const neededSubmissions = task.requiredCount - task.passedCount - pendingCount
  if (neededSubmissions <= 0) {
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '✅ Все записи отправлены!\n\nОжидайте проверку устаза.',
      { reply_markup: getBackKeyboard('close_notification', '✖️ Закрыть') },
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
    // Don't await - run in background to prevent webhook timeout
    processSubmissionAndNotify(task, previousPending, user).catch(err => {
      console.error('[Submission] Background processing error:', err)
    })
  }

  // Check if this is a resubmission (student had failed submissions and is sending more)
  const isResubmission = task.failedCount > 0 && !previousPending

  // Delete ALL previous messages to keep chat clean - no duplicates ever
  await deleteMessagesByType(ctx, 'submission_confirm')
  await deleteMessagesByType(ctx, 'menu')
  await deleteMessagesByType(ctx, 'task_info')  // Delete "Задание создано" message
  await deleteMessagesByType(ctx, 'review_result')
  await deleteMessagesByType(ctx, 'notification')

  // Check for duplicate submission (webhook retry protection)
  const messageId = ctx.message?.message_id
  if (messageId) {
    const existingSubmission = await prisma.submission.findFirst({
      where: {
        studentMsgId: BigInt(messageId),
        taskId: task.id,
      }
    })
    if (existingSubmission) {
      console.log(`[Submission] Duplicate detected for message ${messageId}, skipping`)
      return
    }
  }

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

  // For resubmissions, immediately notify ustaz (no need to wait for confirmation)
  // Don't await - run in background to prevent webhook timeout
  if (isResubmission) {
    processSubmissionAndNotify(task, submission, user).catch(err => {
      console.error('[Submission] Background resubmission error:', err)
    })
  }

  // Send confirmation (auto-delete after N minutes)
  // Calculate remaining correctly: required - passed - pending (including this new one)
  // pendingCount was queried before creating submission, so add 1 for this new submission
  const actualPendingCount = pendingCount + 1
  const remaining = task.requiredCount - task.passedCount - actualPendingCount
  const progressPercent = ((task.passedCount / task.requiredCount) * 100).toFixed(0)
  const isLastSubmission = remaining <= 0

  const deadlineEnabled = task.group?.deadlineEnabled ?? task.lesson?.group?.deadlineEnabled ?? true
  const message = buildSubmissionConfirmation(
    task.page?.pageNumber || 1,
    task.startLine,
    task.endLine,
    task.passedCount + actualPendingCount,
    task.requiredCount,
    Math.max(0, remaining),
    progressPercent,
    task.deadline,
    isLastSubmission,
    deadlineEnabled
  )

  await sendAndTrack(
    ctx,
    message,
    {
      reply_markup: getStudentTaskKeyboard(task.id, true, isLastSubmission),
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

  // Try to use the task from session (set when student views a task screen)
  let task: any = null
  const sessionTaskId = ctx.session.pendingTaskId

  if (sessionTaskId) {
    // First try to find the specific task the student was viewing
    const sessionTask = await prisma.task.findFirst({
      where: {
        id: sessionTaskId,
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
        _count: {
          select: {
            submissions: { where: { status: SubmissionStatus.PENDING } }
          }
        }
      }
    })

    // Check if this task still needs submissions
    if (sessionTask) {
      const pendingCount = sessionTask._count.submissions
      const needsMore = sessionTask.requiredCount - sessionTask.passedCount - pendingCount > 0
      if (needsMore) {
        task = sessionTask
      }
    }
  }

  // If no task from session (or it's full), fall back to finding any task that needs submissions
  if (!task) {
    const allTasks = await prisma.task.findMany({
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
        _count: {
          select: {
            submissions: { where: { status: SubmissionStatus.PENDING } }
          }
        }
      },
      orderBy: { createdAt: 'desc' } // Prefer most recently created
    })

    if (allTasks.length === 0) {
      // No task - just delete the message, don't spam
      await deleteUserMessage(ctx)
      return
    }

    // Find task that still needs more submissions
    task = allTasks.find(t => {
      const pendingCount = t._count.submissions
      return t.requiredCount - t.passedCount - pendingCount > 0
    })
  }

  if (!task) {
    // All tasks have their submissions sent (pending review)
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '✅ Все записи отправлены!\n\nОжидайте проверку устаза.',
      { reply_markup: getBackKeyboard('close_notification', '✖️ Закрыть') },
      user.id,
      'notification'
    )
    return
  }

  // Use group settings (primary) or lesson settings (fallback)
  const settings = task.group || task.lesson?.group || task.lesson

  // Check if lesson allows text
  if (!settings?.allowText) {
    await deleteUserMessage(ctx)
    await deleteMessagesByType(ctx, 'menu')

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

  // Count pending submissions for this task
  const pendingCount = await prisma.submission.count({
    where: {
      taskId: task.id,
      status: SubmissionStatus.PENDING,
    }
  })

  // Check if more submissions are needed
  // Formula: required - passed - pending = remaining needed
  const neededSubmissions = task.requiredCount - task.passedCount - pendingCount
  if (neededSubmissions <= 0) {
    await deleteUserMessage(ctx)
    await sendAndTrack(
      ctx,
      '✅ Все записи отправлены!\n\nОжидайте проверку устаза.',
      { reply_markup: getBackKeyboard('close_notification', '✖️ Закрыть') },
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
    // Don't await - run in background to prevent webhook timeout
    processSubmissionAndNotify(task, previousPending, user).catch(err => {
      console.error('[Submission] Background processing error:', err)
    })
  }

  // Check if this is a resubmission (student had failed submissions and is sending more)
  const isResubmission = task.failedCount > 0 && !previousPending

  // Delete ALL previous messages to keep chat clean - no duplicates ever
  await deleteMessagesByType(ctx, 'submission_confirm')
  await deleteMessagesByType(ctx, 'menu')
  await deleteMessagesByType(ctx, 'task_info')  // Delete "Задание создано" message
  await deleteMessagesByType(ctx, 'review_result')
  await deleteMessagesByType(ctx, 'notification')

  // Check for duplicate submission (webhook retry protection)
  const messageId = ctx.message?.message_id
  if (messageId) {
    const existingSubmission = await prisma.submission.findFirst({
      where: {
        studentMsgId: BigInt(messageId),
        taskId: task.id,
      }
    })
    if (existingSubmission) {
      console.log(`[Submission] Duplicate detected for message ${messageId}, skipping`)
      return
    }
  }

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

  // For resubmissions, immediately notify ustaz (no need to wait for confirmation)
  // Don't await - run in background to prevent webhook timeout
  if (isResubmission) {
    processSubmissionAndNotify(task, submission, user).catch(err => {
      console.error('[Submission] Background resubmission error:', err)
    })
  }

  // Send confirmation (auto-delete after N minutes)
  // Calculate remaining correctly: required - passed - pending (including this new one)
  // pendingCount was queried before creating submission, so add 1 for this new submission
  const actualPendingCount = pendingCount + 1
  const remaining = task.requiredCount - task.passedCount - actualPendingCount
  const progressPercent = ((task.passedCount / task.requiredCount) * 100).toFixed(0)
  const isLastSubmission = remaining <= 0

  const deadlineEnabled = task.group?.deadlineEnabled ?? task.lesson?.group?.deadlineEnabled ?? true
  const message = buildSubmissionConfirmation(
    task.page?.pageNumber || 1,
    task.startLine,
    task.endLine,
    task.passedCount + actualPendingCount,
    task.requiredCount,
    Math.max(0, remaining),
    progressPercent,
    task.deadline,
    isLastSubmission,
    deadlineEnabled
  )

  await sendAndTrack(
    ctx,
    message,
    {
      reply_markup: getStudentTaskKeyboard(task.id, true, isLastSubmission),
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
      lesson: {
        include: { group: true }
      },
      group: true,
    }
  })

  if (!task) {
    // No task - just delete silently
    return
  }

  // Use group settings (primary) or lesson settings (fallback)
  const settings = task.group || task.lesson?.group || task.lesson

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

  await deleteMessagesByType(ctx, 'menu')
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
  deadline?: Date,
  isLastSubmission: boolean = false,
  deadlineEnabled: boolean = true
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
  } else if (isLastSubmission) {
    // Last submission - prompt for confirmation
    message += `\n🎉 <b>Все записи готовы!</b>\n`
    message += `<i>Нажмите «✅ Подтвердить работу» для отправки устазу.</i>`
    return message
  } else {
    message += `\n🎉 <b>Все записи отправлены!</b>\n`
    message += `<i>Ожидайте проверку устаза.</i>`
    return message
  }

  // Add deadline info (only if deadlines are enabled)
  if (deadline && deadlineEnabled) {
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
 * Exported for use in confirmAndSendToUstaz in menu.ts
 */
export async function processSubmissionAndNotify(
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

    // AI verification only for learning stages (1.1 and 2.1)
    // Connection stages (1.2, 2.2) and full page stage (3) - manual review only
    const isLearningStage = task.stage === 'STAGE_1_1' || task.stage === 'STAGE_2_1'

    // Run AI verification if enabled, submission has audio, AND it's a learning stage
    let aiResult: { score: number; transcript: string; errors: any[] } | null = null

    if (aiProvider !== 'NONE' && isLearningStage && (submission.fileType === 'voice' || submission.fileType === 'video_note') && submission.fileId) {
      try {
        if (aiProvider === 'QURANI_AI') {
          console.log('[AI] Processing submission with Qurani.ai QRC...')
          const { processSubmissionWithQRC } = await import('@/lib/qurani-ai')

          const result = await processSubmissionWithQRC(
            submission.fileId,
            task.page?.pageNumber
          )

          if (result.success) {
            aiResult = {
              score: result.score,
              transcript: result.transcript,
              errors: result.errors,
            }

            // Save AI results to submission
            await prisma.submission.update({
              where: { id: submission.id },
              data: {
                aiProvider: 'QURANI_AI',
                aiScore: result.score,
                aiTranscript: result.transcript,
                aiErrors: JSON.stringify(result.errors),
                aiProcessedAt: new Date(),
                aiRawResponse: JSON.stringify(result.rawResponse),
              },
            })

            console.log(`[AI] QRC result: score=${result.score}%, transcript=${result.transcript.substring(0, 50)}...`)
          }
        } else if (aiProvider === 'WHISPER') {
          console.log('[AI] Processing submission with OpenAI Whisper...')

          // Download audio file from Telegram
          const { bot } = await import('../bot')
          const file = await bot.api.getFile(submission.fileId)
          const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`

          // Fetch audio data
          const response = await fetch(fileUrl)
          const audioBuffer = Buffer.from(await response.arrayBuffer())

          // Get expected text from task page
          const { getPageVerses, getMedinaLines } = await import('@/lib/quran-api')
          const pageData = await getPageVerses(task.page?.pageNumber || 1)
          const allLines = getMedinaLines(pageData.verses)

          // Filter by requested lines
          let relevantLines = allLines.filter(l =>
            l.lineNumber >= task.startLine && l.lineNumber <= task.endLine
          )

          // Fallback: If no lines found (e.g. page 1 line 1 doesn't exist in API),
          // get first N available lines where N = requested lines count
          // This matches the same fallback logic used in QRC pre-check
          const linesCount = task.endLine - task.startLine + 1
          if (relevantLines.length === 0 && allLines.length > 0) {
            console.log(`[AI] Whisper: Requested lines ${task.startLine}-${task.endLine} not found, taking first ${linesCount} available`)
            relevantLines = allLines.slice(0, linesCount)
          }

          // Filter Arabic digits and verse markers from expected text
          // so AI comparison matches actual recitation without verse numbers
          const filterArabicDigits = (text: string) => text
            .replace(/[\u0660-\u0669\u06F0-\u06F9\u06DD]/g, '') // Arabic-Indic digits & verse marker
            .replace(/\s+/g, ' ')
            .trim()

          // Debug logging to trace the issue
          console.log(`[AI] Whisper: page=${task.page?.pageNumber}, startLine=${task.startLine}, endLine=${task.endLine}`)
          console.log(`[AI] Whisper: pageData.verses count=${pageData.verses?.length || 0}`)
          console.log(`[AI] Whisper: total lines from getMedinaLines=${allLines.length}`)
          console.log(`[AI] Whisper: API line numbers: ${allLines.map(l => l.lineNumber).join(', ')}`)
          console.log(`[AI] Whisper: relevantLines count=${relevantLines.length}`)

          const expectedText = filterArabicDigits(relevantLines.map(l => l.textArabic).join(' '))
          const expectedWords = relevantLines.flatMap(l =>
            (l.words?.map(w => filterArabicDigits(w.text_uthmani)) || []).filter(w => w.length > 0)
          )

          console.log(`[AI] Whisper: expectedText="${expectedText.substring(0, 100)}..."`)
          console.log(`[AI] Whisper: expectedWords count=${expectedWords.length}`)

          // Process with Whisper via check-audio API logic
          const { prisma: db } = await import('@/lib/prisma')
          const openaiKey = await db.systemSettings.findUnique({
            where: { key: 'OPENAI_API_KEY' }
          })

          if (openaiKey?.value) {
            // Call Whisper API
            const formData = new FormData()
            const blob = new Blob([audioBuffer], { type: 'audio/ogg' })
            formData.append('file', blob, 'audio.ogg')
            formData.append('model', 'whisper-1')
            formData.append('language', 'ar')

            const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${openaiKey.value}` },
              body: formData,
            })

            if (whisperResponse.ok) {
              const whisperResult = await whisperResponse.json()
              const transcript = whisperResult.text || ''

              // Use new combined analysis with whitelist + GPT-4o-mini
              const hafzLevel = group.qrcHafzLevel || 1
              const { analyzeQuranRecitation } = await import('@/lib/quran-text-matching')

              const analysisResult = await analyzeQuranRecitation(
                transcript,
                expectedText,
                expectedWords,
                { hafzLevel, useGPT: true }
              )

              aiResult = {
                score: analysisResult.score,
                transcript,
                errors: analysisResult.errors
              }

              // Save AI results
              await prisma.submission.update({
                where: { id: submission.id },
                data: {
                  aiProvider: 'WHISPER',
                  aiScore: analysisResult.score,
                  aiTranscript: transcript,
                  aiErrors: JSON.stringify(analysisResult.errors),
                  aiProcessedAt: new Date(),
                },
              })

              console.log(`[AI] Whisper+GPT: hafzLevel=${hafzLevel}, score=${analysisResult.score}%`)
              console.log(`[AI] GPT analysis: ${analysisResult.gptAnalysis || 'N/A'}`)
            }
          }
        }

        // Handle auto-verification modes
        if (aiResult) {
          const acceptThreshold = group.aiAcceptThreshold || 85
          const rejectThreshold = group.aiRejectThreshold || 50

          if (verificationMode === 'FULL_AUTO') {
            // FULL_AUTO: AI makes the decision automatically
            if (aiResult.score >= acceptThreshold) {
              // Auto-accept
              console.log(`[AI] FULL_AUTO: Auto-accepting submission (score ${aiResult.score}% >= ${acceptThreshold}%)`)
              await autoPassSubmission({ ...submission, aiScore: aiResult.score, aiErrors: JSON.stringify(aiResult.errors) }, task, student)
              return // Don't notify ustaz
            } else if (aiResult.score < rejectThreshold) {
              // Auto-reject
              console.log(`[AI] FULL_AUTO: Auto-rejecting submission (score ${aiResult.score}% < ${rejectThreshold}%)`)
              await autoFailSubmission({ ...submission, aiScore: aiResult.score, aiErrors: JSON.stringify(aiResult.errors) }, task, student)
              return // Don't notify ustaz
            }
            // Score in middle range - notify ustaz for manual review
          }
          // SEMI_AUTO: Ustaz ALWAYS gets notifications, AI score is just a recommendation
          // We don't auto-accept in SEMI_AUTO - ustaz has final decision
          console.log(`[AI] ${verificationMode}: Notifying ustaz with AI score ${aiResult.score}%`)
        }
      } catch (error) {
        console.error('[AI] Processing failed:', error)
        // Continue to notify ustaz even if AI fails
      }
    }

    // Notify ustaz (with AI score if available)
    // Pass aiResult to update submission object with AI data
    const updatedSubmission = aiResult ? {
      ...submission,
      aiScore: aiResult.score,
      aiTranscript: aiResult.transcript,
      aiErrors: JSON.stringify(aiResult.errors),
    } : submission

    await notifyUstazAboutSubmission(task, updatedSubmission, student, group)
  } catch (error) {
    console.error('Failed to process submission:', error)
  }
}

/**
 * Auto-pass a submission (for FULL_AUTO mode)
 */
async function autoPassSubmission(submission: any, task: any, student: any): Promise<void> {
  try {
    // Update submission status
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.PASSED,
        reviewedAt: new Date(),
        feedback: 'Автоматически принято (AI проверка)',
      },
    })

    // Update task counts
    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        passedCount: { increment: 1 },
      },
    })

    // Notify student with details
    if (student.telegramId) {
      const { bot } = await import('../bot')
      const { deleteMessagesByTypeForChat } = await import('../utils/message-cleaner')
      const chatId = Number(student.telegramId)
      const scorePercent = submission.aiScore ? Math.round(submission.aiScore) : 0
      const workNumber = updatedTask.passedCount
      const totalRequired = task.requiredCount
      const remaining = totalRequired - workNumber

      // Delete previous auto-result notifications to avoid duplicates
      const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
      await deleteMessagesByTypeForChat(chatId, 'review_result', botToken)

      let message = `✅ <b>Работа ${workNumber}/${totalRequired} принята!</b>\n\n`
      message += `📍 Страница ${task.page?.pageNumber || '?'}, строки ${task.startLine}-${task.endLine}\n`
      message += `🤖 AI оценка: <b>${scorePercent}%</b>\n\n`

      if (remaining > 0) {
        message += `📝 Осталось сдать: <b>${remaining}</b>\n`
        message += `<i>Продолжайте в том же духе!</i>`
      } else {
        message += `🎉 <b>Все работы сданы!</b>\n`
        message += `<i>Переход к следующему этапу...</i>`
      }

      const sentMsg = await bot.api.sendMessage(chatId, message, { parse_mode: 'HTML' }).catch(() => null)

      // Track message for cleanup
      if (sentMsg) {
        await prisma.botMessage.create({
          data: {
            chatId: BigInt(chatId),
            messageId: BigInt(sentMsg.message_id),
            userId: student.id,
            messageType: 'review_result',
            deleteAfter: new Date(Date.now() + 30 * 1000), // Auto-delete after 30 seconds
          }
        }).catch(() => {})
      }
    }
  } catch (error) {
    console.error('Auto-pass submission failed:', error)
  }
}

/**
 * Auto-fail a submission (for FULL_AUTO mode)
 */
async function autoFailSubmission(submission: any, task: any, student: any): Promise<void> {
  try {
    // Update submission status
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.FAILED,
        reviewedAt: new Date(),
        feedback: 'Автоматически отклонено (AI проверка)',
      },
    })

    // Update task counts
    await prisma.task.update({
      where: { id: task.id },
      data: {
        failedCount: { increment: 1 },
      },
    })

    // Notify student with feedback
    if (student.telegramId) {
      const { bot } = await import('../bot')
      const { deleteMessagesByTypeForChat } = await import('../utils/message-cleaner')
      const chatId = Number(student.telegramId)
      const scorePercent = submission.aiScore ? Math.round(submission.aiScore) : 0

      // Delete previous auto-result notifications to avoid duplicates
      const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
      await deleteMessagesByTypeForChat(chatId, 'review_result', botToken)

      let message = `❌ <b>Работа не принята</b>\n\n`
      message += `📍 Страница ${task.page?.pageNumber || '?'}, строки ${task.startLine}-${task.endLine}\n`
      message += `🤖 AI оценка: <b>${scorePercent}%</b>\n\n`

      // Parse errors if available
      if (submission.aiErrors) {
        try {
          const errors = JSON.parse(submission.aiErrors)
          if (errors.length > 0) {
            message += `<b>Замечания:</b>\n`
            errors.slice(0, 3).forEach((err: any) => {
              message += `• ${err.word || err.type}\n`
            })
            if (errors.length > 3) {
              message += `<i>...и ещё ${errors.length - 3} замечаний</i>\n`
            }
            message += `\n`
          }
        } catch {}
      }

      message += `<i>Попробуйте ещё раз.</i>`

      const sentMsg = await bot.api.sendMessage(chatId, message, { parse_mode: 'HTML' }).catch(() => null)

      // Track message for cleanup
      if (sentMsg) {
        await prisma.botMessage.create({
          data: {
            chatId: BigInt(chatId),
            messageId: BigInt(sentMsg.message_id),
            userId: student.id,
            messageType: 'review_result',
            deleteAfter: new Date(Date.now() + 30 * 1000), // Auto-delete after 30 seconds
          }
        }).catch(() => {})
      }
    }
  } catch (error) {
    console.error('Auto-fail submission failed:', error)
  }
}

/**
 * Notify ustaz about new submission - uses queue system
 * Only sends notification if no review is currently in progress
 * Otherwise just marks as ready for queue
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

    const ustazChatId = Number(group.ustaz.telegramId)
    const botToken = process.env.TELEGRAM_BOT_TOKEN

    // Mark submission as ready for ustaz review
    await prisma.submission.update({
      where: { id: submission.id },
      data: { sentToUstazAt: new Date() }
    })

    // Check if there's already a review message displayed for this ustaz
    const existingReviewMsg = await prisma.botMessage.findFirst({
      where: {
        chatId: BigInt(ustazChatId),
        messageType: 'submission_review'
      }
    })

    // If review is already in progress, don't send new message - it's in the queue
    if (existingReviewMsg) {
      console.log(`[Queue] Submission ${submission.id} added to queue for ustaz ${ustazChatId}`)
      return
    }

    // No active review - delete menu and show first submission
    if (botToken) {
      await deleteMessagesByTypeForChat(ustazChatId, 'menu', botToken)
    }

    // Show this submission
    await showSubmissionToUstaz(ustazChatId, submission, task, student, group)
  } catch (error) {
    console.error('Failed to notify ustaz:', error)
  }
}

/**
 * Show a specific submission to ustaz with review buttons
 * Called when starting review or showing next in queue
 * Returns delivery record ID if successful, null if failed
 */
async function showSubmissionToUstaz(
  ustazChatId: number,
  submission: any,
  taskInput: any,
  student: any,
  group: any
): Promise<string | null> {
  const { bot } = await import('../bot')
  const { InlineKeyboard } = await import('grammy')
  const { trackMessageForChat } = await import('../utils/message-cleaner')

  // Refetch task to get fresh data (currentCount, passedCount, etc.)
  const task = await prisma.task.findUnique({
    where: { id: taskInput.id },
    include: { page: true, group: true }
  }) || taskInput

  // Create or update delivery tracking record
  let deliveryRecord = await prisma.submissionDelivery.upsert({
    where: { submissionId: submission.id },
    create: {
      submissionId: submission.id,
      studentId: student.id,
      ustazId: group.ustaz.id,
      deliveryAttempts: 1,
      lastAttemptAt: new Date(),
    },
    update: {
      deliveryAttempts: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: null, // Clear previous error on retry
    }
  })

  // Get queue count for header
  const groups = await prisma.group.findMany({
    where: { ustaz: { telegramId: BigInt(ustazChatId) } },
    select: { id: true }
  })
  const groupIds = groups.map(g => g.id)

  const queueCount = await prisma.submission.count({
    where: {
      status: SubmissionStatus.PENDING,
      sentToUstazAt: { not: null },
      OR: [
        { task: { lesson: { groupId: { in: groupIds } } } },
        { task: { groupId: { in: groupIds } } }
      ]
    }
  })

  const studentName = student.firstName?.trim() || 'Студент'
  const groupName = group.name
  const lineRange = task.startLine === task.endLine
    ? `строка ${task.startLine}`
    : `строки ${task.startLine}-${task.endLine}`

  const stageNames: Record<string, string> = {
    STAGE_1_1: 'Этап 1.1',
    STAGE_1_2: 'Этап 1.2',
    STAGE_2_1: 'Этап 2.1',
    STAGE_2_2: 'Этап 2.2',
    STAGE_3: 'Этап 3',
  }
  const stageName = stageNames[task.stage] || task.stage

  // Count pending submissions for accurate progress
  const pendingForTask = await prisma.submission.count({
    where: {
      taskId: task.id,
      status: SubmissionStatus.PENDING
    }
  })
  const totalSent = task.passedCount + pendingForTask

  const progressPercent = Math.round((totalSent / task.requiredCount) * 100)
  const clampedPercent = Math.min(100, Math.max(0, progressPercent))
  const progressBar = `[${'▓'.repeat(Math.round(clampedPercent / 10))}${'░'.repeat(10 - Math.round(clampedPercent / 10))}]`

  // Header with queue count
  let caption = `📥 <b>Проверка работ</b> (${queueCount} в очереди)\n\n`
  caption += `📚 <b>${groupName}</b>\n`
  caption += `👤 ${studentName}\n`
  caption += `📖 Стр. ${task.page?.pageNumber || 1}, ${lineRange}\n`
  caption += `🎯 ${stageName}\n\n`
  caption += `${progressBar} ${progressPercent}%\n`
  caption += `📊 <b>${totalSent}/${task.requiredCount}</b>`

  if (task.passedCount > 0 || task.failedCount > 0) {
    caption += `\n✅ ${task.passedCount}`
    if (task.failedCount > 0) {
      caption += ` | ❌ ${task.failedCount}`
    }
  }

  if (submission.aiScore !== null && submission.aiScore !== undefined) {
    const scoreEmoji = submission.aiScore >= 85 ? '🟢' : submission.aiScore >= 50 ? '🟡' : '🔴'
    caption += `\n\n${scoreEmoji} <b>AI: ${Math.round(submission.aiScore)}%</b>`
    if (submission.aiTranscript) {
      caption += `\n<i>${submission.aiTranscript.substring(0, 100)}${submission.aiTranscript.length > 100 ? '...' : ''}</i>`
    }
  }

  // Always show both Pass and Fail buttons - ustaz has final decision
  const reviewKeyboard = new InlineKeyboard()

  // Pass button - always available
  if (submission.aiScore !== null && submission.aiScore >= 85) {
    reviewKeyboard.text('✅ Сдал (AI: ✓)', `review:pass:${submission.id}`)
  } else {
    reviewKeyboard.text('✅ Сдал', `review:pass:${submission.id}`)
  }

  // Fail button - always available
  if (submission.aiScore !== null && submission.aiScore < 50) {
    reviewKeyboard.text('❌ Не сдал (AI: ✗)', `review:fail:${submission.id}`)
  } else {
    reviewKeyboard.text('❌ Не сдал', `review:fail:${submission.id}`)
  }

  // Quran button - opens page with highlighted lines
  const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qurantester.vercel.app'
  const quranUrl = `${webAppUrl}/telegram?redirect=/ustaz/quran?page=${task.page?.pageNumber || 1}%26startLine=${task.startLine}%26endLine=${task.endLine}`
  reviewKeyboard.row().webApp('📖 Коран', quranUrl)

  if (student.telegramUsername) {
    reviewKeyboard.row().url(`💬 Написать студенту`, `https://t.me/${student.telegramUsername}`)
  } else if (student.telegramId) {
    reviewKeyboard.row().url(`💬 Написать студенту`, `tg://user?id=${student.telegramId}`)
  }

  // Send the file with caption and review buttons
  // Track delivery success/failure
  try {
    let ustazMessageId: number | null = null

    if (submission.fileType === 'voice') {
      const sentMsg = await bot.api.sendVoice(ustazChatId, submission.fileId, {
        caption,
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard
      })
      ustazMessageId = sentMsg.message_id
      await trackMessageForChat(ustazChatId, sentMsg.message_id, group.ustaz.id, 'submission_review')
    } else if (submission.fileType === 'video_note') {
      const videoMsg = await bot.api.sendVideoNote(ustazChatId, submission.fileId)
      ustazMessageId = videoMsg.message_id
      await trackMessageForChat(ustazChatId, videoMsg.message_id, group.ustaz.id, 'submission_review')
      const captionMsg = await bot.api.sendMessage(ustazChatId, caption, {
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard,
        reply_parameters: { message_id: videoMsg.message_id }
      })
      await trackMessageForChat(ustazChatId, captionMsg.message_id, group.ustaz.id, 'submission_review')
    } else if (submission.fileType === 'text') {
      const textContent = submission.fileId.replace('text:', '')
      const textMessage = caption + `\n\n💬 <i>${textContent}</i>`
      const sentMsg = await bot.api.sendMessage(ustazChatId, textMessage, {
        parse_mode: 'HTML',
        reply_markup: reviewKeyboard
      })
      ustazMessageId = sentMsg.message_id
      await trackMessageForChat(ustazChatId, sentMsg.message_id, group.ustaz.id, 'submission_review')
    }

    // Mark delivery as successful
    await prisma.submissionDelivery.update({
      where: { id: deliveryRecord.id },
      data: {
        sentToUstaz: true,
        ustazMessageId: ustazMessageId ? BigInt(ustazMessageId) : null,
        deliveredAt: new Date(),
      }
    })

    return deliveryRecord.id
  } catch (error: any) {
    // Mark delivery as failed
    console.error(`[Delivery] Failed to send to ustaz ${ustazChatId}:`, error.message)
    await prisma.submissionDelivery.update({
      where: { id: deliveryRecord.id },
      data: {
        sentToUstaz: false,
        lastError: error.message?.substring(0, 500) || 'Unknown error',
      }
    })
    return null
  }
}

/**
 * Show next pending submission to ustaz after review
 * Exported for use in menu.ts handleReviewCallback
 */
export async function showNextPendingSubmissionToUstaz(ustazChatId: number, ustazId: string): Promise<boolean> {
  try {
    const { bot } = await import('../bot')
    const botToken = process.env.TELEGRAM_BOT_TOKEN

    // Delete old review messages
    if (botToken) {
      await deleteMessagesByTypeForChat(ustazChatId, 'submission_review', botToken)
    }

    // Get ustaz's groups
    const groups = await prisma.group.findMany({
      where: { ustaz: { telegramId: BigInt(ustazChatId) } },
      select: { id: true }
    })
    const groupIds = groups.map(g => g.id)

    // Get next pending submission
    const nextSubmission = await prisma.submission.findFirst({
      where: {
        status: SubmissionStatus.PENDING,
        sentToUstazAt: { not: null },
        OR: [
          { task: { lesson: { groupId: { in: groupIds } } } },
          { task: { groupId: { in: groupIds } } }
        ]
      },
      include: {
        task: {
          include: {
            page: true,
            group: { include: { ustaz: true } },
            lesson: { include: { group: { include: { ustaz: true } } } }
          }
        },
        student: true
      },
      orderBy: { createdAt: 'asc' }
    })

    if (!nextSubmission) {
      return false // No more submissions
    }

    const task = nextSubmission.task
    const student = nextSubmission.student
    const group = task.group || task.lesson?.group

    if (!group) return false

    await showSubmissionToUstaz(ustazChatId, nextSubmission, task, student, group)
    return true
  } catch (error) {
    console.error('Failed to show next submission:', error)
    return false
  }
}

// ============== DELIVERY STATUS CHECK ==============

/**
 * Check delivery status for student's pending submissions
 * Returns info about failed deliveries and allows retry
 */
export async function checkDeliveryStatus(studentId: string): Promise<{
  totalPending: number
  delivered: number
  failed: number
  failedSubmissions: Array<{
    id: string
    submissionId: string
    pageNumber: number
    startLine: number
    endLine: number
    error: string | null
    attempts: number
    lastAttemptAt: Date | null
  }>
}> {
  // Get all pending submissions for this student
  const pendingSubmissions = await prisma.submission.findMany({
    where: {
      studentId,
      status: SubmissionStatus.PENDING,
    },
    include: {
      task: {
        select: {
          page: { select: { pageNumber: true } },
          startLine: true,
          endLine: true,
        }
      },
      delivery: true,
    }
  })

  const totalPending = pendingSubmissions.length
  let delivered = 0
  let failed = 0
  const failedSubmissions: Array<{
    id: string
    submissionId: string
    pageNumber: number
    startLine: number
    endLine: number
    error: string | null
    attempts: number
    lastAttemptAt: Date | null
  }> = []

  for (const sub of pendingSubmissions) {
    if (sub.delivery) {
      if (sub.delivery.sentToUstaz) {
        delivered++
      } else if (sub.delivery.deliveryAttempts > 0) {
        failed++
        failedSubmissions.push({
          id: sub.delivery.id,
          submissionId: sub.id,
          pageNumber: sub.task?.page?.pageNumber || 0,
          startLine: sub.task?.startLine || 0,
          endLine: sub.task?.endLine || 0,
          error: sub.delivery.lastError,
          attempts: sub.delivery.deliveryAttempts,
          lastAttemptAt: sub.delivery.lastAttemptAt,
        })
      }
    }
  }

  return { totalPending, delivered, failed, failedSubmissions }
}

/**
 * Retry failed delivery for a specific submission
 */
export async function retryDelivery(submissionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        student: true,
        task: {
          include: {
            page: true,
            group: { include: { ustaz: true } },
            lesson: { include: { group: { include: { ustaz: true } } } },
          }
        }
      }
    })

    if (!submission) {
      return { success: false, error: 'Работа не найдена' }
    }

    const task = submission.task
    const group = task?.group || task?.lesson?.group
    const ustaz = group?.ustaz

    if (!ustaz?.telegramId) {
      return { success: false, error: 'Устаз не найден' }
    }

    const ustazChatId = Number(ustaz.telegramId)
    const botToken = process.env.TELEGRAM_BOT_TOKEN

    // Delete any old messages from previous attempts
    if (botToken) {
      await deleteMessagesByTypeForChat(ustazChatId, 'submission_review', botToken)
    }

    // Retry sending
    const deliveryId = await showSubmissionToUstaz(
      ustazChatId,
      submission,
      task,
      submission.student,
      { ...group, ustaz }
    )

    if (deliveryId) {
      return { success: true }
    } else {
      return { success: false, error: 'Не удалось отправить' }
    }
  } catch (error: any) {
    console.error('[Delivery] Retry failed:', error)
    return { success: false, error: error.message || 'Ошибка при повторной отправке' }
  }
}

// ============== REVISION SUBMISSION HANDLERS ==============

/**
 * Handle revision submission (voice or video note)
 */
async function handleRevisionSubmission(
  ctx: BotContext,
  user: any,
  fileType: 'voice' | 'video_note',
  fileId: string,
  duration?: number
): Promise<void> {
  const pageNumber = ctx.session.revisionPageNumber!

  // Delete user's message to keep chat clean
  await deleteUserMessage(ctx)

  // Get student's ustaz for notification
  const studentWithGroup = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      studentGroups: {
        where: { isActive: true },
        include: {
          group: {
            include: { ustaz: true }
          }
        },
        take: 1
      }
    }
  })

  const ustaz = studentWithGroup?.studentGroups[0]?.group?.ustaz

  // Get today's date (start of day) for daily tracking
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Get student's revision pages per day requirement
  const revisionPagesPerDay = studentWithGroup?.studentGroups[0]?.group?.revisionPagesPerDay || 3

  // Create revision submission with date
  const revision = await prisma.revisionSubmission.create({
    data: {
      studentId: user.id,
      pageNumber,
      date: today,
      fileId,
      fileType,
      duration,
      status: SubmissionStatus.PENDING,
      studentMsgId: ctx.message?.message_id ? BigInt(ctx.message.message_id) : null,
    }
  })

  // Update or create daily revision progress
  await prisma.dailyRevisionProgress.upsert({
    where: {
      studentId_date: {
        studentId: user.id,
        date: today,
      }
    },
    create: {
      studentId: user.id,
      date: today,
      pagesRequired: revisionPagesPerDay,
      pagesTotal: 1,
    },
    update: {
      pagesTotal: { increment: 1 },
    }
  })

  // Send confirmation to student
  const message = `✅ <b>Повторение отправлено!</b>\n\n` +
    `📖 Страница: <b>${pageNumber}</b>\n\n` +
    `<i>Ожидайте проверку устаза.</i>`

  await sendAndTrack(
    ctx,
    message,
    {
      reply_markup: getRevisionSubmitKeyboard(pageNumber),
      parse_mode: 'HTML'
    },
    user.id,
    'submission_confirm'
  )

  // Reset session state
  ctx.session.step = 'browsing_menu'
  ctx.session.revisionPageNumber = undefined

  // Notify ustaz
  if (ustaz?.telegramId) {
    try {
      const { bot } = await import('../bot')
      const ustazChatId = Number(ustaz.telegramId)
      const studentName = user.firstName?.trim() || 'Студент'
      const groupName = studentWithGroup?.studentGroups[0]?.group?.name || ''

      let caption = `🔄 <b>Повторение</b>\n\n`
      caption += `📚 <b>${groupName}</b>\n`
      caption += `👤 ${studentName}\n`
      caption += `📖 Страница: <b>${pageNumber}</b>`

      // Send the file with caption and review buttons
      if (fileType === 'voice') {
        await bot.api.sendVoice(ustazChatId, fileId, {
          caption,
          parse_mode: 'HTML',
          reply_markup: getRevisionReviewKeyboard(revision.id, user.telegramUsername || undefined)
        })
      } else {
        // Video notes don't support captions - send video first, then message with buttons
        const videoMsg = await bot.api.sendVideoNote(ustazChatId, fileId)
        // Send details as reply to the video note
        await bot.api.sendMessage(ustazChatId, caption, {
          parse_mode: 'HTML',
          reply_markup: getRevisionReviewKeyboard(revision.id, user.telegramUsername || undefined),
          reply_parameters: { message_id: videoMsg.message_id }
        })
      }
    } catch (error) {
      console.error('Failed to notify ustaz about revision:', error)
    }
  }
}
