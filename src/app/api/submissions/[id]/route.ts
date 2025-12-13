import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'

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

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            telegramId: true,
            studentGroup: {
              select: { id: true, name: true, ustazId: true }
            }
          }
        },
        task: {
          select: {
            id: true,
            stage: true,
            startLine: true,
            endLine: true,
            status: true,
            requiredCount: true,
            currentCount: true,
            passedCount: true,
            page: {
              select: { pageNumber: true, totalLines: true }
            },
            lesson: {
              select: { repetitionCount: true }
            }
          }
        }
      }
    })

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // Access control
    if (currentUser.role === UserRole.STUDENT && submission.studentId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (currentUser.role === UserRole.USTAZ) {
      if (submission.student.studentGroup?.ustazId !== currentUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (currentUser.role === UserRole.PARENT) {
      const student = await prisma.user.findUnique({
        where: { id: submission.studentId },
        select: { childOf: { select: { id: true } } }
      })
      const isParent = student?.childOf.some(parent => parent.id === currentUser.id)
      if (!isParent) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({
      ...submission,
      student: {
        ...submission.student,
        telegramId: submission.student.telegramId?.toString() || null,
      }
    })
  } catch (error) {
    console.error('Get submission error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
