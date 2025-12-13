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
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            currentPage: true,
            currentLine: true,
            currentStage: true,
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
          },
          orderBy: [
            { currentPage: 'desc' },
            { currentLine: 'desc' }
          ]
        },
        _count: {
          select: { students: true }
        }
      }
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    return NextResponse.json(group)
  } catch (error) {
    console.error('Get ustaz group error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
