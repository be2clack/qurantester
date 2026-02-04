import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface QuranVerse {
  verse_key: string  // "2:5" format
  page_number: number
}

interface QuranAPIResponse {
  verses: QuranVerse[]
  pagination: {
    total_pages: number
    current_page: number
    next_page: number | null
  }
}

/**
 * Fetch verses for a specific page from quran.com API
 */
async function fetchVersesForPage(page: number): Promise<{ surah: number; ayah: number }[]> {
  const url = `https://api.quran.com/api/v4/verses/by_page/${page}?per_page=50`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`Failed to fetch page ${page}: ${response.status}`)
      return []
    }

    const data: QuranAPIResponse = await response.json()

    return data.verses.map(v => {
      const [surah, ayah] = v.verse_key.split(':').map(Number)
      return { surah, ayah }
    })
  } catch (error) {
    console.error(`Error fetching page ${page}:`, error)
    return []
  }
}

/**
 * Update WordTranslation records with page numbers
 */
async function updateWordPages() {
  console.log('🔄 Updating word page numbers...\n')

  const TOTAL_PAGES = 604
  let totalUpdated = 0
  let processedPages = 0

  // Process in batches of 10 pages
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const verses = await fetchVersesForPage(page)

    if (verses.length === 0) {
      console.log(`Page ${page}: No verses found`)
      continue
    }

    // Update all words for these verses
    for (const verse of verses) {
      const result = await prisma.wordTranslation.updateMany({
        where: {
          surahNumber: verse.surah,
          ayahNumber: verse.ayah,
          pageNumber: null  // Only update if not already set
        },
        data: {
          pageNumber: page
        }
      })

      totalUpdated += result.count
    }

    processedPages++

    // Progress update every 50 pages
    if (page % 50 === 0) {
      console.log(`Progress: ${page}/${TOTAL_PAGES} pages, ${totalUpdated} words updated`)
    }

    // Rate limiting - 100ms delay between requests
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log(`\n✅ Done! Updated ${totalUpdated} words across ${processedPages} pages.`)

  // Verify
  const withPage = await prisma.wordTranslation.count({ where: { pageNumber: { not: null } } })
  const withoutPage = await prisma.wordTranslation.count({ where: { pageNumber: null } })

  console.log(`\nVerification:`)
  console.log(`  Words with pageNumber: ${withPage}`)
  console.log(`  Words without pageNumber: ${withoutPage}`)
}

updateWordPages()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
