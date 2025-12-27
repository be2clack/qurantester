import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { processAudioWithQRC, getQRCApiKey, QRCError } from '@/lib/qurani-ai'
import { getSurahByPage } from '@/lib/qurani-ai/utils'
import { AIProvider } from '@prisma/client'
import { logAIUsage } from '@/lib/ai-usage'

interface WordMatch {
  position: number
  status: 'correct' | 'wrong' | 'missing' | 'extra'
  expected?: string
  actual?: string
}

interface AudioProcessResult {
  success: boolean
  score: number
  transcript: string
  errors: QRCError[]
  detectedAyahs?: { surah: number; ayah: number }[]
}

/**
 * Normalize Arabic text for comparison
 * Removes diacritics and normalizes characters
 */
function normalizeArabic(text: string): string {
  return text
    // Remove Arabic diacritics (tashkeel) - full range
    .replace(/[\u064B-\u065F]/g, '')  // Fathatan to Hamza Below
    .replace(/[\u0610-\u061A]/g, '')  // Arabic signs (small high letters)
    .replace(/[\u06D6-\u06DC]/g, '')  // Small high ligatures
    .replace(/[\u06DF-\u06E4]/g, '')  // More small high marks
    .replace(/[\u06E7-\u06E8]/g, '')  // Small yeh/noon
    .replace(/[\u06EA-\u06ED]/g, '')  // More marks
    .replace(/\u0670/g, '\u0627')     // Superscript alef -> regular alef (important for Uthmani script)
    .replace(/\u0671/g, '\u0627')     // Alef wasla to alef
    // Normalize alef variants
    .replace(/[\u0622\u0623\u0625\u0627]/g, '\u0627')
    // Normalize hamza
    .replace(/[\u0624\u0626]/g, '\u0621')
    // Normalize teh marbuta to heh
    .replace(/\u0629/g, '\u0647')
    // Normalize alef maksura to yeh
    .replace(/\u0649/g, '\u064A')
    // Remove tatweel (kashida)
    .replace(/\u0640/g, '')
    // Remove verse end markers (ayah numbers like ۝١)
    .replace(/[\u06DD]/g, '')
    // Remove Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) - often attached to words as ayah numbers
    .replace(/[\u0660-\u0669]/g, '')
    // Remove Extended Arabic-Indic numerals (۰۱۲۳۴۵۶۷۸۹)
    .replace(/[\u06F0-\u06F9]/g, '')
    // Remove regular digits too
    .replace(/[0-9]/g, '')
    // Remove common punctuation
    .replace(/[،؛؟]/g, '')
    .trim()
}

/**
 * Remove definite article "ال" from word for fuzzy matching
 * Whisper often doesn't transcribe hamza wasl + laam in connected speech
 */
function removeDefiniteArticle(word: string): string {
  // Remove "ال" at the beginning (with or without hamza)
  return word.replace(/^(ا|أ|إ|آ)?ل/, '')
}

/**
 * Remove internal alefs for fuzzy matching
 * Uthmani script has extra alefs (الرحمان) that modern Arabic doesn't (الرحمن)
 */
function removeInternalAlefs(word: string): string {
  // Keep first character, remove alefs from the rest
  if (word.length <= 2) return word
  return word[0] + word.slice(1).replace(/ا/g, '')
}

/**
 * Check if two words match (with fuzzy matching for "ال" and internal alefs)
 * Returns true if words match exactly OR if they match without "ال" OR without internal alefs
 */
function fuzzyWordsMatch(expected: string, transcript: string): boolean {
  // Exact match
  if (expected === transcript) return true

  // Match without "ال" (Whisper may omit it in connected speech)
  const expectedWithoutAl = removeDefiniteArticle(expected)
  const transcriptWithoutAl = removeDefiniteArticle(transcript)

  if (expectedWithoutAl === transcriptWithoutAl) return true
  if (expected === transcriptWithoutAl) return true
  if (expectedWithoutAl === transcript) return true

  // Match without internal alefs (Uthmani vs modern: الرحمان vs الرحمن)
  const expectedNoAlefs = removeInternalAlefs(expected)
  const transcriptNoAlefs = removeInternalAlefs(transcript)

  if (expectedNoAlefs === transcriptNoAlefs) return true
  if (expectedNoAlefs === transcript) return true
  if (expected === transcriptNoAlefs) return true

  // Combined: without "ال" AND without internal alefs
  const expectedClean = removeInternalAlefs(expectedWithoutAl)
  const transcriptClean = removeInternalAlefs(transcriptWithoutAl)

  if (expectedClean === transcriptClean) return true

  // Check if transcript contains expected (for merged words like "يومتين" containing "يوم")
  if (transcript.includes(expected) && expected.length >= 3) return true
  if (transcript.includes(expectedWithoutAl) && expectedWithoutAl.length >= 3) return true

  return false
}

