import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { translateSingleWord } from '@/lib/openai'

// POST: Сгенерировать перевод для одного слова
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { wordKey, textArabic, translationEn } = body

    if (!wordKey || !textArabic) {
      return NextResponse.json(
        { error: 'wordKey and textArabic required' },
        { status: 400 }
      )
    }

    // Generate translation
    const translationRu = await translateSingleWord(textArabic, translationEn)

    // Save to DB
    await prisma.wordTranslation.update({
      where: { wordKey },
      data: {
        translationRu,
        aiGenerated: true,
        aiModel: 'gpt-4o-mini',
      },
    })

    return NextResponse.json({ success: true, translationRu })
  } catch (error) {
    console.error('Error generating translation:', error)
    return NextResponse.json(
      { error: 'Failed to generate translation' },
      { status: 500 }
    )
  }
}
