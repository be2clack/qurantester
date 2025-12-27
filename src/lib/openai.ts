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
 * Clean translation text - remove punctuation, quotes, extra spaces
 * Keep only the first word/phrase
 */
function cleanTranslation(text: string): string {
  if (!text) return ''

  // Remove quotes, parentheses, and common punctuation
  let cleaned = text
    .replace(/["""''«»()[\]{}]/g, '')
    .replace(/[.,;:!?…]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // If there's a dash or slash, take just the first part
  if (cleaned.includes(' - ')) {
    cleaned = cleaned.split(' - ')[0].trim()
  }
  if (cleaned.includes(' / ')) {
    cleaned = cleaned.split(' / ')[0].trim()
  }

  return cleaned
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
        content: 'Ты переводчик Корана. Дай краткий перевод слова на русский - ТОЛЬКО ОДНО СЛОВО, без знаков препинания, кавычек, скобок. Если нужно несколько слов для смысла - максимум 2 слова.'
      },
      {
        role: 'user',
        content: `Переведи на русский: "${textArabic}"${translationEn ? ` (англ: ${translationEn})` : ''}`
      }
    ],
    temperature: 0.3,
    max_tokens: 30,
  })

  const raw = response.choices[0]?.message?.content?.trim() || ''
  return cleanTranslation(raw)
}

/**
 * Batch translate multiple words (for mass import)
 * More efficient than single-word calls
 */
export async function translateWordsBatch(
  words: Array<{ wordKey: string; textArabic: string; translationEn?: string }>
): Promise<Array<{ wordKey: string; translationRu: string }>> {
  if (words.length === 0) return []

  const { client, model } = await createOpenAIClient()

  // Build compact prompt
  const wordsText = words
    .map((w, i) => `${i + 1}. ${w.textArabic}${w.translationEn ? ` (${w.translationEn})` : ''}`)
    .join('\n')

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `Ты переводчик Корана. Переводи каждое слово на русский ОДНИМ СЛОВОМ без знаков препинания. Используй коранические термины. Ответь в формате JSON: {"translations": [{"i": 1, "ru": "слово"}, ...]}`
      },
      {
        role: 'user',
        content: `Переведи слова:\n${wordsText}`
      }
    ],
    temperature: 0.3,
    max_tokens: words.length * 20,
    response_format: { type: 'json_object' }
  })

  const content = response.choices[0]?.message?.content
  if (!content) return []

  try {
    const parsed = JSON.parse(content)
    const translations = parsed.translations || []

    return translations.map((t: { i: number; ru: string }) => ({
      wordKey: words[t.i - 1]?.wordKey || '',
      translationRu: cleanTranslation(t.ru)
    })).filter((t: { wordKey: string; translationRu: string }) => t.wordKey)
  } catch (e) {
    console.error('Failed to parse GPT batch response:', e)
    return []
  }
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

interface WordWithContext {
  wordKey: string // "surah:ayah:position"
  textArabic: string
  translationEn?: string
  ayahKey: string // "surah:ayah" for grouping
}

interface AyahTranslation {
  ayahKey: string
  translationRu: string // Kuliev translation
}

/**
 * Translate words with full context awareness
 * Uses Kuliev's verse translation to understand context
 * and produce accurate word-level translations
 */
export async function translateWordsWithContext(
  words: WordWithContext[],
  ayahTranslations: AyahTranslation[]
): Promise<Array<{ wordKey: string; translationRu: string }>> {
  if (words.length === 0) return []

  const { client, model } = await createOpenAIClient()

  // Group words by ayah
  const wordsByAyah = words.reduce((acc, word) => {
    if (!acc[word.ayahKey]) acc[word.ayahKey] = []
    acc[word.ayahKey].push(word)
    return acc
  }, {} as Record<string, WordWithContext[]>)

  // Create translation map
  const translationMap = ayahTranslations.reduce((acc, t) => {
    acc[t.ayahKey] = t.translationRu
    return acc
  }, {} as Record<string, string>)

  // Build comprehensive prompt with context
  let promptContent = ''
  for (const [ayahKey, ayahWords] of Object.entries(wordsByAyah)) {
    const kulievTranslation = translationMap[ayahKey] || ''

    promptContent += `\n=== Аят ${ayahKey} ===\n`
    if (kulievTranslation) {
      promptContent += `Перевод аята (Кулиев): "${kulievTranslation}"\n`
    }
    promptContent += `Слова:\n`

    for (const word of ayahWords) {
      promptContent += `- ${word.wordKey}: "${word.textArabic}"${word.translationEn ? ` (англ: ${word.translationEn})` : ''}\n`
    }
  }

  const systemPrompt = `Ты профессиональный переводчик Корана. Твоя задача - перевести арабские слова на русский язык С УЧЁТОМ КОНТЕКСТА.

ВАЖНЫЕ ПРАВИЛА:
1. Для каждого слова дан перевод аята по Кулиеву - используй его как контекст для точного перевода слов
2. Переводи каждое слово 1-2 словами максимум (кратко!)
3. Используй тот же смысл что в переводе Кулиева где возможно
4. Используй традиционные исламские термины (Аллах, намаз, закят и т.д.)
5. Не добавляй знаки препинания, кавычки или скобки

ФОРМАТ ОТВЕТА - JSON:
{
  "translations": [
    {"key": "1:1:1", "ru": "перевод"},
    {"key": "1:1:2", "ru": "перевод"}
  ]
}`

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Переведи слова с учётом контекста:\n${promptContent}` }
      ],
      temperature: 0.2, // Lower for more consistent context-aware translations
      max_tokens: words.length * 25,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) return []

    const parsed = JSON.parse(content)
    const translations = parsed.translations || []

    return translations.map((t: { key: string; ru: string }) => ({
      wordKey: t.key,
      translationRu: cleanTranslation(t.ru)
    })).filter((t: { wordKey: string; translationRu: string }) => t.wordKey && t.translationRu)
  } catch (error) {
    console.error('Context-aware translation error:', error)
    return []
  }
}

/**
 * Batch translate with context for large imports
 * Processes in smaller chunks to avoid token limits
 */
export async function translateBatchWithContext(
  words: WordWithContext[],
  ayahTranslations: AyahTranslation[],
  chunkSize: number = 30
): Promise<Array<{ wordKey: string; translationRu: string }>> {
  const results: Array<{ wordKey: string; translationRu: string }> = []

  // Process in chunks
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize)

    // Get unique ayah keys for this chunk
    const ayahKeys = [...new Set(chunk.map(w => w.ayahKey))]
    const relevantTranslations = ayahTranslations.filter(t => ayahKeys.includes(t.ayahKey))

    const chunkResults = await translateWordsWithContext(chunk, relevantTranslations)
    results.push(...chunkResults)

    // Small delay between chunks to avoid rate limits
    if (i + chunkSize < words.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  return results
}
