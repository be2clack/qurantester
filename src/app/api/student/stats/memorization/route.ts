import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, StageNumber } from '@prisma/client'

// GET: Get extended memorization statistics for a student
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId')
  const groupId = searchParams.get('groupId')

  // Determine which student's stats to get
  let targetStudentId = user.id

  if (studentId && studentId !== user.id) {
    // Only admin, ustaz, or parent can view other students' stats
    if (user.role === UserRole.STUDENT) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify access for ustaz
    if (user.role === UserRole.USTAZ) {
      const studentGroup = await prisma.studentGroup.findFirst({
        where: {
          studentId,
          group: { ustazId: user.id }
        }
      })
      if (!studentGroup) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    targetStudentId = studentId
  }

  try {
    // Get completed tasks with timing info
    const completedTasks = await prisma.task.findMany({
      where: {
        studentId: targetStudentId,
        status: 'PASSED',
        ...(groupId ? { groupId } : {})
      },
      select: {
        id: true,
        stage: true,
        startLine: true,
        endLine: true,
        createdAt: true,
        updatedAt: true,
        passedCount: true,
        requiredCount: true,
        page: { select: { pageNumber: true } },
        group: { select: { level: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100
    })

    // Calculate average time per line by stage
    const stageTimes: Record<string, { total: number; count: number }> = {}

    for (const task of completedTasks) {
      const linesCount = task.endLine - task.startLine + 1
      const durationMs = new Date(task.updatedAt).getTime() - new Date(task.createdAt).getTime()
      const durationMinutes = durationMs / 1000 / 60
      const timePerLine = durationMinutes / linesCount

      const stage = task.stage
      if (!stageTimes[stage]) {
        stageTimes[stage] = { total: 0, count: 0 }
      }
      stageTimes[stage].total += timePerLine
      stageTimes[stage].count += 1
    }

    // Calculate averages
    const averageTimeByStage: Record<string, number> = {}
    for (const [stage, data] of Object.entries(stageTimes)) {
      averageTimeByStage[stage] = Math.round(data.total / data.count)
    }

    // Get page revision stats
    const pageRevisionStats = await prisma.pageRevisionStats.findMany({
      where: {
        studentId: targetStudentId,
        ...(groupId ? { groupId } : {})
      },
      orderBy: { pageNumber: 'asc' }
    })

    // Get active tasks
    const activeTasks = await prisma.task.findMany({
      where: {
        studentId: targetStudentId,
        status: 'IN_PROGRESS',
        ...(groupId ? { groupId } : {})
      },
      include: {
        page: { select: { pageNumber: true } },
        submissions: {
          where: { status: 'PENDING' },
          select: { id: true }
        }
      }
    })

    // Get line progress for learning stages
    const lineProgress = await prisma.lineProgress.findMany({
      where: {
        studentId: targetStudentId,
        ...(groupId ? { groupId } : {})
      },
      orderBy: [{ pageNumber: 'asc' }, { lineNumber: 'asc' }]
    })

    // Summary
    const totalTasksCompleted = completedTasks.length
    const learningTasksCompleted = completedTasks.filter(
      t => t.stage === 'STAGE_1_1' || t.stage === 'STAGE_2_1'
    ).length
    const connectionTasksCompleted = completedTasks.filter(
      t => t.stage === 'STAGE_1_2' || t.stage === 'STAGE_2_2'
    ).length
    const fullPageTasksCompleted = completedTasks.filter(
      t => t.stage === 'STAGE_3'
    ).length

    return NextResponse.json({
      summary: {
        totalTasksCompleted,
        learningTasksCompleted,
        connectionTasksCompleted,
        fullPageTasksCompleted,
        averageTimeByStage
      },
      activeTasks: activeTasks.map(t => ({
        id: t.id,
        pageNumber: t.page.pageNumber,
        startLine: t.startLine,
        endLine: t.endLine,
        stage: t.stage,
        passedCount: t.passedCount,
        requiredCount: t.requiredCount,
        pendingCount: t.submissions.length
      })),
      recentTasks: completedTasks.slice(0, 20).map(t => ({
        id: t.id,
        pageNumber: t.page.pageNumber,
        startLine: t.startLine,
        endLine: t.endLine,
        stage: t.stage,
        passedCount: t.passedCount,
        requiredCount: t.requiredCount,
        completedAt: t.updatedAt,
        durationMinutes: Math.round(
          (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 1000 / 60
        )
      })),
      pageRevisionStats: pageRevisionStats.map(p => ({
        pageNumber: p.pageNumber,
        todayCount: p.todayCount,
        weekCount: p.weekCount,
        monthCount: p.monthCount,
        yearCount: p.yearCount,
        totalCount: p.totalCount,
        lastRevisedAt: p.lastRevisedAt,
        lastResult: p.lastResult
      })),
      lineProgress: lineProgress.map(l => ({
        pageNumber: l.pageNumber,
        lineNumber: l.lineNumber,
        stage: l.stage,
        status: l.status,
        passedCount: l.passedCount,
        requiredCount: l.requiredCount
      }))
    })
  } catch (error) {
    console.error('Error fetching memorization stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
