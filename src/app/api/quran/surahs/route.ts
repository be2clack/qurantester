import { NextRequest, NextResponse } from 'next/server'
import {
  getSurahsByPage,
  getPrimarySurahByPage,
  getSurahByNumber,
  getAllSurahs,
  SurahInfo
} from '@/lib/constants/surahs'

/**
 * GET: Get surah information
 * Query params:
 *   - page: number (1-604) - get surah(s) by page
 *   - number: number (1-114) - get surah by number
 *   - all: true - get all surahs
 *
 * Examples:
 *   GET /api/quran/surahs?page=50 - get surahs on page 50
 *   GET /api/quran/surahs?number=2 - get surah Al-Baqarah
 *   GET /api/quran/surahs?all=true - get all 114 surahs
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = searchParams.get('page')
  const number = searchParams.get('number')
  const all = searchParams.get('all')

  try {
    // Get all surahs
    if (all === 'true') {
      return NextResponse.json({
        surahs: getAllSurahs(),
        count: 114
      })
    }

    // Get surah by page number
    if (page) {
      const pageNum = parseInt(page)
      if (isNaN(pageNum) || pageNum < 1 || pageNum > 604) {
        return NextResponse.json(
          { error: 'Invalid page number. Must be between 1 and 604.' },
          { status: 400 }
        )
      }

      const surahs = getSurahsByPage(pageNum)
      const primary = getPrimarySurahByPage(pageNum)

      return NextResponse.json({
        page: pageNum,
        primary, // Main surah on this page
        surahs,  // All surahs on this page (may include 2 if page has transition)
        count: surahs.length
      })
    }

    // Get surah by number
    if (number) {
      const surahNum = parseInt(number)
      if (isNaN(surahNum) || surahNum < 1 || surahNum > 114) {
        return NextResponse.json(
          { error: 'Invalid surah number. Must be between 1 and 114.' },
          { status: 400 }
        )
      }

      const surah = getSurahByNumber(surahNum)
      if (!surah) {
        return NextResponse.json(
          { error: 'Surah not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ surah })
    }

    // No params - return usage info
    return NextResponse.json({
      message: 'Surah API - Get information about Quran surahs',
      usage: {
        byPage: '/api/quran/surahs?page=50',
        byNumber: '/api/quran/surahs?number=2',
        all: '/api/quran/surahs?all=true'
      },
      example: getSurahByNumber(1)
    })

  } catch (error) {
    console.error('Error in surahs API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
