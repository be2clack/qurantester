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

    const groups = await prisma.group.findMany({
      where: {
        ustazId: currentUser.id,
        isActive: true,
      },
      include: {
        students: {
          where: { isActive: true },
          select: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                currentPage: true,
                currentLine: true,
                currentStage: true,
                isActive: true,
                tasks: {
                  where: { status: 'IN_PROGRESS' },
                  take: 1,
                  select: {
                    passedCount: true,
                    requiredCount: true,
                  }
                }
              }
            }
          }
        },
        _count: {
          select: { students: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Transform: extract students and sort
    const transformed = groups.map(group => {
      const studentList = group.students
        .map(sg => sg.student)
        .filter(s => s.isActive)
        .sort((a, b) => {
          if (b.currentPage !== a.currentPage) return b.currentPage - a.currentPage
          return b.currentLine - a.currentLine
        })
        .slice(0, 5)

      return {
        ...group,
        students: studentList,
        _count: group._count
      }
    })

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Get ustaz groups error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
