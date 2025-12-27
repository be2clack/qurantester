/**
 * Qurani.ai QRC API Types
 * AI-based Quran recitation checking
 */

export interface QRCConfig {
  apiKey: string
  wsUrl?: string // Default: wss://api.qurani.ai
}

/**
 * Message sent to QRC WebSocket
 */
export interface QRCMessage {
  type: 'start' | 'audio' | 'stop'
  data?: {
    surah?: number
    ayah?: number
    audio?: ArrayBuffer | string // Base64 or ArrayBuffer
  }
}

/**
 * Response from QRC API
 */
export interface QRCResponse {
  // Legacy format
  type?: 'partial' | 'final' | 'error'
  transcript?: string
  score?: number
  errors?: QRCError[]
  detectedAyahs?: DetectedAyah[]
  error?: string
  // New API format
  event?: 'start_tilawa_session' | 'check_tilawa' | 'end_session' | 'error'
  exit_code?: number
  websocket_id?: string
  chapter_index?: number
  verse_index?: number
  word_index?: number
  correct_words?: string[]
  skipped_words?: string[]
  tajweed_mistakes?: { word: string; rule: string }[]
}

/**
 * Detected error in recitation
 */
export interface QRCError {
  word: string           // Word with error
  position: number       // Position in text
  type: 'pronunciation' | 'tajweed' | 'missing' | 'extra' | 'wrong'
  expected?: string      // Expected pronunciation
  actual?: string        // What was said
  correction?: string    // Correction hint
}

/**
 * Detected ayah from recitation
 */
export interface DetectedAyah {
  surah: number
  ayah: number
  startTime?: number     // Time in audio (ms)
  endTime?: number
  confidence: number     // 0-1
  text?: string          // Arabic text of ayah
}

/**
 * Final result of QRC processing
 */
export interface QRCResult {
  success: boolean
  transcript: string        // Full recognized Arabic text
  score: number            // 0-100 percentage
  errors: QRCError[]       // List of errors
  detectedAyahs: DetectedAyah[]  // Which ayahs were recited
  processingTime: number   // Time in ms
  rawResponse?: unknown    // Full API response for debugging
}

/**
 * Error from QRC API
 */
export class QRCApiError extends Error {
  code: string

  constructor(message: string, code: string = 'QRC_ERROR') {
    super(message)
    this.name = 'QRCApiError'
    this.code = code
  }
}
