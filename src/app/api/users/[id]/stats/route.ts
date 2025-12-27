import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TaskStatus, SubmissionStatus } from '@prisma/client'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format } from 'date-fns'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studentId } = await context.params
    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'week' // week, month, custom
    const month = searchParams.get('month') // 2024-12
    const year = searchParams.get('year') // 2024

    let startDate: Date
    let endDate: Date
    const now = new Date()

    if (month) {
      // Specific month selected
      const [y, m] = month.split('-').map(Number)
      startDate = new Date(y, m - 1, 1)
      endDate = new Date(y, m, 0, 23, 59, 59, 999)
    } else if (period === 'last_week') {
      startDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      endDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
    } else if (period === 'month') {
      startDate = startOfMonth(now)
      endDate = endOfMonth(now)
    } else if (period === 'last_month') {
      startDate = startOfMonth(subMonths(now, 1))
      endDate = endOfMonth(subMonths(now, 1))
    } else {
      // Default: this week
      startDate = startOfWeek(now, { weekStartsOn: 1 })
      endDate = endOfWeek(now, { weekStartsOn: 1 })
    }

    // Get memorization tasks for period
    const tasks = await prisma.task.findMany({
      where: {
        studentId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        }
      },
      include: {
        page: true,
        submissions: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get revision submissions for period
    const revisions = await prisma.revisionSubmission.findMany({
      where: {
        studentId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get mufradat/translation submissions for period
    const mufradatSubmissions = await prisma.submission.findMany({
      where: {
        studentId,
        submissionType: 'MUFRADAT_GAME',
        createdAt: {
          gte: startDate,
          lte: endDate,
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get daily revision progress for period
    const dailyRevisionProgress = await prisma.dailyRevisionProgress.findMany({
      where: {
        studentId,
        date: {
          gte: startDate,
          lte: endDate,
        }
      },
      orderBy: { date: 'desc' }
    })

    // Calculate daily stats
    const dailyStats: Record<string, {
      date: string
      memorization: { tasks: number; passed: number; failed: number }
      revision: { submitted: number; passed: number; failed: number; required: number }
      mufradat: { games: number; passed: number; avgScore: number }
    }> = {}

    // Initialize days
    const current = new Date(startDate)
    while (current <= endDate) {
      const dateStr = format(current, 'yyyy-MM-dd')
      dailyStats[dateStr] = {
        date: dateStr,
        memorization: { tasks: 0, passed: 0, failed: 0 },
        revision: { submitted: 0, passed: 0, failed: 0, required: 0 },
        mufradat: { games: 0, passed: 0, avgScore: 0 },
      }
      current.setDate(current.getDate() + 1)
    }

    // Fill memorization stats
    for (const task of tasks) {
      const dateStr = format(task.createdAt, 'yyyy-MM-dd')
      if (dailyStats[dateStr]) {
        dailyStats[dateStr].memorization.tasks++
        if (task.status === TaskStatus.PASSED) {
          dailyStats[dateStr].memorization.passed++
        } else if (task.status === TaskStatus.FAILED) {
          dailyStats[dateStr].memorization.failed++
        }
      }
    }

    // Fill revision stats
    for (const rev of revisions) {
      const dateStr = format(rev.createdAt, 'yyyy-MM-dd')
      if (dailyStats[dateStr]) {
        dailyStats[dateStr].revision.submitted++
        if (rev.status === SubmissionStatus.PASSED) {
          dailyStats[dateStr].revision.passed++
        } else if (rev.status === SubmissionStatus.FAILED) {
          dailyStats[dateStr].revision.failed++
        }
      }
    }

    // Fill daily revision requirements
    for (const progress of dailyRevisionProgress) {
      const dateStr = format(progress.date, 'yyyy-MM-dd')
      if (dailyStats[dateStr]) {
        dailyStats[dateStr].revision.required = progress.pagesRequired
      }
    }

    // Fill mufradat stats
    const mufradatByDay: Record<string, { scores: number[]; passed: number }> = {}
    for (const muf of mufradatSubmissions) {
      const dateStr = format(muf.createdAt, 'yyyy-MM-dd')
      if (!mufradatByDay[dateStr]) {
        mufradatByDay[dateStr] = { scores: [], passed: 0 }
      }
      if (muf.gameScore !== null) {
        mufradatByDay[dateStr].scores.push(muf.gameScore)
      }
      if (muf.status === SubmissionStatus.PASSED) {
        mufradatByDay[dateStr].passed++
      }
    }
    for (const [dateStr, data] of Object.entries(mufradatByDay)) {
      if (dailyStats[dateStr]) {
        dailyStats[dateStr].mufradat.games = data.scores.length
        dailyStats[dateStr].mufradat.passed = data.passed
        dailyStats[dateStr].mufradat.avgScore = data.scores.length > 0
          ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
          : 0
      }
    }

    // Calculate summary
    const summary = {
      memorization: {
        totalTasks: tasks.length,
        passed: tasks.filter(t => t.status === TaskStatus.PASSED).length,
        failed: tasks.filter(t => t.status === TaskStatus.FAILED).length,
        inProgress: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      },
      revision: {
        totalSubmitted: revisions.length,
        passed: revisions.filter(r => r.status === SubmissionStatus.PASSED).length,
        failed: revisions.filter(r => r.status === SubmissionStatus.FAILED).length,
        pending: revisions.filter(r => r.status === SubmissionStatus.PENDING).length,
        daysComplete: dailyRevisionProgress.filter(d => d.isComplete).length,
        totalDays: dailyRevisionProgress.length,
      },
      mufradat: {
        totalGames: mufradatSubmissions.length,
        passed: mufradatSubmissions.filter(m => m.status === SubmissionStatus.PASSED).length,
        avgScore: mufradatSubmissions.length > 0
          ? Math.round(mufradatSubmissions.reduce((sum, m) => sum + (m.gameScore || 0), 0) / mufradatSubmissions.length)
          : 0,
      }
    }

    // Get available months for selection
    const firstSubmission = await prisma.submission.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true }
    })

    const availableMonths: string[] = []
    if (firstSubmission) {
      const start = new Date(firstSubmission.createdAt.getFullYear(), firstSubmission.createdAt.getMonth(), 1)
      const end = new Date()
      const current = new Date(start)
      while (current <= end) {
        availableMonths.push(format(current, 'yyyy-MM'))
        current.setMonth(current.getMonth() + 1)
      }
    }

    return NextResponse.json({
      period: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd'),
        label: period,
      },
      summary,
      daily: Object.values(dailyStats).reverse(),
      availableMonths,
    })
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
