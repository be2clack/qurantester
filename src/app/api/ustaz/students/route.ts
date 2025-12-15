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
      select: { id: true }
    })

    const groupIds = groups.map(g => g.id)

    // Get all students from these groups
    const students = await prisma.user.findMany({
      where: {
        role: UserRole.STUDENT,
        studentGroups: { some: { groupId: { in: groupIds }, isActive: true } },
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        telegramUsername: true,
        currentPage: true,
        currentLine: true,
        currentStage: true,
        isActive: true,
        studentGroups: {
          select: {
            group: {
              select: {
                id: true,
                name: true
              }
            }
          },
          take: 1
        },
        tasks: {
          where: { status: 'IN_PROGRESS' },
          take: 1,
          select: {
            id: true,
            status: true,
            passedCount: true,
            requiredCount: true,
            failedCount: true
          }
        },
        _count: {
          select: { submissions: true }
        }
      },
      orderBy: [
        { currentPage: 'desc' },
        { currentLine: 'desc' }
      ]
    })

    // Transform to match expected format
    const result = students.map(s => ({
      ...s,
      studentGroup: s.studentGroups[0]?.group || null,
      group: s.studentGroups[0]?.group || null
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get ustaz students error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
