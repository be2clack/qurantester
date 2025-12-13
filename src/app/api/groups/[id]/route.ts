import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, GroupLevel } from '@prisma/client'
import { z } from 'zod'

const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  ustazId: z.string().optional(),
  level: z.nativeEnum(GroupLevel).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        ustaz: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        },
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
          },
          orderBy: [
            { currentPage: 'desc' },
            { currentLine: 'desc' }
          ]
        },
        lessons: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        _count: {
          select: { students: true, lessons: true }
        }
      }
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Access control
    if (currentUser.role === UserRole.USTAZ && group.ustazId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (currentUser.role === UserRole.STUDENT && currentUser.groupId !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(group)
  } catch (error) {
    console.error('Get group error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const validation = updateGroupSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const existing = await prisma.group.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Verify new ustaz if provided
    if (validation.data.ustazId) {
      const ustaz = await prisma.user.findUnique({
        where: { id: validation.data.ustazId }
      })
      if (!ustaz || ustaz.role !== UserRole.USTAZ) {
        return NextResponse.json({ error: 'Invalid ustaz' }, { status: 400 })
      }
    }

    const group = await prisma.group.update({
      where: { id },
      data: validation.data,
      include: {
        ustaz: {
          select: { id: true, firstName: true, lastName: true }
        },
        _count: { select: { students: true } }
      }
    })

    return NextResponse.json(group)
  } catch (error) {
    console.error('Update group error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const existing = await prisma.group.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Soft delete
    await prisma.group.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete group error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
