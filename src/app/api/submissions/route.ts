import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, SubmissionStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('taskId')
    const studentId = searchParams.get('studentId')
    const status = searchParams.get('status') as SubmissionStatus | null
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}

    if (taskId) {
      where.taskId = taskId
    }

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
      // Get ustaz's groups first
      const ustazGroups = await prisma.group.findMany({
        where: { ustazId: currentUser.id },
        select: { id: true }
      })
      const groupIds = ustazGroups.map(g => g.id)

      // Only show submissions that were sent to ustaz for review
      where.sentToUstazAt = { not: null }

      // Filter submissions by: student in ustaz's groups OR task in ustaz's groups
      where.OR = [
        { student: { studentGroups: { some: { groupId: { in: groupIds } } } } },
        { task: { groupId: { in: groupIds } } },
        { task: { lesson: { groupId: { in: groupIds } } } }
      ]
    } else if (currentUser.role === UserRole.PARENT) {
      where.student = {
        childOf: { some: { id: currentUser.id } }
      }
    } else if (currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
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
              studentGroups: {
                select: {
                  group: {
                    select: {
                      id: true,
                      name: true,
                    }
                  }
                },
                take: 1
              }
            }
          },
          task: {
            select: {
              id: true,
              stage: true,
              startLine: true,
              endLine: true,
              passedCount: true,
              requiredCount: true,
              page: {
                select: { pageNumber: true }
              }
            }
          }
        }
      }),
      prisma.submission.count({ where })
    ])

    // Map to frontend format with additional fields
    // Convert BigInt to Number for JSON serialization
    const mappedSubmissions = submissions.map(s => ({
      ...s,
      // Convert BigInt fields to Number
      telegramMsgId: s.telegramMsgId ? Number(s.telegramMsgId) : null,
      studentMsgId: s.studentMsgId ? Number(s.studentMsgId) : null,
      telegramFileId: s.fileId, // Alias for compatibility
      // Map studentGroup from nested array
      student: {
        ...s.student,
        studentGroup: s.student.studentGroups?.[0]?.group || null
      }
    }))

    return NextResponse.json({
      items: mappedSubmissions,
      total,
      page,
      limit,
      hasMore: page * limit < total
    })
  } catch (error) {
    console.error('Get submissions error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
