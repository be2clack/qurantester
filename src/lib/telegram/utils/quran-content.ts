/**
 * Quran content helper for Telegram bot
 * Fetches content based on group's mushafType (LOCAL or MEDINA_API)
 */

import { prisma } from '@/lib/prisma'
import { MushafType } from '@prisma/client'
import {
  getPageVerses,
  getMedinaLines,
  getVerseTranslations,
  getChapterAudio,
  RUSSIAN_TRANSLATIONS,
} from '@/lib/quran-api'

export interface QuranLineContent {
  lineNumber: number
  textArabic: string | null
  textTajweed?: string | null
  translation?: string | null
  audioFileId?: string | null   // Telegram file_id (local DB)
  audioUrl?: string | null      // URL (Medina API)
  imageFileId?: string | null   // Telegram file_id (local DB)
  verseKeys?: string[]          // e.g., ['1:1', '1:2']
}

export interface QuranPageContent {
  pageNumber: number
  totalLines: number
  lines: QuranLineContent[]
  chapters?: {
    id: number
    nameArabic: string
    nameSimple: string
  }[]
  source: 'local' | 'medina_api'
}

export interface GroupMushafSettings {
  mushafType: MushafType
  showTranslation: boolean
  translationId: number | null
  showTafsir: boolean
  tafsirId: number | null
  reciterId: number | null
  showText: boolean
  showImage: boolean
  showAudio: boolean
}

/**
 * Get default mushaf settings
 */
export function getDefaultMushafSettings(): GroupMushafSettings {
  return {
    mushafType: MushafType.LOCAL,
    showTranslation: false,
    translationId: RUSSIAN_TRANSLATIONS.KULIEV,  // Default: Kuliev translation
    showTafsir: false,
    tafsirId: 170,  // Default: Tafsir as-Saadi
    reciterId: 7,   // Default: Mishary Rashid
    showText: true,
    showImage: false,
    showAudio: false,
  }
}

/**
 * Get mushaf settings for a group
 */
export async function getGroupMushafSettings(groupId: string): Promise<GroupMushafSettings> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      mushafType: true,
      showTranslation: true,
      translationId: true,
      showTafsir: true,
      tafsirId: true,
      reciterId: true,
      showText: true,
      showImage: true,
      showAudio: true,
    }
  })

  if (!group) {
    return getDefaultMushafSettings()
  }

  return {
    mushafType: group.mushafType,
    showTranslation: group.showTranslation,
    translationId: group.translationId,
    showTafsir: group.showTafsir,
    tafsirId: group.tafsirId,
    reciterId: group.reciterId,
    showText: group.showText,
    showImage: group.showImage,
    showAudio: group.showAudio,
  }
}

/**
 * Get Quran content for a specific line
 */
export async function getQuranLineContent(
  page: number,
  line: number,
  settings: GroupMushafSettings
): Promise<QuranLineContent | null> {
  const pageContent = await getQuranPageContent(page, settings)
  return pageContent.lines.find(l => l.lineNumber === line) || null
}

/**
 * Get Quran content for a line range
 */
export async function getQuranLinesContent(
  page: number,
  startLine: number,
  endLine: number,
  settings: GroupMushafSettings
): Promise<QuranLineContent[]> {
  const pageContent = await getQuranPageContent(page, settings)
  return pageContent.lines.filter(l => l.lineNumber >= startLine && l.lineNumber <= endLine)
}

/**
 * Get Quran content for a page based on mushaf type
 */
export async function getQuranPageContent(
  pageNumber: number,
  settings: GroupMushafSettings
): Promise<QuranPageContent> {
  if (settings.mushafType === MushafType.MEDINA_API) {
    return getMedinaPageContent(pageNumber, settings)
  }
  return getLocalPageContent(pageNumber, settings)
}

/**
 * Get content from local database
 */
async function getLocalPageContent(
  pageNumber: number,
  settings: GroupMushafSettings
): Promise<QuranPageContent> {
  const page = await prisma.quranPage.findUnique({
    where: { pageNumber },
    include: {
      lines: {
        orderBy: { lineNumber: 'asc' }
      }
    }
  })

  if (!page) {
    // Return empty page if not found
    return {
      pageNumber,
      totalLines: getDefaultLinesPerPage(pageNumber),
      lines: [],
      source: 'local'
    }
  }

  return {
    pageNumber,
    totalLines: page.totalLines,
    lines: page.lines.map(line => ({
      lineNumber: line.lineNumber,
      textArabic: settings.showText ? line.textArabic : null,
      textTajweed: line.textTajweed,
      audioFileId: settings.showAudio ? line.audioFileId : null,
      imageFileId: settings.showImage ? line.imageFileId : null,
    })),
    source: 'local'
  }
}

