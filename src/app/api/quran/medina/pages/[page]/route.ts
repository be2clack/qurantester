import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { translateWordsToRussian } from '@/lib/openai'
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
    const includeWords = searchParams.get('words') === 'true'

    // Fetch page data in parallel
    const [versesData, tajweedData, chapters] = await Promise.all([
      getPageVerses(pageNumber, {
        translationId: translationId ? parseInt(translationId) : undefined,
        wordTranslationLanguage: includeWords ? 'en' : undefined, // Get English from API
      }),
      includeTajweed ? getTajweedText(pageNumber) : null,
      includeChapters ? getChaptersForPage(pageNumber) : null,
    ])

    // Organize verses by line number
    const lines = getMedinaLines(versesData.verses)

    // Get Russian translations from our DB if words are included
    if (includeWords) {
      try {
        // Collect all word keys from verses
        const allWords: Array<{
          wordKey: string
          surahNumber: number
          ayahNumber: number
          position: number
          textArabic: string
          translationEn?: string
        }> = []

        for (const verse of versesData.verses) {
          if (verse.words) {
            const [surah, ayah] = verse.verse_key.split(':').map(Number)
            for (const word of verse.words) {
              if (word.char_type_name === 'word') {
                const wordKey = `${surah}:${ayah}:${word.position}`
                allWords.push({
                  wordKey,
                  surahNumber: surah,
                  ayahNumber: ayah,
                  position: word.position,
                  textArabic: word.text_uthmani,
                  translationEn: word.translation?.text,
                })
              }
            }
          }
        }

        // Get existing translations from DB
        const wordKeys = allWords.map(w => w.wordKey)
        const existingTranslations = await prisma.wordTranslation.findMany({
          where: { wordKey: { in: wordKeys } },
          select: { wordKey: true, translationRu: true }
        })
        const translationMap = new Map(existingTranslations.map(t => [t.wordKey, t.translationRu]))

        // Find words without Russian translations
        const needTranslation = allWords.filter(w => !translationMap.get(w.wordKey))

        // Auto-generate translations if OpenAI is configured
        if (needTranslation.length > 0 && process.env.OPENAI_API_KEY) {
          try {
            // Save words to DB first
            for (const word of needTranslation) {
              await prisma.wordTranslation.upsert({
                where: { wordKey: word.wordKey },
                update: { translationEn: word.translationEn },
                create: {
                  wordKey: word.wordKey,
                  surahNumber: word.surahNumber,
                  ayahNumber: word.ayahNumber,
                  position: word.position,
                  textArabic: word.textArabic,
                  translationEn: word.translationEn,
                }
              })
            }

            // Generate Russian translations (batch by 20)
            const batchSize = 20
            for (let i = 0; i < needTranslation.length; i += batchSize) {
              const batch = needTranslation.slice(i, i + batchSize)
              const translations = await translateWordsToRussian(
                batch.map(w => ({
                  wordKey: w.wordKey,
                  textArabic: w.textArabic,
                  translationEn: w.translationEn,
                }))
              )

              // Save to DB and update map
              for (const t of translations) {
                await prisma.wordTranslation.update({
                  where: { wordKey: t.wordKey },
                  data: { translationRu: t.translationRu, aiGenerated: true, aiModel: 'gpt-4o-mini' }
                })
                translationMap.set(t.wordKey, t.translationRu)
              }
            }
          } catch (aiError) {
            console.error('Auto-translation error:', aiError)
          }
        }

        // Apply Russian translations to lines
        for (const line of lines) {
          for (const word of line.words) {
            // Find the word key based on verse_key and position
            // word has: text_uthmani, position, line_number
            // We need to match it with the correct verse
            for (const verseKey of line.verseKeys) {
              const [surah, ayah] = verseKey.split(':').map(Number)
              const wordKey = `${surah}:${ayah}:${word.position}`
              const ruTranslation = translationMap.get(wordKey)
              if (ruTranslation) {
                // Replace or add Russian translation
                word.translation = {
                  text: ruTranslation,
                  language_name: 'russian'
                }
                break
              }
            }
          }
        }
      } catch (translationError) {
        // WordTranslation table may not exist yet - continue without Russian translations
        console.error('Word translation lookup error (table may not exist):', translationError)
      }
    }

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
