import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, GroupLevel, LessonType } from '@prisma/client'
import { z } from 'zod'

const createGroupSchema = z.object({
  description: z.string().optional(),
  ustazId: z.string(),
  level: z.nativeEnum(GroupLevel).default(GroupLevel.LEVEL_1),
  lessonType: z.nativeEnum(LessonType).default(LessonType.MEMORIZATION), // For auto-naming
})

// Generate auto-name: 2-letter prefix + Year + Level + Number
// Format: ЗА-25-1-1 (Заучивание, 2025, Level 1, group #1)
async function generateGroupName(lessonType: LessonType, level: GroupLevel): Promise<string> {
  const typePrefixes: Record<LessonType, string> = {
    [LessonType.MEMORIZATION]: 'ЗА',  // Заучивание
    [LessonType.REVISION]: 'ПО',       // Повторение
    [LessonType.TRANSLATION]: 'ПЕ',    // Перевод
  }
  const levelNumber = level.replace('LEVEL_', '')
  const year = new Date().getFullYear().toString().slice(-2)
  const basePattern = `${typePrefixes[lessonType]}-${year}-${levelNumber}`

  // Count existing groups with same base pattern to get next number
  const existingGroups = await prisma.group.count({
    where: {
      name: {
        startsWith: basePattern
      }
    }
  })

  const groupNumber = existingGroups + 1
  return `${basePattern}-${groupNumber}`
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const activeOnly = searchParams.get('activeOnly') === 'true'

    let where: any = {}

    // Filter by active status if requested
    if (activeOnly) {
      where.isActive = true
    }

    // Filter by user role
    if (currentUser.role === UserRole.USTAZ) {
      where.ustazId = currentUser.id
    } else if (currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ustaz: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true
            }
          },
          _count: { select: { students: true, lessons: true } }
        }
      }),
      prisma.group.count({ where })
    ])

    return NextResponse.json({
      items: groups,
      total,
      page,
      limit,
      hasMore: page * limit < total
    })
  } catch (error) {
    console.error('Get groups error:', error)
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
    const validation = createGroupSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { description, ustazId, level, lessonType } = validation.data

    // Verify ustaz exists and has correct role
    const ustaz = await prisma.user.findUnique({ where: { id: ustazId } })
    if (!ustaz || ustaz.role !== UserRole.USTAZ) {
      return NextResponse.json(
        { error: 'Invalid ustaz' },
        { status: 400 }
      )
    }

    // Always auto-generate name with unique number
    const groupName = await generateGroupName(lessonType, level)

    const group = await prisma.group.create({
      data: {
        name: groupName,
        description,
        ustazId,
        level,
        lessonType,
        // Default settings for lessons
        repetitionCount: 80,
        stage1Days: 1,
        stage2Days: 2,
        stage3Days: 2,
        allowVoice: true,
        allowVideoNote: true,
        allowText: false,
        showText: false,
        showImage: false,
        showAudio: false,
      },
      include: {
        ustaz: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    })

    return NextResponse.json(group, { status: 201 })
  } catch (error) {
    console.error('Create group error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
