import type { BotContext } from '../bot'
import { prisma } from '@/lib/prisma'

/**
 * Track a sent message for later cleanup
 * @param deleteAfterMinutes - Optional: auto-delete message after N minutes
 */
export async function trackMessage(
  ctx: BotContext,
  messageId: number,
  userId?: string,
  messageType: string = 'general',
  deleteAfterMinutes?: number
): Promise<void> {
  const chatId = ctx.chat?.id
  if (!chatId) return

  // Calculate deleteAfter time if specified
  let deleteAfter: Date | undefined
  if (deleteAfterMinutes && deleteAfterMinutes > 0) {
    deleteAfter = new Date(Date.now() + deleteAfterMinutes * 60 * 1000)
  }

  // Track in database
  await prisma.botMessage.create({
    data: {
      chatId: BigInt(chatId),
      messageId: BigInt(messageId),
      userId,
      messageType,
      deleteAfter,
    }
  })

  // Track in session for immediate cleanup
  ctx.session.messageIds.push(messageId)
}

/**
 * Delete messages from session (recent messages)
 */
export async function cleanupSessionMessages(
  ctx: BotContext,
  keepLast: number = 0
): Promise<void> {
  const chatId = ctx.chat?.id
  if (!chatId) return

  const messagesToDelete = keepLast > 0
    ? ctx.session.messageIds.slice(0, -keepLast)
    : [...ctx.session.messageIds]

  for (const msgId of messagesToDelete) {
    try {
      await ctx.api.deleteMessage(chatId, msgId)
    } catch (error) {
      // Message might already be deleted or too old
      console.log(`Could not delete message ${msgId}:`, error)
    }
  }

  // Update session
  ctx.session.messageIds = keepLast > 0
    ? ctx.session.messageIds.slice(-keepLast)
    : []

  // Also clean from database
  if (messagesToDelete.length > 0) {
    await prisma.botMessage.deleteMany({
      where: {
        chatId: BigInt(chatId),
        messageId: {
          in: messagesToDelete.map(id => BigInt(id))
        }
      }
    })
  }
}

/**
 * Delete all tracked messages for a chat
 */
export async function cleanupAllMessages(ctx: BotContext): Promise<void> {
  const chatId = ctx.chat?.id
  if (!chatId) return

  // Get all tracked messages from database
  const messages = await prisma.botMessage.findMany({
    where: { chatId: BigInt(chatId) },
    orderBy: { createdAt: 'desc' }
  })

  // Delete each message
  for (const msg of messages) {
    try {
      await ctx.api.deleteMessage(chatId, Number(msg.messageId))
    } catch (error) {
      // Message might already be deleted or too old
    }
  }

  // Clean database
  await prisma.botMessage.deleteMany({
    where: { chatId: BigInt(chatId) }
  })

  // Clear session
  ctx.session.messageIds = []
}

/**
 * Delete the user's last message (command or text they sent)
 */
export async function deleteUserMessage(ctx: BotContext): Promise<void> {
  const chatId = ctx.chat?.id
  const messageId = ctx.message?.message_id

  if (!chatId || !messageId) return

  try {
    await ctx.api.deleteMessage(chatId, messageId)
  } catch (error) {
    // Cannot delete user message (permissions or too old)
  }
}

/**
 * Send a message and track it for cleanup
 * @param deleteAfterMinutes - Optional: auto-delete message after N minutes
 */
export async function sendAndTrack(
  ctx: BotContext,
  text: string,
  options: Parameters<BotContext['reply']>[1] = {},
  userId?: string,
  messageType: string = 'general',
  deleteAfterMinutes?: number
): Promise<number> {
  const message = await ctx.reply(text, options)
  await trackMessage(ctx, message.message_id, userId, messageType, deleteAfterMinutes)
  return message.message_id
}

/**
 * Edit a message and update tracking
 */
export async function editMessage(
  ctx: BotContext,
  messageId: number,
  text: string,
  options: Parameters<BotContext['api']['editMessageText']>[3] = {}
): Promise<void> {
  const chatId = ctx.chat?.id
  if (!chatId) return

  try {
    await ctx.api.editMessageText(chatId, messageId, text, options)
  } catch (error) {
    console.log(`Could not edit message ${messageId}:`, error)
  }
}

