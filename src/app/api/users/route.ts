import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, StageNumber } from '@prisma/client'
import { z } from 'zod'

const createUserSchema = z.object({
  phone: z.string().min(10).startsWith('+'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.nativeEnum(UserRole),
  groupId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin can list all users
    if (currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const role = searchParams.get('role') as UserRole | null
    const search = searchParams.get('search')
    const noGroup = searchParams.get('noGroup') === 'true'
    const ustazId = searchParams.get('ustazId')

    const where: any = {}
    if (role) where.role = role
    if (noGroup) where.studentGroups = { none: {} }
    if (ustazId === 'none') {
      where.ustazId = null
    } else if (ustazId) {
      where.ustazId = ustazId
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          studentGroups: {
            select: {
              group: { select: { id: true, name: true, lessonType: true } },
              currentPage: true,
              currentLine: true,
              currentStage: true,
            },
          },
          ustaz: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              _count: { select: { ustazGroups: true } }
            }
          },
          childOf: { select: { id: true, firstName: true, lastName: true, phone: true } },
          parentOf: { select: { id: true, firstName: true, lastName: true, phone: true } },
          tasks: {
            where: { status: 'IN_PROGRESS' },
            select: {
              passedCount: true,
              requiredCount: true,
            },
            take: 1,
            orderBy: { createdAt: 'desc' }
          },
          _count: { select: { tasks: true, submissions: true, ustazGroups: true } }
        }
      }),
      prisma.user.count({ where })
    ])

    // Convert BigInt to string and calculate task completion
    const serializedUsers = users.map(user => {
      const activeTask = user.tasks[0]
      const completionPercent = activeTask
        ? Math.round((activeTask.passedCount / activeTask.requiredCount) * 100)
        : 0

      return {
        ...user,
        telegramId: user.telegramId?.toString() || null,
        taskCompletion: completionPercent,
        taskPassedCount: activeTask?.passedCount || 0,
        taskRequiredCount: activeTask?.requiredCount || 0,
        tasks: undefined, // Remove raw tasks data
        studentGroup: user.studentGroups[0]?.group || null, // For backward compatibility
      }
    })

    return NextResponse.json({
      items: serializedUsers,
      total,
      page,
      limit,
      hasMore: page * limit < total
    })
  } catch (error) {
    console.error('Get users error:', error)
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
    const validation = createUserSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { phone, firstName, lastName, role, groupId } = validation.data

    // Check if phone exists
    const existing = await prisma.user.findUnique({ where: { phone } })
    if (existing) {
      return NextResponse.json(
        { error: 'Phone already registered' },
        { status: 409 }
      )
    }

    // Validate groupId if provided for student
    const validGroupId = role === UserRole.STUDENT && groupId && groupId.trim() !== '' ? groupId : undefined
    if (validGroupId) {
      const groupExists = await prisma.group.findUnique({ where: { id: validGroupId } })
      if (!groupExists) {
        return NextResponse.json(
          { error: 'Group not found' },
          { status: 400 }
        )
      }
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        phone,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        role,
        currentPage: 1,
        currentLine: 1,
        currentStage: StageNumber.STAGE_1_1,
      }
    })

    // Create StudentGroup if groupId provided
    if (validGroupId) {
      await prisma.studentGroup.create({
        data: {
          studentId: user.id,
          groupId: validGroupId,
        }
      })
    }

    // Create statistics for students
    if (role === UserRole.STUDENT) {
      await prisma.userStatistics.create({
        data: { userId: user.id }
      })
    }

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
