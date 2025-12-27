/**
 * Whisper utilities for text similarity and error detection
 * Used for AI verification of Quran recitation
 */

/**
 * Normalize Arabic text for comparison
 * Removes diacritics and normalizes characters
 */
export function normalizeArabic(text: string): string {
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
    // Remove Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩)
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
function wordsMatch(expected: string, transcript: string): boolean {
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
 * Calculate text similarity score (0-100)
 * @param hafzLevel Strictness level 1-3: 1=lenient, 2=medium, 3=strict
 */
export function calculateTextSimilarity(transcript: string, expected: string, hafzLevel: number = 1): number {
  const normalizedTranscript = normalizeArabic(transcript)
  const normalizedExpected = normalizeArabic(expected)

  if (normalizedExpected.length === 0) return 0

  // Split into words
  const transcriptWords = normalizedTranscript.split(/\s+/).filter(w => w.length > 0)
  const expectedWords = normalizedExpected.split(/\s+/).filter(w => w.length > 0)

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

    // Look for match within next N words (based on hafzLevel)
    for (let j = transcriptIdx; j < Math.min(transcriptIdx + lookAhead, transcriptWords.length); j++) {
      // Use fuzzy matching (handles "ال" omission and merged words)
      if (wordsMatch(expectedWord, transcriptWords[j])) {
        matchCount++
        transcriptIdx = j + 1
        break
      }
    }
  }

  return Math.round((matchCount / expectedWords.length) * 100)
}

/**
 * Find errors by comparing words
 * @param hafzLevel Strictness level 1-3: 1=lenient, 2=medium, 3=strict
 */
export function findTextErrors(expectedWords: string[], transcript: string, hafzLevel: number = 1): Array<{
  word: string
  position: number
  type: 'missing' | 'wrong'
}> {
  const errors: Array<{ word: string; position: number; type: 'missing' | 'wrong' }> = []
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
      if (wordsMatch(normalizedExp, normalizedTranscript[j])) {
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
