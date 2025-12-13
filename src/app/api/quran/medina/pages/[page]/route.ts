import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  getPageVerses,
  getTajweedText,
  getMedinaLines,
  getChaptersForPage,
  MEDINA_MUSHAF,
} from '@/lib/quran-api'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ page: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { page } = await params
    const pageNumber = parseInt(page)

    if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > MEDINA_MUSHAF.TOTAL_PAGES) {
      return NextResponse.json(
        { error: `Invalid page number. Must be between 1 and ${MEDINA_MUSHAF.TOTAL_PAGES}` },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(req.url)
    const translationId = searchParams.get('translation')
    const includeTajweed = searchParams.get('tajweed') === 'true'
    const includeChapters = searchParams.get('chapters') === 'true'

    // Fetch page data in parallel
    const [versesData, tajweedData, chapters] = await Promise.all([
      getPageVerses(pageNumber, {
        translationId: translationId ? parseInt(translationId) : undefined,
      }),
      includeTajweed ? getTajweedText(pageNumber) : null,
      includeChapters ? getChaptersForPage(pageNumber) : null,
    ])

    // Organize verses by line number
    const lines = getMedinaLines(versesData.verses)

    // Build tajweed map if requested
    const tajweedMap: Record<string, string> = {}
    if (tajweedData?.verses) {
      for (const verse of tajweedData.verses) {
        tajweedMap[verse.verse_key] = verse.text_uthmani_tajweed
      }
    }

    // Add tajweed to lines if available
    if (Object.keys(tajweedMap).length > 0) {
      for (const line of lines) {
        // Combine tajweed text from all verses in this line
        const tajweedParts = line.verseKeys
          .map(key => tajweedMap[key])
          .filter(Boolean)
        if (tajweedParts.length > 0) {
          line.textTajweed = tajweedParts.join(' ')
        }
      }
    }

    // Extract translations if included
    const translations: Record<string, string> = {}
    if (translationId) {
      for (const verse of versesData.verses) {
        if (verse.translations?.[0]) {
          translations[verse.verse_key] = verse.translations[0].text
        }
      }
    }

    return NextResponse.json({
      pageNumber,
      totalLines: lines.length,
      lines,
      verses: versesData.verses.map(v => ({
        id: v.id,
        verse_key: v.verse_key,
        verse_number: v.verse_number,
        text_uthmani: v.text_uthmani,
        juz_number: v.juz_number,
        hizb_number: v.hizb_number,
      })),
      translations: Object.keys(translations).length > 0 ? translations : undefined,
      chapters: chapters?.map(c => ({
        id: c.id,
        name_arabic: c.name_arabic,
        name_simple: c.name_simple,
        translated_name: c.translated_name.name,
        verses_count: c.verses_count,
      })),
      meta: {
        mushafType: 'MEDINA_API',
        source: 'quran.com',
        translationId: translationId ? parseInt(translationId) : null,
      },
    })
  } catch (error) {
    console.error('Medina API proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Quran data' },
      { status: 500 }
    )
  }
}
