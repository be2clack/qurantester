import OpenAI from 'openai'

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured')
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
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
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  if (words.length === 0) return []

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
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini', // Cheaper and faster for translation
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
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
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
