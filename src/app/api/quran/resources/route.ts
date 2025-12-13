import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  getTranslationsList,
  getTafsirsList,
  getRecitersList,
  RUSSIAN_TRANSLATIONS,
  RUSSIAN_TAFSIRS,
  POPULAR_RECITERS,
} from '@/lib/quran-api'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all resources in parallel
    const [translationsData, tafsirsData, recitersData] = await Promise.all([
      getTranslationsList(),
      getTafsirsList(),
      getRecitersList(),
    ])

    // Filter Russian translations
    const russianTranslations = translationsData.translations
      .filter(t => t.language_name === 'russian')
      .map(t => ({
        id: t.id,
        name: t.name,
        author: t.author_name,
        isDefault: t.id === RUSSIAN_TRANSLATIONS.KULIEV,
      }))

    // Filter Russian tafsirs
    const russianTafsirs = tafsirsData.tafsirs
      .filter(t => t.language_name === 'russian')
      .map(t => ({
        id: t.id,
        name: t.name,
        author: t.author_name,
        isDefault: t.id === RUSSIAN_TAFSIRS.SAADI,
      }))

    // Format reciters with popular ones marked
    const popularReciterIds = Object.values(POPULAR_RECITERS) as number[]
    const reciters = recitersData.recitations.map(r => ({
      id: r.id,
      name: r.reciter_name,
      style: r.style,
      isPopular: popularReciterIds.includes(r.id),
      isDefault: r.id === POPULAR_RECITERS.MISHARY,
    }))

    // Sort reciters: popular first
    reciters.sort((a, b) => {
      if (a.isPopular && !b.isPopular) return -1
      if (!a.isPopular && b.isPopular) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      translations: {
        all: translationsData.translations.map(t => ({
          id: t.id,
          name: t.name,
          author: t.author_name,
          language: t.language_name,
        })),
        russian: russianTranslations,
        defaults: RUSSIAN_TRANSLATIONS,
      },
      tafsirs: {
        all: tafsirsData.tafsirs.map(t => ({
          id: t.id,
          name: t.name,
          author: t.author_name,
          language: t.language_name,
        })),
        russian: russianTafsirs,
        defaults: RUSSIAN_TAFSIRS,
      },
      reciters: {
        all: reciters,
        popular: reciters.filter(r => r.isPopular),
        defaults: POPULAR_RECITERS,
      },
    })
  } catch (error) {
    console.error('Get resources error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Quran resources' },
      { status: 500 }
    )
  }
}
