import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TaskStatus, StageNumber } from '@prisma/client'
import { addHours } from 'date-fns'

// Verify cron secret
const CRON_SECRET = process.env.CRON_SECRET || 'hlDGk9eyARRBgZb4UVqPb7x4mjH/nes66Nl0wM053Cc='

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')

    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results = {
      createdTasks: 0,
      expiredTasks: 0,
      updatedStats: 0,
    }

    // 1. Mark expired tasks as FAILED
    const expiredTasks = await prisma.task.updateMany({
      where: {
        status: TaskStatus.IN_PROGRESS,
        deadline: { lt: new Date() }
      },
      data: {
        status: TaskStatus.FAILED
      }
    })
    results.expiredTasks = expiredTasks.count

    // 2. Create new daily tasks for students without active tasks
    const activeStudents = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        isActive: true,
        studentGroups: { some: {} }
      },
      include: {
        studentGroups: {
          include: {
            group: {
              include: {
                lessons: {
                  where: { isActive: true },
                  take: 1
                }
              }
            }
          }
        }
      }
    })

    for (const student of activeStudents) {
      // Check if student has active task
      const activeTask = await prisma.task.findFirst({
        where: {
          studentId: student.id,
          status: TaskStatus.IN_PROGRESS
        }
      })

      if (activeTask) continue // Already has active task

      // Get lesson for student's group
      const lesson = student.studentGroups[0]?.group?.lessons[0]
      if (!lesson) continue

      // Get current page
      const page = await prisma.quranPage.findUnique({
        where: { pageNumber: student.currentPage }
      })
      if (!page) continue

      // Calculate lines based on stage
      let startLine = student.currentLine
      let endLine: number

      switch (student.currentStage) {
        case StageNumber.STAGE_1_1:
          // Learning lines 1-7 individually
          endLine = Math.min(startLine, 7)
          break
        case StageNumber.STAGE_1_2:
          // Reviewing lines 1-7 together
          startLine = 1
          endLine = Math.min(7, page.totalLines)
          break
        case StageNumber.STAGE_2_1:
          // Learning lines 8-15 individually
          startLine = Math.max(startLine, 8)
          endLine = Math.min(startLine, page.totalLines)
          break
        case StageNumber.STAGE_2_2:
          // Reviewing lines 8-15 together
          startLine = 8
          endLine = page.totalLines
          break
        case StageNumber.STAGE_3:
          // Full page
          startLine = 1
          endLine = page.totalLines
          break
        default:
          endLine = startLine
      }

      // Calculate deadline based on stage (in hours)
      const stageHours: Record<StageNumber, number> = {
        STAGE_1_1: lesson.stage1Hours,
        STAGE_1_2: lesson.stage2Hours,
        STAGE_2_1: lesson.stage1Hours,
        STAGE_2_2: lesson.stage2Hours,
        STAGE_3: lesson.stage3Hours,
      }

      const deadline = addHours(new Date(), stageHours[student.currentStage])

      // Create task
      await prisma.task.create({
        data: {
          lessonId: lesson.id,
          studentId: student.id,
          pageId: page.id,
          startLine,
          endLine,
          stage: student.currentStage,
          requiredCount: lesson.repetitionCount,
          deadline,
        }
      })

      results.createdTasks++
    }

    // 3. Update rankings
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT', isActive: true },
      include: { statistics: true },
      orderBy: [
        { currentPage: 'desc' },
        { currentLine: 'desc' }
      ]
    })

    // Update global ranks
    for (let i = 0; i < students.length; i++) {
      const student = students[i]
      if (student.statistics) {
        await prisma.userStatistics.update({
          where: { userId: student.id },
          data: { globalRank: i + 1 }
        })
        results.updatedStats++
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// Allow GET for manual trigger in development
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }

  // Fake the auth header for dev testing
  const request = new Request(req.url, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${CRON_SECRET}`
    }
  })

  return POST(request as NextRequest)
}
