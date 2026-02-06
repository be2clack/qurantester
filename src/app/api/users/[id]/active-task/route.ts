import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TaskStatus } from '@prisma/client'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const groupId = req.nextUrl.searchParams.get('groupId')

    // Find active task for this student
    const task = await prisma.task.findFirst({
      where: {
        studentId: id,
        status: TaskStatus.IN_PROGRESS,
        ...(groupId ? { groupId } : {}),
      },
      include: {
        page: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!task) {
      return NextResponse.json({ task: null })
    }

    return NextResponse.json({
      task: {
        id: task.id,
        stage: task.stage,
        passedCount: task.passedCount,
        requiredCount: task.requiredCount,
        pageNumber: task.page?.pageNumber || 0,
        startLine: task.startLine,
        endLine: task.endLine,
      },
    })
  } catch (error) {
    console.error('Error fetching active task:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
