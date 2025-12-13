import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, LessonType } from '@prisma/client'
import { z } from 'zod'

const updateLessonSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.nativeEnum(LessonType).optional(),
  repetitionCount: z.number().min(1).optional(),
  stage1Days: z.number().min(1).optional(),
  stage2Days: z.number().min(1).optional(),
  stage3Days: z.number().min(1).optional(),
  isActive: z.boolean().optional(),
  allowVoice: z.boolean().optional(),
  allowVideoNote: z.boolean().optional(),
  allowText: z.boolean().optional(),
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

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            ustazId: true,
            ustaz: {
              select: { firstName: true, lastName: true }
            }
          }
        },
        _count: { select: { tasks: true } }
      }
    })

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    // Access control
    if (currentUser.role === UserRole.USTAZ && lesson.group.ustazId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.USTAZ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(lesson)
  } catch (error) {
    console.error('Get lesson error:', error)
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
    const validation = updateLessonSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const existing = await prisma.lesson.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    const lesson = await prisma.lesson.update({
      where: { id },
      data: validation.data,
      include: {
        group: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json(lesson)
  } catch (error) {
    console.error('Update lesson error:', error)
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

    const existing = await prisma.lesson.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    }

    // Soft delete
    await prisma.lesson.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete lesson error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
