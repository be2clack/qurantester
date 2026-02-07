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

    const allowedRoles: UserRole[] = [UserRole.STUDENT, UserRole.ADMIN]
    if (!allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const requests = await prisma.parentLinkRequest.findMany({
      where: {
        studentId: currentUser.id,
        status: 'PENDING'
      },
      include: {
        parent: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const items = requests.map(r => ({
      id: r.id,
      parentName: [r.parent.firstName, r.parent.lastName].filter(Boolean).join(' ') || 'Родитель',
      createdAt: r.createdAt.toISOString(),
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Get student link requests error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
