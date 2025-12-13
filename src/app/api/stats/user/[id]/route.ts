import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, TaskStatus, SubmissionStatus } from '@prisma/client'
import { subDays } from 'date-fns'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Access control
    if (currentUser.role === UserRole.STUDENT && currentUser.id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        currentPage: true,
        currentLine: true,
        currentStage: true,
        childOf: { select: { id: true } },
        statistics: true,
        studentGroup: {
          select: { id: true, name: true, ustazId: true }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Ustaz can only see their students
    if (currentUser.role === UserRole.USTAZ) {
      if (user.studentGroup?.ustazId !== currentUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Parent can only see their children
    if (currentUser.role === UserRole.PARENT) {
      const isParent = user.childOf.some(parent => parent.id === currentUser.id)
      if (!isParent) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Get task statistics
    const [totalTasks, passedTasks, failedTasks, inProgressTasks] = await Promise.all([
      prisma.task.count({ where: { studentId: id } }),
      prisma.task.count({ where: { studentId: id, status: TaskStatus.PASSED } }),
      prisma.task.count({ where: { studentId: id, status: TaskStatus.FAILED } }),
      prisma.task.count({ where: { studentId: id, status: TaskStatus.IN_PROGRESS } }),
    ])

    // Get submission statistics
    const [totalSubmissions, passedSubmissions, failedSubmissions] = await Promise.all([
      prisma.submission.count({ where: { studentId: id } }),
      prisma.submission.count({ where: { studentId: id, status: SubmissionStatus.PASSED } }),
      prisma.submission.count({ where: { studentId: id, status: SubmissionStatus.FAILED } }),
    ])

    // Get recent activity (last 7 days)
    const sevenDaysAgo = subDays(new Date(), 7)
    const recentSubmissions = await prisma.submission.groupBy({
      by: ['createdAt'],
      where: {
        studentId: id,
        createdAt: { gte: sevenDaysAgo }
      },
      _count: true,
    })

    // Calculate completion percentage
    const totalPages = 602
    const completedPages = user.statistics?.totalPagesCompleted || 0
    const completionPercentage = ((completedPages / totalPages) * 100).toFixed(2)

    // Estimate completion date
    const averagePagesPerWeek = user.statistics?.averagePagesPerWeek || 0
    const remainingPages = totalPages - completedPages
    const estimatedWeeksRemaining = averagePagesPerWeek > 0
      ? Math.ceil(remainingPages / averagePagesPerWeek)
      : null

    return NextResponse.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        currentPage: user.currentPage,
        currentLine: user.currentLine,
        currentStage: user.currentStage,
      },
      progress: {
        currentPage: user.currentPage,
        currentLine: user.currentLine,
        currentStage: user.currentStage,
        totalPages,
        completedPages,
        completionPercentage: parseFloat(completionPercentage),
        estimatedWeeksRemaining,
      },
      tasks: {
        total: totalTasks,
        passed: passedTasks,
        failed: failedTasks,
        inProgress: inProgressTasks,
        passRate: totalTasks > 0 ? ((passedTasks / totalTasks) * 100).toFixed(1) : '0',
      },
      submissions: {
        total: totalSubmissions,
        passed: passedSubmissions,
        failed: failedSubmissions,
        passRate: totalSubmissions > 0 ? ((passedSubmissions / totalSubmissions) * 100).toFixed(1) : '0',
      },
      statistics: user.statistics,
      recentActivity: recentSubmissions,
    })
  } catch (error) {
    console.error('Get user stats error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
