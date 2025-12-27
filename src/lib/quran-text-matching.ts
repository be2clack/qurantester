/**
 * Quran Text Matching Utilities
 * Handles Uthmani vs Modern Arabic differences for Whisper transcription comparison
 */

import OpenAI from 'openai'
import { prisma } from './prisma'

/**
 * Known Uthmani ↔ Modern Arabic word mappings
 * Uthmani script (Quran.com) vs what Whisper typically transcribes
 */
export const UTHMANI_MODERN_WHITELIST: Record<string, string[]> = {
  // Alef differences (الرحمان vs الرحمن)
  'الرحمان': ['الرحمن', 'رحمن', 'الرحمان'],
  'العالمين': ['العلمين', 'عالمين', 'علمين'],
  'الصراط': ['السراط', 'صراط', 'سراط'],
  'ابراهيم': ['إبراهيم', 'ابراهيم'],
  'اسماعيل': ['إسماعيل', 'اسمعيل', 'إسمعيل'],
  'اسحاق': ['إسحاق', 'اسحق', 'إسحق'],
  'الملائكة': ['الملئكة', 'ملائكة', 'ملئكة'],
  'لااله': ['لا إله', 'لا اله', 'لاإله'],

  // Hamza variations
  'السماء': ['السما', 'سماء', 'سما'],
  'الماء': ['الما', 'ماء', 'ما'],
  'الدعاء': ['الدعا', 'دعاء', 'دعا'],
  'البلاء': ['البلا', 'بلاء', 'بلا'],
  'الشفاء': ['الشفا', 'شفاء', 'شفا'],

  // Taa marbuta/haa variations
  'الصلاة': ['الصلوة', 'صلاة', 'صلوة'],
  'الزكاة': ['الزكوة', 'زكاة', 'زكوة'],
  'الحياة': ['الحيوة', 'حياة', 'حيوة'],

  // Common Quranic words with spelling variations
  'اياك': ['إياك', 'اياك'],
  'انعمت': ['أنعمت', 'انعمت'],
  'المغضوب': ['المغضوب', 'مغضوب'],
  'الضالين': ['الضآلين', 'ضالين', 'الظالين'],

  // Surah Al-Baqarah common words
  'الم': ['الم', 'ألم'],
  'الكتاب': ['الكتب', 'كتاب'],
  'المتقين': ['المتقين', 'متقين'],
  'الغيب': ['الغيب', 'غيب'],
  'المفلحون': ['المفلحون', 'مفلحون'],

  // Words with waaw/alef variations
  'ادا': ['إذا', 'اذا'],
  'هاؤلاء': ['هؤلاء', 'هولاء'],
  'اولائك': ['أولئك', 'اولئك', 'أولاءك'],

  // Sun letters assimilation (Whisper may not capture)
  'الناس': ['الناس', 'ناس'],
  'النار': ['النار', 'نار'],
  'الليل': ['الليل', 'ليل'],
  'النور': ['النور', 'نور'],
  'الرحمن': ['الرحمن', 'رحمن'],
  'الرحيم': ['الرحيم', 'رحيم'],
  'الرب': ['الرب', 'رب'],

  // Common short words that Whisper might merge or split
  'في': ['فى', 'في'],
  'على': ['علي', 'على'],
  'الى': ['إلى', 'الي', 'إلي'],
  'من': ['من', 'مِن'],
  'ما': ['ما', 'مَا'],
  'لا': ['لا', 'لآ'],
  'الا': ['إلا', 'الا', 'إلّا'],

  // Quran-specific terms
  'القران': ['القرءان', 'قرآن', 'القرآن'],
  'الايات': ['الآيات', 'ايات', 'آيات'],
  'يايها': ['يا أيها', 'ياأيها', 'يأيها'],
}

/**
 * Get OpenAI client with API key from database
 */
async function getOpenAIClient(): Promise<OpenAI | null> {
  const apiKeySetting = await prisma.systemSettings.findUnique({
    where: { key: 'OPENAI_API_KEY' }
  })

  if (!apiKeySetting?.value) return null

  return new OpenAI({ apiKey: apiKeySetting.value })
}

/**
 * Check if two words match using whitelist
 */
export function matchWithWhitelist(uthmaniWord: string, transcriptWord: string): boolean {
  // Direct match
  if (uthmaniWord === transcriptWord) return true

  // Check whitelist
  const variations = UTHMANI_MODERN_WHITELIST[uthmaniWord]
  if (variations && variations.includes(transcriptWord)) return true

  // Check reverse (transcript might be the key)
  for (const [key, values] of Object.entries(UTHMANI_MODERN_WHITELIST)) {
    if (values.includes(uthmaniWord) && (key === transcriptWord || values.includes(transcriptWord))) {
      return true
    }
  }

  return false
}

