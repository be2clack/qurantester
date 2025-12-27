'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  Key,
  Save,
  Loader2,
  Check,
  X,
  Eye,
  EyeOff,
  Sparkles,
  Search,
  ExternalLink,
  Trash2,
  Bot,
  Mic,
  MicOff,
  Square,
  Play,
  Volume2,
  AlertCircle,
  CheckCircle,
  XCircle,
  TestTube,
} from 'lucide-react'

interface ApiKey {
  key: string
  status: 'configured' | 'not_configured'
  maskedValue?: string
}

interface ApiKeysData {
  QURANI_AI_QRC_KEY: ApiKey
  QURANI_AI_SEMANTIC_KEY: ApiKey
  OPENAI_API_KEY: ApiKey
  OPENAI_MODEL: ApiKey
}

const OPENAI_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Быстрый и недорогой' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Продвинутый мультимодальный' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Быстрый GPT-4' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Экономичный' },
]

const AI_PROVIDERS = [
  { value: 'QURANI_AI', label: 'Qurani.ai QRC', description: 'WebSocket API', icon: Sparkles, color: 'amber' },
  { value: 'WHISPER', label: 'OpenAI Whisper', description: 'REST API', icon: Bot, color: 'emerald' },
] as const

type TestStatus = 'idle' | 'loading' | 'need_mic' | 'ready' | 'playing' | 'recording' | 'processing' | 'success' | 'failed' | 'error'

interface TestResult {
  score: number
  transcript: string
  errors: { word: string; type: string; position: number }[]
  processingTime: number
  provider: string
  wordMatches?: { position: number; status: string; expected?: string; actual?: string }[]
}

interface QuranLine {
  lineNumber: number
  text: string
  words: { text: string; position: number }[]
}

