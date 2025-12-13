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
            id: true,
            firstName: true,
            lastName: true,
            currentPage: true,
            currentStage: true,
            tasks: {
              where: { status: 'IN_PROGRESS' },
              take: 1,
              select: {
                passedCount: true,
                requiredCount: true,
              }
            }
          },
          orderBy: [
            { currentPage: 'desc' },
            { currentLine: 'desc' }
          ],
          take: 5
        },
        _count: {
          select: { students: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(groups)
  } catch (error) {
    console.error('Get ustaz groups error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
