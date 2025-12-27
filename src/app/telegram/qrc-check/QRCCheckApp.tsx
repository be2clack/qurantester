'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Loader2, Mic, MicOff, CheckCircle, XCircle, AlertCircle, RotateCcw, Volume2, VolumeX } from 'lucide-react'

interface QuranWord {
  id: number
  position: number
  text: string
  charType: string
  audioUrl?: string
}

interface PreCheckLine {
  lineNumber: number
  textArabic: string | null
  textTajweed?: string  // HTML with tajweed coloring
  verseKeys?: string[]
  words: QuranWord[]
}

interface PreCheckInfo {
  groupId: string
  groupName: string
  pageNumber: number
  startLine: number
  endLine: number
  stage: string
  lines: PreCheckLine[]
  qrcSettings: {
    provider: 'QURANI_AI' | 'WHISPER'
    hafzLevel: number
    tajweedLevel: number
    passThreshold: number
  }
  apiKeyConfigured: boolean
  qrcApiKey?: string
  existingPreCheck: {
    passed: boolean
    score: number
    createdAt: string
  } | null
}

type Status = 'loading' | 'need_mic_permission' | 'ready' | 'playing_audio' | 'recording' | 'processing' | 'success' | 'failed' | 'error'

/**
 * Remove Arabic digits and verse markers from text (for test mode)
 */
function hideArabicDigits(text: string): string {
  return text
    .replace(/[\u0660-\u0669]/g, '')    // Arabic-Indic digits ٠-٩
    .replace(/[\u06F0-\u06F9]/g, '')    // Extended Arabic-Indic digits
    .replace(/[\u06DD]/g, '')           // End of ayah mark ۝
    .replace(/\s+/g, ' ')               // Normalize spaces
    .trim()
}

// QRC WebSocket events
interface QRCCheckTilawaResponse {
  event: 'check_tilawa'
  exit_code: number
  chapter_index: number
  verse_index: number
  word_index: number
  correct_words: { chapter: number; verse: number; word: number }[]
  skipped_words: { chapter: number; verse: number; word: number }[]
  tajweed_mistakes: { chapter: number; verse: number; word: number; message: string }[]
}

