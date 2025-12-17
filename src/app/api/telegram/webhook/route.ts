import { NextRequest, NextResponse } from 'next/server'
import { webhookCallback } from 'grammy'
import { bot } from '@/lib/telegram/bot'
import { handleStart } from '@/lib/telegram/handlers/start'
import { handleContact, handleNameInput, handleBirthDateInput } from '@/lib/telegram/handlers/contact'
import {
  handleVoiceSubmission,
  handleVideoNoteSubmission,
  handleTextSubmission,
  handleRejectedMessage
} from '@/lib/telegram/handlers/submission'
import { handleCallbackQuery } from '@/lib/telegram/handlers/menu'
import { handleChildPhoneInput } from '@/lib/telegram/handlers/registration'
import { handleSetPassword, handlePasswordInput, handleCancelPassword } from '@/lib/telegram/handlers/password'

// Register command handlers
bot.command('start', handleStart)
bot.command('setpassword', handleSetPassword)
bot.command('cancel', async (ctx) => {
  const handled = await handleCancelPassword(ctx)
  if (!handled) {
    await ctx.reply('Нет активных операций для отмены.')
  }
})
bot.command('help', async (ctx) => {
  await ctx.reply(
    '<b>Помощь</b>\n\n' +
    '/start - Начать работу с ботом\n' +
    '/setpassword - Установить пароль для веб-входа (для админов и устазов)\n' +
    '/help - Показать эту справку\n\n' +
    'Для сдачи заданий отправляйте голосовые сообщения или видео-кружочки.',
    { parse_mode: 'HTML' }
  )
})

// Register message handlers
bot.on('message:contact', handleContact)
bot.on('message:voice', handleVoiceSubmission)
bot.on('message:video_note', handleVideoNoteSubmission)

// Handle text messages - check for registration steps first, then try text submission
bot.on('message:text', async (ctx) => {
  // Skip if it's a command
  if (ctx.message.text.startsWith('/')) return

  // Check if in registration process
  if (ctx.session.step === 'awaiting_name') {
    await handleNameInput(ctx)
    return
  }

  if (ctx.session.step === 'awaiting_birthdate') {
    await handleBirthDateInput(ctx)
    return
  }

  if (ctx.session.step === 'awaiting_child_phone') {
    await handleChildPhoneInput(ctx)
    return
  }

  if (ctx.session.step === 'awaiting_password') {
    await handlePasswordInput(ctx)
    return
  }

  // Try text submission (will check if user is student with active task that allows text)
  await handleTextSubmission(ctx)
})
bot.on('message:photo', handleRejectedMessage)
bot.on('message:document', handleRejectedMessage)
bot.on('message:video', handleRejectedMessage)
bot.on('message:audio', handleRejectedMessage)
bot.on('message:sticker', handleRejectedMessage)

// Register callback query handler
bot.on('callback_query:data', handleCallbackQuery)

// Create webhook handler
const handleUpdate = webhookCallback(bot, 'std/http')

export async function POST(req: NextRequest) {
  try {
    return await handleUpdate(req)
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    bot: process.env.TELEGRAM_BOT_USERNAME || 'QuranTesterBot'
  })
}