/**
 * Delete messages by type for a specific chat
 */
export async function deleteMessagesByType(
  ctx: BotContext,
  messageType: string
): Promise<number> {
  const chatId = ctx.chat?.id
  if (!chatId) return 0

  const messages = await prisma.botMessage.findMany({
    where: {
      chatId: BigInt(chatId),
      messageType,
    }
  })

  let deleted = 0
  for (const msg of messages) {
    try {
      await ctx.api.deleteMessage(chatId, Number(msg.messageId))
      deleted++
    } catch (error) {
      // Message might already be deleted
    }
  }

  // Remove from database
  await prisma.botMessage.deleteMany({
    where: {
      chatId: BigInt(chatId),
      messageType,
    }
  })

  // Remove from session
  const msgIds = messages.map(m => Number(m.messageId))
  ctx.session.messageIds = ctx.session.messageIds.filter(id => !msgIds.includes(id))

  return deleted
}

/**
 * Delete messages by type for a specific chat using bot API directly
 * Used when we don't have the user's context (e.g., notifying ustaz)
 */
export async function deleteMessagesByTypeForChat(
  chatId: number | bigint,
  messageType: string,
  botToken: string
): Promise<number> {
  const messages = await prisma.botMessage.findMany({
    where: {
      chatId: BigInt(chatId),
      messageType,
    }
  })

  let deleted = 0
  const baseUrl = `https://api.telegram.org/bot${botToken}`

  for (const msg of messages) {
    try {
      const response = await fetch(`${baseUrl}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: msg.chatId.toString(),
          message_id: msg.messageId.toString(),
        }),
      })

      if (response.ok) {
        deleted++
      }
    } catch (error) {
      // Message might already be deleted
    }
  }

  // Remove from database
  await prisma.botMessage.deleteMany({
    where: {
      chatId: BigInt(chatId),
      messageType,
    }
  })

  return deleted
}

/**
 * Track a message sent via bot API (without context)
 */
export async function trackMessageForChat(
  chatId: number | bigint,
  messageId: number,
  userId?: string,
  messageType: string = 'general',
  deleteAfterMinutes?: number
): Promise<void> {
  let deleteAfter: Date | undefined
  if (deleteAfterMinutes && deleteAfterMinutes > 0) {
    deleteAfter = new Date(Date.now() + deleteAfterMinutes * 60 * 1000)
  }

  await prisma.botMessage.create({
    data: {
      chatId: BigInt(chatId),
      messageId: BigInt(messageId),
      userId,
      messageType,
      deleteAfter,
    }
  })
}

/**
 * Delete messages that have passed their deleteAfter time
 * Called by cron job
 */
export async function cleanupExpiredMessages(botToken: string): Promise<{
  checked: number
  deleted: number
  errors: number
}> {
  const now = new Date()

  // Find all messages that should be deleted
  const expiredMessages = await prisma.botMessage.findMany({
    where: {
      deleteAfter: {
        lte: now,
        not: null,
      }
    },
    take: 100, // Process in batches
  })

  let deleted = 0
  let errors = 0

  // Use bot API directly (not context)
  const baseUrl = `https://api.telegram.org/bot${botToken}`

  for (const msg of expiredMessages) {
    try {
      const response = await fetch(`${baseUrl}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: msg.chatId.toString(),
          message_id: msg.messageId.toString(),
        }),
      })

      if (response.ok) {
        deleted++
      } else {
        const error = await response.json()
        // If message is already deleted or too old, still remove from DB
        if (error.description?.includes('message to delete not found') ||
            error.description?.includes("message can't be deleted")) {
          deleted++ // Count as deleted since it's already gone
        } else {
          errors++
        }
      }
    } catch (error) {
      errors++
    }

    // Remove from database regardless
    await prisma.botMessage.delete({
      where: { id: msg.id }
    }).catch(() => {
      // Ignore if already deleted
    })
  }

  return {
    checked: expiredMessages.length,
    deleted,
    errors,
  }
}
