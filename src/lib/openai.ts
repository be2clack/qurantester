import OpenAI from 'openai'
import { prisma } from './prisma'

// Cache for settings to avoid DB calls on every request
let cachedApiKey: string | null = null
let cachedModel: string = 'gpt-4o-mini'
let cacheExpiry: number = 0
const CACHE_TTL = 60000 // 1 minute cache

/**
 * Get OpenAI settings from DB or env vars
 */
async function getOpenAISettings(): Promise<{ apiKey: string; model: string }> {
  // Return cached if valid
  if (cachedApiKey && Date.now() < cacheExpiry) {
    return { apiKey: cachedApiKey, model: cachedModel }
  }

  // Try to get from DB first
  try {
    const settings = await prisma.systemSettings.findMany({
      where: {
        key: { in: ['OPENAI_API_KEY', 'OPENAI_MODEL'] }
      }
    })

    const dbApiKey = settings.find(s => s.key === 'OPENAI_API_KEY')?.value
    const dbModel = settings.find(s => s.key === 'OPENAI_MODEL')?.value

    // Use DB values if available, otherwise fall back to env vars
    const apiKey = dbApiKey || process.env.OPENAI_API_KEY
    const model = dbModel || 'gpt-4o-mini'

    if (apiKey) {
      cachedApiKey = apiKey
      cachedModel = model
      cacheExpiry = Date.now() + CACHE_TTL
      return { apiKey, model }
    }
  } catch (error) {
    // If DB lookup fails (e.g., table doesn't exist), fall back to env vars
    console.error('Failed to get OpenAI settings from DB:', error)
  }

  // Fallback to env vars only
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  cachedApiKey = apiKey
  cachedModel = 'gpt-4o-mini'
  cacheExpiry = Date.now() + CACHE_TTL

  return { apiKey, model: cachedModel }
}

/**
 * Create OpenAI client with current settings
 */
async function createOpenAIClient(): Promise<{ client: OpenAI; model: string }> {
  const { apiKey, model } = await getOpenAISettings()
  return {
    client: new OpenAI({ apiKey }),
    model
  }
}

interface WordToTranslate {
  wordKey: string // "surah:ayah:position"
  textArabic: string
  translationEn?: string // English translation for context
}

interface TranslatedWord {
  wordKey: string
  translationRu: string
}

/**
 * Translate Quran words from Arabic to Russian using ChatGPT
 * We batch words to minimize API calls
 */
export async function translateWordsToRussian(
  words: WordToTranslate[]
): Promise<TranslatedWord[]> {
  if (words.length === 0) return []

  const { client, model } = await createOpenAIClient()

  // Build prompt with words to translate
  const wordsText = words
    .map((w, i) => `${i + 1}. "${w.textArabic}" (англ: ${w.translationEn || 'нет'})`)
    .join('\n')

  const prompt = `Переведи следующие слова из Корана на русский язык.
Дай только перевод каждого слова, коротко (1-3 слова максимум).
Учитывай контекст Корана - используй традиционные исламские термины где уместно.

Слова для перевода:
${wordsText}

Формат ответа - JSON массив:
[{"index": 1, "ru": "перевод"}, {"index": 2, "ru": "перевод"}, ...]`

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'Ты переводчик Корана. Переводи слова кратко и точно на русский.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lower for more consistent translations
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from OpenAI')
    }

    // Parse JSON response
    const parsed = JSON.parse(content)
    const translations = parsed.translations || parsed

    // Map back to word keys
    const result: TranslatedWord[] = []
    for (const item of translations) {
      const idx = item.index - 1
      if (idx >= 0 && idx < words.length) {
        result.push({
          wordKey: words[idx].wordKey,
          translationRu: item.ru
        })
      }
    }

    return result
  } catch (error) {
    console.error('OpenAI translation error:', error)
    throw error
  }
}

/**
 * Translate a single word (for admin corrections or one-off translations)
 */
export async function translateSingleWord(
  textArabic: string,
  translationEn?: string
): Promise<string> {
  const { client, model } = await createOpenAIClient()

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'Ты переводчик Корана. Дай краткий перевод слова на русский (1-3 слова).'
      },
      {
        role: 'user',
        content: `Переведи на русский: "${textArabic}"${translationEn ? ` (англ: ${translationEn})` : ''}`
      }
    ],
    temperature: 0.3,
    max_tokens: 50,
  })

  return response.choices[0]?.message?.content?.trim() || ''
}

/**
 * Check if OpenAI is configured
 */
export async function isOpenAIConfigured(): Promise<boolean> {
  try {
    await getOpenAISettings()
    return true
  } catch {
    return false
  }
}
