import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'

// GET: Get mufradat submission statistics
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId')
  const days = parseInt(searchParams.get('days') || '30')

  // Determine which student's stats to get
  let targetStudentId = user.id

  if (studentId && studentId !== user.id) {
    // Only admin, ustaz, or parent can view other students' stats
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
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    // Get submissions for the period
    const submissions = await prisma.mufradatSubmission.findMany({
      where: {
        studentId: targetStudentId,
        date: { gte: startDate }
      },
      orderBy: { date: 'desc' }
    })

    // Calculate statistics
    const totalDays = submissions.length
    const passedDays = submissions.filter(s => s.passed).length
    const totalWords = submissions.reduce((sum, s) => sum + s.wordsTotal, 0)
    const correctWords = submissions.reduce((sum, s) => sum + s.wordsCorrect, 0)
    const mistakes = submissions.reduce((sum, s) => sum + s.wordsMistakes, 0)

    // Get today's submission
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todaySubmission = submissions.find(s => {
      const subDate = new Date(s.date)
      return subDate.toDateString() === today.toDateString()
    })

    // Build daily breakdown
    const dailyStats = submissions.map(s => ({
      date: s.date,
      wordsTotal: s.wordsTotal,
      wordsCorrect: s.wordsCorrect,
      wordsMistakes: s.wordsMistakes,
      passed: s.passed
    }))

    // Calculate weekly stats
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const weekSubmissions = submissions.filter(s => new Date(s.date) >= sevenDaysAgo)
    const weekStats = {
      totalDays: weekSubmissions.length,
      passedDays: weekSubmissions.filter(s => s.passed).length,
      totalWords: weekSubmissions.reduce((sum, s) => sum + s.wordsTotal, 0),
      correctWords: weekSubmissions.reduce((sum, s) => sum + s.wordsCorrect, 0)
    }

    return NextResponse.json({
      studentId: targetStudentId,
      period: {
        days,
        startDate,
        endDate: new Date()
      },
      summary: {
        totalDays,
        passedDays,
        totalWords,
        correctWords,
        mistakes,
        passRate: totalDays > 0 ? Math.round((passedDays / totalDays) * 100) : 0,
        accuracy: totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0
      },
      week: weekStats,
      today: todaySubmission ? {
        wordsTotal: todaySubmission.wordsTotal,
        wordsCorrect: todaySubmission.wordsCorrect,
        passed: todaySubmission.passed
      } : null,
      daily: dailyStats
    })
  } catch (error) {
    console.error('Error fetching mufradat stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
