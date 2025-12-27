import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'

/**
 * POST /api/admin/reset-progress
 * Reset all student progress (for testing)
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Reset all student progress in StudentGroup
    const studentGroupsReset = await prisma.studentGroup.updateMany({
      data: {
        currentPage: 1,
        currentLine: 1,
        currentStage: 'STAGE_1_1',
      }
    })

    // Reset all user progress
    const usersReset = await prisma.user.updateMany({
      where: { role: UserRole.STUDENT },
      data: {
        currentPage: 1,
        currentLine: 1,
        currentStage: 'STAGE_1_1',
      }
    })

    // Delete all tasks
    const tasksDeleted = await prisma.task.deleteMany({})

    // Delete all submissions
    const submissionsDeleted = await prisma.submission.deleteMany({})

    // Delete all revision submissions
    const revisionSubmissionsDeleted = await prisma.revisionSubmission.deleteMany({})

    // Delete all QRC pre-checks (AI verification attempts)
    const qrcPreChecksDeleted = await prisma.qRCPreCheck.deleteMany({})

    // Delete all mufradat submissions
    const mufradatSubmissionsDeleted = await prisma.mufradatSubmission.deleteMany({})

    // Delete all mufradat game sessions
    const mufradatSessionsDeleted = await prisma.mufradatGameSession.deleteMany({})

    // Delete daily revision progress
    const dailyRevisionDeleted = await prisma.dailyRevisionProgress.deleteMany({})

    // Reset all statistics
    const statsReset = await prisma.userStatistics.updateMany({
      data: {
        totalPagesCompleted: 0,
        totalLinesCompleted: 0,
        totalTasksCompleted: 0,
        totalTasksFailed: 0,
        totalSubmissions: 0,
        passedSubmissions: 0,
        currentStreak: 0,
        lastWeekProgress: 0,
        thisWeekProgress: 0,
        lastMonthProgress: 0,
        thisMonthProgress: 0,
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Прогресс всех студентов сброшен',
      stats: {
        studentGroupsReset: studentGroupsReset.count,
        usersReset: usersReset.count,
        tasksDeleted: tasksDeleted.count,
        submissionsDeleted: submissionsDeleted.count,
        revisionSubmissionsDeleted: revisionSubmissionsDeleted.count,
        qrcPreChecksDeleted: qrcPreChecksDeleted.count,
        mufradatSubmissionsDeleted: mufradatSubmissionsDeleted.count,
        mufradatSessionsDeleted: mufradatSessionsDeleted.count,
        dailyRevisionDeleted: dailyRevisionDeleted.count,
        statsReset: statsReset.count,
      }
    })
  } catch (error) {
    console.error('Reset progress error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
