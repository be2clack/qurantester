/**
 * Qurani.ai QRC Utilities
 */

import { prisma } from '@/lib/prisma'
import { QRCResult, QRCApiError } from './types'
import { processAudioWithQRC } from './client'

/**
 * Get QRC API key from database settings
 */
export async function getQRCApiKey(): Promise<string | null> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'QURANI_AI_QRC_KEY' },
    })
    return setting?.value || null
  } catch (error) {
    console.error('[QRC] Failed to get API key:', error)
    return null
  }
}

/**
 * Download file from Telegram servers
 */
export async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    throw new QRCApiError('TELEGRAM_BOT_TOKEN not configured', 'CONFIG_ERROR')
  }

  // Get file path from Telegram
  const fileInfoUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  const fileInfoResponse = await fetch(fileInfoUrl)

  if (!fileInfoResponse.ok) {
    throw new QRCApiError('Failed to get file info from Telegram', 'TELEGRAM_ERROR')
  }

  const fileInfo = await fileInfoResponse.json()

  if (!fileInfo.ok || !fileInfo.result?.file_path) {
    throw new QRCApiError('Invalid file info response from Telegram', 'TELEGRAM_ERROR')
  }

  // Download the file
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`
  const fileResponse = await fetch(fileUrl)

  if (!fileResponse.ok) {
    throw new QRCApiError('Failed to download file from Telegram', 'TELEGRAM_ERROR')
  }

  const arrayBuffer = await fileResponse.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Get surah number from page number (Medina Mushaf)
 */
export function getSurahByPage(pageNumber: number): number {
  // Approximate mapping - start of each surah in Medina Mushaf
  const surahStartPages: Record<number, number> = {
    1: 1,    // Al-Fatiha
    2: 2,    // Al-Baqarah
    3: 50,   // Aal-Imran
    4: 77,   // An-Nisa
    5: 106,  // Al-Ma'idah
    6: 128,  // Al-An'am
    7: 151,  // Al-A'raf
    8: 177,  // Al-Anfal
    9: 187,  // At-Tawbah
    10: 208, // Yunus
    11: 221, // Hud
    12: 235, // Yusuf
    13: 249, // Ar-Ra'd
    14: 255, // Ibrahim
    15: 262, // Al-Hijr
    16: 267, // An-Nahl
    17: 282, // Al-Isra
    18: 293, // Al-Kahf
    19: 305, // Maryam
    20: 312, // Ta-Ha
    21: 322, // Al-Anbiya
    22: 332, // Al-Hajj
    23: 342, // Al-Mu'minun
    24: 350, // An-Nur
    25: 359, // Al-Furqan
    26: 367, // Ash-Shu'ara
    27: 377, // An-Naml
    28: 385, // Al-Qasas
    29: 396, // Al-Ankabut
    30: 404, // Ar-Rum
    31: 411, // Luqman
    32: 415, // As-Sajdah
    33: 418, // Al-Ahzab
    34: 428, // Saba
    35: 434, // Fatir
    36: 440, // Ya-Sin
    37: 446, // As-Saffat
    38: 453, // Sad
    39: 458, // Az-Zumar
    40: 467, // Ghafir
    41: 477, // Fussilat
    42: 483, // Ash-Shura
    43: 489, // Az-Zukhruf
    44: 496, // Ad-Dukhan
    45: 499, // Al-Jathiyah
    46: 502, // Al-Ahqaf
    47: 507, // Muhammad
    48: 511, // Al-Fath
    49: 515, // Al-Hujurat
    50: 518, // Qaf
    51: 520, // Adh-Dhariyat
    52: 523, // At-Tur
    53: 526, // An-Najm
    54: 528, // Al-Qamar
    55: 531, // Ar-Rahman
    56: 534, // Al-Waqi'ah
    57: 537, // Al-Hadid
    58: 542, // Al-Mujadilah
    59: 545, // Al-Hashr
    60: 549, // Al-Mumtahanah
    61: 551, // As-Saff
    62: 553, // Al-Jumu'ah
    63: 554, // Al-Munafiqun
    64: 556, // At-Taghabun
    65: 558, // At-Talaq
    66: 560, // At-Tahrim
    67: 562, // Al-Mulk
    68: 564, // Al-Qalam
    69: 566, // Al-Haqqah
    70: 568, // Al-Ma'arij
    71: 570, // Nuh
    72: 572, // Al-Jinn
    73: 574, // Al-Muzzammil
    74: 575, // Al-Muddaththir
    75: 577, // Al-Qiyamah
    76: 578, // Al-Insan
    77: 580, // Al-Mursalat
    78: 582, // An-Naba
    79: 583, // An-Nazi'at
    80: 585, // 'Abasa
    81: 586, // At-Takwir
    82: 587, // Al-Infitar
    83: 587, // Al-Mutaffifin
    84: 589, // Al-Inshiqaq
    85: 590, // Al-Buruj
    86: 591, // At-Tariq
    87: 591, // Al-A'la
    88: 592, // Al-Ghashiyah
    89: 593, // Al-Fajr
    90: 594, // Al-Balad
    91: 595, // Ash-Shams
    92: 595, // Al-Lail
    93: 596, // Ad-Duha
    94: 596, // Ash-Sharh
    95: 597, // At-Tin
    96: 597, // Al-'Alaq
    97: 598, // Al-Qadr
    98: 598, // Al-Bayyinah
    99: 599, // Az-Zalzalah
    100: 599, // Al-'Adiyat
    101: 600, // Al-Qari'ah
    102: 600, // At-Takathur
    103: 601, // Al-'Asr
    104: 601, // Al-Humazah
    105: 601, // Al-Fil
    106: 602, // Quraysh
    107: 602, // Al-Ma'un
    108: 602, // Al-Kawthar
    109: 603, // Al-Kafirun
    110: 603, // An-Nasr
    111: 603, // Al-Masad
    112: 604, // Al-Ikhlas
    113: 604, // Al-Falaq
    114: 604, // An-Nas
  }

  // Find surah for given page
  let surah = 1
  for (const [surahNum, startPage] of Object.entries(surahStartPages)) {
    if (pageNumber >= startPage) {
      surah = parseInt(surahNum)
    } else {
      break
    }
  }

  return surah
}

/**
 * Process a submission's audio through QRC
 */
export async function processSubmissionWithQRC(
  fileId: string,
  pageNumber?: number
): Promise<QRCResult> {
  // Get API key
  const apiKey = await getQRCApiKey()
  if (!apiKey) {
    throw new QRCApiError('QRC API key not configured', 'CONFIG_ERROR')
  }

  // Download audio from Telegram
  console.log('[QRC] Downloading audio from Telegram...')
  const audioBuffer = await downloadTelegramFile(fileId)
  console.log(`[QRC] Downloaded ${audioBuffer.length} bytes`)

  // Get surah hint from page number
  const surah = pageNumber ? getSurahByPage(pageNumber) : undefined

  // Process with QRC
  console.log('[QRC] Processing audio...', { surah })
  const result = await processAudioWithQRC(audioBuffer, apiKey, { surah })

  console.log('[QRC] Processing complete:', {
    success: result.success,
    score: result.score,
    transcript: result.transcript.substring(0, 100),
    errors: result.errors.length,
    processingTime: result.processingTime,
  })

  return result
}

/**
 * Check if QRC is configured and available
 */
export async function isQRCConfigured(): Promise<boolean> {
  const apiKey = await getQRCApiKey()
  return !!apiKey
}
