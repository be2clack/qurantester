import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { translateWordsWithContext } from '@/lib/openai'
import { getVerseTranslations, RUSSIAN_TRANSLATIONS } from '@/lib/quran-api'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { surah, fromAyah = 1, limit = 100 } = body

    if (!surah) {
      return NextResponse.json({ error: 'Surah number required' }, { status: 400 })
    }

    // Fetch ALL untranslated words in the surah (ignore fromAyah - find any missing)
    const words = await prisma.wordTranslation.findMany({
      where: {
        surahNumber: surah,
        translationRu: null, // Only untranslated
      },
      orderBy: [
        { ayahNumber: 'asc' },
        { position: 'asc' },
      ],
      take: limit,
    })

    if (words.length === 0) {
      return NextResponse.json({
        success: true,
        translated: 0,
        message: 'Все слова уже переведены',
        isComplete: true,
      })
    }

    // Get unique ayah keys
    const ayahKeys = [...new Set(words.map(w => `${w.surahNumber}:${w.ayahNumber}`))]

    // Fetch Kuliev translations for context
    let ayahTranslations: { ayahKey: string; translationRu: string }[] = []
    try {
      const { translations } = await getVerseTranslations(ayahKeys, RUSSIAN_TRANSLATIONS.KULIEV)
      ayahTranslations = translations.map(t => ({
        ayahKey: t.verse_key,
        translationRu: t.text.replace(/<[^>]*>/g, ''), // Remove HTML tags
      }))
    } catch (error) {
      console.error('Failed to fetch Kuliev translations:', error)
      // Continue without context if API fails
    }

    // Prepare words for translation
    const wordsToTranslate = words.map(w => ({
      wordKey: w.wordKey,
      textArabic: w.textArabic,
      translationEn: w.translationEn || undefined,
      ayahKey: `${w.surahNumber}:${w.ayahNumber}`,
    }))

    // Translate with context
    const translated = await translateWordsWithContext(wordsToTranslate, ayahTranslations)

    // Save translations to database
    let savedCount = 0
    for (const t of translated) {
      try {
        await prisma.wordTranslation.update({
          where: { wordKey: t.wordKey },
          data: {
            translationRu: t.translationRu,
            aiGenerated: true,
            aiModel: 'gpt-4o-mini-context',
          },
        })
        savedCount++
      } catch (e) {
        console.error(`Failed to save translation for ${t.wordKey}:`, e)
      }
    }

    // Count ALL remaining untranslated words in the surah
    const remainingWords = await prisma.wordTranslation.count({
      where: {
        surahNumber: surah,
        translationRu: null,
      },
    })

    const lastWord = words[words.length - 1]

    return NextResponse.json({
      success: true,
      translated: savedCount,
      total: words.length,
      currentAyah: lastWord.ayahNumber,
      remaining: remainingWords,
      isComplete: remainingWords === 0,
      message: `Переведено ${savedCount} слов (аят ${lastWord.ayahNumber}), осталось: ${remainingWords}`,
    })
  } catch (error) {
    console.error('Context translation error:', error)
    return NextResponse.json(
      { error: 'Failed to translate with context' },
      { status: 500 }
    )
  }
}

// Get translation status for a surah
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const surah = parseInt(searchParams.get('surah') || '0')

    if (!surah) {
      return NextResponse.json({ error: 'Surah number required' }, { status: 400 })
    }

    const [total, translated, untranslated] = await Promise.all([
      prisma.wordTranslation.count({ where: { surahNumber: surah } }),
      prisma.wordTranslation.count({ where: { surahNumber: surah, translationRu: { not: null } } }),
      prisma.wordTranslation.count({ where: { surahNumber: surah, translationRu: null } }),
    ])

    return NextResponse.json({
      surah,
      total,
      translated,
      untranslated,
      progress: total > 0 ? Math.round((translated / total) * 100) : 0,
    })
  } catch (error) {
    console.error('Get context translation status error:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}
