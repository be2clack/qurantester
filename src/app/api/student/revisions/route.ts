import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'

// GET: Get revision submissions for a student
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId')
  const limit = parseInt(searchParams.get('limit') || '20')
  const page = parseInt(searchParams.get('page') || '1')

  // Determine which student's revisions to get
  let targetStudentId = user.id

  if (studentId && studentId !== user.id) {
    // Only admin, ustaz, or parent can view other students' revisions
    if (user.role === UserRole.STUDENT) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify access
    if (user.role === UserRole.USTAZ) {
      // Check if student is in ustaz's group
      const studentGroup = await prisma.studentGroup.findFirst({
        where: {
          studentId,
          group: { ustazId: user.id }
        }
      })
      if (!studentGroup) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    targetStudentId = studentId
  }

  try {
    const [items, total] = await Promise.all([
      prisma.revisionSubmission.findMany({
        where: { studentId: targetStudentId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.revisionSubmission.count({
        where: { studentId: targetStudentId }
      })
    ])

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      hasMore: page * limit < total
    })
  } catch (error) {
    console.error('Error fetching revisions:', error)
    return NextResponse.json({ error: 'Failed to fetch revisions' }, { status: 500 })
  }
}
