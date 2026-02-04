import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, TaskStatus, SubmissionStatus, Gender, Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get filter params
    const { searchParams } = new URL(request.url)
    const genderFilter = searchParams.get('gender') as Gender | null
    const ageFilter = searchParams.get('age') // 'children' (<18) or 'adults' (>=18)

    // Build top students filter
    const topStudentsWhere: Prisma.UserWhereInput = {
      role: UserRole.STUDENT,
      isActive: true,
    }

    if (genderFilter && (genderFilter === 'MALE' || genderFilter === 'FEMALE')) {
      topStudentsWhere.gender = genderFilter
    }

    if (ageFilter) {
      const today = new Date()
      const cutoffDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())

      if (ageFilter === 'children') {
        // Born after cutoff = under 18
        topStudentsWhere.birthDate = { gt: cutoffDate }
      } else if (ageFilter === 'adults') {
        // Born on or before cutoff = 18 or older
        topStudentsWhere.birthDate = { lte: cutoffDate }
      }
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

      // Top students by page progress (with filters)
      prisma.user.findMany({
        where: topStudentsWhere,
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
          gender: true,
          birthDate: true,
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
      topStudents: topStudents.map((student, index) => {
        // Calculate age
        let age: number | null = null
        if (student.birthDate) {
          const today = new Date()
          const birth = new Date(student.birthDate)
          age = today.getFullYear() - birth.getFullYear()
          const monthDiff = today.getMonth() - birth.getMonth()
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--
          }
        }

        return {
          id: student.id,
          rank: index + 1,
          name: [student.firstName, student.lastName].filter(Boolean).join(' ') || 'Студент',
          page: student.currentPage,
          line: student.currentLine,
          tasksCompleted: student.statistics?.totalTasksCompleted || 0,
          gender: student.gender,
          age,
        }
      }),
    })
  } catch (error) {
    console.error('Get stats overview error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
