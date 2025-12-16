import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { translateWordsToRussian } from '@/lib/openai'
import { getCurrentUser } from '@/lib/auth'

// GET: Получить переводы слов для списка wordKeys
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const wordKeys = searchParams.get('keys')?.split(',') || []

  if (wordKeys.length === 0) {
    return NextResponse.json({ translations: {} })
  }

  // Получаем существующие переводы из БД
  const existing = await prisma.wordTranslation.findMany({
    where: {
      wordKey: { in: wordKeys }
    },
    select: {
      wordKey: true,
      translationRu: true,
      translationEn: true,
      isVerified: true,
    }
  })

  // Создаем map для быстрого доступа
  const translations: Record<string, { ru?: string; en?: string; verified: boolean }> = {}
  for (const word of existing) {
    translations[word.wordKey] = {
      ru: word.translationRu || undefined,
      en: word.translationEn || undefined,
      verified: word.isVerified,
    }
  }

  return NextResponse.json({ translations })
}

// POST: Сохранить слова из API и сгенерировать переводы
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { words } = body as {
      words: Array<{
        wordKey: string
        surahNumber: number
        ayahNumber: number
        position: number
        textArabic: string
        textSimple?: string
        translationEn?: string
      }>
    }

    if (!words || words.length === 0) {
      return NextResponse.json({ error: 'No words provided' }, { status: 400 })
    }

    // Проверяем какие слова уже есть в БД
    const existingKeys = await prisma.wordTranslation.findMany({
      where: { wordKey: { in: words.map(w => w.wordKey) } },
      select: { wordKey: true, translationRu: true }
    })
    const existingMap = new Map(existingKeys.map(e => [e.wordKey, e.translationRu]))

    // Фильтруем только те что нужно перевести (нет русского перевода)
    const needTranslation = words.filter(w => !existingMap.get(w.wordKey))

    // Сначала сохраняем слова в БД (без русского перевода)
    for (const word of needTranslation) {
      await prisma.wordTranslation.upsert({
        where: { wordKey: word.wordKey },
        update: {
          textArabic: word.textArabic,
          textSimple: word.textSimple,
          translationEn: word.translationEn,
        },
        create: {
          wordKey: word.wordKey,
          surahNumber: word.surahNumber,
          ayahNumber: word.ayahNumber,
          position: word.position,
          textArabic: word.textArabic,
          textSimple: word.textSimple,
          translationEn: word.translationEn,
        }
      })
    }

    // Если есть слова для перевода и настроен OpenAI
    let translated = 0
    if (needTranslation.length > 0 && process.env.OPENAI_API_KEY) {
      try {
        // Переводим батчами по 20 слов
        const batchSize = 20
        for (let i = 0; i < needTranslation.length; i += batchSize) {
          const batch = needTranslation.slice(i, i + batchSize)

          const translations = await translateWordsToRussian(
            batch.map(w => ({
              wordKey: w.wordKey,
              textArabic: w.textArabic,
              translationEn: w.translationEn,
            }))
          )

          // Сохраняем переводы в БД
          for (const t of translations) {
            await prisma.wordTranslation.update({
              where: { wordKey: t.wordKey },
              data: {
                translationRu: t.translationRu,
                aiGenerated: true,
                aiModel: 'gpt-4o-mini',
              }
            })
            translated++
          }
        }
      } catch (aiError) {
        console.error('AI translation error:', aiError)
        // Продолжаем даже если AI не сработал
      }
    }

    // Получаем все переводы для ответа
    const allTranslations = await prisma.wordTranslation.findMany({
      where: { wordKey: { in: words.map(w => w.wordKey) } },
      select: {
        wordKey: true,
        translationRu: true,
        translationEn: true,
        isVerified: true,
      }
    })

    const translations: Record<string, { ru?: string; en?: string; verified: boolean }> = {}
    for (const word of allTranslations) {
      translations[word.wordKey] = {
        ru: word.translationRu || undefined,
        en: word.translationEn || undefined,
        verified: word.isVerified,
      }
    }

    return NextResponse.json({
      success: true,
      saved: needTranslation.length,
      translated,
      translations,
    })
  } catch (error) {
    console.error('Error saving word translations:', error)
    return NextResponse.json(
      { error: 'Failed to save translations' },
      { status: 500 }
    )
  }
}

// PATCH: Обновить перевод слова (для админов)
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { wordKey, translationRu, verify } = body

    if (!wordKey) {
      return NextResponse.json({ error: 'wordKey required' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}

    if (translationRu !== undefined) {
      updateData.translationRu = translationRu
    }

    if (verify) {
      updateData.isVerified = true
      updateData.verifiedBy = user.id
      updateData.verifiedAt = new Date()
    }

    const updated = await prisma.wordTranslation.update({
      where: { wordKey },
      data: updateData,
    })

    return NextResponse.json({ success: true, word: updated })
  } catch (error) {
    console.error('Error updating word translation:', error)
    return NextResponse.json(
      { error: 'Failed to update translation' },
      { status: 500 }
    )
  }
}
