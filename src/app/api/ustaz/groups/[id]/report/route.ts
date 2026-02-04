import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== UserRole.USTAZ && currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: groupId } = await params
    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')

    // Parse date or use today
    const date = dateParam ? new Date(dateParam) : new Date()
    date.setHours(0, 0, 0, 0)
    const nextDay = new Date(date)
    nextDay.setDate(nextDay.getDate() + 1)

    // Verify group belongs to this ustaz
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        ...(currentUser.role === UserRole.USTAZ && { ustazId: currentUser.id }),
      },
      select: { id: true, name: true, lessonType: true, ustazId: true },
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Get all students in this group
    const studentGroups = await prisma.studentGroup.findMany({
      where: { groupId, isActive: true },
      select: {
        studentId: true,
        currentPage: true,
        currentLine: true,
        currentStage: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            telegramUsername: true,
          },
        },
      },
    })

    const studentIds = studentGroups.map((sg) => sg.studentId)

    // Get all groups this ustaz has (to find related memorization/revision/translation groups)
    const allUstazGroups = await prisma.group.findMany({
      where: { ustazId: group.ustazId, isActive: true },
      select: { id: true, lessonType: true },
    })
    const allGroupIds = allUstazGroups.map((g) => g.id)
    const memorizationGroupIds = allUstazGroups.filter((g) => g.lessonType === 'MEMORIZATION').map((g) => g.id)
    const revisionGroupIds = allUstazGroups.filter((g) => g.lessonType === 'REVISION').map((g) => g.id)
    const translationGroupIds = allUstazGroups.filter((g) => g.lessonType === 'TRANSLATION').map((g) => g.id)

    // Fetch all data in parallel
    const [
      memorizationSubmissions,
      revisionSubmissions,
      revisionLogs,
      translationProgress,
    ] = await Promise.all([
      // Memorization: submissions created today for tasks in ustaz's groups
      prisma.submission.findMany({
        where: {
          studentId: { in: studentIds },
          createdAt: { gte: date, lt: nextDay },
          task: {
            OR: [
              { groupId: { in: allGroupIds } },
              { lesson: { groupId: { in: allGroupIds } } },
            ],
          },
        },
        select: {
          id: true,
          studentId: true,
          status: true,
          createdAt: true,
          fileType: true,
          task: {
            select: {
              id: true,
              stage: true,
              status: true,
              passedCount: true,
              requiredCount: true,
              failedCount: true,
              groupId: true,
              page: { select: { pageNumber: true } },
              group: { select: { lessonType: true } },
              lesson: { select: { group: { select: { lessonType: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),

      // Revision submissions (voice-based)
      prisma.revisionSubmission.findMany({
        where: {
          studentId: { in: studentIds },
          createdAt: { gte: date, lt: nextDay },
        },
        select: {
          id: true,
          studentId: true,
          pageNumber: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),

      // Revision logs (button-based)
      prisma.dailyRevisionLog.findMany({
        where: {
          studentId: { in: studentIds },
          groupId: { in: revisionGroupIds },
          date,
        },
        select: {
          id: true,
          studentId: true,
          pageNumber: true,
          status: true,
          markedAt: true,
        },
      }),

      // Translation progress
      prisma.translationPageProgress.findMany({
        where: {
          studentId: { in: studentIds },
          groupId: { in: translationGroupIds },
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

    // Build per-student report
    const studentReport = studentGroups.map((sg) => {
      const studentId = sg.studentId

      // Memorization data - group submissions by task
      const studentMemSubs = memorizationSubmissions.filter((s) => {
        if (s.studentId !== studentId) return false
        const lessonType = s.task.group?.lessonType || s.task.lesson?.group?.lessonType
        return lessonType === 'MEMORIZATION'
      })

      // Group by task to get unique task info
      const taskMap = new Map<string, {
        taskId: string
        page: number
        stage: string
        passedCount: number
        requiredCount: number
        failedCount: number
        taskStatus: string
        submissionsToday: number
        passedToday: number
        failedToday: number
        pendingToday: number
      }>()

      for (const sub of studentMemSubs) {
        const taskId = sub.task.id
        if (!taskMap.has(taskId)) {
          taskMap.set(taskId, {
            taskId,
            page: sub.task.page?.pageNumber || 0,
            stage: sub.task.stage,
            passedCount: sub.task.passedCount,
            requiredCount: sub.task.requiredCount,
            failedCount: sub.task.failedCount,
            taskStatus: sub.task.status,
            submissionsToday: 0,
            passedToday: 0,
            failedToday: 0,
            pendingToday: 0,
          })
        }
        const t = taskMap.get(taskId)!
        t.submissionsToday++
        if (sub.status === 'PASSED') t.passedToday++
        else if (sub.status === 'FAILED') t.failedToday++
        else t.pendingToday++
      }

      // Revision data
      const studentRevSubs = revisionSubmissions.filter((s) => s.studentId === studentId)
      const studentRevLogs = revisionLogs.filter((l) => l.studentId === studentId)

      const revisionPages = [
        ...studentRevSubs.map((s) => ({ page: s.pageNumber, status: s.status, type: 'voice' as const })),
        ...studentRevLogs.map((l) => ({ page: l.pageNumber, status: l.status === 'ACKNOWLEDGED' ? 'PASSED' : 'PENDING', type: 'button' as const })),
      ]

      // Translation data
      const studentTranslation = translationProgress.filter((t) => t.studentId === studentId)

      const hasActivity = taskMap.size > 0 || revisionPages.length > 0 || studentTranslation.length > 0

      return {
        id: sg.student.id,
        name: `${sg.student.firstName || ''} ${sg.student.lastName || ''}`.trim() || 'Без имени',
        telegramUsername: sg.student.telegramUsername,
        currentPage: sg.currentPage,
        currentLine: sg.currentLine,
        currentStage: sg.currentStage,
        hasActivity,
        memorization: taskMap.size > 0
          ? Array.from(taskMap.values())
          : [],
        revision: revisionPages,
        translation: studentTranslation.map((t) => ({
          page: t.pageNumber,
          wordsCorrect: t.wordsCorrect,
          wordsTotal: t.wordsTotal,
          bestScore: t.bestScore,
          attempts: t.attempts,
        })),
      }
    })

    // Sort: active students first, then by name
    studentReport.sort((a, b) => {
      if (a.hasActivity !== b.hasActivity) return a.hasActivity ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    // Summary stats
    const activeCount = studentReport.filter((s) => s.hasActivity).length
    const totalMemSubs = memorizationSubmissions.length
    const totalRevPages = revisionSubmissions.length + revisionLogs.length
    const totalTranslation = translationProgress.length

    return NextResponse.json({
      group: { id: group.id, name: group.name, lessonType: group.lessonType },
      date: date.toISOString(),
      summary: {
        totalStudents: studentReport.length,
        activeStudents: activeCount,
        inactiveStudents: studentReport.length - activeCount,
        totalMemorizationSubmissions: totalMemSubs,
        totalRevisionPages: totalRevPages,
        totalTranslationSessions: totalTranslation,
      },
      students: studentReport,
    })
  } catch (error) {
    console.error('Get group report error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
