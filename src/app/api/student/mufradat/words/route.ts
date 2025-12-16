import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'

// GET: Get words for the mufradat game
// Query params:
// - page: specific Quran page number
// - surah: specific surah number
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

    // Build filter based on params
    const where: {
      translationRu: { not: null }
      surahNumber?: number
    } = {
      translationRu: { not: null }, // Only words with Russian translation
    }

    // If page specified, get surah numbers for that page
    if (page) {
      // For now, we'll filter by surah if page is 1-2 (Al-Fatiha is surah 1)
      // In future, we could map pages to surahs more precisely
      const pageNum = parseInt(page)
      if (pageNum === 1) {
        where.surahNumber = 1 // Al-Fatiha
      } else if (pageNum === 2) {
        where.surahNumber = 2 // Start of Al-Baqarah
      }
    }

    if (surah) {
      where.surahNumber = parseInt(surah)
    }

    // Get all words matching criteria
    const allWords = await prisma.wordTranslation.findMany({
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

    if (allWords.length === 0) {
      return NextResponse.json({
        words: [],
        message: 'No words found with Russian translations. Import words first.',
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