/**
 * Match transcript words against expected words
 * Returns word-level matching results for inline highlighting
 */
function matchWords(expectedWords: string[], transcript: string, errors: QRCError[]): WordMatch[] {
  const matches: WordMatch[] = []

  // Split transcript into words
  const transcriptWords = transcript.split(/\s+/).filter(w => w.length > 0)

  // Normalize all words for comparison
  const normalizedExpected = expectedWords.map(w => normalizeArabic(w))
  const normalizedTranscript = transcriptWords.map(w => normalizeArabic(w))

  // Create error lookup by word
  const errorLookup = new Map<string, QRCError>()
  for (const err of errors) {
    errorLookup.set(normalizeArabic(err.word), err)
  }

  // Use simple alignment algorithm
  let transcriptIdx = 0

  for (let i = 0; i < expectedWords.length; i++) {
    const expected = expectedWords[i]
    const normalizedExp = normalizedExpected[i]

    // Skip verse end markers (ayah numbers)
    if (expected.match(/^[\u06DD]/)) {
      matches.push({
        position: i,
        status: 'correct',
        expected,
      })
      continue
    }

    // Look for match in transcript (with some flexibility)
    // Use fuzzy matching to handle Uthmani vs modern Arabic differences
    let found = false
    for (let j = transcriptIdx; j < Math.min(transcriptIdx + 3, normalizedTranscript.length); j++) {
      if (fuzzyWordsMatch(normalizedExp, normalizedTranscript[j])) {
        // Check if there's an error for this word
        const error = errorLookup.get(normalizedExp)
        if (error) {
          matches.push({
            position: i,
            status: error.type === 'tajweed' ? 'wrong' : error.type === 'missing' ? 'missing' : 'wrong',
            expected,
            actual: transcriptWords[j],
          })
        } else {
          matches.push({
            position: i,
            status: 'correct',
            expected,
          })
        }
        transcriptIdx = j + 1
        found = true
        break
      }
    }

    if (!found) {
      // Word not found in transcript - mark as missing or wrong
      const error = errorLookup.get(normalizedExp)
      if (error?.type === 'missing') {
        matches.push({
          position: i,
          status: 'missing',
          expected,
        })
      } else if (transcriptIdx < normalizedTranscript.length) {
        // There's a word in transcript that doesn't match - mark as wrong
        matches.push({
          position: i,
          status: 'wrong',
          expected,
          actual: transcriptWords[transcriptIdx],
        })
        transcriptIdx++
      } else {
        // No more transcript words - mark as missing
        matches.push({
          position: i,
          status: 'missing',
          expected,
        })
      }
    }
  }

  return matches
}

/**
 * Get API key from system settings
 */
async function getApiKey(keyName: string): Promise<string | null> {
  const setting = await prisma.systemSettings.findUnique({
    where: { key: keyName }
  })
  return setting?.value || null
}

/**
 * Process audio with OpenAI Whisper + GPT-4o-mini analysis
 * @param hafzLevel Strictness level 1-3: 1=lenient, 2=medium, 3=strict
 * @param useGPT Whether to use GPT-4o-mini for intelligent analysis
 */
