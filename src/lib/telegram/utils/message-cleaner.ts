import type { BotContext } from '../bot'
import { prisma } from '@/lib/prisma'

/**
 * Track a sent message for later cleanup
 */
export async function trackMessage(
  ctx: BotContext,
  messageId: number,
  userId?: string,
  messageType: string = 'general'
): Promise<void> {
  const chatId = ctx.chat?.id
  if (!chatId) return

  // Track in database
  await prisma.botMessage.create({
    data: {
      chatId: BigInt(chatId),
      messageId: BigInt(messageId),
      userId,
      messageType,
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
 */
export async function sendAndTrack(
  ctx: BotContext,
  text: string,
  options: Parameters<BotContext['reply']>[1] = {},
  userId?: string,
  messageType: string = 'general'
): Promise<number> {
  const message = await ctx.reply(text, options)
  await trackMessage(ctx, message.message_id, userId, messageType)
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