/**
 * Normalize Arabic for comparison (removes diacritics, normalizes characters)
 */
export function normalizeArabicForComparison(text: string): string {
  return text
    .replace(/[\u064B-\u065F]/g, '')  // Remove tashkeel
    .replace(/[\u0610-\u061A]/g, '')  // Arabic signs
    .replace(/[\u06D6-\u06DC]/g, '')  // Small ligatures
    .replace(/[\u06DF-\u06E4]/g, '')  // More marks
    .replace(/[\u06E7-\u06E8]/g, '')  // Small yeh/noon
    .replace(/[\u06EA-\u06ED]/g, '')  // More marks
    .replace(/\u0670/g, '\u0627')     // Superscript alef
    .replace(/\u0671/g, '\u0627')     // Alef wasla
    .replace(/[\u0622\u0623\u0625\u0627]/g, '\u0627') // Normalize alef
    .replace(/[\u0624\u0626]/g, '\u0621') // Normalize hamza
    .replace(/\u0629/g, '\u0647')     // Teh marbuta to heh
    .replace(/\u0649/g, '\u064A')     // Alef maksura to yeh
    .replace(/\u0640/g, '')           // Remove tatweel
    .replace(/[\u06DD]/g, '')         // Verse markers
    .replace(/[\u0660-\u0669]/g, '')  // Arabic-Indic numerals
    .replace(/[\u06F0-\u06F9]/g, '')  // Extended numerals
    .replace(/[0-9]/g, '')            // Regular digits
    .replace(/[،؛؟]/g, '')            // Punctuation
    .trim()
}

export interface GPTAnalysisResult {
  score: number
  errors: Array<{
    word: string
    position?: number
    issue: string
    type: 'missing' | 'wrong' | 'extra'
  }>
  analysis?: string
}

/**
 * Analyze transcript vs expected text using GPT-4o-mini
 * More intelligent analysis that understands Quran recitation context
 */
