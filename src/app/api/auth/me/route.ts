import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get full user data with relations
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        studentGroups: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                ustaz: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        },
        statistics: true,
        _count: {
          select: {
            tasks: true,
            submissions: true,
            parentOf: true
          }
        }
      }
    })

    if (!fullUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Transform BigInt to string for JSON serialization
    const response = {
      ...fullUser,
      telegramId: fullUser.telegramId?.toString() || null,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Get current user error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
