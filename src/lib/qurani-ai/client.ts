/**
 * Qurani.ai QRC WebSocket Client
 *
 * API Documentation: https://qurani.ai/en/docs/qrc
 *
 * The QRC API accepts Opus audio format and returns real-time
 * transcription with recitation quality scoring.
 */

import WebSocket from 'ws'
import { QRCConfig, QRCResult, QRCResponse, QRCError, DetectedAyah, QRCApiError } from './types'

const DEFAULT_WS_URL = 'wss://api.qurani.ai'
const CONNECTION_TIMEOUT = 8000 // 8 seconds (Vercel compatible)
const RESPONSE_TIMEOUT = 25000  // 25 seconds for processing (Vercel compatible)
const SESSION_START_TIMEOUT = 10000 // 10 seconds for session start

export class QRCClient {
  private config: QRCConfig
  private ws: WebSocket | null = null
  private responseBuffer: QRCResponse[] = []
  private onPartialCallback?: (transcript: string) => void

  constructor(config: QRCConfig) {
    this.config = {
      ...config,
      wsUrl: config.wsUrl || DEFAULT_WS_URL,
    }
  }

  /**
   * Connect to QRC WebSocket server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.config.wsUrl}?api_key=${this.config.apiKey}`

      // Log masked API key for debugging
      const maskedKey = this.config.apiKey.substring(0, 8) + '...' + this.config.apiKey.substring(this.config.apiKey.length - 4)
      console.log('[QRC] Connecting to:', this.config.wsUrl, 'with API key:', maskedKey)

      const timeout = setTimeout(() => {
        this.disconnect()
        reject(new QRCApiError('Connection timeout', 'CONNECTION_TIMEOUT'))
      }, CONNECTION_TIMEOUT)

      try {
        this.ws = new WebSocket(url)

        this.ws.on('open', () => {
          clearTimeout(timeout)
          console.log('[QRC] WebSocket OPEN - connected to Qurani.ai')
          resolve()
        })

        this.ws.on('error', (error) => {
          clearTimeout(timeout)
          console.error('[QRC] WebSocket ERROR:', error.message || error)
          reject(new QRCApiError(`WebSocket error: ${error.message}`, 'WS_ERROR'))
        })

        this.ws.on('close', (code, reason) => {
          const reasonStr = reason?.toString() || 'none'
          console.log(`[QRC] WebSocket CLOSED: code=${code}, reason=${reasonStr}`)
          // Common close codes:
          // 1000 = Normal closure
          // 1006 = Abnormal closure (connection lost)
          // 1008 = Policy violation
          // 4001-4999 = Application-specific
          if (code !== 1000) {
            console.error('[QRC] Abnormal close! This may indicate auth failure or server error')
          }
        })

        this.ws.on('message', (data) => {
          const rawData = data.toString()
          console.log('[QRC] RAW MESSAGE:', rawData.substring(0, 500))
          try {
            const response = JSON.parse(rawData) as QRCResponse
            this.handleResponse(response)
          } catch (e) {
            console.error('[QRC] Failed to parse response:', e, 'raw:', rawData)
          }
        })

        this.ws.on('ping', (data) => {
          console.log('[QRC] Received PING, sending PONG')
          this.ws?.pong(data)
        })

        this.ws.on('pong', () => {
          console.log('[QRC] Received PONG - connection alive')
        })

        // Also handle unexpected close during connection
        this.ws.on('unexpected-response', (req, res) => {
          console.error('[QRC] Unexpected response:', res.statusCode, res.statusMessage)
          clearTimeout(timeout)
          reject(new QRCApiError(`Unexpected HTTP response: ${res.statusCode}`, 'UNEXPECTED_RESPONSE'))
        })
      } catch (error) {
        clearTimeout(timeout)
        reject(new QRCApiError(`Failed to connect: ${error}`, 'CONNECTION_FAILED'))
      }
    })
  }

  /**
   * Handle incoming response from QRC
   */
  private handleResponse(response: QRCResponse): void {
    console.log('[QRC] Received:', JSON.stringify(response))
    this.responseBuffer.push(response)

    // Handle check_tilawa events for partial updates
    if (response.event === 'check_tilawa' && this.onPartialCallback) {
      // Build transcript from correct words
      const correctWords = (response as unknown as { correct_words?: string[] }).correct_words || []
      if (correctWords.length > 0) {
        this.onPartialCallback(correctWords.join(' '))
      }
    }
  }