// AI Test Modal Component
function AITestModal({
  open,
  onOpenChange,
  apiKeys,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiKeys: ApiKeysData | null
}) {
  const [selectedProvider, setSelectedProvider] = useState<'QURANI_AI' | 'WHISPER'>('QURANI_AI')
  const [pageNumber, setPageNumber] = useState(1)
  const [startLine, setStartLine] = useState(1)
  const [endLine, setEndLine] = useState(3)
  const [status, setStatus] = useState<TestStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<QuranLine[]>([])
  const [result, setResult] = useState<TestResult | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [micPermission, setMicPermission] = useState(false)

  // QRC-specific settings
  const [hafzLevel, setHafzLevel] = useState(1)
  const [tajweedLevel, setTajweedLevel] = useState(1)

  // Audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Word highlighting
  const [correctWords, setCorrectWords] = useState<Set<number>>(new Set())
  const [wrongWords, setWrongWords] = useState<Set<number>>(new Set())
  const [skippedWords, setSkippedWords] = useState<Set<number>>(new Set())

  // Check if selected provider has API key configured
  const isProviderConfigured = useCallback(() => {
    if (!apiKeys) return false
    switch (selectedProvider) {
      case 'QURANI_AI':
        return apiKeys.QURANI_AI_QRC_KEY?.status === 'configured'
      case 'WHISPER':
        return apiKeys.OPENAI_API_KEY?.status === 'configured'
    }
  }, [apiKeys, selectedProvider])

  // Load Quran text for the selected page/lines
  const loadQuranText = useCallback(async () => {
    setStatus('loading')
    setError(null)
    setResult(null)
    setCorrectWords(new Set())
    setWrongWords(new Set())
    setSkippedWords(new Set())

    try {
      const response = await fetch(
        `/api/quran/page-lines?page=${pageNumber}&startLine=${startLine}&endLine=${endLine}`
      )
      if (!response.ok) throw new Error('Failed to load Quran text')
      const data = await response.json()
      setLines(data.lines || [])
      setStatus('need_mic')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load text')
      setStatus('error')
    }
  }, [pageNumber, startLine, endLine])

  // Request microphone permission
  const requestMicPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setMicPermission(true)
      setStatus('ready')
    } catch (err) {
      setError('Нет доступа к микрофону. Разрешите доступ в настройках браузера.')
      setStatus('error')
    }
  }, [])

  // Play sheikh audio
  const playAudio = useCallback(async () => {
    if (lines.length === 0) return

    setStatus('playing')

    // Get first verse key from lines if available
    // For now just skip audio and go to recording
    setTimeout(() => {
      startRecording()
    }, 500)
  }, [lines])

  // Start recording
  const startRecording = useCallback(async () => {
    setStatus('recording')
    setRecordingTime(0)
    audioChunksRef.current = []

    try {
      let stream = streamRef.current
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
      }

      // Find supported mime type
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg', '']
      let selectedMimeType = ''
      for (const mt of mimeTypes) {
        if (!mt || MediaRecorder.isTypeSupported(mt)) {
          selectedMimeType = mt
          break
        }
      }

      const mediaRecorder = new MediaRecorder(stream, selectedMimeType ? { mimeType: selectedMimeType } : undefined)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.start(100)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      setError('Ошибка записи: ' + (err instanceof Error ? err.message : String(err)))
      setStatus('error')
    }
  }, [])

  // Stop recording and process
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    mediaRecorderRef.current.stop()
    setStatus('processing')

    // Wait for all chunks to be collected
    await new Promise((resolve) => setTimeout(resolve, 200))

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

      // Prepare form data
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('telegramId', '0') // Test mode
      formData.append('pageNumber', pageNumber.toString())
      formData.append('provider', selectedProvider)

      // Get expected words and text
      const allWords = lines.flatMap((l) => l.words.map((w) => w.text))
      const expectedText = lines.map((l) => l.text).join(' ')
      formData.append('expectedWords', JSON.stringify(allWords))
      formData.append('expectedText', expectedText)

      // For QRC, add levels
      if (selectedProvider === 'QURANI_AI') {
        formData.append('hafzLevel', hafzLevel.toString())
        formData.append('tajweedLevel', tajweedLevel.toString())
      }

      const response = await fetch('/api/qrc/check-audio', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Processing failed')
      }

      setResult(data)

      // Update word highlights
      if (data.wordMatches) {
        const newCorrect = new Set<number>()
        const newWrong = new Set<number>()
        const newSkipped = new Set<number>()

        data.wordMatches.forEach((match: { position: number; status: string }) => {
          if (match.status === 'correct') newCorrect.add(match.position)
          else if (match.status === 'wrong') newWrong.add(match.position)
          else if (match.status === 'missing') newSkipped.add(match.position)
        })

        setCorrectWords(newCorrect)
        setWrongWords(newWrong)
        setSkippedWords(newSkipped)
      }

      setStatus(data.score >= 70 ? 'success' : 'failed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed')
      setStatus('error')
    }
  }, [lines, pageNumber, selectedProvider, hafzLevel, tajweedLevel])

  // Reset test
  const resetTest = useCallback(() => {
    setStatus('idle')
    setResult(null)
    setLines([])
    setError(null)
    setCorrectWords(new Set())
    setWrongWords(new Set())
    setSkippedWords(new Set())
    setRecordingTime(0)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get word class for highlighting
  const getWordClass = (wordIndex: number) => {
    if (correctWords.has(wordIndex)) return 'text-green-600 bg-green-100 dark:bg-green-900/30'
    if (wrongWords.has(wordIndex)) return 'text-red-600 bg-red-100 dark:bg-red-900/30'
    if (skippedWords.has(wordIndex)) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 line-through'
    return ''
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Тест AI моделей
          </DialogTitle>
          <DialogDescription>
            Проверьте работу AI моделей для распознавания чтения Корана
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Provider Selection */}
          <div className="space-y-3">
            <Label>AI Модель</Label>
            <div className="grid grid-cols-3 gap-2">
              {AI_PROVIDERS.map((provider) => {
                const Icon = provider.icon
                const isSelected = selectedProvider === provider.value
                const isConfigured = (() => {
                  if (!apiKeys) return false
                  switch (provider.value) {
                    case 'QURANI_AI':
                      return apiKeys.QURANI_AI_QRC_KEY?.status === 'configured'
                    case 'WHISPER':
                      return apiKeys.OPENAI_API_KEY?.status === 'configured'
                  }
                })()

                return (
                  <div
                    key={provider.value}
                    onClick={() => setSelectedProvider(provider.value)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent bg-muted hover:border-muted-foreground/50'
                    } ${!isConfigured ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      {isConfigured ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                    </div>
                    <p className="text-sm font-medium">{provider.label}</p>
                    <p className="text-xs text-muted-foreground">{provider.description}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {!isProviderConfigured() && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">API ключ не настроен</span>
              </div>
              <p className="text-xs text-red-500 mt-1">
                Настройте API ключ для выбранного провайдера ниже на этой странице
              </p>
            </div>
          )}

          {/* Page/Line Selection */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Страница</Label>
              <Input
                type="number"
                min={1}
                max={604}
                value={pageNumber}
                onChange={(e) => setPageNumber(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label>Начальная строка</Label>
              <Input
                type="number"
                min={1}
                max={15}
                value={startLine}
                onChange={(e) => setStartLine(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label>Конечная строка</Label>
              <Input
                type="number"
                min={1}
                max={15}
                value={endLine}
                onChange={(e) => setEndLine(parseInt(e.target.value) || 3)}
              />
            </div>
          </div>

          {/* QRC-specific settings */}
          {selectedProvider === 'QURANI_AI' && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <div className="space-y-2">
                <Label className="text-xs">Уровень хифза: {hafzLevel}</Label>
                <Slider
                  value={[hafzLevel]}
                  onValueChange={([v]) => setHafzLevel(v)}
                  min={1}
                  max={3}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Уровень таджвида: {tajweedLevel}</Label>
                <Slider
                  value={[tajweedLevel]}
                  onValueChange={([v]) => setTajweedLevel(v)}
                  min={1}
                  max={3}
                  step={1}
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-center">
            {status === 'idle' && (
              <Button onClick={loadQuranText} disabled={!isProviderConfigured()} size="lg">
                <Play className="h-4 w-4 mr-2" />
                Загрузить текст
              </Button>
            )}

            {status === 'loading' && (
              <Button disabled size="lg">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Загрузка...
              </Button>
            )}

            {status === 'need_mic' && (
              <Button onClick={requestMicPermission} size="lg">
                <Mic className="h-4 w-4 mr-2" />
                Разрешить микрофон
              </Button>
            )}

            {status === 'ready' && (
              <Button onClick={playAudio} size="lg" className="bg-green-600 hover:bg-green-700">
                <Volume2 className="h-4 w-4 mr-2" />
                Начать запись
              </Button>
            )}

            {status === 'playing' && (
              <Button disabled size="lg">
                <Volume2 className="h-4 w-4 mr-2 animate-pulse" />
                Подготовка...
              </Button>
            )}

            {status === 'recording' && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-red-600">
                    <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                    <span className="font-mono text-lg">{formatTime(recordingTime)}</span>
                  </div>
                  <Button onClick={stopRecording} size="lg" variant="destructive">
                    <Square className="h-4 w-4 mr-2" />
                    Остановить
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Прочитайте текст выше</p>
              </div>
            )}

            {status === 'processing' && (
              <Button disabled size="lg">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Обработка...
              </Button>
            )}

            {(status === 'success' || status === 'failed') && (
              <Button onClick={resetTest} size="lg" variant="outline">
                Повторить тест
              </Button>
            )}

            {status === 'error' && (
              <Button onClick={resetTest} size="lg" variant="destructive">
                Попробовать снова
              </Button>
            )}
          </div>

          {/* Quran Text Display */}
          {lines.length > 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-2xl leading-loose text-right font-['Scheherazade_New',serif]" dir="rtl">
                {(() => {
                  let globalWordIndex = 0
                  return lines.map((line, lineIdx) => (
                    <div key={lineIdx} className="mb-2">
                      {line.words.map((word, wordIdx) => {
                        const currentIndex = globalWordIndex++
                        return (
                          <span
                            key={wordIdx}
                            className={`inline-block mx-1 px-1 rounded ${getWordClass(currentIndex)}`}
                          >
                            {word.text}
                          </span>
                        )
                      })}
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border-2 ${
                result.score >= 70
                  ? 'bg-green-50 dark:bg-green-950/20 border-green-500'
                  : 'bg-red-50 dark:bg-red-950/20 border-red-500'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {result.score >= 70 ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">
                      {result.score >= 70 ? 'Тест пройден' : 'Тест не пройден'}
                    </span>
                  </div>
                  <div className="text-2xl font-bold">
                    {result.score}%
                  </div>
                </div>
                <Progress value={result.score} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-muted-foreground">Провайдер</p>
                  <p className="font-medium">{result.provider}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-muted-foreground">Время обработки</p>
                  <p className="font-medium">{result.processingTime}ms</p>
                </div>
              </div>

              {result.transcript && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Распознанный текст:</p>
                  <p className="text-right font-['Scheherazade_New',serif]" dir="rtl">
                    {result.transcript}
                  </p>
                </div>
              )}

              {result.errors && result.errors.length > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Ошибки ({result.errors.length}):</p>
                  <div className="space-y-1">
                    {result.errors.slice(0, 5).map((err, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-xs">{err.type}</Badge>
                        <span className="font-['Scheherazade_New',serif]">{err.word}</span>
                      </div>
                    ))}
                    {result.errors.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        ...и ещё {result.errors.length - 5}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function ApiSettingsPage() {
  const [keys, setKeys] = useState<ApiKeysData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [testModalOpen, setTestModalOpen] = useState(false)

  // Input states
  const [qrcKeyInput, setQrcKeyInput] = useState('')
  const [semanticKeyInput, setSemanticKeyInput] = useState('')
  const [openaiKeyInput, setOpenaiKeyInput] = useState('')
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini')

  // Show/hide states
  const [showQrcKey, setShowQrcKey] = useState(false)
  const [showSemanticKey, setShowSemanticKey] = useState(false)
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)

  useEffect(() => {
    fetchKeys()
  }, [])

  async function fetchKeys() {
    try {
      const res = await fetch('/api/settings/quran-api')
      if (res.ok) {
        const data = await res.json()
        setKeys(data)
        // Set current model if configured
        if (data.OPENAI_MODEL?.maskedValue) {
          setOpenaiModel(data.OPENAI_MODEL.maskedValue)
        }
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveKey(keyName: string, value: string) {
    if (!value.trim()) return

    setSaving(keyName)
    try {
      const res = await fetch('/api/settings/quran-api', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyName, value }),
      })

      if (res.ok) {
        await fetchKeys()
        // Clear input
        if (keyName === 'QURANI_AI_QRC_KEY') setQrcKeyInput('')
        if (keyName === 'QURANI_AI_SEMANTIC_KEY') setSemanticKeyInput('')
        if (keyName === 'OPENAI_API_KEY') setOpenaiKeyInput('')
      }
    } catch (error) {
      console.error('Failed to save API key:', error)
    } finally {
      setSaving(null)
    }
  }

  async function handleDeleteKey(keyName: string) {
    if (!confirm('Удалить этот API ключ?')) return

    setDeleting(keyName)
    try {
      const res = await fetch(`/api/settings/quran-api?key=${keyName}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchKeys()
      }
    } catch (error) {
      console.error('Failed to delete API key:', error)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const openaiConfigured = keys?.OPENAI_API_KEY?.status === 'configured'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Key className="h-6 w-6" />
              Настройки API
            </h1>
            <p className="text-muted-foreground">
              Управление ключами внешних API сервисов
            </p>
          </div>
        </div>
        <Button onClick={() => setTestModalOpen(true)} className="gap-2">
          <TestTube className="h-4 w-4" />
          Тест AI моделей
        </Button>
      </div>

      {/* OpenAI Section */}
      <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">OpenAI API</CardTitle>
                <CardDescription>
                  Перевод муфрадата (пословный перевод) с помощью ChatGPT
                </CardDescription>
              </div>
            </div>
            <Badge variant={openaiConfigured ? 'default' : 'secondary'} className="gap-1">
              {openaiConfigured ? (
                <>
                  <Check className="h-3 w-3" />
                  Настроен
                </>
              ) : (
                <>
                  <X className="h-3 w-3" />
                  Не настроен
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current key display */}
          {openaiConfigured && (
            <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-black/20 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Текущий ключ</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {showOpenaiKey ? keys?.OPENAI_API_KEY?.maskedValue : '••••••••••••••••'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                >
                  {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteKey('OPENAI_API_KEY')}
                  disabled={deleting === 'OPENAI_API_KEY'}
                >
                  {deleting === 'OPENAI_API_KEY' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* API Key input */}
          <div className="space-y-2">
            <Label htmlFor="openai-key">
              {openaiConfigured ? 'Обновить API ключ' : 'API ключ'}
            </Label>
            <div className="flex gap-2">
              <Input
                id="openai-key"
                type="password"
                placeholder="sk-..."
                value={openaiKeyInput}
                onChange={(e) => setOpenaiKeyInput(e.target.value)}
              />
              <Button
                onClick={() => handleSaveKey('OPENAI_API_KEY', openaiKeyInput)}
                disabled={!openaiKeyInput.trim() || saving === 'OPENAI_API_KEY'}
              >
                {saving === 'OPENAI_API_KEY' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Model selection */}
          <div className="space-y-2">
            <Label>Модель</Label>
            <div className="flex gap-2">
              <Select value={openaiModel} onValueChange={setOpenaiModel}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPENAI_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span>{model.name}</span>
                        <span className="text-xs text-muted-foreground">{model.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => handleSaveKey('OPENAI_MODEL', openaiModel)}
                disabled={saving === 'OPENAI_MODEL'}
                variant="outline"
              >
                {saving === 'OPENAI_MODEL' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
            {keys?.OPENAI_MODEL?.status === 'configured' && (
              <p className="text-xs text-muted-foreground">
                Текущая модель: <span className="font-mono">{keys.OPENAI_MODEL.maskedValue}</span>
              </p>
            )}
          </div>

          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline"
          >
            Получить API ключ на OpenAI
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>

      {/* Qurani.ai Info Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
              <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100">О Qurani.ai API</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Qurani.ai предоставляет AI-сервисы для работы с Кораном: проверка чтения,
                семантический поиск и многое другое.
              </p>
              <a
                href="https://qurani.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
              >
                Получить API ключ
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Qurani.ai Keys */}
      <div className="grid gap-6">
        {/* QRC Key */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">QRC API Key</CardTitle>
                  <CardDescription>AI проверка чтения Корана</CardDescription>
                </div>
              </div>
              <Badge variant={keys?.QURANI_AI_QRC_KEY?.status === 'configured' ? 'default' : 'secondary'} className="gap-1">
                {keys?.QURANI_AI_QRC_KEY?.status === 'configured' ? (
                  <>
                    <Check className="h-3 w-3" />
                    Настроен
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3" />
                    Не настроен
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {keys?.QURANI_AI_QRC_KEY?.status === 'configured' && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Текущий ключ</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {showQrcKey ? keys?.QURANI_AI_QRC_KEY?.maskedValue : '••••••••••••••••'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setShowQrcKey(!showQrcKey)}>
                    {showQrcKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteKey('QURANI_AI_QRC_KEY')}
                    disabled={deleting === 'QURANI_AI_QRC_KEY'}
                  >
                    {deleting === 'QURANI_AI_QRC_KEY' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="qrc-key">
                {keys?.QURANI_AI_QRC_KEY?.status === 'configured' ? 'Обновить ключ' : 'Добавить ключ'}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="qrc-key"
                  type="password"
                  placeholder="sk-..."
                  value={qrcKeyInput}
                  onChange={(e) => setQrcKeyInput(e.target.value)}
                />
                <Button
                  onClick={() => handleSaveKey('QURANI_AI_QRC_KEY', qrcKeyInput)}
                  disabled={!qrcKeyInput.trim() || saving === 'QURANI_AI_QRC_KEY'}
                >
                  {saving === 'QURANI_AI_QRC_KEY' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <a
              href="https://qurani.ai/en/docs/qrc"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Документация
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {/* Semantic Search Key */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Semantic Search API Key</CardTitle>
                  <CardDescription>Семантический поиск по Корану</CardDescription>
                </div>
              </div>
              <Badge variant={keys?.QURANI_AI_SEMANTIC_KEY?.status === 'configured' ? 'default' : 'secondary'} className="gap-1">
                {keys?.QURANI_AI_SEMANTIC_KEY?.status === 'configured' ? (
                  <>
                    <Check className="h-3 w-3" />
                    Настроен
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3" />
                    Не настроен
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {keys?.QURANI_AI_SEMANTIC_KEY?.status === 'configured' && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Текущий ключ</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {showSemanticKey ? keys?.QURANI_AI_SEMANTIC_KEY?.maskedValue : '••••••••••••••••'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setShowSemanticKey(!showSemanticKey)}>
                    {showSemanticKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteKey('QURANI_AI_SEMANTIC_KEY')}
                    disabled={deleting === 'QURANI_AI_SEMANTIC_KEY'}
                  >
                    {deleting === 'QURANI_AI_SEMANTIC_KEY' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="semantic-key">
                {keys?.QURANI_AI_SEMANTIC_KEY?.status === 'configured' ? 'Обновить ключ' : 'Добавить ключ'}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="semantic-key"
                  type="password"
                  placeholder="sk-..."
                  value={semanticKeyInput}
                  onChange={(e) => setSemanticKeyInput(e.target.value)}
                />
                <Button
                  onClick={() => handleSaveKey('QURANI_AI_SEMANTIC_KEY', semanticKeyInput)}
                  disabled={!semanticKeyInput.trim() || saving === 'QURANI_AI_SEMANTIC_KEY'}
                >
                  {saving === 'QURANI_AI_SEMANTIC_KEY' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <a
              href="https://qurani.ai/en/docs/semantic-search"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Документация
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Quran.com Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Quran.com API
          </CardTitle>
          <CardDescription>
            Основной API для получения текста Корана, переводов, тафсиров и аудио
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
              <Check className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                API ключ не требуется
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Базовые функции Quran.com API доступны без регистрации
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Test Modal */}
      <AITestModal
        open={testModalOpen}
        onOpenChange={setTestModalOpen}
        apiKeys={keys}
      />
    </div>
  )
}
