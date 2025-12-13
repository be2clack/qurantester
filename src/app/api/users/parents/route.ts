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

    if (currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {
      role: UserRole.PARENT,
      isActive: true,
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]
    }

    const parents = await prisma.user.findMany({
      where,
      take: limit,
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        telegramUsername: true,
        _count: {
          select: { parentOf: true }
        }
      }
    })

    return NextResponse.json({
      items: parents,
    })
  } catch (error) {
    console.error('Get parents error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
