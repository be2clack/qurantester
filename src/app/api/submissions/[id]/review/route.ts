import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, SubmissionStatus, TaskStatus, StageNumber } from '@prisma/client'
import { z } from 'zod'

const reviewSchema = z.object({
  status: z.enum(['PASSED', 'FAILED']),
  feedback: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ustaz and admin can review
    if (currentUser.role !== UserRole.USTAZ && currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const validation = reviewSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            studentGroups: {
              include: {
                group: true
              }
            },
            statistics: true,
          }
        },
        task: {
          include: {
            lesson: true,
            page: true,
          }
        }
      }
    })

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // Ustaz can only review their students' submissions
    if (currentUser.role === UserRole.USTAZ) {
      const studentGroup = submission.student.studentGroups[0]?.group
      if (studentGroup?.ustazId !== currentUser.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Check if already reviewed
    if (submission.status !== SubmissionStatus.PENDING) {
      return NextResponse.json(
        { error: 'Submission already reviewed' },
        { status: 400 }
      )
    }

    const { status, feedback } = validation.data

    // Update submission
    const updatedSubmission = await prisma.submission.update({
      where: { id },
      data: {
        status: status as SubmissionStatus,
        feedback,
        reviewerId: currentUser.id,
        reviewedAt: new Date(),
      }
    })

    // Update task counts
    const task = submission.task
    const newPassedCount = status === 'PASSED'
      ? task.passedCount + 1
      : task.passedCount

    const taskUpdate: any = {
      currentCount: task.currentCount + 1,
      passedCount: newPassedCount,
    }

    // Check if task is completed
    // New logic: must pass ALL required count
    const requiredCount = task.requiredCount
    const failedCount = task.failedCount + (status === 'FAILED' ? 1 : 0)

    // Check if task should be marked as passed
    if (newPassedCount >= requiredCount && failedCount === 0) {
      taskUpdate.status = TaskStatus.PASSED

      // Update student progress
      const student = submission.student
      const page = task.page

      let newPage = student.currentPage
      let newLine = student.currentLine
      let newStage = student.currentStage

      // Progress logic based on new stage system
      switch (task.stage) {
        case StageNumber.STAGE_1_1:
          // Learning lines 1-7 individually
          if (newLine < 7 && newLine < page.totalLines) {
            newLine++
          } else {
            // Finished learning 1-7, move to review stage 1.2
            newStage = StageNumber.STAGE_1_2
            newLine = 1
          }
          break
        case StageNumber.STAGE_1_2:
          // Reviewed lines 1-7 together, start learning 8-15
          if (page.totalLines > 7) {
            newStage = StageNumber.STAGE_2_1
            newLine = 8
          } else {
            // Pages with <=7 lines go straight to full page
            newStage = StageNumber.STAGE_3
            newLine = 1
          }
          break
        case StageNumber.STAGE_2_1:
          // Learning lines 8-15 individually
          if (newLine < page.totalLines) {
            newLine++
          } else {
            // Finished learning 8-15, move to review stage 2.2
            newStage = StageNumber.STAGE_2_2
            newLine = 8
          }
          break
        case StageNumber.STAGE_2_2:
          // Reviewed lines 8-15 together, move to full page
          newStage = StageNumber.STAGE_3
          newLine = 1
          break
        case StageNumber.STAGE_3:
          // Page completed! Move to next page
          if (newPage < 602) {
            newPage++
            newLine = 1
            newStage = StageNumber.STAGE_1_1
          }
          // If page 602, student completed Quran!
          break
      }

      // Update student
      await prisma.user.update({
        where: { id: student.id },
        data: {
          currentPage: newPage,
          currentLine: newLine,
          currentStage: newStage,
        }
      })

      // Update statistics
      if (student.statistics) {
        const statsUpdate: any = {
          totalSubmissions: { increment: 1 },
          passedSubmissions: status === 'PASSED' ? { increment: 1 } : undefined,
          currentStreak: status === 'PASSED'
            ? { increment: 1 }
            : 0,
        }

        // If completed a page in stage 3
        if (task.stage === StageNumber.STAGE_3 && newPage > student.currentPage) {
          statsUpdate.totalPagesCompleted = { increment: 1 }
        }

        await prisma.userStatistics.update({
          where: { userId: student.id },
          data: statsUpdate,
        })
      }
    }

    // Update task
    await prisma.task.update({
      where: { id: task.id },
      data: taskUpdate,
    })

    // Update reviewer statistics
    if (status === 'PASSED') {
      await prisma.userStatistics.upsert({
        where: { userId: currentUser.id },
        update: { totalReviews: { increment: 1 } },
        create: { userId: currentUser.id, totalReviews: 1 },
      })
    }

    return NextResponse.json({
      success: true,
      submission: updatedSubmission,
      taskCompleted: newPassedCount >= requiredCount && failedCount === 0,
    })
  } catch (error) {
    console.error('Review submission error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
