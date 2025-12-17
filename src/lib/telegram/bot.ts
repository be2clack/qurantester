import { Bot, Context, SessionFlavor, session, StorageAdapter } from 'grammy'
import { prisma } from '@/lib/prisma'

// Session data interface
export interface SessionData {
  step: 'idle' | 'awaiting_contact' | 'awaiting_name' | 'awaiting_birthdate' | 'awaiting_role' | 'awaiting_ustaz_selection' | 'awaiting_ustaz_confirm' | 'awaiting_child_phone' | 'awaiting_submission' | 'browsing_menu' | 'awaiting_password'
  messageIds: number[]
  pendingTaskId?: string
  currentMenuPath?: string
  // Registration data
  registrationPhone?: string
  registrationName?: string
  registrationBirthDate?: string
  selectedUstazId?: string
}

// Bot context with session
export type BotContext = Context & SessionFlavor<SessionData>

// Get bot token
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

if (!BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables')
}

// Create bot instance
export const bot = new Bot<BotContext>(BOT_TOKEN)

// Initial session data
function getInitialSessionData(): SessionData {
  return {
    step: 'idle',
    messageIds: [],
    currentMenuPath: 'main',
  }
}

// Prisma-based session storage adapter for serverless environments
function createPrismaStorage(): StorageAdapter<SessionData> {
  return {
    async read(key: string): Promise<SessionData | undefined> {
      try {
        const session = await prisma.botSession.findUnique({
          where: { id: key }
        })
        if (session?.data) {
          return JSON.parse(session.data) as SessionData
        }
        return undefined
      } catch (error) {
        console.error('Session read error:', error)
        return undefined
      }
    },

    async write(key: string, value: SessionData): Promise<void> {
      try {
        await prisma.botSession.upsert({
          where: { id: key },
          update: { data: JSON.stringify(value) },
          create: { id: key, data: JSON.stringify(value) }
        })
      } catch (error) {
        console.error('Session write error:', error)
      }
    },

    async delete(key: string): Promise<void> {
      try {
        await prisma.botSession.delete({
          where: { id: key }
        }).catch(() => {
          // Ignore if session doesn't exist
        })
      } catch (error) {
        console.error('Session delete error:', error)
      }
    }
  }
}

// Session middleware with Prisma storage
bot.use(session({
  initial: getInitialSessionData,
  storage: createPrismaStorage(),
}))

// Error handling
bot.catch((err) => {
  const ctx = err.ctx
  console.error(`Error while handling update ${ctx.update.update_id}:`)
  console.error(err.error)
})

// Export bot instance
export { BOT_TOKEN }
