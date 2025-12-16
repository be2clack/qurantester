import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'

interface GameResult {
  wordId: string
  wordKey: string
  correct: boolean
  selectedAnswer: string
  correctAnswer: string
}

// POST: Submit game results
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: 'Only students can submit' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { taskId, results, totalTime } = body as {
      taskId?: string
      results: GameResult[]
      totalTime?: number // in seconds
    }

    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json({ error: 'No results provided' }, { status: 400 })
    }

    // Calculate score
    const correctCount = results.filter((r) => r.correct).length
    const totalCount = results.length
    const score = Math.round((correctCount / totalCount) * 100)

    // If taskId is provided, create a submission for that task
    if (taskId) {
      // Verify task exists and belongs to this student
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          studentId: user.id,
          group: {
            lessonType: 'TRANSLATION',
          },
        },
        include: {
          group: true,
        },
      })

      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }

      // Create submission
      const submission = await prisma.submission.create({
        data: {
          taskId,
          studentId: user.id,
          submissionType: 'MUFRADAT_GAME',
          gameScore: score,
          gameCorrect: correctCount,
          gameTotal: totalCount,
          gameData: JSON.stringify({ results, totalTime }),
          status: score >= 80 ? 'PASSED' : 'PENDING', // Auto-pass if 80%+
          feedback: `Муфрадат: ${correctCount}/${totalCount} правильно (${score}%)`,
          reviewedAt: score >= 80 ? new Date() : null,
        },
      })

      // If auto-approved, update task status
      if (score >= 80) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: 'PASSED' },
        })
      }

      return NextResponse.json({
        success: true,
        submissionId: submission.id,
        score,
        correctCount,
        totalCount,
        passed: score >= 80,
        message: score >= 80
          ? `Отлично! Вы набрали ${score}%. Задание выполнено!`
          : `Вы набрали ${score}%. Нужно минимум 80% для сдачи. Попробуйте ещё раз!`,
      })
    }

    // If no taskId, just return the score (practice mode)
    return NextResponse.json({
      success: true,
      score,
      correctCount,
      totalCount,
      passed: score >= 80,
      message: `Результат: ${correctCount}/${totalCount} (${score}%)`,
    })
  } catch (error) {
    console.error('Error submitting game results:', error)
    return NextResponse.json({ error: 'Failed to submit results' }, { status: 500 })
  }
}
