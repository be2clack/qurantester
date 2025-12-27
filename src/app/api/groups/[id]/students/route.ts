import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

const addStudentSchema = z.object({
  studentId: z.string(),
  currentPage: z.number().min(1).max(604).optional(),
  currentLine: z.number().min(1).max(15).optional(),
  currentStage: z.enum(['STAGE_1_1', 'STAGE_1_2', 'STAGE_2_1', 'STAGE_2_2', 'STAGE_3']).optional(),
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

    // Check group access
    const group = await prisma.group.findUnique({
      where: { id },
      select: { ustazId: true }
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    if (currentUser.role === UserRole.USTAZ && group.ustazId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.USTAZ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const studentGroups = await prisma.studentGroup.findMany({
      where: {
        groupId: id,
        student: {
          role: UserRole.STUDENT,
          isActive: true,
        }
      },
      select: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            currentPage: true,
            currentLine: true,
            currentStage: true,
            statistics: {
              select: {
                totalPagesCompleted: true,
                currentStreak: true,
                globalRank: true,
              }
            },
            _count: {
              select: { tasks: true, submissions: true }
            }
          }
        }
      },
      orderBy: [
        { student: { currentPage: 'desc' } },
        { student: { currentLine: 'desc' } }
      ]
    })

    const students = studentGroups.map(sg => sg.student)

    return NextResponse.json(students)
  } catch (error) {
    console.error('Get group students error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(
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
    const validation = addStudentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    // Check group exists
    const group = await prisma.group.findUnique({ where: { id } })
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Check student exists and is a student
    const student = await prisma.user.findUnique({
      where: { id: validation.data.studentId }
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    if (student.role !== UserRole.STUDENT) {
      return NextResponse.json(
        { error: 'User is not a student' },
        { status: 400 }
      )
    }

    // Student can only be in ONE group - remove from all other groups first
    await prisma.studentGroup.deleteMany({
      where: {
        studentId: validation.data.studentId,
        groupId: { not: id } // Remove from all groups except target
      }
    })

    // Also cancel any active tasks from other groups
    await prisma.task.updateMany({
      where: {
        studentId: validation.data.studentId,
        groupId: { not: id },
        status: 'IN_PROGRESS'
      },
      data: {
        status: 'CANCELLED'
      }
    })

    // Check if already in this group
    const existingMembership = await prisma.studentGroup.findUnique({
      where: {
        studentId_groupId: {
          studentId: validation.data.studentId,
          groupId: id
        }
      }
    })

    if (existingMembership) {
      // Update existing membership with new progress if provided
      if (validation.data.currentPage || validation.data.currentLine || validation.data.currentStage) {
        await prisma.studentGroup.update({
          where: {
            studentId_groupId: {
              studentId: validation.data.studentId,
              groupId: id
            }
          },
          data: {
            ...(validation.data.currentPage && { currentPage: validation.data.currentPage }),
            ...(validation.data.currentLine && { currentLine: validation.data.currentLine }),
            ...(validation.data.currentStage && { currentStage: validation.data.currentStage }),
          }
        })
      }
    } else {
      // Add student to group with optional progress
      await prisma.studentGroup.create({
        data: {
          studentId: validation.data.studentId,
          groupId: id,
          currentPage: validation.data.currentPage || student.currentPage,
          currentLine: validation.data.currentLine || student.currentLine,
          currentStage: validation.data.currentStage || student.currentStage,
        }
      })
    }

    const updated = await prisma.user.findUnique({
      where: { id: student.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        currentPage: true,
        currentLine: true,
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Add student to group error:', error)
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
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('studentId')

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId is required' },
        { status: 400 }
      )
    }

    // Remove student from group
    await prisma.studentGroup.delete({
      where: {
        studentId_groupId: {
          studentId,
          groupId: id
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove student from group error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
