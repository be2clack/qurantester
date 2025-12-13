import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, TaskStatus, SubmissionStatus } from '@prisma/client'

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

    // Get group
    const group = await prisma.group.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ustazId: true,
        _count: { select: { students: true } }
      }
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Access control
    if (currentUser.role === UserRole.USTAZ && group.ustazId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.USTAZ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get student IDs
    const students = await prisma.user.findMany({
      where: { groupId: id, role: UserRole.STUDENT, isActive: true },
      select: { id: true, currentPage: true, currentLine: true }
    })
    const studentIds = students.map(s => s.id)

    // Task statistics
    const [totalTasks, passedTasks, failedTasks, inProgressTasks] = await Promise.all([
      prisma.task.count({ where: { studentId: { in: studentIds } } }),
      prisma.task.count({ where: { studentId: { in: studentIds }, status: TaskStatus.PASSED } }),
      prisma.task.count({ where: { studentId: { in: studentIds }, status: TaskStatus.FAILED } }),
      prisma.task.count({ where: { studentId: { in: studentIds }, status: TaskStatus.IN_PROGRESS } }),
    ])

    // Submission statistics
    const [totalSubmissions, passedSubmissions, pendingSubmissions] = await Promise.all([
      prisma.submission.count({ where: { studentId: { in: studentIds } } }),
      prisma.submission.count({ where: { studentId: { in: studentIds }, status: SubmissionStatus.PASSED } }),
      prisma.submission.count({ where: { studentId: { in: studentIds }, status: SubmissionStatus.PENDING } }),
    ])

    // Calculate averages
    const avgPage = students.length > 0
      ? students.reduce((sum, s) => sum + s.currentPage, 0) / students.length
      : 0

    // Get top students
    const topStudents = await prisma.user.findMany({
      where: { groupId: id, role: UserRole.STUDENT, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        currentPage: true,
        currentLine: true,
        statistics: {
          select: { totalPagesCompleted: true, currentStreak: true }
        }
      },
      orderBy: [
        { currentPage: 'desc' },
        { currentLine: 'desc' }
      ],
      take: 5,
    })

    // Get struggling students (lowest progress)
    const strugglingStudents = await prisma.user.findMany({
      where: { groupId: id, role: UserRole.STUDENT, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        currentPage: true,
        currentLine: true,
      },
      orderBy: [
        { currentPage: 'asc' },
        { currentLine: 'asc' }
      ],
      take: 5,
    })

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        totalStudents: group._count.students,
      },
      progress: {
        averagePage: Math.round(avgPage * 10) / 10,
        totalStudents: students.length,
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
        pending: pendingSubmissions,
        passRate: totalSubmissions > 0 ? ((passedSubmissions / totalSubmissions) * 100).toFixed(1) : '0',
      },
      topStudents: topStudents.map((s, i) => ({
        rank: i + 1,
        id: s.id,
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Unknown',
        progress: `${s.currentPage}-${s.currentLine}`,
        pagesCompleted: s.statistics?.totalPagesCompleted || 0,
        streak: s.statistics?.currentStreak || 0,
      })),
      strugglingStudents: strugglingStudents.map(s => ({
        id: s.id,
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Unknown',
        progress: `${s.currentPage}-${s.currentLine}`,
      })),
    })
  } catch (error) {
    console.error('Get group stats error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
