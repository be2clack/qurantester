import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, TaskStatus } from '@prisma/client'
import { z } from 'zod'

const updateTaskSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  deadline: z.string().datetime().optional(),
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

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            studentGroup: {
              select: { id: true, name: true, ustazId: true }
            }
          }
        },
        page: {
          select: {
            pageNumber: true,
            totalLines: true,
          }
        },
        lesson: {
          select: {
            repetitionCount: true,
          }
        },
        submissions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            createdAt: true,
            reviewedAt: true,
          }
        },
        _count: { select: { submissions: true } }
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Access control
    if (currentUser.role === UserRole.STUDENT && task.studentId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (currentUser.role === UserRole.USTAZ) {
      if (task.student.studentGroup?.ustazId !== currentUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (currentUser.role === UserRole.PARENT) {
      const student = await prisma.user.findUnique({
        where: { id: task.studentId },
        select: { childOf: { select: { id: true } } }
      })
      const isParent = student?.childOf.some(parent => parent.id === currentUser.id)
      if (!isParent) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Get task error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.USTAZ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const validation = updateTaskSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            studentGroup: true
          }
        }
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Ustaz can only update their students' tasks
    if (currentUser.role === UserRole.USTAZ) {
      if (task.student.studentGroup?.ustazId !== currentUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const data: any = {}
    if (validation.data.status) {
      data.status = validation.data.status
    }
    if (validation.data.deadline) {
      data.deadline = new Date(validation.data.deadline)
    }

    const updated = await prisma.task.update({
      where: { id },
      data,
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true }
        },
        page: {
          select: { pageNumber: true }
        }
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update task error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
