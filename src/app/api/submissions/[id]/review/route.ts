import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, SubmissionStatus, TaskStatus, StageNumber, LineProgressStatus } from '@prisma/client'
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
              where: { isActive: true },
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
            group: true,
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

    const newFailedCount = status === 'FAILED'
      ? task.failedCount + 1
      : task.failedCount

    const taskUpdate: any = {
      passedCount: newPassedCount,
      failedCount: newFailedCount,
    }

    // Check if task is completed (all required submissions passed)
    const requiredCount = task.requiredCount
    const taskCompleted = newPassedCount >= requiredCount

    if (taskCompleted) {
      taskUpdate.status = TaskStatus.PASSED
      taskUpdate.completedAt = new Date()

      // Get the group for this task
      const group = task.group
      const groupId = task.groupId

      // Update lineProgress for learning stages
      const isLearningStage = task.stage === StageNumber.STAGE_1_1 || task.stage === StageNumber.STAGE_2_1
      if (isLearningStage && groupId && task.page?.pageNumber) {
        await prisma.lineProgress.updateMany({
          where: {
            studentId: submission.studentId,
            groupId: groupId,
            pageNumber: task.page.pageNumber,
            lineNumber: task.startLine,
            stage: task.stage,
          },
          data: {
            status: LineProgressStatus.COMPLETED,
            passedCount: newPassedCount,
            completedAt: new Date()
          }
        })
      }

      // Update user statistics
      await prisma.userStatistics.upsert({
        where: { userId: submission.studentId },
        create: {
          userId: submission.studentId,
          totalTasksCompleted: 1,
          thisWeekProgress: 1,
          thisMonthProgress: 1,
        },
        update: {
          totalTasksCompleted: { increment: 1 },
          thisWeekProgress: { increment: 1 },
          thisMonthProgress: { increment: 1 },
        }
      })

      // Advance student progress in StudentGroup (primary) and User (legacy)
      if (groupId) {
        const studentGroup = await prisma.studentGroup.findFirst({
          where: {
            studentId: submission.studentId,
            groupId: groupId,
            isActive: true
          }
        })

        if (studentGroup) {
          const page = task.page
          const totalLines = page?.totalLines || 15
          const currentStage = studentGroup.currentStage as StageNumber

          // Only advance if task matches current position
          const taskMatchesPosition =
            task.stage === currentStage &&
            (!isLearningStage || task.startLine === studentGroup.currentLine)

          if (taskMatchesPosition) {
            let newPage = studentGroup.currentPage
            let newLine = studentGroup.currentLine
            let newStage = currentStage
            const firstHalfEnd = Math.min(7, totalLines)
            const isSimplePage = totalLines <= 7

            switch (task.stage) {
              case StageNumber.STAGE_1_1:
                if (newLine < firstHalfEnd) {
                  newLine++
                } else {
                  if (isSimplePage) {
                    newStage = StageNumber.STAGE_3
                    newLine = 1
                  } else {
                    newStage = StageNumber.STAGE_1_2
                    newLine = 1
                  }
                }
                break
              case StageNumber.STAGE_1_2:
                if (totalLines > 7) {
                  newStage = StageNumber.STAGE_2_1
                  newLine = 8
                } else {
                  newStage = StageNumber.STAGE_3
                  newLine = 1
                }
                break
              case StageNumber.STAGE_2_1:
                if (newLine < totalLines) {
                  newLine++
                } else {
                  newStage = StageNumber.STAGE_2_2
                  newLine = 8
                }
                break
              case StageNumber.STAGE_2_2:
                newStage = StageNumber.STAGE_3
                newLine = 1
                break
              case StageNumber.STAGE_3:
                if (newPage < 602) {
                  newPage++
                  newLine = 1
                  newStage = StageNumber.STAGE_1_1
                }
                break
            }

            // Update StudentGroup (primary source of truth)
            await prisma.studentGroup.update({
              where: { id: studentGroup.id },
              data: {
                currentLine: newLine,
                currentStage: newStage,
                currentPage: newPage
              }
            })

            // Also update legacy User fields for compatibility
            await prisma.user.update({
              where: { id: submission.studentId },
              data: {
                currentPage: newPage,
                currentLine: newLine,
                currentStage: newStage,
              }
            })
          } else {
            console.log(
              `[WebReview] Task ${task.id} completed but doesn't match student position. ` +
              `Task: stage=${task.stage} line=${task.startLine}, ` +
              `Student: stage=${currentStage} line=${studentGroup.currentLine}. ` +
              `Skipping progress advancement.`
            )
          }
        }
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

    // Send Telegram notification to student (async, don't block response)
    const student = submission.student
    if (student.telegramId) {
      // Run notification in background to not slow down the API response
      const taskForNotification = {
        ...task,
        passedCount: newPassedCount,
        failedCount: newFailedCount,
      }
      notifyStudentInBackground(
        student.telegramId,
        { ...submission, task: taskForNotification },
        status,
        taskCompleted
      )
    }

    return NextResponse.json({
      success: true,
      submission: updatedSubmission,
      taskCompleted,
    })
  } catch (error) {
    console.error('Review submission error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * Send Telegram notification to student in background.
 * Errors are logged but don't affect the API response.
 */
function notifyStudentInBackground(
  telegramId: bigint,
  submission: any,
  status: string,
  taskCompleted: boolean
): void {
  import('@/lib/telegram/utils/review-notifications')
    .then(({ notifyStudentAboutReview }) => {
      return notifyStudentAboutReview(
        telegramId,
        submission,
        status as 'PASSED' | 'FAILED',
        taskCompleted
      )
    })
    .catch((error) => {
      console.error('[WebReview] Failed to send Telegram notification:', error)
    })
}
