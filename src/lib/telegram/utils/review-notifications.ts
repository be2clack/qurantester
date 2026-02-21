import { prisma } from '@/lib/prisma'
import { SubmissionStatus } from '@prisma/client'

/**
 * Notify student via Telegram about submission review result.
 * Used by both Telegram bot handler and web API review route
 * to ensure consistent notifications regardless of review source.
 */
export async function notifyStudentAboutReview(
  studentTelegramId: bigint | string | number,
  submission: {
    id: string
    taskId: string
    studentId: string
    task: {
      page?: { pageNumber: number } | null
      startLine: number
      endLine: number
      passedCount: number
      requiredCount: number
      failedCount: number
    }
  },
  status: 'PASSED' | 'FAILED',
  taskCompleted: boolean
): Promise<void> {
  try {
    const { bot } = await import('../bot')
    const { deleteMessagesByTypeForChat, trackMessageForChat } = await import('./message-cleaner')
    const { InlineKeyboard } = await import('grammy')

    const chatId = Number(studentTelegramId)
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const task = submission.task

    const lineRange = task.startLine === task.endLine
      ? `строка ${task.startLine}`
      : `строки ${task.startLine}-${task.endLine}`

    // If task completed, clean up old submission confirms
    // The advanceStudentProgress (Telegram) or web API will handle the completion notification
    if (taskCompleted && status === 'PASSED') {
      if (botToken) {
        await deleteMessagesByTypeForChat(chatId, 'submission_confirm', botToken)
      }
      // Don't send notification here - advanceStudentProgress handles it
      return
    }

    // Clean up old review result notifications
    if (botToken) {
      await deleteMessagesByTypeForChat(chatId, 'review_result', botToken)
    }

    // For failed submissions, also clean up submission confirms to avoid confusion
    if (status === 'FAILED' && botToken) {
      await deleteMessagesByTypeForChat(chatId, 'submission_confirm', botToken)
    }

    const notificationKeyboard = new InlineKeyboard()
    let message: string

    if (status === 'FAILED') {
      message = `❌ <b>Запись отклонена</b>\n\n`
      message += `📖 Стр. ${task.page?.pageNumber || 1}, ${lineRange}\n`
      message += `📊 Принято: <b>${task.passedCount}/${task.requiredCount}</b>\n`
      message += `❌ На пересдачу: <b>${task.failedCount}</b>\n\n`
      message += `<i>Отправьте запись повторно.</i>`

      notificationKeyboard.text('✖️ Закрыть', 'close_notification')
    } else {
      // Passed but more needed
      const remaining = task.requiredCount - task.passedCount
      message = `✅ <b>Запись принята</b>\n\n`
      message += `📖 Стр. ${task.page?.pageNumber || 1}, ${lineRange}\n`
      message += `📊 Принято: <b>${task.passedCount}/${task.requiredCount}</b>`

      if (remaining > 0) {
        message += `\n⏳ Осталось: <b>${remaining}</b>`
      }

      notificationKeyboard.text('✖️ Закрыть', 'close_notification')
    }

    const sentMsg = await bot.api.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: notificationKeyboard
    })

    // Track message for cleanup
    await trackMessageForChat(
      chatId,
      sentMsg.message_id,
      submission.studentId,
      'review_result'
    )
  } catch (error) {
    console.error('[ReviewNotification] Failed to notify student:', error)
  }
}
