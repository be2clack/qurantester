import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'

const QURAN_API_BASE = 'https://api.quran.com/api/v4'

interface QuranWord {
  id: number
  position: number
  text_uthmani: string
  text_simple?: string
  char_type_name: string
  translation?: {
    text: string
    language_name: string
  }
}

interface QuranVerse {
  id: number
  verse_key: string
  words: QuranWord[]
}

// POST: Import words for a surah from Quran.com API
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user || user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { surah } = body

    if (!surah || surah < 1 || surah > 114) {
      return NextResponse.json(
        { error: 'Invalid surah number (1-114)' },
        { status: 400 }
      )
    }

    // Fetch verses with words from Quran.com API
    const url = `${QURAN_API_BASE}/verses/by_chapter/${surah}?language=en&words=true&word_translation_language=en&per_page=300`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Quran API error: ${response.status}`)
    }

    const data = await response.json()
    const verses: QuranVerse[] = data.verses || []

    let imported = 0
    let updated = 0

    // Process each verse
    for (const verse of verses) {
      const [surahNum, ayahNum] = verse.verse_key.split(':').map(Number)

      for (const word of verse.words) {
        // Skip end markers (like ۝)
        if (word.char_type_name !== 'word') continue

        const wordKey = `${surahNum}:${ayahNum}:${word.position}`

        // Check if exists
        const existing = await prisma.wordTranslation.findUnique({
          where: { wordKey }
        })

        if (existing) {
          // Update English translation if missing
          if (!existing.translationEn && word.translation?.text) {
            await prisma.wordTranslation.update({
              where: { wordKey },
              data: { translationEn: word.translation.text }
            })
            updated++
          }
        } else {
          // Create new word
          await prisma.wordTranslation.create({
            data: {
              wordKey,
              surahNumber: surahNum,
              ayahNumber: ayahNum,
              position: word.position,
              textArabic: word.text_uthmani,
              textSimple: word.text_simple,
              translationEn: word.translation?.text || null,
            }
          })
          imported++
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      updated,
      total: imported + updated,
      message: `Импортировано ${imported} новых слов, обновлено ${updated}`
    })
  } catch (error) {
    console.error('Error importing words:', error)
    return NextResponse.json(
      { error: 'Failed to import words' },
      { status: 500 }
    )
  }
}
