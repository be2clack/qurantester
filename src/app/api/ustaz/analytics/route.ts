import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== UserRole.USTAZ && currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all groups for this ustaz
    const groups = await prisma.group.findMany({
      where: {
        ustazId: currentUser.id,
        isActive: true
      },
      include: {
        students: {
          where: { isActive: true },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            currentPage: true,
          }
        },
        _count: {
          select: { students: true }
        }
      }
    })

    const groupIds = groups.map(g => g.id)

    // Get all students from these groups
    const students = await prisma.user.findMany({
      where: {
        role: UserRole.STUDENT,
        groupId: { in: groupIds },
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        currentPage: true,
        studentGroup: {
          select: { name: true }
        }
      },
      orderBy: { currentPage: 'desc' },
      take: 10
    })

    // Get submissions stats
    const [pendingCount, passedCount, failedCount] = await Promise.all([
      prisma.submission.count({
        where: {
          status: 'PENDING',
          task: {
            groupId: { in: groupIds }
          }
        }
      }),
      prisma.submission.count({
        where: {
          status: 'PASSED',
          task: {
            groupId: { in: groupIds }
          }
        }
      }),
      prisma.submission.count({
        where: {
          status: 'FAILED',
          task: {
            groupId: { in: groupIds }
          }
        }
      })
    ])

    // Calculate totals
    const totalStudents = groups.reduce((sum, g) => sum + g._count.students, 0)
    const allPages = groups.flatMap(g => g.students.map(s => s.currentPage))
    const avgPage = allPages.length > 0
      ? Math.round(allPages.reduce((a, b) => a + b, 0) / allPages.length)
      : 0

    // Group stats
    const groupStats = groups.map(g => ({
      id: g.id,
      name: g.name,
      studentCount: g._count.students,
      avgPage: g.students.length > 0
        ? Math.round(g.students.reduce((sum, s) => sum + s.currentPage, 0) / g.students.length)
        : 0
    })).sort((a, b) => b.avgPage - a.avgPage)

    // Top students with group info
    const topStudents = students.map(s => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      currentPage: s.currentPage,
      group: s.studentGroup
    }))

    return NextResponse.json({
      totalStudents,
      totalGroups: groups.length,
      totalSubmissions: pendingCount + passedCount + failedCount,
      pendingSubmissions: pendingCount,
      passedSubmissions: passedCount,
      failedSubmissions: failedCount,
      avgStudentPage: avgPage,
      topStudents,
      groupStats
    })
  } catch (error) {
    console.error('Get ustaz analytics error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
