import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, LessonType } from '@prisma/client'
import { z } from 'zod'

const createLessonSchema = z.object({
  groupId: z.string(),
  name: z.string().min(1).default('Урок заучивания'),
  type: z.nativeEnum(LessonType).default(LessonType.MEMORIZATION),
  repetitionCount: z.number().min(1).default(80),
  stage1Hours: z.number().min(1).default(24),
  stage2Hours: z.number().min(1).default(48),
  stage3Hours: z.number().min(1).default(48),
  allowVoice: z.boolean().default(true),
  allowVideoNote: z.boolean().default(true),
  allowText: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const groupId = searchParams.get('groupId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}

    if (groupId) {
      where.groupId = groupId
    }

    // Filter by role
    if (currentUser.role === UserRole.USTAZ) {
      where.group = { ustazId: currentUser.id }
    } else if (currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [lessons, total] = await Promise.all([
      prisma.lesson.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          group: {
            select: {
              id: true,
              name: true,
              ustaz: {
                select: { firstName: true, lastName: true }
              }
            }
          },
          _count: { select: { tasks: true } }
        }
      }),
      prisma.lesson.count({ where })
    ])

    return NextResponse.json({
      items: lessons,
      total,
      page,
      limit,
      hasMore: page * limit < total
    })
  } catch (error) {
    console.error('Get lessons error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const validation = createLessonSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { groupId, ...lessonData } = validation.data

    // Check group exists
    const group = await prisma.group.findUnique({ where: { id: groupId } })
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Deactivate previous lesson for this group
    await prisma.lesson.updateMany({
      where: { groupId, isActive: true },
      data: { isActive: false }
    })

    // Create new lesson
    const lesson = await prisma.lesson.create({
      data: {
        groupId,
        ...lessonData,
        isActive: true,
      },
      include: {
        group: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json(lesson, { status: 201 })
  } catch (error) {
    console.error('Create lesson error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
