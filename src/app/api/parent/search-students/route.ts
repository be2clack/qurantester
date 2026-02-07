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

    const allowedRoles: UserRole[] = [UserRole.PARENT, UserRole.ADMIN]
    if (!allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')?.trim() || ''

    if (query.length < 3) {
      return NextResponse.json({ items: [] })
    }

    // Normalize phone: strip everything except digits, ensure starts with +
    let phone = query.replace(/[^\d+]/g, '')
    if (!phone.startsWith('+')) {
      phone = '+' + phone
    }

    // Get IDs of already-linked children
    const linkedChildren = await prisma.user.findMany({
      where: { childOf: { some: { id: currentUser.id } } },
      select: { id: true }
    })
    const linkedIds = linkedChildren.map(c => c.id)

    // Get IDs of students with pending requests from this parent
    const pendingRequests = await prisma.parentLinkRequest.findMany({
      where: { parentId: currentUser.id, status: 'PENDING' },
      select: { studentId: true }
    })
    const pendingIds = pendingRequests.map(r => r.studentId)

    const excludeIds = [...linkedIds, ...pendingIds]

    const students = await prisma.user.findMany({
      where: {
        role: UserRole.STUDENT,
        isActive: true,
        id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
        phone: { contains: phone },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        currentPage: true,
        studentGroups: {
          where: { isActive: true },
          select: {
            group: { select: { name: true } }
          },
          take: 3
        }
      },
      take: 10,
      orderBy: { firstName: 'asc' }
    })

    const items = students.map(s => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      phone: s.phone,
      currentPage: s.currentPage,
      groups: s.studentGroups.map(sg => ({ name: sg.group.name }))
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Search students error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
