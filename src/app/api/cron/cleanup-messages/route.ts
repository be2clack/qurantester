import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cleanupExpiredMessages } from '@/lib/telegram/utils/message-cleaner'

// Secret for cron job authentication
const CRON_SECRET = process.env.CRON_SECRET || 'qurantester-cron-secret'

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  const providedSecret = authHeader?.replace('Bearer ', '') ||
    req.nextUrl.searchParams.get('secret')

  if (providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured')
    }

    // Cleanup expired messages
    const result = await cleanupExpiredMessages(botToken)

    const duration = Date.now() - startTime

    // Update cron job record
    await prisma.cronJob.upsert({
      where: { name: 'cleanup-messages' },
      update: {
        lastRunAt: new Date(),
        lastStatus: 'success',
        lastError: null,
        runCount: { increment: 1 },
      },
      create: {
        name: 'cleanup-messages',
        url: '/api/cron/cleanup-messages',
        schedule: '*/5 * * * *', // Every 5 minutes
        isEnabled: true,
        lastRunAt: new Date(),
        lastStatus: 'success',
        runCount: 1,
      }
    })

    return NextResponse.json({
      success: true,
      ...result,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Update cron job record with error
    await prisma.cronJob.upsert({
      where: { name: 'cleanup-messages' },
      update: {
        lastRunAt: new Date(),
        lastStatus: 'error',
        lastError: errorMessage,
        runCount: { increment: 1 },
        errorCount: { increment: 1 },
      },
      create: {
        name: 'cleanup-messages',
        url: '/api/cron/cleanup-messages',
        schedule: '*/5 * * * *',
        isEnabled: true,
        lastRunAt: new Date(),
        lastStatus: 'error',
        lastError: errorMessage,
        runCount: 1,
        errorCount: 1,
      }
    })

    console.error('Cleanup messages cron error:', error)

    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

// Also support POST for cron-job.org
export async function POST(req: NextRequest) {
  return GET(req)
}
