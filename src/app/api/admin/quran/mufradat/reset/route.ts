import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { surah, resetAll, resetOnlyAI } = body

    // Validate request
    if (!resetAll && !surah) {
      return NextResponse.json(
        { error: 'Specify surah number or resetAll: true' },
        { status: 400 }
      )
    }

    // Build where clause
    const where: Record<string, unknown> = {}
    if (!resetAll && surah) {
      where.surahNumber = surah
    }
    if (resetOnlyAI) {
      where.aiGenerated = true
    }

    // Count before reset
    const countBefore = await prisma.wordTranslation.count({
      where: {
        ...where,
        translationRu: { not: null },
      },
    })

    // Reset translations
    const result = await prisma.wordTranslation.updateMany({
      where: {
        ...where,
        translationRu: { not: null }, // Only reset if there's something to reset
      },
      data: {
        translationRu: null,
        aiGenerated: false,
        aiModel: null,
        isVerified: false,
        verifiedBy: null,
        verifiedAt: null,
      },
    })

    const scope = resetAll ? 'всего Корана' : `суры ${surah}`
    const aiNote = resetOnlyAI ? ' (только AI)' : ''

    return NextResponse.json({
      success: true,
      reset: result.count,
      message: `Сброшено ${result.count} переводов${aiNote} для ${scope}`,
    })
  } catch (error) {
    console.error('Reset translations error:', error)
    return NextResponse.json(
      { error: 'Failed to reset translations' },
      { status: 500 }
    )
  }
}

// Get reset preview (count how many will be affected)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const surah = searchParams.get('surah')
    const resetOnlyAI = searchParams.get('onlyAI') === 'true'

    const where: Record<string, unknown> = {
      translationRu: { not: null },
    }

    if (surah) {
      where.surahNumber = parseInt(surah)
    }
    if (resetOnlyAI) {
      where.aiGenerated = true
    }

    const count = await prisma.wordTranslation.count({ where })

    return NextResponse.json({
      count,
      scope: surah ? `суры ${surah}` : 'всего Корана',
      onlyAI: resetOnlyAI,
    })
  } catch (error) {
    console.error('Get reset preview error:', error)
    return NextResponse.json(
      { error: 'Failed to get preview' },
      { status: 500 }
    )
  }
}
