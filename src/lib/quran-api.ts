import { unstable_cache } from 'next/cache'

const QURAN_API_BASE = 'https://api.quran.com/api/v4'

// Cache times
const CONTENT_CACHE_TIME = 3600 // 1 hour for page content
const LIST_CACHE_TIME = 86400   // 24 hours for lists

// ============== Types ==============

export interface QuranWord {
  id: number
  position: number
  text_uthmani: string
  text_imlaei?: string
  line_number: number
  page_number: number
  translation?: {
    text: string
    language_name: string
  }
  transliteration?: {
    text: string
  }
}

export interface QuranVerse {
  id: number
  verse_number: number
  verse_key: string
  text_uthmani?: string
  text_imlaei?: string
  words?: QuranWord[]
  translations?: {
    resource_id: number
    text: string
  }[]
  page_number: number
  juz_number: number
  hizb_number: number
}

export interface PageVersesResponse {
  verses: QuranVerse[]
  pagination: {
    total_records: number
    current_page: number
    total_pages: number
  }
}

export interface TajweedVerse {
  id: number
  verse_key: string
  text_uthmani_tajweed: string
}

export interface Translation {
  id: number
  name: string
  author_name: string
  language_name: string
  translated_name: {
    name: string
    language_name: string
  }
}

export interface Tafsir {
  id: number
  name: string
  author_name?: string
  language_name: string
  translated_name: {
    name: string
    language_name: string
  }
}

export interface Recitation {
  id: number
  reciter_name: string
  style: string | null
  translated_name: {
    name: string
    language_name: string
  }
}

export interface Chapter {
  id: number
  revelation_place: string
  revelation_order: number
  bismillah_pre: boolean
  name_simple: string
  name_complex: string
  name_arabic: string
  verses_count: number
  pages: number[]
  translated_name: {
    language_name: string
    name: string
  }
}

export interface MedinaLine {
  lineNumber: number
  textArabic: string
  textTajweed?: string
  words: QuranWord[]
  verseKeys: string[]
}

// ============== API Functions ==============

/**
 * Get verses by page number with word-level details
 */
export const getPageVerses = unstable_cache(
  async (
    pageNumber: number,
    options?: {
      translationId?: number
      fields?: string[]
    }
  ): Promise<PageVersesResponse> => {
    const params = new URLSearchParams({
      words: 'true',
      word_fields: 'line_number,text_uthmani,text_imlaei,position',
      per_page: '50',
    })

    if (options?.translationId) {
      params.set('translations', options.translationId.toString())
    }

    if (options?.fields?.length) {
      params.set('fields', options.fields.join(','))
    }

    const response = await fetch(
      `${QURAN_API_BASE}/verses/by_page/${pageNumber}?${params}`,
      { next: { revalidate: CONTENT_CACHE_TIME } }
    )

    if (!response.ok) {
      throw new Error(`Quran API error: ${response.status}`)
    }

    return response.json()
  },
  ['quran-page-verses'],
  { revalidate: CONTENT_CACHE_TIME, tags: ['quran-content'] }
)

/**
 * Get Tajweed text for a page
 */
export const getTajweedText = unstable_cache(
  async (pageNumber: number): Promise<{ verses: TajweedVerse[] }> => {
    const response = await fetch(
      `${QURAN_API_BASE}/quran/verses/uthmani_tajweed?page_number=${pageNumber}`,
      { next: { revalidate: CONTENT_CACHE_TIME } }
    )

    if (!response.ok) {
      throw new Error(`Quran API error: ${response.status}`)
    }

    return response.json()
  },
  ['quran-page-tajweed'],
  { revalidate: CONTENT_CACHE_TIME, tags: ['quran-content'] }
)

/**
 * Get translation for specific verses
 */
export const getVerseTranslations = unstable_cache(
  async (
    verseKeys: string[],
    translationId: number
  ): Promise<{ translations: { resource_id: number; text: string; verse_key: string }[] }> => {
    // API accepts verse_key as query parameter
    const params = new URLSearchParams()
    verseKeys.forEach(key => params.append('verse_key', key))

    const response = await fetch(
      `${QURAN_API_BASE}/quran/translations/${translationId}?${params}`,
      { next: { revalidate: CONTENT_CACHE_TIME } }
    )

    if (!response.ok) {
      throw new Error(`Quran API error: ${response.status}`)
    }

    return response.json()
  },
  ['quran-translations'],
  { revalidate: CONTENT_CACHE_TIME, tags: ['quran-content'] }
)

/**
 * Get tafsir for a specific verse
 */
export const getTafsir = unstable_cache(
  async (
    verseKey: string,
    tafsirId: number
  ): Promise<{ tafsir: { text: string; verse_key: string } }> => {
    const response = await fetch(
      `${QURAN_API_BASE}/tafsirs/${tafsirId}/by_ayah/${verseKey}`,
      { next: { revalidate: CONTENT_CACHE_TIME } }
    )

    if (!response.ok) {
      throw new Error(`Quran API error: ${response.status}`)
    }

    return response.json()
  },
  ['quran-tafsir'],
  { revalidate: CONTENT_CACHE_TIME, tags: ['quran-content'] }
)

/**
 * Get audio URL for a chapter
 */
export const getChapterAudio = unstable_cache(
  async (
    chapterNumber: number,
    reciterId: number
  ): Promise<{ audio_file: { audio_url: string; format: string; duration: number } }> => {
    const response = await fetch(
      `${QURAN_API_BASE}/chapter_recitations/${reciterId}/${chapterNumber}`,
      { next: { revalidate: CONTENT_CACHE_TIME } }
    )

    if (!response.ok) {
      throw new Error(`Quran API error: ${response.status}`)
    }

    return response.json()
  },
  ['quran-audio'],
  { revalidate: CONTENT_CACHE_TIME, tags: ['quran-content'] }
)

