/**
 * Qurani.ai Integration Module
 *
 * QRC (Quran Recitation Checker) API for AI-based
 * Quran recitation verification.
 *
 * Features:
 * - Real-time recitation checking
 * - Accuracy scoring (0-100%)
 * - Error detection (pronunciation, tajweed)
 * - Ayah detection
 *
 * Usage:
 *
 * ```typescript
 * import { processSubmissionWithQRC, isQRCConfigured } from '@/lib/qurani-ai'
 *
 * // Check if API is configured
 * if (await isQRCConfigured()) {
 *   // Process a Telegram voice message
 *   const result = await processSubmissionWithQRC(fileId, pageNumber)
 *
 *   if (result.success) {
 *     console.log(`Score: ${result.score}%`)
 *     console.log(`Transcript: ${result.transcript}`)
 *   }
 * }
 * ```
 */

// Types
export type {
  QRCConfig,
  QRCMessage,
  QRCResponse,
  QRCResult,
  QRCError,
  DetectedAyah,
} from './types'

export { QRCApiError } from './types'

// Client
export { QRCClient, processAudioWithQRC } from './client'

// Utilities
export {
  getQRCApiKey,
  downloadTelegramFile,
  processSubmissionWithQRC,
  isQRCConfigured,
  getSurahByPage,
} from './utils'
