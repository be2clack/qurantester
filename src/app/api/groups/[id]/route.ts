import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, GroupLevel, LessonType, MushafType, AIProvider, VerificationMode, TaskStatus } from '@prisma/client'
import { z } from 'zod'

const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  ustazId: z.string().optional(),
  level: z.nativeEnum(GroupLevel).optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  lessonType: z.nativeEnum(LessonType).optional(),
  isActive: z.boolean().optional(),
  // MEMORIZATION settings
  repetitionCount: z.number().min(1).max(200).optional(),
  stage1Hours: z.number().min(1).max(720).optional(),  // max 30 days
  stage2Hours: z.number().min(1).max(720).optional(),
  stage3Hours: z.number().min(1).max(720).optional(),
  deadlineEnabled: z.boolean().optional(),
  // REVISION settings
  revisionPagesPerDay: z.number().min(1).max(20).optional(),
  revisionAllPages: z.boolean().optional(),
  revisionButtonOnly: z.boolean().optional(),
  // TRANSLATION settings
  wordsPerDay: z.number().min(1).max(50).optional(),
  wordsPassThreshold: z.number().min(1).max(50).optional(),
  mufradatTimeLimit: z.number().min(30).max(600).optional(),
  // Content settings
  allowVoice: z.boolean().optional(),
  allowVideoNote: z.boolean().optional(),
  allowText: z.boolean().optional(),
  showText: z.boolean().optional(),
  showImage: z.boolean().optional(),
  showAudio: z.boolean().optional(),
  // Mushaf settings
  mushafType: z.nativeEnum(MushafType).optional(),
  translationId: z.number().nullable().optional(),
  tafsirId: z.number().nullable().optional(),
  showTranslation: z.boolean().optional(),
  showTafsir: z.boolean().optional(),
  showTajweed: z.boolean().optional(),
  reciterId: z.number().nullable().optional(),
  // AI Verification settings
  aiProvider: z.nativeEnum(AIProvider).optional(),
  verificationMode: z.nativeEnum(VerificationMode).optional(),
  aiAcceptThreshold: z.number().min(0).max(100).optional(),
  aiRejectThreshold: z.number().min(0).max(100).optional(),
  // QRC Pre-check settings
  qrcPreCheckEnabled: z.boolean().optional(),
  qrcPreCheckProvider: z.nativeEnum(AIProvider).optional(),
  qrcHafzLevel: z.number().min(1).max(3).optional(),
  qrcTajweedLevel: z.number().min(1).max(3).optional(),
  qrcPassThreshold: z.number().min(0).max(100).optional(),
})

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

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        ustaz: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        students: {
          where: {
            isActive: true,
            student: {
              isActive: true
            }
          },
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                telegramId: true,
                tasks: {
                  where: { status: 'IN_PROGRESS' },
                  take: 1,
                  select: {
                    passedCount: true,
                    requiredCount: true,
                  }
                },
                // Revision submissions count
                revisionSubmissions: {
                  select: {
                    id: true,
                    status: true,
                    pageNumber: true,
                    createdAt: true,
                  }
                },
                // Mufradat submissions (last 7 days) - legacy
                mufradatSubmissions: {
                  where: {
                    date: {
                      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                  },
                  select: {
                    id: true,
                    date: true,
                    wordsTotal: true,
                    wordsCorrect: true,
                    passed: true,
                  },
                  orderBy: { date: 'desc' }
                },
                // Translation page progress (new system)
                translationPageProgress: {
                  where: {
                    date: {
                      gte: new Date(new Date().setHours(0, 0, 0, 0)) // today only
                    }
                  },
                  select: {
                    pageNumber: true,
                    wordsCorrect: true,
                    wordsTotal: true,
                    wordsWrong: true,
                    bestScore: true,
                    attempts: true,
                  },
                  orderBy: { pageNumber: 'asc' }
                },
                // Completed tasks count for memorization (PASSED = completed successfully)
                _count: {
                  select: {
                    tasks: { where: { status: TaskStatus.PASSED } }
                  }
                }
              }
            }
          },
          orderBy: [
            { student: { currentPage: 'desc' } },
            { student: { currentLine: 'desc' } }
          ]
        },
        lessons: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            type: true,
            repetitionCount: true,
            stage1Hours: true,
            stage2Hours: true,
            stage3Hours: true,
            isActive: true,
          }
        },
        _count: {
          select: { students: true, lessons: true }
        }
      }
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Access control
    if (currentUser.role === UserRole.USTAZ && group.ustazId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (currentUser.role === UserRole.STUDENT) {
      const studentInGroup = await prisma.studentGroup.findUnique({
        where: {
          studentId_groupId: {
            studentId: currentUser.id,
            groupId: id
          }
        }
      })
      if (!studentInGroup) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Serialize BigInt fields to strings for JSON compatibility
    // IMPORTANT: Progress (currentPage, currentLine, currentStage) comes from StudentGroup, not User!
    const serializedGroup = {
      ...group,
      students: group.students.map(sg => {
        const revisions = sg.student.revisionSubmissions || []
        const passedRevisions = revisions.filter(r => r.status === 'PASSED').length
        const pendingRevisions = revisions.filter(r => r.status === 'PENDING').length

        // Mufradat stats
        const mufradatSubs = sg.student.mufradatSubmissions || []
        const mufradatWeekPassed = mufradatSubs.filter(m => m.passed).length
        const mufradatWeekTotal = mufradatSubs.length
        const mufradatTodaySub = mufradatSubs.find(m => {
          const subDate = new Date(m.date)
          const today = new Date()
          return subDate.toDateString() === today.toDateString()
        })

        return {
          ...sg.student,
          telegramId: sg.student.telegramId?.toString() || null,
          // Progress from StudentGroup (not User!) - this is the authoritative source
          currentPage: sg.currentPage,
          currentLine: sg.currentLine,
          currentStage: sg.currentStage,
          // Progress stats
          completedTasksCount: sg.student._count?.tasks || 0,
          revisionsPassed: passedRevisions,
          revisionsPending: pendingRevisions,
          revisionsTotal: revisions.length,
          // Mufradat stats (legacy)
          mufradatWeekPassed,
          mufradatWeekTotal,
          mufradatToday: mufradatTodaySub ? {
            wordsCorrect: mufradatTodaySub.wordsCorrect,
            wordsTotal: mufradatTodaySub.wordsTotal,
            passed: mufradatTodaySub.passed
          } : null,
          // Translation page progress (new system)
          translationToday: sg.student.translationPageProgress || [],
          translationTodayStats: (() => {
            const progress = sg.student.translationPageProgress || []
            if (progress.length === 0) return null
            const totalAttempts = progress.reduce((sum: number, p: any) => sum + p.attempts, 0)
            const avgScore = progress.length > 0
              ? Math.round(progress.reduce((sum: number, p: any) => sum + p.bestScore, 0) / progress.length)
              : 0
            const pagesLearned = progress.filter((p: any) => p.bestScore >= 80).length
            return {
              pagesStudied: progress.length,
              pagesLearned,
              totalAttempts,
              avgScore,
            }
          })(),
        }
      })
    }

    return NextResponse.json(serializedGroup)
  } catch (error) {
    console.error('Get group error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const validation = updateGroupSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const existing = await prisma.group.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Verify new ustaz if provided
    if (validation.data.ustazId) {
      const ustaz = await prisma.user.findUnique({
        where: { id: validation.data.ustazId }
      })
      if (!ustaz || ustaz.role !== UserRole.USTAZ) {
        return NextResponse.json({ error: 'Invalid ustaz' }, { status: 400 })
      }
    }

    // Check if we need to regenerate the group name (gender or level changed)
    const newGender = validation.data.gender || existing.gender
    const newLevel = validation.data.level || existing.level
    const genderChanged = validation.data.gender && validation.data.gender !== existing.gender
    const levelChanged = validation.data.level && validation.data.level !== existing.level

    let updateData = { ...validation.data }

    if (genderChanged || levelChanged) {
      // Regenerate group name
      const genderPrefix = newGender === 'MALE' ? 'М' : 'Ж'
      const year = new Date().getFullYear().toString().slice(-2)
      const levelNumber = newLevel.replace('LEVEL_', '')
      const basePattern = `${genderPrefix}-${year}-${levelNumber}`

      // Count existing groups with same base pattern to get next number
      const existingGroups = await prisma.group.count({
        where: {
          name: { startsWith: basePattern },
          id: { not: id } // Exclude current group
        }
      })

      const groupNumber = existingGroups + 1
      updateData.name = `${basePattern}-${groupNumber}`
    }

    const group = await prisma.group.update({
      where: { id },
      data: updateData,
      include: {
        ustaz: {
          select: { id: true, firstName: true, lastName: true }
        },
        _count: { select: { students: true } }
      }
    })

    // If repetitionCount changed, sync all active tasks for this group
    if (validation.data.repetitionCount !== undefined &&
        validation.data.repetitionCount !== existing.repetitionCount) {
      await prisma.task.updateMany({
        where: {
          groupId: id,
          status: 'IN_PROGRESS',
          // Only update if new count is different and task hasn't exceeded the new count
          currentCount: { lt: validation.data.repetitionCount }
        },
        data: {
          requiredCount: validation.data.repetitionCount
        }
      })

      // For tasks where currentCount >= new requiredCount, mark them as ready
      // (keep as IN_PROGRESS but with updated requiredCount so they complete on next check)
      await prisma.task.updateMany({
        where: {
          groupId: id,
          status: 'IN_PROGRESS',
          currentCount: { gte: validation.data.repetitionCount }
        },
        data: {
          requiredCount: validation.data.repetitionCount
        }
      })
    }

    return NextResponse.json(group)
  } catch (error) {
    console.error('Update group error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const existing = await prisma.group.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Soft delete
    await prisma.group.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete group error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
