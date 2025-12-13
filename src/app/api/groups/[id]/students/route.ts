import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

const addStudentSchema = z.object({
  studentId: z.string(),
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

    const students = await prisma.user.findMany({
      where: {
        groupId: id,
        role: UserRole.STUDENT,
        isActive: true,
      },
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
      },
      orderBy: [
        { currentPage: 'desc' },
        { currentLine: 'desc' }
      ]
    })

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

    // Add student to group
    const updated = await prisma.user.update({
      where: { id: student.id },
      data: { groupId: id },
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
    await prisma.user.update({
      where: { id: studentId },
      data: { groupId: null }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove student from group error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
