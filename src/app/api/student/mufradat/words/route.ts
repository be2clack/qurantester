import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { getPageVerses } from '@/lib/quran-api'

// GET: Get words for the mufradat game
// Query params:
// - page: specific Quran page number (uses Quran API to get words)
// - surah: specific surah number (fallback to DB lookup)
// - count: number of words to return (default 10)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only students can play the game
  if (user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: 'Only students can access this' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page')
    const surah = searchParams.get('surah')
    const count = parseInt(searchParams.get('count') || '10')

    let allWords: {
      id: string
      wordKey: string
      surahNumber: number
      ayahNumber: number
      position: number
      textArabic: string
      translationEn: string | null
      translationRu: string | null
    }[] = []

    // If page is specified, get words from Quran API then match with our translations
    if (page) {
      const pageNum = parseInt(page)

      // Get verses with words from Quran API
      const pageData = await getPageVerses(pageNum, { wordTranslationLanguage: 'en' })

      // Collect all wordKeys from this page
      const wordKeys: string[] = []
      const arabicWords: Map<string, { textArabic: string; translationEn?: string }> = new Map()

      for (const verse of pageData.verses) {
        const [surahNum, ayahNum] = verse.verse_key.split(':').map(Number)

        for (const word of verse.words || []) {
          if (word.char_type_name !== 'word') continue

          const wordKey = `${surahNum}:${ayahNum}:${word.position}`
          wordKeys.push(wordKey)
          arabicWords.set(wordKey, {
            textArabic: word.text_uthmani,
            translationEn: word.translation?.text
          })
        }
      }

      // Get Russian translations from our DB for these wordKeys
      const translations = await prisma.wordTranslation.findMany({
        where: {
          wordKey: { in: wordKeys },
          translationRu: { not: null }
        },
        select: {
          id: true,
          wordKey: true,
          surahNumber: true,
          ayahNumber: true,
          position: true,
          textArabic: true,
          translationEn: true,
          translationRu: true,
        }
      })

      // Merge: use Arabic from API, translation from DB
      allWords = translations.map(t => {
        const apiWord = arabicWords.get(t.wordKey)
        return {
          id: t.id,
          wordKey: t.wordKey,
          surahNumber: t.surahNumber,
          ayahNumber: t.ayahNumber,
          position: t.position,
          textArabic: apiWord?.textArabic || t.textArabic,
          translationEn: apiWord?.translationEn || t.translationEn,
          translationRu: t.translationRu
        }
      })
    } else {
      // Fallback: filter by surah from DB
      const where: {
        translationRu: { not: null }
        surahNumber?: number
      } = {
        translationRu: { not: null },
      }

      if (surah) {
        where.surahNumber = parseInt(surah)
      }

      allWords = await prisma.wordTranslation.findMany({
        where,
        select: {
          id: true,
          wordKey: true,
          surahNumber: true,
          ayahNumber: true,
          position: true,
          textArabic: true,
          translationEn: true,
          translationRu: true,
        },
      })
    }

    if (allWords.length === 0) {
      return NextResponse.json({
        words: [],
        message: 'No words found with Russian translations for this page.',
      })
    }

    // Shuffle and take requested count
    const shuffled = allWords.sort(() => Math.random() - 0.5)
    const selectedWords = shuffled.slice(0, Math.min(count, allWords.length))

    // For each word, generate 3 wrong options from other words
    const gameWords = selectedWords.map((word) => {
      // Get 3 other random translations as wrong options
      const otherWords = allWords.filter((w) => w.id !== word.id && w.translationRu !== word.translationRu)
      const shuffledOthers = otherWords.sort(() => Math.random() - 0.5)
      const wrongOptions = shuffledOthers.slice(0, 3).map((w) => w.translationRu!)

      // Create options array with correct answer and wrong ones
      const options = [word.translationRu!, ...wrongOptions].sort(() => Math.random() - 0.5)

      return {
        id: word.id,
        wordKey: word.wordKey,
        surahNumber: word.surahNumber,
        ayahNumber: word.ayahNumber,
        textArabic: word.textArabic,
        translationEn: word.translationEn,
        correctAnswer: word.translationRu,
        options,
      }
    })

    return NextResponse.json({
      words: gameWords,
      total: gameWords.length,
    })
  } catch (error) {
    console.error('Error fetching words for game:', error)
    return NextResponse.json({ error: 'Failed to fetch words' }, { status: 500 })
  }
}
