import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'

const QURAN_API_BASE = 'https://api.quran.com/api/v4'
const BATCH_SIZE = 30 // Words per batch

interface QuranWord {
  id: number
  position: number
  text_uthmani?: string
  text?: string
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

// Surah info for tracking
const SURAH_VERSE_COUNTS: Record<number, number> = {
  1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75, 9: 129, 10: 109,
  11: 123, 12: 111, 13: 43, 14: 52, 15: 99, 16: 128, 17: 111, 18: 110, 19: 98, 20: 135,
  21: 112, 22: 78, 23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88, 29: 69, 30: 60,
  31: 34, 32: 30, 33: 73, 34: 54, 35: 45, 36: 83, 37: 182, 38: 88, 39: 75, 40: 85,
  41: 54, 42: 53, 43: 89, 44: 59, 45: 37, 46: 35, 47: 38, 48: 29, 49: 18, 50: 45,
  51: 60, 52: 49, 53: 62, 54: 55, 55: 78, 56: 96, 57: 29, 58: 22, 59: 24, 60: 13,
  61: 14, 62: 11, 63: 11, 64: 18, 65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44,
  71: 28, 72: 28, 73: 20, 74: 56, 75: 40, 76: 31, 77: 50, 78: 40, 79: 46, 80: 42,
  81: 29, 82: 19, 83: 36, 84: 25, 85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20,
  91: 15, 92: 21, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8, 100: 11,
  101: 11, 102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6, 110: 3,
  111: 5, 112: 4, 113: 5, 114: 6
}

/**
 * POST: Import words in batches
 * Request body: { surah: number, fromAyah?: number }
 * Response: { imported, updated, nextSurah, nextAyah, isComplete, progress }
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user || user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { surah, fromAyah = 1, fromPosition = 0 } = body

    if (!surah || surah < 1 || surah > 114) {
      return NextResponse.json(
        { error: 'Invalid surah number (1-114)' },
        { status: 400 }
      )
    }

    // Fetch verses for this surah
    const url = `${QURAN_API_BASE}/verses/by_chapter/${surah}?language=en&words=true&word_translation_language=en&word_fields=text_uthmani,text,text_simple&per_page=300`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Quran API error: ${response.status}`)
    }

    const data = await response.json()
    const verses: QuranVerse[] = data.verses || []

    let imported = 0
    let updated = 0
    let skipped = 0
    let processed = 0
    let lastAyah = fromAyah
    let lastPosition = fromPosition
    let reachedBatchLimit = false

    // Process verses starting from fromAyah
    for (const verse of verses) {
      const [surahNum, ayahNum] = verse.verse_key.split(':').map(Number)

      // Skip verses before fromAyah
      if (ayahNum < fromAyah) continue

      lastAyah = ayahNum

      for (const word of verse.words) {
        // Skip end markers
        if (word.char_type_name !== 'word') continue

        // Skip words before fromPosition (only for the starting ayah)
        if (ayahNum === fromAyah && word.position <= fromPosition) continue

        // Check batch limit
        if (processed >= BATCH_SIZE) {
          reachedBatchLimit = true
          break
        }

        const textArabic = word.text_uthmani || word.text
        if (!textArabic) continue

        const wordKey = `${surahNum}:${ayahNum}:${word.position}`
        lastPosition = word.position

        const existing = await prisma.wordTranslation.findUnique({
          where: { wordKey }
        })

        // Always increment processed to advance through words
        processed++

        if (existing) {
          if (!existing.translationEn && word.translation?.text) {
            await prisma.wordTranslation.update({
              where: { wordKey },
              data: { translationEn: word.translation.text }
            })
            updated++
          } else {
            skipped++
          }
        } else {
          await prisma.wordTranslation.create({
            data: {
              wordKey,
              surahNumber: surahNum,
              ayahNumber: ayahNum,
              position: word.position,
              textArabic,
              textSimple: word.text_simple || null,
              translationEn: word.translation?.text || null,
            }
          })
          imported++
        }
      }

      if (reachedBatchLimit) break

      // Finished this ayah, reset position for next ayah
      lastPosition = 0
    }

    // Determine next position
    let nextSurah = surah
    let nextAyah = lastAyah
    let nextPosition = lastPosition
    let isComplete = false

    if (!reachedBatchLimit) {
      // Finished this surah, move to next
      if (surah >= 114) {
        isComplete = true
      } else {
        nextSurah = surah + 1
        nextAyah = 1
        nextPosition = 0
      }
    }

    // Calculate overall progress
    const totalSurahs = 114
    const progress = Math.round(((surah - 1 + (lastAyah / SURAH_VERSE_COUNTS[surah])) / totalSurahs) * 100)

    return NextResponse.json({
      success: true,
      imported,
      updated,
      skipped,
      processed,
      currentSurah: surah,
      currentAyah: lastAyah,
      currentPosition: lastPosition,
      nextSurah,
      nextAyah,
      nextPosition,
      isComplete,
      progress,
      message: `Сура ${surah}:${lastAyah} — +${imported} новых${updated > 0 ? `, ${updated} обн.` : ''}${skipped > 0 ? `, ${skipped} уже есть` : ''}`
    })
  } catch (error) {
    console.error('Error in batch import:', error)
    return NextResponse.json(
      { error: 'Import error', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET: Get current import status
 */
export async function GET() {
  const user = await getCurrentUser()

  if (!user || user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get stats from database
    const stats = await prisma.wordTranslation.aggregate({
      _count: true,
    })

    // Find the last imported word to determine resume point
    const lastWord = await prisma.wordTranslation.findFirst({
      orderBy: [
        { surahNumber: 'desc' },
        { ayahNumber: 'desc' },
        { position: 'desc' }
      ]
    })

    let resumeSurah = 1
    let resumeAyah = 1

    if (lastWord) {
      // Check if this surah is complete
      const wordsInSurah = await prisma.wordTranslation.count({
        where: { surahNumber: lastWord.surahNumber }
      })

      // Rough estimate: if we have words, continue from next ayah or next surah
      if (lastWord.surahNumber < 114) {
        resumeSurah = lastWord.surahNumber
        resumeAyah = lastWord.ayahNumber
      } else {
        resumeSurah = 114
        resumeAyah = 1
      }
    }

    const progress = lastWord
      ? Math.round((lastWord.surahNumber / 114) * 100)
      : 0

    return NextResponse.json({
      totalWords: stats._count,
      resumeSurah,
      resumeAyah,
      progress,
      lastImported: lastWord ? `${lastWord.surahNumber}:${lastWord.ayahNumber}:${lastWord.position}` : null
    })
  } catch (error) {
    console.error('Error getting import status:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}