export default function QRCCheckApp() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<PreCheckInfo | null>(null)
  const [telegramId, setTelegramId] = useState<number | null>(null)

  // Word tracking for real-time highlighting
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [correctWords, setCorrectWords] = useState<Set<number>>(new Set())
  const [wrongWords, setWrongWords] = useState<Set<number>>(new Set())
  const [skippedWords, setSkippedWords] = useState<Set<number>>(new Set())

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingTimerRef = useRef<number | null>(null)
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopRecordingRef = useRef<(() => void) | null>(null)

  // WebSocket for QRC
  const wsRef = useRef<WebSocket | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [score, setScore] = useState<number | null>(null)

  // Audio playback
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  // Microphone stream (pre-acquired)
  const streamRef = useRef<MediaStream | null>(null)
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean>(false)

  // Audio chunks for non-WebSocket providers (Whisper, HuggingFace)
  const audioChunksRef = useRef<Blob[]>([])

  // Get params from URL
  const groupId = searchParams.get('groupId')
  const page = searchParams.get('page')
  const startLine = searchParams.get('startLine')
  const endLine = searchParams.get('endLine')
  const stage = searchParams.get('stage')
  const msgId = searchParams.get('msgId')  // Original message ID to delete after success

  // Initialize Telegram WebApp
  useEffect(() => {
    const initTelegram = async () => {
      let retries = 30
      while (retries > 0 && !window.Telegram?.WebApp) {
        await new Promise(resolve => setTimeout(resolve, 100))
        retries--
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tg = window.Telegram?.WebApp as any
      if (tg) {
        tg.ready()
        tg.expand()
        tg.BackButton?.show()
        tg.BackButton?.onClick(() => tg.close())

        const userId = tg.initDataUnsafe?.user?.id
        if (userId) {
          setTelegramId(userId)
        }

        if (tg.themeParams?.bg_color) {
          document.body.style.backgroundColor = tg.themeParams.bg_color
        }
      }
    }

    initTelegram()
  }, [])

  // Load pre-check info (only once when telegramId is available)
  useEffect(() => {
    const loadInfo = async () => {
      if (!groupId || !page || !startLine || !endLine || !stage || !telegramId) {
        return
      }

      try {
        const params = new URLSearchParams({
          groupId,
          telegramId: telegramId.toString(),
          page,
          startLine,
          endLine,
          stage,
        })

        const response = await fetch(`/api/qrc/pre-check?${params}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Ошибка загрузки')
        }

        console.log('Pre-check info loaded:', data)
        setInfo(data)

        // Check if API key is configured for the selected provider
        if (!data.apiKeyConfigured) {
          const providerName = data.qrcSettings.provider === 'WHISPER' ? 'OpenAI' : 'Qurani.ai QRC'
          setError(`API ключ ${providerName} не настроен. Обратитесь к администратору.`)
          setStatus('error')
          return
        }

        if (data.existingPreCheck?.passed) {
          setScore(data.existingPreCheck.score)
          setStatus('success')
        } else {
          // First need to get microphone permission
          setStatus('need_mic_permission')
        }
      } catch (err) {
        console.error('Failed to load pre-check info:', err)
        setError(err instanceof Error ? err.message : 'Ошибка загрузки')
        setStatus('error')
      }
    }

    if (telegramId && !info) {
      loadInfo()
    }
  }, [groupId, page, startLine, endLine, stage, telegramId, info])

  // Request microphone permission upfront
  const requestMicPermission = useCallback(async (): Promise<void> => {
    console.log('[QRC] Requesting microphone permission...')
    try {
      // Just check permission - don't keep stream running
      // We'll acquire a fresh stream right before recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('[QRC] Microphone permission granted')

      // Stop the stream immediately - we only needed to verify permission
      // This prevents the mic indicator from showing until recording starts
      stream.getTracks().forEach(track => {
        console.log('[QRC] Stopping permission check track:', track.label)
        track.stop()
      })

      setMicPermissionGranted(true)
      setStatus('ready')
      // Haptic feedback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window.Telegram?.WebApp as any)?.HapticFeedback?.notificationOccurred('success')
    } catch (err) {
      console.error('[QRC] Microphone permission denied:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage.includes('Permission') || errorMessage.includes('NotAllowed') || errorMessage.includes('denied')) {
        setError('Нет доступа к микрофону. Разрешите доступ в настройках Telegram.')
      } else if (errorMessage.includes('NotFound')) {
        setError('Микрофон не найден на устройстве')
      } else {
        setError(`Ошибка микрофона: ${errorMessage}`)
      }
      setStatus('error')
    }
  }, [])

  // Connect to QRC WebSocket (optional - for real-time word highlighting)
  const connectWebSocket = useCallback(async (): Promise<boolean> => {
    console.log('[QRC] Connecting to WebSocket...')

    try {
      // Get API key from server
      const response = await fetch('/api/qrc/get-key')
      const data = await response.json()

      if (!data.apiKey) {
        console.warn('[QRC] API key not configured, skipping real-time check')
        return false
      }

      const ws = new WebSocket(`wss://api.qurani.ai?api_key=${data.apiKey}`)

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('[QRC] WebSocket connection timeout')
          resolve(false)
        }, 5000)

        ws.onopen = () => {
          console.log('[QRC] WebSocket connected')
          clearTimeout(timeout)
          setWsConnected(true)
          resolve(true)
        }

        ws.onmessage = (event) => {
          try {
            const response = JSON.parse(event.data)
            console.log('[QRC] WS response:', response)

            if (response.event === 'start_tilawa_session') {
              console.log('[QRC] Tilawa session started')
            } else if (response.event === 'check_tilawa') {
              handleCheckTilawaResponse(response as QRCCheckTilawaResponse)
            }
          } catch (err) {
            console.error('[QRC] Failed to parse WS response:', err)
          }
        }

        ws.onerror = (err) => {
          console.error('[QRC] WebSocket error:', err)
          clearTimeout(timeout)
          setWsConnected(false)
          resolve(false)
        }

        ws.onclose = () => {
          console.log('[QRC] WebSocket closed')
          setWsConnected(false)
        }

        wsRef.current = ws
      })
    } catch (err) {
      console.error('[QRC] Failed to connect to WebSocket:', err)
      return false
    }
  }, [])

  // Handle real-time check response
  const handleCheckTilawaResponse = (response: QRCCheckTilawaResponse) => {
    // Update current word position
    setCurrentWordIndex(response.word_index)

    // Track correct words
    if (response.correct_words) {
      setCorrectWords(prev => {
        const next = new Set(prev)
        response.correct_words.forEach(w => next.add(w.word - 1))
        return next
      })
    }

    // Track skipped words
    if (response.skipped_words) {
      setSkippedWords(prev => {
        const next = new Set(prev)
        response.skipped_words.forEach(w => next.add(w.word - 1))
        return next
      })
    }

    // Track tajweed mistakes
    if (response.tajweed_mistakes) {
      setWrongWords(prev => {
        const next = new Set(prev)
        response.tajweed_mistakes.forEach(m => next.add(m.word - 1))
        return next
      })
    }
  }

  // Start QRC session
  const startSession = useCallback(() => {
    if (!wsRef.current || !info) return

    // Get first verse info from lines
    const firstVerseKey = info.lines[0]?.verseKeys?.[0]
    if (!firstVerseKey) return

    const [chapter, verse] = firstVerseKey.split(':').map(Number)

    const payload = {
      method: 'StartTilawaSession',
      chapter_index: chapter,
      verse_index: verse,
      word_index: 1,
      hafz_level: info.qrcSettings.hafzLevel,
      tajweed_level: info.qrcSettings.tajweedLevel,
    }

    console.log('Starting QRC session:', payload)
    wsRef.current.send(JSON.stringify(payload))
  }, [info])

  // Start recording flow (after audio) - defined first to avoid circular deps
  const startRecordingFlow = useCallback(async () => {
    console.log('[AI] Starting recording flow...')
    setStatus('recording')
    setIsRecording(true)
    setRecordingTime(0)

    // Clear previous audio chunks
    audioChunksRef.current = []

    const provider = info?.qrcSettings.provider || 'QURANI_AI'
    console.log('[AI] Using provider:', provider)

    try {
      // Connect to QRC WebSocket only for QURANI_AI provider
      if (provider === 'QURANI_AI') {
        try {
          const connected = await connectWebSocket()
          console.log('[AI] WebSocket connected:', connected)
          if (connected) {
            await new Promise(resolve => setTimeout(resolve, 500))
            startSession()
          }
        } catch (wsErr) {
          console.warn('[AI] WebSocket connection failed, continuing without real-time check:', wsErr)
        }
      }

      // Always acquire a fresh stream right before recording
      // Old streams can become inactive on iOS after audio playback
      console.log('[AI] Acquiring fresh microphone stream...')

      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          console.log('[AI] Stopping old track:', track.label)
          track.stop()
        })
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      console.log('[AI] Fresh microphone stream acquired, active:', stream.active, 'tracks:', stream.getTracks().length)

      // Find supported mimeType
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        '',  // default
      ]

      let selectedMimeType = ''
      for (const mimeType of mimeTypes) {
        if (!mimeType || MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType
          console.log('[AI] Using mimeType:', mimeType || 'default')
          break
        }
      }

      const mediaRecorder = new MediaRecorder(stream, selectedMimeType ? { mimeType: selectedMimeType } : undefined)
      console.log('[AI] MediaRecorder created with mimeType:', mediaRecorder.mimeType)

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          // Always collect chunks for later processing
          audioChunksRef.current.push(event.data)

          // For QURANI_AI, also send to WebSocket for real-time feedback
          if (provider === 'QURANI_AI' && wsRef.current?.readyState === WebSocket.OPEN) {
            const buffer = await event.data.arrayBuffer()
            wsRef.current.send(buffer)
          }
        }
      }

      mediaRecorder.onstop = () => {
        console.log('[AI] MediaRecorder stopped')
      }

      mediaRecorder.onerror = (e) => {
        console.error('[AI] MediaRecorder error:', e)
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(100) // Send chunks every 100ms
      console.log('[AI] Recording started')

      // Start timer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recordingTimerRef.current = (window as any).setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000);

      // Calculate auto-stop time based on expected text length
      // For Quran recitation with tajweed, each word needs ~1.2 seconds
      const wordsCount = info?.lines.reduce((acc, l) => acc + (l.words?.length || 0), 0) || 10
      // Average: ~1.2 seconds per word + 5 seconds buffer for starting/stopping
      const autoStopSeconds = Math.max(8, Math.min(60, Math.ceil(wordsCount * 1.2) + 5))
      console.log('[AI] Auto-stop in', autoStopSeconds, 'seconds (words:', wordsCount, ')')

      // Set auto-stop timer - will call stopRecording via ref to avoid circular deps
      autoStopTimerRef.current = setTimeout(() => {
        console.log('[AI] Auto-stopping recording')
        // Haptic feedback for auto-stop
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window.Telegram?.WebApp as any)?.HapticFeedback?.notificationOccurred('success')
        // Call stopRecording via ref
        if (stopRecordingRef.current) {
          stopRecordingRef.current()
        }
      }, autoStopSeconds * 1000)

      // Haptic feedback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window.Telegram?.WebApp as any)?.HapticFeedback?.impactOccurred('medium')
    } catch (err) {
      console.error('[QRC] Failed to start recording:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage.includes('Permission') || errorMessage.includes('NotAllowed')) {
        setError('Нет доступа к микрофону. Разрешите доступ в настройках.')
      } else if (errorMessage.includes('NotFound')) {
        setError('Микрофон не найден')
      } else {
        setError(`Ошибка записи: ${errorMessage}`)
      }
      setIsRecording(false)
      setStatus('error')
    }
  }, [connectWebSocket, startSession])

  // Play sheikh audio first - play ALL verses in the task sequentially
  const playSheikhAudio = useCallback(async () => {
    // Collect all unique verse keys from all lines
    const allVerseKeys: string[] = []
    if (info?.lines) {
      for (const line of info.lines) {
        if (line.verseKeys) {
          for (const vk of line.verseKeys) {
            if (!allVerseKeys.includes(vk)) {
              allVerseKeys.push(vk)
            }
          }
        }
      }
    }

    if (allVerseKeys.length === 0) {
      console.log('No verse keys, starting recording directly')
      startRecordingFlow()
      return
    }

    console.log(`[Audio] Will play ${allVerseKeys.length} verses:`, allVerseKeys)
    setStatus('playing_audio')
    setIsPlayingAudio(true)

    // Play verses sequentially
    let currentIndex = 0

    const playNextVerse = async () => {
      if (currentIndex >= allVerseKeys.length) {
        console.log('[Audio] All verses played, starting recording')
        setIsPlayingAudio(false)
        startRecordingFlow()
        return
      }

      const verseKey = allVerseKeys[currentIndex]
      const [chapter, verse] = verseKey.split(':').map(Number)
      const chapterPadded = chapter.toString().padStart(3, '0')
      const versePadded = verse.toString().padStart(3, '0')

      // Use quran.com verse audio API (Mishary Alafasy)
      const audioUrl = `https://verses.quran.com/Alafasy/mp3/${chapterPadded}${versePadded}.mp3`
      console.log(`[Audio] Playing verse ${currentIndex + 1}/${allVerseKeys.length}: ${verseKey} from ${audioUrl}`)

      try {
        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onended = () => {
          console.log(`[Audio] Verse ${verseKey} ended`)
          currentIndex++
          playNextVerse()
        }

        audio.onerror = async () => {
          console.log(`[Audio] Primary URL failed for ${verseKey}, trying everyayah.com`)
          // Try everyayah.com format
          const altUrl = `https://everyayah.com/data/Alafasy_128kbps/${chapterPadded}${versePadded}.mp3`
          try {
            const altAudio = new Audio(altUrl)
            audioRef.current = altAudio
            altAudio.onended = () => {
              currentIndex++
              playNextVerse()
            }
            altAudio.onerror = () => {
              console.log(`[Audio] Alt URL also failed for ${verseKey}, skipping`)
              currentIndex++
              playNextVerse()
            }
            await altAudio.play()
          } catch {
            currentIndex++
            playNextVerse()
          }
        }

        // Add timeout in case audio doesn't load
        const timeoutId = setTimeout(() => {
          if (audio.paused && audio.currentTime === 0) {
            console.log(`[Audio] Timeout for ${verseKey}, skipping`)
            currentIndex++
            playNextVerse()
          }
        }, 8000)

        await audio.play()
        // Clear timeout once playing starts
        audio.onplay = () => clearTimeout(timeoutId)
      } catch (err) {
        console.error(`[Audio] Failed to play ${verseKey}:`, err)
        currentIndex++
        playNextVerse()
      }
    }

    // Start playing first verse
    playNextVerse()
  }, [info, startRecordingFlow])

  // Try alternative audio URL format (everyayah.com)
  const tryAlternativeAudio = useCallback(async (chapter: number, verse: number) => {
    try {
      // everyayah.com format: surah3digit/ayah3digit.mp3
      const chapterPadded = chapter.toString().padStart(3, '0')
      const versePadded = verse.toString().padStart(3, '0')
      const audioUrl = `https://everyayah.com/data/Alafasy_128kbps/${chapterPadded}${versePadded}.mp3`
      console.log('Trying alternative audio URL:', audioUrl)

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setIsPlayingAudio(false)
        startRecordingFlow()
      }

      audio.onerror = () => {
        console.log('Alternative audio also failed, starting recording without audio')
        setIsPlayingAudio(false)
        startRecordingFlow()
      }

      await audio.play()
    } catch (err) {
      console.error('Alternative audio failed:', err)
      setIsPlayingAudio(false)
      startRecordingFlow()
    }
  }, [startRecordingFlow])

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !isRecording) return

    const provider = info?.qrcSettings.provider || 'QURANI_AI'

    // Stop timer
    if (recordingTimerRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    // Stop auto-stop timer if active
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current)
      autoStopTimerRef.current = null
    }

    setIsRecording(false)
    setStatus('processing')

    // Wait for MediaRecorder to finish and emit all data
    await new Promise<void>((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve()
        return
      }

      const recorder = mediaRecorderRef.current

      // Set up onstop handler before calling stop
      const originalOnStop = recorder.onstop
      recorder.onstop = (e) => {
        if (originalOnStop) originalOnStop.call(recorder, e)
        console.log('[AI] MediaRecorder fully stopped, chunks:', audioChunksRef.current.length)
        // Small delay to ensure last ondataavailable is processed
        setTimeout(resolve, 100)
      }

      recorder.stop()
    })

    // Stop microphone stream to release the device and turn off indicator
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('[AI] Stopping microphone track:', track.label)
        track.stop()
      })
      streamRef.current = null
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close()
    }

    // Haptic feedback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window.Telegram?.WebApp as any)?.HapticFeedback?.impactOccurred('light')

    let calculatedScore: number

    // For non-QURANI_AI providers, process audio via REST API
    if (provider !== 'QURANI_AI' && audioChunksRef.current.length > 0) {
      try {
        console.log('[AI] Processing audio with', provider)

        // Combine audio chunks into single blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        console.log('[AI] Audio blob size:', audioBlob.size)

        // Prepare form data
        const formData = new FormData()
        formData.append('audio', audioBlob, 'recording.webm')
        formData.append('telegramId', telegramId!.toString())
        formData.append('groupId', groupId!)
        formData.append('pageNumber', page!)
        formData.append('provider', provider)

        // Get expected words and text - filter out Arabic digits/verse markers
        // so AI doesn't check how student reads verse numbers, only the actual text
        const expectedWords = info?.lines.flatMap(l =>
          l.words
            .map(w => hideArabicDigits(w.text))
            .filter(text => text.length > 0)  // Remove empty words (pure digit words)
        ) || []
        const expectedText = hideArabicDigits(info?.lines.map(l => l.textArabic).join(' ') || '')
        formData.append('expectedWords', JSON.stringify(expectedWords))
        formData.append('expectedText', expectedText)
        console.log('[AI] Expected text (filtered):', expectedText.substring(0, 100) + '...')

        // Add QRC settings (hafzLevel, tajweedLevel) for AI strictness
        formData.append('hafzLevel', (info?.qrcSettings.hafzLevel || 1).toString())
        formData.append('tajweedLevel', (info?.qrcSettings.tajweedLevel || 1).toString())

        // Call check-audio API
        const response = await fetch('/api/qrc/check-audio', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()
        console.log('[AI] Check result:', result)

        if (!response.ok) {
          throw new Error(result.error || 'AI processing failed')
        }

        calculatedScore = result.score || 0
        setScore(calculatedScore)

        // Update word matches for highlighting
        if (result.wordMatches) {
          const newCorrect = new Set<number>()
          const newWrong = new Set<number>()
          const newSkipped = new Set<number>()

          result.wordMatches.forEach((match: { position: number; status: string }) => {
            if (match.status === 'correct') newCorrect.add(match.position)
            else if (match.status === 'wrong') newWrong.add(match.position)
            else if (match.status === 'missing') newSkipped.add(match.position)
          })

          setCorrectWords(newCorrect)
          setWrongWords(newWrong)
          setSkippedWords(newSkipped)
        }
      } catch (err) {
        console.error('[AI] Processing failed:', err)
        setError(err instanceof Error ? err.message : 'Ошибка обработки')
        setStatus('error')
        return
      }
    } else {
      // For QURANI_AI, use WebSocket results
      const totalWords = info?.lines.reduce((sum, l) => sum + l.words.length, 0) || 1
      const correctCount = correctWords.size
      calculatedScore = Math.round((correctCount / totalWords) * 100)
      setScore(calculatedScore)
    }

    // Save result
    try {
      const saveResponse = await fetch('/api/qrc/pre-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          telegramId: telegramId!.toString(),
          pageNumber: parseInt(page!),
          startLine: parseInt(startLine!),
          endLine: parseInt(endLine!),
          stage,
          msgId: msgId ? parseInt(msgId) : undefined,  // Message ID to delete
          passed: calculatedScore >= (info?.qrcSettings.passThreshold || 70),
          score: calculatedScore,
          transcript: '',
          errors: JSON.stringify([]),
          rawResponse: JSON.stringify({
            correctWords: Array.from(correctWords),
            wrongWords: Array.from(wrongWords),
            skippedWords: Array.from(skippedWords),
            provider,
          }),
        }),
      })

      const saveResult = await saveResponse.json()

      if (saveResult.passed) {
        setStatus('success')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window.Telegram?.WebApp as any)?.HapticFeedback?.notificationOccurred('success')
      } else {
        setStatus('failed')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window.Telegram?.WebApp as any)?.HapticFeedback?.notificationOccurred('warning')
      }
    } catch (err) {
      console.error('Failed to save result:', err)
      setStatus('failed')
    }
  }, [isRecording, info, groupId, telegramId, page, startLine, endLine, stage, correctWords, wrongWords, skippedWords])

  // Keep stopRecording ref updated for auto-stop timer
  useEffect(() => {
    stopRecordingRef.current = stopRecording
  }, [stopRecording])

  // Cleanup on unmount - release microphone and stop recording
  useEffect(() => {
    return () => {
      console.log('[QRC] Component unmounting, cleaning up...')

      // Stop recording timer
      if (recordingTimerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).clearInterval(recordingTimerRef.current)
      }

      // Stop auto-stop timer
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current)
      }

      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }

      // Release microphone
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          console.log('[QRC] Cleanup: stopping track:', track.label)
          track.stop()
        })
      }

      // Stop audio playback
      if (audioRef.current) {
        audioRef.current.pause()
      }

      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  // Handle retry
  const handleRetry = useCallback(() => {
    setStatus('ready')
    setScore(null)
    setError(null)
    setRecordingTime(0)
    setCurrentWordIndex(0)
    setCorrectWords(new Set())
    setWrongWords(new Set())
    setSkippedWords(new Set())
  }, [])

  // Handle close
  const handleClose = useCallback(() => {
    window.Telegram?.WebApp?.close()
  }, [])

  // Skip audio and start recording directly
  const skipAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setIsPlayingAudio(false)
    startRecordingFlow()
  }, [startRecordingFlow])

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get stage name
  const getStageName = (stage: string) => {
    const names: Record<string, string> = {
      'STAGE_1_1': 'Этап 1.1',
      'STAGE_1_2': 'Этап 1.2',
      'STAGE_2_1': 'Этап 2.1',
      'STAGE_2_2': 'Этап 2.2',
      'STAGE_3': 'Этап 3',
    }
    return names[stage] || stage
  }

  // Get word class based on status
  const getWordClass = (wordIndex: number): string => {
    if (correctWords.has(wordIndex)) {
      return 'text-green-500'
    }
    if (wrongWords.has(wordIndex)) {
      return 'text-red-500 underline decoration-wavy'
    }
    if (skippedWords.has(wordIndex)) {
      return 'text-orange-400 opacity-50'
    }
    if (status === 'recording' && wordIndex < currentWordIndex) {
      return 'text-green-500'
    }
    return 'text-foreground'
  }

  // Get all words flattened
  const getAllWords = (): QuranWord[] => {
    if (!info?.lines) return []
    return info.lines.flatMap(l => l.words)
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-lg font-medium">Загрузка...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Ошибка
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {error || 'Произошла ошибка'}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.Telegram?.WebApp?.close()}
            >
              Закрыть
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const allWords = getAllWords()

  return (
    <div className="min-h-screen p-4 pb-24">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            AI Проверка чтения
          </CardTitle>
          {info && (
            <p className="text-sm text-muted-foreground">
              {info.groupName} • {getStageName(info.stage)}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Page info */}
          {info && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium mb-1">
                Страница {info.pageNumber}, {info.startLine === info.endLine
                  ? `строка ${info.startLine}`
                  : `строки ${info.startLine}-${info.endLine}`}
              </p>
              <p className="text-xs text-muted-foreground">
                Порог прохождения: {info.qrcSettings.passThreshold}%
              </p>
            </div>
          )}

          {/* Arabic text with tajweed coloring */}
          <div className="bg-card border rounded-lg p-4">
            <div className="text-right leading-loose" dir="rtl">
              {/* Show tajweed text if available (during ready/playing_audio states) */}
              {(status === 'ready' || status === 'playing_audio' || status === 'need_mic_permission') && info?.lines.some(l => l.textTajweed) ? (
                <div className="space-y-2">
                  {info.lines.map(line => (
                    <p
                      key={line.lineNumber}
                      className="text-2xl font-arabic leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: line.textTajweed || hideArabicDigits(line.textArabic || '')
                      }}
                    />
                  ))}
                </div>
              ) : allWords.length > 0 ? (
                // Word-by-word with highlighting (during recording/results)
                <div className="flex flex-wrap gap-x-2 gap-y-1 justify-end">
                  {allWords.map((word, idx) => {
                    // Hide Arabic digits and verse markers from display
                    const displayText = hideArabicDigits(word.text)
                    if (!displayText) return null  // Skip pure digit words

                    return (
                      <span
                        key={`word-${idx}-${word.position}`}
                        className={`text-2xl font-arabic transition-colors duration-200 ${getWordClass(idx)}`}
                      >
                        {displayText}
                      </span>
                    )
                  })}
                </div>
              ) : info?.lines && info.lines.length > 0 ? (
                // Fallback to full text (hide verse numbers for test mode)
                <div className="space-y-2">
                  {info.lines.map(line => (
                    <p key={line.lineNumber} className="text-2xl font-arabic">
                      {hideArabicDigits(line.textArabic || '')}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center" dir="ltr">
                  Текст не загружен
                </p>
              )}
            </div>

            {/* Verse keys hidden for test mode */}
          </div>

          {/* Need microphone permission */}
          {status === 'need_mic_permission' && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Для проверки чтения нужен доступ к микрофону
              </p>
              <Button
                size="lg"
                className="w-full"
                onClick={requestMicPermission}
              >
                <Mic className="w-5 h-5 mr-2" />
                Разрешить микрофон
              </Button>
            </div>
          )}

          {/* Ready state - Start button */}
          {status === 'ready' && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Микрофон подключён</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Сначала прослушайте правильное чтение, затем повторите
              </p>
              <Button
                size="lg"
                className="w-full"
                onClick={playSheikhAudio}
              >
                <Volume2 className="w-5 h-5 mr-2" />
                Начать проверку
              </Button>
            </div>
          )}

          {/* Playing audio state */}
          {status === 'playing_audio' && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Volume2 className="w-6 h-6 text-primary animate-pulse" />
                <p className="font-medium">Слушайте...</p>
              </div>
              <p className="text-sm text-muted-foreground">
                После прослушивания начнётся запись
              </p>
              <Button variant="outline" onClick={skipAudio}>
                <VolumeX className="w-4 h-4 mr-2" />
                Пропустить
              </Button>
            </div>
          )}

          {/* Recording state */}
          {status === 'recording' && (
            <div className="text-center space-y-4">
              {/* Timer */}
              <div className="text-3xl font-mono font-bold text-primary">
                {formatTime(recordingTime)}
              </div>

              {/* Recording indicator */}
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Запись...</span>
              </div>

              {/* Stop button */}
              <Button
                size="lg"
                variant="destructive"
                className="w-20 h-20 rounded-full animate-pulse"
                onClick={stopRecording}
              >
                <MicOff className="w-8 h-8" />
              </Button>

              <p className="text-sm text-muted-foreground">
                Нажмите для остановки
              </p>

              {/* Legend */}
              <div className="flex justify-center gap-4 text-xs pt-2">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Верно
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Ошибка
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                  Пропущено
                </span>
              </div>
            </div>
          )}

          {/* Processing state */}
          {status === 'processing' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="font-medium">Обработка...</p>
            </div>
          )}

          {/* Result states */}
          {(status === 'success' || status === 'failed') && (
            <div className="text-center space-y-4">
              {status === 'success' ? (
                <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
              ) : (
                <XCircle className="w-16 h-16 mx-auto text-orange-500" />
              )}

              <div>
                <p className={`text-xl font-bold ${status === 'success' ? 'text-green-600' : 'text-orange-600'}`}>
                  {status === 'success' ? 'Успешно!' : 'Попробуйте ещё раз'}
                </p>
                <p className="text-3xl font-bold">{score}%</p>
              </div>

              <div className="space-y-1">
                <Progress value={score || 0} className="h-3" />
                <p className="text-xs text-muted-foreground">
                  {status === 'success'
                    ? `Порог: ${info?.qrcSettings.passThreshold}%`
                    : `Нужно минимум ${info?.qrcSettings.passThreshold}%`
                  }
                </p>
              </div>

              {/* Stats */}
              <div className="flex justify-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">{correctWords.size}</p>
                  <p className="text-xs text-muted-foreground">Верно</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{wrongWords.size}</p>
                  <p className="text-xs text-muted-foreground">Ошибок</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-400">{skippedWords.size}</p>
                  <p className="text-xs text-muted-foreground">Пропущено</p>
                </div>
              </div>

              {status === 'success' ? (
                <Button className="w-full" onClick={handleClose}>
                  Продолжить
                </Button>
              ) : (
                <Button className="w-full" onClick={handleRetry}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Попробовать снова
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
