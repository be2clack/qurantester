import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, TaskStatus, SubmissionStatus } from '@prisma/client'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all stats in parallel
    const [
      totalUsers,
      studentCount,
      ustazCount,
      activeUserCount,
      totalTasks,
      inProgressTasks,
      completedTasks,
      failedTasks,
      totalSubmissions,
      pendingSubmissions,
      passedSubmissions,
      failedSubmissions,
      totalGroups,
      activeGroups,
      topStudents,
    ] = await Promise.all([
      // Users
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.STUDENT } }),
      prisma.user.count({ where: { role: UserRole.USTAZ } }),
      prisma.user.count({ where: { isActive: true } }),

      // Tasks
      prisma.task.count(),
      prisma.task.count({ where: { status: TaskStatus.IN_PROGRESS } }),
      prisma.task.count({ where: { status: TaskStatus.PASSED } }),
      prisma.task.count({ where: { status: TaskStatus.FAILED } }),

      // Submissions
      prisma.submission.count(),
      prisma.submission.count({ where: { status: SubmissionStatus.PENDING } }),
      prisma.submission.count({ where: { status: SubmissionStatus.PASSED } }),
      prisma.submission.count({ where: { status: SubmissionStatus.FAILED } }),

      // Groups
      prisma.group.count(),
      prisma.group.count({ where: { isActive: true } }),

      // Top students by page progress
      prisma.user.findMany({
        where: { role: UserRole.STUDENT, isActive: true },
        orderBy: [
          { currentPage: 'desc' },
          { currentLine: 'desc' },
        ],
        take: 10,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          currentPage: true,
          currentLine: true,
          statistics: {
            select: { totalTasksCompleted: true }
          },
        },
      }),
    ])

    return NextResponse.json({
      users: {
        total: totalUsers,
        students: studentCount,
        ustaz: ustazCount,
        active: activeUserCount,
      },
      tasks: {
        total: totalTasks,
        inProgress: inProgressTasks,
        completed: completedTasks,
        failed: failedTasks,
      },
      submissions: {
        total: totalSubmissions,
        pending: pendingSubmissions,
        passed: passedSubmissions,
        failed: failedSubmissions,
      },
      groups: {
        total: totalGroups,
        active: activeGroups,
      },
      topStudents: topStudents.map((student, index) => ({
        id: student.id,
        rank: index + 1,
        name: [student.firstName, student.lastName].filter(Boolean).join(' ') || 'Студент',
        page: student.currentPage,
        line: student.currentLine,
        tasksCompleted: student.statistics?.totalTasksCompleted || 0,
      })),
    })
  } catch (error) {
    console.error('Get stats overview error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
