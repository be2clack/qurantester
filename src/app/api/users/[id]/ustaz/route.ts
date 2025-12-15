import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

const assignUstazSchema = z.object({
  ustazId: z.string().nullable(),
})

/**
 * POST /api/users/[id]/ustaz
 * Assign an ustaz to a student. This will:
 * 1. Set the student's ustazId
 * 2. Remove student from all existing groups
 * 3. Add student to all groups where the ustaz is assigned
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: studentId } = await params
    const body = await req.json()
    const validation = assignUstazSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { ustazId } = validation.data

    // Check if student exists and is a student
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, role: true, firstName: true, lastName: true }
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    if (student.role !== UserRole.STUDENT) {
      return NextResponse.json({ error: 'User is not a student' }, { status: 400 })
    }

    // If ustazId is null, remove from all groups and clear ustaz
    if (!ustazId) {
      await prisma.$transaction([
        prisma.studentGroup.deleteMany({ where: { studentId } }),
        prisma.user.update({ where: { id: studentId }, data: { ustazId: null } })
      ])

      return NextResponse.json({ success: true, message: 'Ustaz removed from student' })
    }

    // Check if ustaz exists
    const ustaz = await prisma.user.findUnique({
      where: { id: ustazId },
      select: { id: true, role: true, firstName: true, lastName: true }
    })

    if (!ustaz) {
      return NextResponse.json({ error: 'Ustaz not found' }, { status: 404 })
    }

    if (ustaz.role !== UserRole.USTAZ) {
      return NextResponse.json({ error: 'User is not an ustaz' }, { status: 400 })
    }

    // Get all groups for this ustaz
    const ustazGroups = await prisma.group.findMany({
      where: { ustazId, isActive: true },
      select: { id: true, name: true }
    })

    // Transaction: update ustazId, remove from old groups, add to new groups
    await prisma.$transaction([
      // Update student's ustazId
      prisma.user.update({
        where: { id: studentId },
        data: { ustazId }
      }),
      // Remove from all existing groups
      prisma.studentGroup.deleteMany({ where: { studentId } }),
      // Add to all ustaz's groups
      ...ustazGroups.map(group =>
        prisma.studentGroup.create({
          data: {
            studentId,
            groupId: group.id,
          }
        })
      )
    ])

    return NextResponse.json({
      success: true,
      message: `Student assigned to ustaz ${ustaz.firstName || ''} ${ustaz.lastName || ''}`,
      groupsJoined: ustazGroups.length,
      groups: ustazGroups.map(g => g.name)
    })
  } catch (error) {
    console.error('Assign ustaz error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
