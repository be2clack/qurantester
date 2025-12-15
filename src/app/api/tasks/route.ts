import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, TaskStatus, StageNumber } from '@prisma/client'
import { z } from 'zod'
import { addDays } from 'date-fns'

const createTaskSchema = z.object({
  studentId: z.string(),
  pageNumber: z.number().min(1).max(602).optional(),
  startLine: z.number().min(1).max(15).optional(),
  endLine: z.number().min(1).max(15).optional(),
  stage: z.nativeEnum(StageNumber).optional(),
  deadlineDays: z.number().min(1).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')
    const status = searchParams.get('status') as TaskStatus | null
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}

    if (studentId) {
      where.studentId = studentId
    }

    if (status) {
      where.status = status
    }

    // Filter by role
    if (currentUser.role === UserRole.STUDENT) {
      where.studentId = currentUser.id
    } else if (currentUser.role === UserRole.USTAZ) {
      where.student = {
        studentGroups: { some: { group: { ustazId: currentUser.id } } }
      }
    } else if (currentUser.role === UserRole.PARENT) {
      where.student = {
        childOf: { some: { id: currentUser.id } }
      }
    } else if (currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            }
          },
          page: {
            select: {
              pageNumber: true,
              totalLines: true,
            }
          },
          _count: { select: { submissions: true } }
        }
      }),
      prisma.task.count({ where })
    ])

    return NextResponse.json({
      items: tasks,
      total,
      page,
      limit,
      hasMore: page * limit < total
    })
  } catch (error) {
    console.error('Get tasks error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admin and ustaz can create tasks
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.USTAZ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const validation = createTaskSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { studentId, pageNumber, startLine, endLine, stage, deadlineDays } = validation.data

    // Get student
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: {
        studentGroups: {
          where: { isActive: true },
          include: {
            group: {
              include: {
                lessons: {
                  where: { isActive: true },
                  take: 1
                }
              }
            }
          },
          take: 1
        }
      }
    })

    if (!student || student.role !== UserRole.STUDENT) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    const primaryStudentGroup = student.studentGroups[0]
    const primaryGroup = primaryStudentGroup?.group

    // Ustaz can only create tasks for their students
    if (currentUser.role === UserRole.USTAZ) {
      if (!primaryGroup || primaryGroup.ustazId !== currentUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Get lesson settings
    const lesson = primaryGroup?.lessons[0]
    if (!lesson) {
      return NextResponse.json(
        { error: 'No active lesson for student group' },
        { status: 400 }
      )
    }

    // Get page
    const actualPageNumber = pageNumber || student.currentPage
    const page = await prisma.quranPage.findUnique({
      where: { pageNumber: actualPageNumber }
    })

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    // Calculate lines based on stage
    const actualStage = stage || student.currentStage
    let actualStartLine = startLine || student.currentLine
    let actualEndLine = endLine

    if (!actualEndLine) {
      switch (actualStage) {
        case StageNumber.STAGE_1_1:
          actualEndLine = Math.min(actualStartLine, 7)
          break
        case StageNumber.STAGE_1_2:
          actualStartLine = 1
          actualEndLine = Math.min(7, page.totalLines)
          break
        case StageNumber.STAGE_2_1:
          actualStartLine = Math.max(actualStartLine, 8)
          actualEndLine = Math.min(actualStartLine, page.totalLines)
          break
        case StageNumber.STAGE_2_2:
          actualStartLine = 8
          actualEndLine = page.totalLines
          break
        case StageNumber.STAGE_3:
          actualStartLine = 1
          actualEndLine = page.totalLines
          break
      }
    }

    // Calculate deadline
    const stageDays: Record<StageNumber, number> = {
      STAGE_1_1: lesson.stage1Days,
      STAGE_1_2: lesson.stage2Days,
      STAGE_2_1: lesson.stage1Days,
      STAGE_2_2: lesson.stage2Days,
      STAGE_3: lesson.stage3Days,
    }
    const days = deadlineDays || stageDays[actualStage]
    const deadline = addDays(new Date(), days)

    // Create task
    const task = await prisma.task.create({
      data: {
        lessonId: lesson.id,
        studentId: student.id,
        pageId: page.id,
        startLine: actualStartLine,
        endLine: actualEndLine,
        stage: actualStage,
        requiredCount: lesson.repetitionCount,
        deadline,
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true }
        },
        page: {
          select: { pageNumber: true }
        }
      }
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Create task error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