/**
 * Get list of all chapters with page info
 */
export const getChaptersList = unstable_cache(
  async (): Promise<{ chapters: Chapter[] }> => {
    const response = await fetch(
      `${QURAN_API_BASE}/chapters`,
      { next: { revalidate: LIST_CACHE_TIME } }
    )

    if (!response.ok) {
      throw new Error(`Quran API error: ${response.status}`)
    }

    return response.json()
  },
  ['quran-chapters-list'],
  { revalidate: LIST_CACHE_TIME, tags: ['quran-lists'] }
)

/**
 * Get list of available translations
 */
export const getTranslationsList = unstable_cache(
  async (): Promise<{ translations: Translation[] }> => {
    const response = await fetch(
      `${QURAN_API_BASE}/resources/translations`,
      { next: { revalidate: LIST_CACHE_TIME } }
    )

    if (!response.ok) {
      throw new Error(`Quran API error: ${response.status}`)
    }

    return response.json()
  },
  ['quran-translations-list'],
  { revalidate: LIST_CACHE_TIME, tags: ['quran-lists'] }
)

/**
 * Get list of available tafsirs
 */
export const getTafsirsList = unstable_cache(
  async (): Promise<{ tafsirs: Tafsir[] }> => {
    const response = await fetch(
      `${QURAN_API_BASE}/resources/tafsirs`,
      { next: { revalidate: LIST_CACHE_TIME } }
    )

    if (!response.ok) {
      throw new Error(`Quran API error: ${response.status}`)
    }

    return response.json()
  },
  ['quran-tafsirs-list'],
  { revalidate: LIST_CACHE_TIME, tags: ['quran-lists'] }
)

/**
 * Get list of available reciters
 */
export const getRecitersList = unstable_cache(
  async (): Promise<{ recitations: Recitation[] }> => {
    const response = await fetch(
      `${QURAN_API_BASE}/resources/recitations`,
      { next: { revalidate: LIST_CACHE_TIME } }
    )

    if (!response.ok) {
      throw new Error(`Quran API error: ${response.status}`)
    }

    return response.json()
  },
  ['quran-reciters-list'],
  { revalidate: LIST_CACHE_TIME, tags: ['quran-lists'] }
)

// ============== Helper Functions ==============

/**
 * Organize verses into lines by line_number (for Medina Mushaf display)
 */
export function organizeVersesByLine(verses: QuranVerse[]): Map<number, { words: QuranWord[]; verseKeys: string[] }> {
  const lineMap = new Map<number, { words: QuranWord[]; verseKeys: Set<string> }>()

  for (const verse of verses) {
    for (const word of verse.words || []) {
      const lineNum = word.line_number
      if (!lineMap.has(lineNum)) {
        lineMap.set(lineNum, { words: [], verseKeys: new Set() })
      }
      const line = lineMap.get(lineNum)!
      line.words.push(word)
      line.verseKeys.add(verse.verse_key)
    }
  }

  // Convert Sets to arrays and sort words by position
  const result = new Map<number, { words: QuranWord[]; verseKeys: string[] }>()
  lineMap.forEach((value, key) => {
    result.set(key, {
      words: value.words.sort((a, b) => a.position - b.position),
      verseKeys: Array.from(value.verseKeys),
    })
  })

  return result
}

/**
 * Get Medina lines from page verses
 */
export function getMedinaLines(verses: QuranVerse[]): MedinaLine[] {
  const linesByNumber = organizeVersesByLine(verses)

  return Array.from(linesByNumber.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([lineNumber, { words, verseKeys }]) => ({
      lineNumber,
      textArabic: words.map(w => w.text_uthmani).join(' '),
      words,
      verseKeys,
    }))
}

/**
 * Find which chapter(s) a page belongs to
 */
export async function getChaptersForPage(pageNumber: number): Promise<Chapter[]> {
  const { chapters } = await getChaptersList()

  return chapters.filter(chapter => {
    const [startPage, endPage] = chapter.pages
    return pageNumber >= startPage && pageNumber <= endPage
  })
}

/**
 * Get Russian translations list
 */
export async function getRussianTranslations(): Promise<Translation[]> {
  const { translations } = await getTranslationsList()
  return translations.filter(t => t.language_name === 'russian')
}

/**
 * Get Russian tafsirs list
 */
export async function getRussianTafsirs(): Promise<Tafsir[]> {
  const { tafsirs } = await getTafsirsList()
  return tafsirs.filter(t => t.language_name === 'russian')
}

// ============== Constants ==============

export const RUSSIAN_TRANSLATIONS = {
  KULIEV: 45,
  ABU_ADEL: 79,
  MINISTRY_AWQAF: 78,
} as const

export const RUSSIAN_TAFSIRS = {
  SAADI: 170,
} as const

export const POPULAR_RECITERS = {
  MISHARY: 7,
  ABDUL_BASIT_MUJAWWAD: 1,
  ABDUL_BASIT_MURATTAL: 2,
  SUDAIS: 3,
  HUSARY: 6,
  HUSARY_MUALLIM: 12,
  MINSHAWI: 8,
  AFASY: 7,
} as const

export const MEDINA_MUSHAF = {
  TOTAL_PAGES: 604,
  LINES_PER_PAGE: 15,
  PAGE_1_LINES: 7,  // Al-Fatiha special layout
  PAGE_2_LINES: 7,  // Al-Fatiha special layout
} as const