  /**
   * Start recitation session
   * @param surah Optional surah number to expect (1-114)
   * @param ayah Optional starting ayah number
   * @param hafzLevel Hafz level 1-3 (default 1)
   * @param tajweedLevel Tajweed level 1-3 (default 1)
   */
  async startRecitation(
    surah?: number,
    ayah?: number,
    hafzLevel: number = 1,
    tajweedLevel: number = 1
  ): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new QRCApiError('Not connected', 'NOT_CONNECTED')
    }

    this.responseBuffer = []

    // Use the correct API format: StartTilawaSession
    const message = {
      method: 'StartTilawaSession',
      chapter_index: surah || 1,
      verse_index: ayah || 1,
      word_index: 1,
      hafz_level: hafzLevel,
      tajweed_level: tajweedLevel,
    }

    const messageStr = JSON.stringify(message)
    console.log('[QRC] Sending StartTilawaSession:', messageStr)
    this.ws.send(messageStr)
    console.log('[QRC] StartTilawaSession sent, waiting for confirmation...')

    // Wait for session start confirmation
    await this.waitForSessionStart()
    console.log('[QRC] Session started successfully')
  }

  /**
   * Wait for session start confirmation
   */
  private async waitForSessionStart(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[QRC] Waiting for session start confirmation...')

      const timeout = setTimeout(() => {
        console.log('[QRC] Session start TIMEOUT after', SESSION_START_TIMEOUT, 'ms')
        console.log('[QRC] Buffer has', this.responseBuffer.length, 'messages')
        console.log('[QRC] WebSocket state:', this.ws?.readyState, '(1=OPEN, 2=CLOSING, 3=CLOSED)')
        if (this.responseBuffer.length > 0) {
          console.log('[QRC] Messages received:', JSON.stringify(this.responseBuffer, null, 2))
        }
        reject(new QRCApiError('Session start timeout - no response from server', 'SESSION_START_TIMEOUT'))
      }, SESSION_START_TIMEOUT)

      const checkInterval = setInterval(() => {
        const startResponse = this.responseBuffer.find(r => r.event === 'start_tilawa_session')
        const errorResponse = this.responseBuffer.find(r => r.event === 'error' || r.type === 'error')

        if (errorResponse) {
          clearInterval(checkInterval)
          clearTimeout(timeout)
          reject(new QRCApiError(errorResponse.error || 'Session start failed', 'SESSION_START_ERROR'))
          return
        }

        if (startResponse) {
          clearInterval(checkInterval)
          clearTimeout(timeout)
          if (startResponse.exit_code !== 0) {
            reject(new QRCApiError(`Session start failed with code ${startResponse.exit_code}`, 'SESSION_START_ERROR'))
            return
          }
          resolve()
        }
      }, 50)
    })
  }

  /**
   * Send audio chunk to QRC
   * Audio should be Opus encoded. Send as binary data per API docs.
   * @param audioData Opus audio data as Buffer
   */
  async sendAudio(audioData: Buffer | string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new QRCApiError('Not connected', 'NOT_CONNECTED')
    }

    // Convert to Buffer if string (base64)
    const buffer = Buffer.isBuffer(audioData)
      ? audioData
      : Buffer.from(audioData, 'base64')

    // Send as binary data per API documentation
    this.ws.send(buffer)
    console.log('[QRC] Sent audio chunk:', buffer.length, 'bytes')
  }

  /**
   * Send complete audio file (for non-streaming use)
   */
  async sendCompleteAudio(audioBuffer: Buffer): Promise<void> {
    // Send in chunks for better processing
    const CHUNK_SIZE = 16000 // 16KB chunks

    for (let i = 0; i < audioBuffer.length; i += CHUNK_SIZE) {
      const chunk = audioBuffer.slice(i, Math.min(i + CHUNK_SIZE, audioBuffer.length))
      await this.sendAudio(chunk)
      // Small delay between chunks to not overwhelm the server
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  /**
   * Stop recitation and get final result
   */
  async stopAndGetResult(): Promise<QRCResult> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new QRCApiError('Not connected', 'NOT_CONNECTED')
    }

    const startTime = Date.now()

    // Send stop signal with correct format
    this.ws.send(JSON.stringify({ method: 'EndTilawaSession' }))
    console.log('[QRC] Sent EndTilawaSession')

    // Wait for final response
    const finalResponse = await this.waitForFinalResponse()

    const processingTime = Date.now() - startTime

    // Build result from responses
    return this.buildResult(finalResponse, processingTime)
  }

  /**
   * Wait for the final response after sending stop
   */
  private async waitForFinalResponse(): Promise<QRCResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // If we have any check_tilawa responses, return the last one
        const checkResponses = this.responseBuffer.filter(r => r.event === 'check_tilawa')
        if (checkResponses.length > 0) {
          console.log('[QRC] Timeout but have', checkResponses.length, 'check_tilawa responses')
          resolve(checkResponses[checkResponses.length - 1])
          return
        }
        reject(new QRCApiError('Response timeout - no data received', 'RESPONSE_TIMEOUT'))
      }, RESPONSE_TIMEOUT)

      const checkInterval = setInterval(() => {
        // Check for legacy format
        const finalResponse = this.responseBuffer.find(r => r.type === 'final')
        const errorResponse = this.responseBuffer.find(r => r.type === 'error' || r.event === 'error')

        if (errorResponse) {
          clearInterval(checkInterval)
          clearTimeout(timeout)
          reject(new QRCApiError(errorResponse.error || 'API error', 'API_ERROR'))
          return
        }

        if (finalResponse) {
          clearInterval(checkInterval)
          clearTimeout(timeout)
          resolve(finalResponse)
          return
        }

        // Check for new format end_session
        const endSession = this.responseBuffer.find(r => r.event === 'end_session')
        if (endSession) {
          clearInterval(checkInterval)
          clearTimeout(timeout)
          resolve(endSession)
          return
        }
      }, 100)
    })
  }

  /**
   * Build final result from API response
   */
  private buildResult(response: QRCResponse, processingTime: number): QRCResult {
    // Collect all check_tilawa responses
    const checkResponses = this.responseBuffer.filter(r => r.event === 'check_tilawa')

    // Build transcript from all correct_words
    let allCorrectWords: string[] = []
    let allSkippedWords: string[] = []
    const allTajweedMistakes: { word: string; rule: string }[] = []

    for (const resp of checkResponses) {
      if (resp.correct_words) {
        allCorrectWords = allCorrectWords.concat(resp.correct_words)
      }
      if (resp.skipped_words) {
        allSkippedWords = allSkippedWords.concat(resp.skipped_words)
      }
      if (resp.tajweed_mistakes) {
        allTajweedMistakes.push(...resp.tajweed_mistakes)
      }
    }

    // Use legacy format if available, otherwise use new format
    let transcript = response.transcript || allCorrectWords.join(' ')

    // If no transcript from new format, try legacy partials
    if (!transcript) {
      const partials = this.responseBuffer
        .filter(r => r.type === 'partial' && r.transcript)
        .map(r => r.transcript!)
      transcript = partials.join(' ')
    }

    // Calculate score
    const totalWords = allCorrectWords.length + allSkippedWords.length
    let score = response.score ?? (totalWords > 0
      ? Math.round((allCorrectWords.length / totalWords) * 100)
      : this.calculateScore(response))

    // Convert to QRC errors format
    const errors: QRCError[] = [
      ...allSkippedWords.map((word, i) => ({
        word,
        position: i,
        type: 'missing' as const,
      })),
      ...allTajweedMistakes.map((m, i) => ({
        word: m.word,
        position: i,
        type: 'tajweed' as const,
        correction: m.rule,
      })),
    ]

    console.log('[QRC] Built result:', {
      correctWords: allCorrectWords.length,
      skippedWords: allSkippedWords.length,
      tajweedMistakes: allTajweedMistakes.length,
      score,
    })

    return {
      success: true,
      transcript,
      score,
      errors: errors.length > 0 ? errors : (response.errors || []),
      detectedAyahs: response.detectedAyahs || [],
      processingTime,
      rawResponse: this.responseBuffer,
    }
  }

  /**
   * Calculate score if not provided by API
   */
  private calculateScore(response: QRCResponse): number {
    // If no errors, assume perfect score
    if (!response.errors || response.errors.length === 0) {
      return 100
    }

    // Reduce score based on errors
    const errorPenalty = response.errors.length * 5 // 5% per error
    return Math.max(0, 100 - errorPenalty)
  }

  /**
   * Set callback for partial transcription updates
   */
  onPartial(callback: (transcript: string) => void): void {
    this.onPartialCallback = callback
  }

  /**
   * Disconnect from QRC server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.responseBuffer = []
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

/**
 * Process a complete audio file through QRC API
 * Convenience function for one-shot processing
 */