export async function analyzeWithGPT(
  transcript: string,
  expectedText: string,
  options?: {
    hafzLevel?: number  // 1=lenient, 2=medium, 3=strict
    surahInfo?: string
  }
): Promise<GPTAnalysisResult | null> {
  const openai = await getOpenAIClient()
  if (!openai) {
    console.warn('[GPT Analysis] OpenAI client not available')
    return null
  }

  const hafzLevel = options?.hafzLevel || 1
  const strictnessDesc = hafzLevel === 1 ? 'мягкий (допускаются небольшие отклонения)' :
                         hafzLevel === 2 ? 'средний' :
                         'строгий (требуется точное соответствие)'

  const systemPrompt = `Ты эксперт по чтению Корана. Твоя задача - сравнить транскрипцию речи с ожидаемым текстом Корана.

ВАЖНЫЕ ПРАВИЛА:
1. Усмани скрипт vs современный арабский - это ОДНО И ТО ЖЕ слово:
   - الرحمان = الرحمن (оба правильно)
   - العالمين = العلمين (оба правильно)
   - الصراط = السراط (оба правильно)

2. Пропуск "ال" в слитной речи - НЕ ошибка (Whisper часто не слышит hamza wasl)

3. Мелкие фонетические различия при сохранении смысла - НЕ критичны на мягком уровне

4. Уровень строгости: ${strictnessDesc}

Ответь ТОЛЬКО валидным JSON без markdown:
{
  "score": <число 0-100>,
  "errors": [
    {"word": "<слово>", "issue": "<краткое описание на русском>", "type": "missing|wrong|extra"}
  ],
  "analysis": "<краткий анализ на русском, 1-2 предложения>"
}`

  const userPrompt = `Ожидаемый текст (Усмани):
${expectedText}

Транскрипция Whisper:
${transcript}

${options?.surahInfo ? `Контекст: ${options.surahInfo}` : ''}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 500,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      console.error('[GPT Analysis] Empty response')
      return null
    }

    // Parse JSON response
    try {
      // Clean potential markdown wrapper
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const result = JSON.parse(cleanContent) as GPTAnalysisResult

      // Validate structure
      if (typeof result.score !== 'number' || !Array.isArray(result.errors)) {
        console.error('[GPT Analysis] Invalid response structure:', result)
        return null
      }

      console.log(`[GPT Analysis] Score: ${result.score}%, Errors: ${result.errors.length}`)
      return result
    } catch (parseError) {
      console.error('[GPT Analysis] Failed to parse response:', content, parseError)
      return null
    }
  } catch (error) {
    console.error('[GPT Analysis] API error:', error)
    return null
  }
}

/**
 * Combined analysis: First use fast fuzzy matching, then GPT for refinement
 */
export async function analyzeQuranRecitation(
  transcript: string,
  expectedText: string,
  expectedWords: string[],
  options?: {
    hafzLevel?: number
    useGPT?: boolean
    surahInfo?: string
  }
): Promise<{
  score: number
  errors: Array<{ word: string; position: number; type: 'missing' | 'wrong'; issue?: string }>
  transcript: string
  gptAnalysis?: string
}> {
  const { hafzLevel = 1, useGPT = true } = options || {}

  // Step 1: Fast fuzzy matching with whitelist
  const fuzzyResult = calculateFuzzyScore(transcript, expectedText, expectedWords, hafzLevel)

  // Step 2: If GPT is enabled and score is not perfect, get GPT analysis
  let gptResult: GPTAnalysisResult | null = null
  if (useGPT && fuzzyResult.score < 100) {
    gptResult = await analyzeWithGPT(transcript, expectedText, {
      hafzLevel,
      surahInfo: options?.surahInfo
    })
  }

  // Use GPT score if available and reasonable, otherwise use fuzzy score
  const finalScore = gptResult?.score ?? fuzzyResult.score

  // Merge errors from both sources
  const errors = gptResult?.errors?.map((e, i) => ({
    word: e.word,
    position: e.position ?? i,
    type: e.type === 'extra' ? 'wrong' as const : e.type,
    issue: e.issue
  })) ?? fuzzyResult.errors

  return {
    score: finalScore,
    errors,
    transcript,
    gptAnalysis: gptResult?.analysis
  }
}

/**
 * Calculate fuzzy score using whitelist and normalization
 */
function calculateFuzzyScore(
  transcript: string,
  expectedText: string,
  expectedWords: string[],
  hafzLevel: number
): { score: number; errors: Array<{ word: string; position: number; type: 'missing' | 'wrong' }> } {
  const normalizedTranscript = normalizeArabicForComparison(transcript)
  const transcriptWords = normalizedTranscript.split(/\s+/).filter(w => w.length > 0)

  const errors: Array<{ word: string; position: number; type: 'missing' | 'wrong' }> = []
  const lookAhead = hafzLevel === 1 ? 5 : hafzLevel === 2 ? 3 : 1

  let matchCount = 0
  let transcriptIdx = 0

  for (let i = 0; i < expectedWords.length; i++) {
    const expectedWord = expectedWords[i]
    const normalizedExpected = normalizeArabicForComparison(expectedWord)

    // Skip empty or numeric words
    if (!normalizedExpected || /^[\u0660-\u0669\d]+$/.test(normalizedExpected)) continue

    let found = false
    for (let j = transcriptIdx; j < Math.min(transcriptIdx + lookAhead, transcriptWords.length); j++) {
      const transcriptWord = transcriptWords[j]

      // Check with whitelist and fuzzy matching
      if (matchWordsWithWhitelist(normalizedExpected, transcriptWord)) {
        matchCount++
        transcriptIdx = j + 1
        found = true
        break
      }
    }

    if (!found) {
      errors.push({
        word: expectedWord,
        position: i,
        type: 'missing'
      })
    }
  }

  const validExpectedCount = expectedWords.filter(w => {
    const n = normalizeArabicForComparison(w)
    return n && !/^[\u0660-\u0669\d]+$/.test(n)
  }).length

  const score = validExpectedCount > 0 ? Math.round((matchCount / validExpectedCount) * 100) : 0

  return { score, errors }
}

/**
 * Match words using whitelist + fuzzy rules
 */
function matchWordsWithWhitelist(expected: string, transcript: string): boolean {
  // Direct match
  if (expected === transcript) return true

  // Whitelist match
  if (matchWithWhitelist(expected, transcript)) return true

  // Remove "ال" and try again
  const expectedNoAl = expected.replace(/^(ا|أ|إ|آ)?ل/, '')
  const transcriptNoAl = transcript.replace(/^(ا|أ|إ|آ)?ل/, '')

  if (expectedNoAl === transcriptNoAl) return true
  if (matchWithWhitelist(expectedNoAl, transcriptNoAl)) return true

  // Remove internal alefs (Uthmani vs modern)
  const removeInternalAlefs = (w: string) => w.length <= 2 ? w : w[0] + w.slice(1).replace(/ا/g, '')

  const expectedNoAlefs = removeInternalAlefs(expected)
  const transcriptNoAlefs = removeInternalAlefs(transcript)

  if (expectedNoAlefs === transcriptNoAlefs) return true

  // Combined
  const expectedClean = removeInternalAlefs(expectedNoAl)
  const transcriptClean = removeInternalAlefs(transcriptNoAl)

  if (expectedClean === transcriptClean) return true

  // Substring match for merged words
  if (transcript.includes(expected) && expected.length >= 3) return true
  if (transcript.includes(expectedNoAl) && expectedNoAl.length >= 3) return true

  return false
}
