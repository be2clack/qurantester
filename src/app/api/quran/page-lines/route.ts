import { NextRequest, NextResponse } from 'next/server'
import { getPageVerses, getMedinaLines } from '@/lib/quran-api'

/**
 * GET /api/quran/page-lines
 * Get Quran lines with words for a specific page and line range
 * Uses the same approach as the pre-check API
 *
 * Query params:
 * - page: Page number (1-604)
 * - startLine: Starting line number (optional, default 1)
 * - endLine: Ending line number (optional, default 15)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const pageNumber = parseInt(searchParams.get('page') || '1')
    const startLine = parseInt(searchParams.get('startLine') || '1')
    const endLine = parseInt(searchParams.get('endLine') || '15')

    if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > 604) {
      return NextResponse.json({ error: 'Invalid page number' }, { status: 400 })
    }

    const linesCount = endLine - startLine + 1

    // Fetch from Quran.com API using the same approach as pre-check
    const response = await getPageVerses(pageNumber)
    const allLines = getMedinaLines(response.verses)

    console.log('[page-lines] Medina API lines:', allLines.map(l => l.lineNumber))

    // Try to get requested lines first
    let lines = allLines.filter(l =>
      l.lineNumber >= startLine && l.lineNumber <= endLine
    )

    // If no lines found (e.g. page 1 line 1 doesn't exist), get first available lines
    if (lines.length === 0 && allLines.length > 0) {
      console.log('[page-lines] Requested lines not found, taking first', linesCount, 'available lines')
      lines = allLines.slice(0, linesCount)
    }

    console.log('[page-lines] Returning', lines.length, 'lines')

    // Format for response
    const formattedLines = lines.map((l, idx) => ({
      lineNumber: l.lineNumber,
      text: l.textArabic,
      verseKeys: l.verseKeys,
      words: l.words?.map(w => ({
        id: w.id,
        position: w.position,
        text: w.text_uthmani,
        charType: w.char_type_name,
      })) || [],
    }))

    return NextResponse.json({ lines: formattedLines })
  } catch (error) {
    console.error('Get page lines error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
