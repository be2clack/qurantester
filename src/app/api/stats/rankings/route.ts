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

    const { searchParams } = new URL(req.url)
    const groupId = searchParams.get('groupId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {
      role: UserRole.STUDENT,
      isActive: true,
    }

    // Filter by group if specified
    if (groupId) {
      where.groupId = groupId

      // Ustaz can only see their group's rankings
      if (currentUser.role === UserRole.USTAZ) {
        const group = await prisma.group.findUnique({
          where: { id: groupId },
          select: { ustazId: true }
        })
        if (group?.ustazId !== currentUser.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    }

    // Get students with their statistics
    const students = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        currentPage: true,
        currentLine: true,
        currentStage: true,
        studentGroup: {
          select: { id: true, name: true }
        },
        statistics: {
          select: {
            totalPagesCompleted: true,
            totalSubmissions: true,
            passedSubmissions: true,
            currentStreak: true,
            longestStreak: true,
            globalRank: true,
            groupRank: true,
          }
        }
      },
      orderBy: [
        { currentPage: 'desc' },
        { currentLine: 'desc' }
      ],
      take: limit,
    })

    // Calculate ranks
    const rankings = students.map((student, index) => {
      const passRate = student.statistics?.totalSubmissions
        ? ((student.statistics.passedSubmissions / student.statistics.totalSubmissions) * 100).toFixed(1)
        : '0'

      return {
        rank: index + 1,
        id: student.id,
        name: `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown',
        progress: `${student.currentPage}-${student.currentLine}`,
        currentPage: student.currentPage,
        currentLine: student.currentLine,
        stage: student.currentStage,
        group: student.studentGroup?.name || null,
        pagesCompleted: student.statistics?.totalPagesCompleted || 0,
        totalSubmissions: student.statistics?.totalSubmissions || 0,
        passRate: parseFloat(passRate),
        currentStreak: student.statistics?.currentStreak || 0,
        longestStreak: student.statistics?.longestStreak || 0,
      }
    })

    return NextResponse.json({
      rankings,
      total: rankings.length,
    })
  } catch (error) {
    console.error('Get rankings error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