/**
 * Get content from Quran.com API (Medina mushaf)
 */
async function getMedinaPageContent(
  pageNumber: number,
  settings: GroupMushafSettings
): Promise<QuranPageContent> {
  try {
    // First get verses from API
    const response = await getPageVerses(pageNumber)
    // Then organize them into lines
    const lines = getMedinaLines(response.verses)

    // Fetch translations if enabled
    let translations: Record<string, string> = {}
    if (settings.showTranslation && settings.translationId) {
      const allVerseKeys = [...new Set(lines.flatMap(l => l.verseKeys))]
      if (allVerseKeys.length > 0) {
        const translationsResponse = await getVerseTranslations(allVerseKeys, settings.translationId)
        // Transform array to verse_key -> text record
        translations = translationsResponse.translations.reduce((acc, t) => {
          acc[t.verse_key] = t.text
          return acc
        }, {} as Record<string, string>)
      }
    }

    // Get chapters for this page (for context)
    const chapterIds = [...new Set(lines.flatMap(l =>
      l.verseKeys.map(vk => parseInt(vk.split(':')[0]))
    ))]

    return {
      pageNumber,
      totalLines: lines.length,
      lines: lines.map(line => {
        // Combine translations for all verses in this line
        const lineTranslation = settings.showTranslation
          ? line.verseKeys.map(vk => translations[vk]).filter(Boolean).join(' ')
          : null

        return {
          lineNumber: line.lineNumber,
          textArabic: settings.showText ? line.textArabic : null,
          textTajweed: line.textTajweed,
          translation: lineTranslation || null,
          verseKeys: line.verseKeys,
        }
      }),
      chapters: chapterIds.map(id => ({
        id,
        nameArabic: '',
        nameSimple: '',
      })),
      source: 'medina_api'
    }
  } catch (error) {
    console.error('Failed to fetch Medina page content:', error)
    // Fallback to local if API fails
    return getLocalPageContent(pageNumber, settings)
  }
}

/**
 * Get audio URL for a chapter (Medina API only)
 */
export async function getChapterAudioUrl(
  chapter: number,
  reciterId?: number | null
): Promise<string | null> {
  try {
    const audioData = await getChapterAudio(chapter, reciterId || 7)
    return audioData?.audio_file?.audio_url || null
  } catch (error) {
    console.error('Failed to get chapter audio:', error)
    return null
  }
}

/**
 * Format Quran content for Telegram message
 */
export function formatQuranLineForTelegram(
  line: QuranLineContent,
  showLineNumber: boolean = true
): string {
  let text = ''

  if (showLineNumber) {
    text += `${line.lineNumber}. `
  }

  if (line.textArabic) {
    text += line.textArabic
  }

  if (line.translation) {
    text += `\n📖 ${line.translation}`
  }

  if (line.verseKeys && line.verseKeys.length > 0) {
    text += `\n📍 ${line.verseKeys.join(', ')}`
  }

  return text
}

/**
 * Format multiple lines for Telegram message
 */
export function formatQuranLinesForTelegram(
  lines: QuranLineContent[],
  options: {
    showLineNumbers?: boolean
    showTranslation?: boolean
    showVerseKeys?: boolean
    maxLines?: number
  } = {}
): string {
  const {
    showLineNumbers = true,
    showTranslation = false,
    showVerseKeys = false,
    maxLines = 15
  } = options

  const linesToShow = lines.slice(0, maxLines)
  let text = ''

  for (const line of linesToShow) {
    if (showLineNumbers) {
      text += `${line.lineNumber}. `
    }

    if (line.textArabic) {
      text += line.textArabic
    }

    if (showTranslation && line.translation) {
      text += `\n   📖 ${line.translation}`
    }

    if (showVerseKeys && line.verseKeys && line.verseKeys.length > 0) {
      text += ` <code>[${line.verseKeys.join(', ')}]</code>`
    }

    text += '\n'
  }

  if (lines.length > maxLines) {
    text += `\n<i>...и ещё ${lines.length - maxLines} строк</i>`
  }

  return text.trim()
}

/**
 * Get default lines per page (for pages not in DB)
 */
function getDefaultLinesPerPage(pageNumber: number): number {
  if (pageNumber === 1) return 5
  if (pageNumber === 2) return 6
  return 15
}