async function processWithWhisper(
  audioBuffer: Buffer,
  expectedWords: string[],
  expectedText: string,
  hafzLevel: number = 1,
  useGPT: boolean = true
): Promise<AudioProcessResult> {
  const apiKey = await getApiKey('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  // Create form data for Whisper API
  const formData = new FormData()
  const uint8Array = new Uint8Array(audioBuffer)
  const blob = new Blob([uint8Array], { type: 'audio/webm' })
  formData.append('file', blob, 'audio.webm')
  formData.append('model', 'whisper-1')
  formData.append('language', 'ar')  // Arabic

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Whisper API error: ${error}`)
  }

  const result = await response.json()
  const transcript = result.text || ''

  // Use combined analysis with whitelist + GPT
  const { analyzeQuranRecitation } = await import('@/lib/quran-text-matching')

  const analysisResult = await analyzeQuranRecitation(
    transcript,
    expectedText,
    expectedWords,
    { hafzLevel, useGPT }
  )

  console.log(`[Whisper+GPT] Score: ${analysisResult.score}%, GPT analysis: ${analysisResult.gptAnalysis || 'N/A'}`)

  // Convert errors to QRCError format
  const errors: QRCError[] = analysisResult.errors.map(e => ({
    word: e.word,
    position: e.position,
    type: e.type,
  }))

  return {
    success: true,
    score: analysisResult.score,
    transcript,
    errors,
  }
}

/**
 * Calculate text similarity score (0-100)
 * @param hafzLevel Strictness level 1-3: 1=lenient, 2=medium, 3=strict
 */
function calculateTextSimilarity(transcript: string, expected: string, hafzLevel: number = 1): number {
  const normalizedTranscript = normalizeArabic(transcript)
  const normalizedExpected = normalizeArabic(expected)

  console.log('[Similarity] Normalized transcript:', normalizedTranscript.substring(0, 100))
  console.log('[Similarity] Normalized expected:', normalizedExpected.substring(0, 100))
  console.log('[Similarity] Hafz level:', hafzLevel)

  if (normalizedExpected.length === 0) return 0

  // Split into words
  const transcriptWords = normalizedTranscript.split(/\s+/).filter(w => w.length > 0)
  const expectedWords = normalizedExpected.split(/\s+/).filter(w => w.length > 0)

  console.log('[Similarity] Transcript words:', transcriptWords.length, 'Expected words:', expectedWords.length)

  if (expectedWords.length === 0) return 0

  // Hafz level affects how many words ahead we look for matches
  // Level 1 (lenient): look 5 words ahead, allows gaps
  // Level 2 (medium): look 3 words ahead
  // Level 3 (strict): look 1 word ahead (strict sequential)
  const lookAhead = hafzLevel === 1 ? 5 : hafzLevel === 2 ? 3 : 1

  // Count matching words
  let matchCount = 0
  let transcriptIdx = 0

  for (let i = 0; i < expectedWords.length; i++) {
    const expectedWord = expectedWords[i]
    let found = false

    // Look for match within next N words (based on hafzLevel)
    for (let j = transcriptIdx; j < Math.min(transcriptIdx + lookAhead, transcriptWords.length); j++) {
      // Use fuzzy matching (handles "ال" omission and merged words)
      if (fuzzyWordsMatch(expectedWord, transcriptWords[j])) {
        matchCount++
        transcriptIdx = j + 1
        found = true
        break
      }
    }

    // Log first few mismatches for debugging
    if (!found && i < 5) {
      console.log(`[Similarity] Word ${i} not found: "${expectedWord}" vs transcript around idx ${transcriptIdx}:`,
        transcriptWords.slice(transcriptIdx, transcriptIdx + 3))
    }
  }

  const rawScore = Math.round((matchCount / expectedWords.length) * 100)
  console.log('[Similarity] Match count:', matchCount, '/', expectedWords.length, '= raw score:', rawScore)

  return rawScore
}

/**
 * Find errors by comparing words
 * @param hafzLevel Strictness level 1-3: 1=lenient, 2=medium, 3=strict
 */
function findTextErrors(expectedWords: string[], transcript: string, hafzLevel: number = 1): QRCError[] {
  const errors: QRCError[] = []
  const transcriptWords = transcript.split(/\s+/).filter(w => w.length > 0)

  const normalizedExpected = expectedWords.map(w => normalizeArabic(w))
  const normalizedTranscript = transcriptWords.map(w => normalizeArabic(w))

  // Hafz level affects error detection strictness
  const lookAhead = hafzLevel === 1 ? 5 : hafzLevel === 2 ? 3 : 1

  let transcriptIdx = 0

  for (let i = 0; i < expectedWords.length; i++) {
    const expected = expectedWords[i]
    const normalizedExp = normalizedExpected[i]

    // Skip verse markers and ayah numbers
    if (expected.match(/^[\u06DD]/) || normalizedExp.length === 0) continue
    // Skip if it's just a number (ayah marker like ١٢٣)
    if (/^[\u0660-\u0669\d]+$/.test(normalizedExp)) continue

    let found = false
    for (let j = transcriptIdx; j < Math.min(transcriptIdx + lookAhead, normalizedTranscript.length); j++) {
      // Use fuzzy matching (handles "ال" omission and merged words)
      if (fuzzyWordsMatch(normalizedExp, normalizedTranscript[j])) {
        transcriptIdx = j + 1
        found = true
        break
      }
    }

    if (!found) {
      errors.push({
        word: expected,
        position: i,
        type: 'missing',
      })
    }
  }

  return errors
}

/**
 * POST /api/qrc/check-audio
 * Process audio through AI API for recitation checking
 *
 * Accepts audio file as FormData with 'audio' field
 * Also accepts: groupId, telegramId, pageNumber, provider, expectedWords, expectedText as form fields
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    const telegramId = formData.get('telegramId') as string | null
    const groupId = formData.get('groupId') as string | null
    const pageNumber = formData.get('pageNumber') as string | null
    const provider = (formData.get('provider') as string | null) || 'QURANI_AI'
    const expectedWordsJson = formData.get('expectedWords') as string | null
    const expectedText = formData.get('expectedText') as string | null
    const hafzLevel = parseInt(formData.get('hafzLevel') as string || '1') || 1
    const useGPT = formData.get('useGPT') !== 'false' // Default to true

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    if (!telegramId) {
      return NextResponse.json(
        { error: 'telegramId is required' },
        { status: 400 }
      )
    }

    // Parse expected words if provided
    let expectedWords: string[] = []
    if (expectedWordsJson) {
      try {
        expectedWords = JSON.parse(expectedWordsJson)
      } catch {
        console.warn('Failed to parse expectedWords')
      }
    }

    // Skip user verification for test mode (telegramId = '0')
    const isTestMode = telegramId === '0'
    if (!isTestMode) {
      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) }
      })

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }
    }

    // Convert audio file to buffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)

    const startTime = Date.now()
    let result: AudioProcessResult

    // Route to appropriate AI provider
    switch (provider as AIProvider) {
      case 'WHISPER':
        console.log('[check-audio] Using OpenAI Whisper, hafzLevel:', hafzLevel, 'useGPT:', useGPT)
        result = await processWithWhisper(
          audioBuffer,
          expectedWords,
          expectedText || expectedWords.join(' '),
          hafzLevel,
          useGPT
        )
        break

      case 'QURANI_AI':
      default:
        console.log('[check-audio] Using Qurani.ai QRC')
        // Get API key
        const apiKey = await getQRCApiKey()
        if (!apiKey) {
          return NextResponse.json(
            { error: 'QRC API not configured' },
            { status: 400 }
          )
        }

        // Get surah info if page number provided
        let surah: number | undefined
        if (pageNumber) {
          surah = getSurahByPage(parseInt(pageNumber))
        }

        // Process with QRC API
        console.log('[check-audio] Calling QRC API, audio size:', audioBuffer.length)
        const qrcResult = await processAudioWithQRC(audioBuffer, apiKey, {
          surah,
        })

        // Check if QRC failed
        if (!qrcResult.success) {
          const errorMsg = qrcResult.rawResponse && typeof qrcResult.rawResponse === 'object' && 'error' in qrcResult.rawResponse
            ? String((qrcResult.rawResponse as { error: string }).error)
            : 'QRC processing failed'
          console.error('[check-audio] QRC failed:', errorMsg)
          return NextResponse.json(
            { error: errorMsg, provider: 'QURANI_AI' },
            { status: 500 }
          )
        }

        result = {
          success: qrcResult.success,
          score: qrcResult.score,
          transcript: qrcResult.transcript,
          errors: qrcResult.errors || [],
          detectedAyahs: qrcResult.detectedAyahs,
        }
        break
    }

    const processingTime = Date.now() - startTime

    // Match words for inline highlighting
    let wordMatches: WordMatch[] = []
    if (expectedWords.length > 0 && result.transcript) {
      wordMatches = matchWords(expectedWords, result.transcript, result.errors || [])
    }

    // Log AI usage for analytics
    const audioDurationSeconds = processingTime / 1000  // Rough estimate
    await logAIUsage({
      provider: provider as AIProvider,
      operation: 'transcribe',
      audioDuration: audioDurationSeconds,
      groupId: groupId || undefined,
      success: result.success,
    })

    return NextResponse.json({
      success: result.success,
      score: result.score,
      transcript: result.transcript,
      errors: result.errors,
      detectedAyahs: result.detectedAyahs,
      wordMatches,
      processingTime,
      provider,
    })
  } catch (error) {
    console.error('check-audio error:', error)

    // Log failed AI usage
    await logAIUsage({
      provider: 'WHISPER',
      operation: 'transcribe',
      success: false,
      errorMessage: String(error),
    }).catch(() => {})  // Don't fail on logging error

    return NextResponse.json(
      { error: 'Failed to process audio', details: String(error) },
      { status: 500 }
    )
  }
}
