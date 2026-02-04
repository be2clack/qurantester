import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles: UserRole[] = [UserRole.PARENT, UserRole.ADMIN]
    if (!allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')

    const date = dateParam ? new Date(dateParam) : new Date()
    date.setHours(0, 0, 0, 0)
    const nextDay = new Date(date)
    nextDay.setDate(nextDay.getDate() + 1)

    // Get children of this parent
    const children = await prisma.user.findMany({
      where: {
        childOf: { some: { id: currentUser.id } },
      },
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
            currentPage: true,
            currentLine: true,
            currentStage: true,
            group: {
              select: {
                id: true,
                name: true,
                lessonType: true,
                ustaz: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    })

    if (children.length === 0) {
      return NextResponse.json({
        date: date.toISOString(),
        children: [],
      })
    }

    const childIds = children.map((c) => c.id)

    // Get all group IDs the children belong to
    const allGroupIds = children.flatMap((c) =>
      c.studentGroups.map((sg) => sg.groupId)
    )

    // Fetch all activity data in parallel
    const [
      memorizationSubmissions,
      revisionSubmissions,
      revisionLogs,
      translationProgress,
    ] = await Promise.all([
      // Memorization submissions
      prisma.submission.findMany({
        where: {
          studentId: { in: childIds },
          createdAt: { gte: date, lt: nextDay },
        },
        select: {
          id: true,
          studentId: true,
          status: true,
          createdAt: true,
          task: {
            select: {
              stage: true,
              passedCount: true,
              requiredCount: true,
              status: true,
              page: { select: { pageNumber: true } },
              group: { select: { lessonType: true, name: true } },
              lesson: { select: { group: { select: { lessonType: true, name: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),

      // Revision voice submissions
      prisma.revisionSubmission.findMany({
        where: {
          studentId: { in: childIds },
          createdAt: { gte: date, lt: nextDay },
        },
        select: {
          id: true,
          studentId: true,
          pageNumber: true,
          status: true,
        },
      }),

      // Revision button logs
      prisma.dailyRevisionLog.findMany({
        where: {
          studentId: { in: childIds },
          groupId: { in: allGroupIds },
          date,
        },
        select: {
          id: true,
          studentId: true,
          pageNumber: true,
          status: true,
        },
      }),

      // Translation progress
      prisma.translationPageProgress.findMany({
        where: {
          studentId: { in: childIds },
          groupId: { in: allGroupIds },
          date,
        },
        select: {
          id: true,
          studentId: true,
          pageNumber: true,
          wordsCorrect: true,
          wordsTotal: true,
          bestScore: true,
          attempts: true,
        },
      }),
    ])

    // Build per-child report
    const childrenReport = children.map((child) => {
      const childMemSubs = memorizationSubmissions.filter(
        (s) => s.studentId === child.id
      )
      const childRevSubs = revisionSubmissions.filter(
        (s) => s.studentId === child.id
      )
      const childRevLogs = revisionLogs.filter(
        (l) => l.studentId === child.id
      )
      const childTranslation = translationProgress.filter(
        (t) => t.studentId === child.id
      )

      // Group memorization by task
      const memTasks = new Map<string, {
        page: number
        stage: string
        groupName: string
        passedCount: number
        requiredCount: number
        taskStatus: string
        submissionsToday: number
        passedToday: number
        failedToday: number
        pendingToday: number
      }>()

      for (const sub of childMemSubs) {
        const lessonType = sub.task.group?.lessonType || sub.task.lesson?.group?.lessonType
        if (lessonType !== 'MEMORIZATION') continue

        const taskKey = `${sub.task.page?.pageNumber}-${sub.task.stage}`
        if (!memTasks.has(taskKey)) {
          memTasks.set(taskKey, {
            page: sub.task.page?.pageNumber || 0,
            stage: sub.task.stage,
            groupName: sub.task.group?.name || sub.task.lesson?.group?.name || '',
            passedCount: sub.task.passedCount,
            requiredCount: sub.task.requiredCount,
            taskStatus: sub.task.status,
            submissionsToday: 0,
            passedToday: 0,
            failedToday: 0,
            pendingToday: 0,
          })
        }
        const t = memTasks.get(taskKey)!
        t.submissionsToday++
        if (sub.status === 'PASSED') t.passedToday++
        else if (sub.status === 'FAILED') t.failedToday++
        else t.pendingToday++
      }

      const revisionPages = [
        ...childRevSubs.map((s) => ({
          page: s.pageNumber,
          status: s.status,
          type: 'voice' as const,
        })),
        ...childRevLogs.map((l) => ({
          page: l.pageNumber,
          status: l.status === 'ACKNOWLEDGED' ? 'PASSED' : 'PENDING',
          type: 'button' as const,
        })),
      ]

      const hasActivity =
        memTasks.size > 0 ||
        revisionPages.length > 0 ||
        childTranslation.length > 0

      return {
        id: child.id,
        name:
          `${child.firstName || ''} ${child.lastName || ''}`.trim() ||
          'Ребенок',
        currentPage: child.currentPage,
        currentLine: child.currentLine,
        currentStage: child.currentStage,
        groups: child.studentGroups.map((sg) => ({
          name: sg.group.name,
          lessonType: sg.group.lessonType,
          ustaz: sg.group.ustaz
            ? `${sg.group.ustaz.firstName || ''} ${sg.group.ustaz.lastName || ''}`.trim()
            : null,
        })),
        hasActivity,
        memorization: Array.from(memTasks.values()),
        revision: revisionPages,
        translation: childTranslation.map((t) => ({
          page: t.pageNumber,
          wordsCorrect: t.wordsCorrect,
          wordsTotal: t.wordsTotal,
          bestScore: t.bestScore,
          attempts: t.attempts,
        })),
      }
    })

    return NextResponse.json({
      date: date.toISOString(),
      children: childrenReport,
    })
  } catch (error) {
    console.error('Parent report error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
