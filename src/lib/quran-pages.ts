import { prisma } from '@/lib/prisma'

const QURAN_API_BASE = 'https://api.quran.com/api/v4'

/**
 * Fetch total lines for a page from Quran.com API
 * Counts unique line numbers (page 1 has lines 2-8 = 7 unique lines)
 */
async function fetchPageLinesFromAPI(pageNumber: number): Promise<number> {
  try {
    const response = await fetch(
      `${QURAN_API_BASE}/verses/by_page/${pageNumber}?words=true&word_fields=line_number`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const verses = data.verses || []

    // Count unique line numbers (not max!)
    // Page 1 has lines 2-8 which is 7 unique lines
    const uniqueLines = new Set<number>()
    for (const verse of verses) {
      if (verse.words) {
        for (const word of verse.words) {
          if (word.line_number) {
            uniqueLines.add(word.line_number)
          }
        }
      }
    }

    return uniqueLines.size || 15 // Default to 15 if no data
  } catch (error) {
    console.error(`Failed to fetch lines for page ${pageNumber}:`, error)
    // Fallback to standard values
    if (pageNumber === 1) return 7
    if (pageNumber === 2) return 6
    return 15
  }
}

/**
 * Sync a single page's line count from API to database
 */
export async function syncPageFromAPI(pageNumber: number): Promise<number> {
  const totalLines = await fetchPageLinesFromAPI(pageNumber)

  await prisma.quranPage.upsert({
    where: { pageNumber },
    update: { totalLines },
    create: { pageNumber, totalLines }
  })

  return totalLines
}

/**
 * Sync multiple pages from API (batch)
 */
export async function syncPagesFromAPI(startPage: number, endPage: number): Promise<void> {
  console.log(`Syncing pages ${startPage} to ${endPage} from Quran.com API...`)

  for (let page = startPage; page <= endPage; page++) {
    await syncPageFromAPI(page)
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log(`Synced pages ${startPage} to ${endPage}`)
}

/**
 * Get total lines for a page from database
 * If page doesn't exist, fetches from API and caches
 */
export async function getPageTotalLines(pageNumber: number): Promise<number> {
  const page = await prisma.quranPage.findUnique({
    where: { pageNumber },
    select: { totalLines: true }
  })

  if (page) {
    return page.totalLines
  }

  // Page doesn't exist - fetch from API and cache
  return await syncPageFromAPI(pageNumber)
}

/**
 * Get or create QuranPage with line count from API
 */
export async function getOrCreateQuranPage(pageNumber: number) {
  let page = await prisma.quranPage.findUnique({
    where: { pageNumber }
  })

  if (!page) {
    // Fetch line count from API
    const totalLines = await fetchPageLinesFromAPI(pageNumber)

    page = await prisma.quranPage.create({
      data: {
        pageNumber,
        totalLines
      }
    })
  }

  return page
}

/**
 * Check if page is a "simple" page (7 or fewer lines)
 * Simple pages skip stages 1.2, 2.1, 2.2 and go directly from 1.1 to 3
 */
export async function isSimplePage(pageNumber: number): Promise<boolean> {
  const totalLines = await getPageTotalLines(pageNumber)
  return totalLines <= 7
}

/**
 * Get line range for a stage based on page's actual line count
 */
export async function getStageLineRangeFromDB(
  stage: string,
  pageNumber: number
): Promise<{ startLine: number; endLine: number }> {
  const totalLines = await getPageTotalLines(pageNumber)
  const firstHalfEnd = Math.min(7, totalLines)

  // For simple pages (<=7 lines), all stages use all lines
  if (totalLines <= 7) {
    return { startLine: 1, endLine: totalLines }
  }

  // For regular pages (15 lines)
  switch (stage) {
    case 'STAGE_1_1':
    case 'STAGE_1_2':
      return { startLine: 1, endLine: firstHalfEnd }
    case 'STAGE_2_1':
    case 'STAGE_2_2':
      return { startLine: 8, endLine: totalLines }
    case 'STAGE_3':
      return { startLine: 1, endLine: totalLines }
    default:
      return { startLine: 1, endLine: totalLines }
  }
}
