import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { Bot } from 'grammy'

const CRON_SECRET = process.env.CRON_SECRET || 'hlDGk9eyARRBgZb4UVqPb7x4mjH/nes66Nl0wM053Cc='
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

const stageShort: Record<string, string> = {
  STAGE_1_1: '1.1',
  STAGE_1_2: '1.2',
  STAGE_2_1: '2.1',
  STAGE_2_2: '2.2',
  STAGE_3: '3',
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bot = new Bot(BOT_TOKEN)

    // Get today's date range
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Find all parents with children and telegram IDs
    const parents = await prisma.user.findMany({
      where: {
        role: UserRole.PARENT,
        isActive: true,
        telegramId: { not: null },
        parentOf: { some: {} },
      },
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        parentOf: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            currentPage: true,
            currentLine: true,
            currentStage: true,
            studentGroups: {
              where: { isActive: true },
              select: {
                groupId: true,
                group: {
                  select: { name: true, lessonType: true },
                },
              },
            },
          },
        },
      },
    })

    let sentCount = 0
    let errorCount = 0

    for (const parent of parents) {
      if (!parent.telegramId) continue

      const childIds = parent.parentOf.map((c) => c.id)
      const allGroupIds = parent.parentOf.flatMap((c) =>
        c.studentGroups.map((sg) => sg.groupId)
      )

      // Get today's activity for all children
      const [submissions, revisionSubs, revisionLogs, translationProgress] =
        await Promise.all([
          prisma.submission.findMany({
            where: {
              studentId: { in: childIds },
              createdAt: { gte: today, lt: tomorrow },
            },
            select: {
              studentId: true,
              status: true,
              task: {
                select: {
                  stage: true,
                  page: { select: { pageNumber: true } },
                  group: { select: { lessonType: true } },
                  lesson: { select: { group: { select: { lessonType: true } } } },
                },
              },
            },
          }),
          prisma.revisionSubmission.findMany({
            where: {
              studentId: { in: childIds },
              createdAt: { gte: today, lt: tomorrow },
            },
            select: { studentId: true, pageNumber: true, status: true },
          }),
          prisma.dailyRevisionLog.findMany({
            where: {
              studentId: { in: childIds },
              groupId: { in: allGroupIds },
              date: today,
            },
            select: { studentId: true, pageNumber: true },
          }),
          prisma.translationPageProgress.findMany({
            where: {
              studentId: { in: childIds },
              groupId: { in: allGroupIds },
              date: today,
            },
            select: {
              studentId: true,
              pageNumber: true,
              bestScore: true,
              attempts: true,
            },
          }),
        ])

      // Build message for each child
      let message = `📋 <b>Ежедневный отчёт</b>\n\n`
      let hasAnyActivity = false

      for (const child of parent.parentOf) {
        const childName = child.firstName || 'Ребёнок'
        const stageName = stageShort[child.currentStage] || child.currentStage

        // Memorization
        const childMemSubs = submissions.filter((s) => {
          if (s.studentId !== child.id) return false
          const lt = s.task.group?.lessonType || s.task.lesson?.group?.lessonType
          return lt === 'MEMORIZATION'
        })

        // Revision
        const childRevSubs = revisionSubs.filter((s) => s.studentId === child.id)
        const childRevLogs = revisionLogs.filter((l) => l.studentId === child.id)
        const totalRevision = childRevSubs.length + childRevLogs.length

        // Translation
        const childTranslation = translationProgress.filter(
          (t) => t.studentId === child.id
        )

        const childHasActivity =
          childMemSubs.length > 0 || totalRevision > 0 || childTranslation.length > 0

        if (childHasActivity) hasAnyActivity = true

        message += `👤 <b>${childName}</b> (стр. ${child.currentPage}, эт. ${stageName})\n`

        if (!childHasActivity) {
          message += `   ❌ Не отправлял работы сегодня\n\n`
          continue
        }

        // Memorization summary
        if (childMemSubs.length > 0) {
          const passed = childMemSubs.filter((s) => s.status === 'PASSED').length
          const pending = childMemSubs.filter((s) => s.status === 'PENDING').length
          const failed = childMemSubs.filter((s) => s.status === 'FAILED').length
          message += `   📖 Заучивание: ${childMemSubs.length} сдач`
          if (passed > 0) message += ` ✅${passed}`
          if (pending > 0) message += ` ⏳${pending}`
          if (failed > 0) message += ` ❌${failed}`
          message += '\n'
        }

        // Revision summary
        if (totalRevision > 0) {
          const revPages = [
            ...childRevSubs.map((s) => s.pageNumber),
            ...childRevLogs.map((l) => l.pageNumber),
          ]
          const uniquePages = [...new Set(revPages)]
          message += `   🔄 Повторение: ${uniquePages.length} стр. (${uniquePages.join(', ')})\n`
        }

        // Translation summary
        if (childTranslation.length > 0) {
          for (const t of childTranslation) {
            message += `   📝 Перевод стр. ${t.pageNumber}: ${t.bestScore}%`
            if (t.attempts > 1) message += ` (${t.attempts} поп.)`
            message += '\n'
          }
        }

        message += '\n'
      }

      // Add web panel link
      const webUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qurantester.vercel.app'
      message += `🔗 <a href="${webUrl}/parent/report">Подробный отчёт</a>`

      try {
        await bot.api.sendMessage(Number(parent.telegramId), message, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        })
        sentCount++
      } catch (err: any) {
        console.error(
          `[DailyParentReport] Failed to send to parent ${parent.id}:`,
          err.message
        )
        errorCount++
      }
    }

    // Update cron job record
    await prisma.cronJob
      .upsert({
        where: { name: 'daily-parent-report' },
        create: {
          name: 'daily-parent-report',
          url: '/api/cron/daily-parent-report',
          schedule: '0 20 * * *',
          lastRunAt: new Date(),
          lastStatus: 'SUCCESS',
          runCount: 1,
        },
        update: {
          lastRunAt: new Date(),
          lastStatus: errorCount > 0 ? 'PARTIAL' : 'SUCCESS',
          runCount: { increment: 1 },
        },
      })
      .catch(() => {})

    return NextResponse.json({
      success: true,
      sentCount,
      errorCount,
      totalParents: parents.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Daily parent report cron error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
