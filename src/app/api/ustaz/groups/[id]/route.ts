import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== UserRole.USTAZ && currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const group = await prisma.group.findFirst({
      where: {
        id,
        // For ustaz, only show their own groups
        ...(currentUser.role === UserRole.USTAZ && { ustazId: currentUser.id })
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
                phone: true,
                currentPage: true,
                currentLine: true,
                currentStage: true,
                isActive: true,
                _count: {
                  select: { tasks: true }
                },
                tasks: {
                  where: { status: 'IN_PROGRESS' },
                  take: 1,
                  select: {
                    id: true,
                    status: true,
                    passedCount: true,
                    requiredCount: true,
                    createdAt: true,
                  }
                }
              }
            }
          }
        },
        _count: {
          select: { students: true }
        }
      }
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Transform to expected format: extract students from students join table
    const studentList = group.students
      .map(sg => sg.student)
      .filter(s => s.isActive)
      .sort((a, b) => {
        if (b.currentPage !== a.currentPage) return b.currentPage - a.currentPage
        return b.currentLine - a.currentLine
      })

    return NextResponse.json({
      ...group,
      students: studentList,
      _count: group._count
    })
  } catch (error) {
    console.error('Get ustaz group error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