export async function processAudioWithQRC(
  audioBuffer: Buffer,
  apiKey: string,
  options?: {
    surah?: number
    ayah?: number
    hafzLevel?: number
    tajweedLevel?: number
    onPartial?: (transcript: string) => void
  }
): Promise<QRCResult> {
  const client = new QRCClient({ apiKey })

  console.log('[QRC] Starting audio processing, buffer size:', audioBuffer.length)

  try {
    console.log('[QRC] Connecting to WebSocket...')
    await client.connect()
    console.log('[QRC] Connected successfully')

    if (options?.onPartial) {
      client.onPartial(options.onPartial)
    }

    console.log('[QRC] Starting recitation session, surah:', options?.surah)
    await client.startRecitation(
      options?.surah,
      options?.ayah,
      options?.hafzLevel || 1,
      options?.tajweedLevel || 1
    )

    console.log('[QRC] Sending audio data...')
    await client.sendCompleteAudio(audioBuffer)

    console.log('[QRC] Waiting for result...')
    const result = await client.stopAndGetResult()
    console.log('[QRC] Got result, score:', result.score, 'transcript length:', result.transcript.length)

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[QRC] Processing failed:', errorMessage)

    // Check for specific error types
    if (errorMessage.includes('CONNECTION_TIMEOUT')) {
      console.error('[QRC] Connection timeout - check API key and network')
    } else if (errorMessage.includes('RESPONSE_TIMEOUT')) {
      console.error('[QRC] Response timeout - audio may not be in correct format')
    } else if (errorMessage.includes('WS_ERROR')) {
      console.error('[QRC] WebSocket error - server may have rejected connection')
    }

    // Return failed result with error details
    return {
      success: false,
      transcript: '',
      score: 0,
      errors: [],
      detectedAyahs: [],
      processingTime: 0,
      rawResponse: { error: errorMessage },
    }
  } finally {
    client.disconnect()
  }
}
