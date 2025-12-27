'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  BookOpen,
  Search,
  Edit2,
  Check,
  Loader2,
  Sparkles,
  Download,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronFirst,
  ChevronLast,
  Languages,
  Brain,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getSurahByNumber } from '@/lib/constants/surahs'

interface WordTranslation {
  id: string
  wordKey: string
  surahNumber: number
  ayahNumber: number
  position: number
  textArabic: string
  translationEn: string | null
  translationRu: string | null
  isVerified: boolean
  aiGenerated: boolean
}

export default function MufradatAdminPage() {
  const [words, setWords] = useState<WordTranslation[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchSurah, setSearchSurah] = useState('1')
  const [searchAyah, setSearchAyah] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    translated: 0,
    verified: 0,
    aiGenerated: 0,
  })

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalWords, setTotalWords] = useState(0)
  const ITEMS_PER_PAGE = 100

  // Edit dialog
  const [editWord, setEditWord] = useState<WordTranslation | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Batch import state
  const [batchImporting, setBatchImporting] = useState(false)
  const [batchPaused, setBatchPaused] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchCurrentSurah, setBatchCurrentSurah] = useState(1)
  const [batchCurrentAyah, setBatchCurrentAyah] = useState(1)
  const [batchCurrentPosition, setBatchCurrentPosition] = useState(0)
  const [batchImported, setBatchImported] = useState(0)
  const [batchTranslated, setBatchTranslated] = useState(0)
  const [batchLog, setBatchLog] = useState<string[]>([])
  const batchPausedRef = useRef(false)

  // Context-aware translation state
  const [contextTranslating, setContextTranslating] = useState(false)
  const [contextProgress, setContextProgress] = useState({ translated: 0, remaining: 0 })
  const [contextLog, setContextLog] = useState<string[]>([])
  const contextPausedRef = useRef(false)

  // Current surah stats (for both import and translation)
  const [surahStats, setSurahStats] = useState({ total: 0, translated: 0, untranslated: 0, progress: 0, imported: 0 })
  const [loadingSurahStats, setLoadingSurahStats] = useState(false)

  // Single surah import state
  const [surahImporting, setSurahImporting] = useState(false)
  const [surahImportLog, setSurahImportLog] = useState<string[]>([])

  // Full Quran context translation state
  const [fullContextTranslating, setFullContextTranslating] = useState(false)
  const [fullContextSurah, setFullContextSurah] = useState(1)
  const [fullContextAyah, setFullContextAyah] = useState(1)
  const [fullContextTotal, setFullContextTotal] = useState(0)
  const [fullContextLog, setFullContextLog] = useState<string[]>([])
  const fullContextPausedRef = useRef(false)

  // Fetch words with pagination
  const fetchWords = async (page: number = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchSurah) params.set('surah', searchSurah)
      if (searchAyah) params.set('ayah', searchAyah)
      params.set('page', page.toString())
      params.set('limit', ITEMS_PER_PAGE.toString())

      const res = await fetch(`/api/admin/quran/mufradat?${params}`)
      if (res.ok) {
        const data = await res.json()
        setWords(data.words || [])
        setStats(data.stats || stats)
        if (data.pagination) {
          setCurrentPage(data.pagination.page)
          setTotalPages(data.pagination.totalPages)
          setTotalWords(data.pagination.totalWords)
        }
      }
    } catch (error) {
      console.error('Error fetching words:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      fetchWords(page)
    }
  }

  // Update translation
  const saveTranslation = async (verify = false) => {
    if (!editWord) return

    setSaving(true)
    try {
      const res = await fetch('/api/quran/words', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordKey: editWord.wordKey,
          translationRu: editValue,
          verify,
        }),
      })

      if (res.ok) {
        // Update local state
        setWords(words.map(w =>
          w.wordKey === editWord.wordKey
            ? { ...w, translationRu: editValue, isVerified: verify || w.isVerified }
            : w
        ))
        setEditWord(null)
      }
    } catch (error) {
      console.error('Error saving translation:', error)
    } finally {
      setSaving(false)
    }
  }

  // Generate translation with AI
  const generateTranslation = async () => {
    if (!editWord) return

    setSaving(true)
    try {
      const res = await fetch('/api/admin/quran/mufradat/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordKey: editWord.wordKey,
          textArabic: editWord.textArabic,
          translationEn: editWord.translationEn,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setEditValue(data.translationRu)
      }
    } catch (error) {
      console.error('Error generating translation:', error)
    } finally {
      setSaving(false)
    }
  }

  // Import words from Quran.com API
  const importWords = async () => {
    if (!searchSurah) return

    setImporting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/quran/mufradat/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surah: parseInt(searchSurah) }),
      })

      if (res.ok) {
        const data = await res.json()
        setMessage({ type: 'success', text: data.message })
        // Refresh words list
        await fetchWords()
      } else {
        const error = await res.json()
        setMessage({ type: 'error', text: error.error || 'Не удалось импортировать слова' })
      }
    } catch (error) {
      console.error('Error importing words:', error)
      setMessage({ type: 'error', text: 'Произошла ошибка при импорте' })
    } finally {
      setImporting(false)
    }
  }

  // Load saved batch progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('mufradat_batch_progress')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setBatchCurrentSurah(data.surah || 1)
        setBatchCurrentAyah(data.ayah || 1)
        setBatchCurrentPosition(data.position || 0)
        setBatchImported(data.imported || 0)
        setBatchProgress(data.progress || 0)
      } catch {}
    }
  }, [])

  // Save batch progress to localStorage
  const saveBatchProgress = (surah: number, ayah: number, position: number, imported: number, progress: number) => {
    localStorage.setItem('mufradat_batch_progress', JSON.stringify({
      surah, ayah, position, imported, progress
    }))
  }

  // Batch import function (no GPT, just import words)
  const runBatchImport = async (startSurah: number, startAyah: number, startPosition: number) => {
    setBatchImporting(true)
    setBatchPaused(false)
    batchPausedRef.current = false

    let surah = startSurah
    let ayah = startAyah
    let position = startPosition
    let totalImported = batchImported

    while (surah <= 114 && !batchPausedRef.current) {
      try {
        const res = await fetch('/api/admin/quran/mufradat/import-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surah,
            fromAyah: ayah,
            fromPosition: position,
            withTranslation: false
          }),
        })

        if (!res.ok) {
          const error = await res.json()
          setBatchLog(prev => [...prev, `❌ Ошибка: ${error.error || 'Unknown error'}`])
          saveBatchProgress(surah, ayah, position, totalImported, batchProgress)
          setBatchPaused(true)
          break
        }

        const data = await res.json()
        totalImported += data.imported
        setBatchImported(totalImported)
        setBatchProgress(data.progress)
        setBatchCurrentSurah(data.currentSurah)
        setBatchCurrentAyah(data.currentAyah)
        setBatchCurrentPosition(data.currentPosition || 0)
        setBatchLog(prev => [...prev.slice(-50), data.message])

        saveBatchProgress(data.nextSurah, data.nextAyah, data.nextPosition || 0, totalImported, data.progress)

        if (data.isComplete) {
          setBatchLog(prev => [...prev, '✅ Импорт завершён!'])
          setMessage({ type: 'success', text: `Импорт завершён! Всего импортировано: ${totalImported}` })
          localStorage.removeItem('mufradat_batch_progress')
          break
        }

        surah = data.nextSurah
        ayah = data.nextAyah
        position = data.nextPosition || 0

        await new Promise(resolve => setTimeout(resolve, 300))
      } catch (error) {
        setBatchLog(prev => [...prev, `❌ Сетевая ошибка: ${error}`])
        saveBatchProgress(surah, ayah, position, totalImported, batchProgress)
        setBatchPaused(true)
        break
      }
    }

    setBatchImporting(false)
    if (batchPausedRef.current) {
      setBatchPaused(true)
    }
    fetchWords() // Refresh data
  }

  // Start batch import
  const startBatchImport = () => {
    setBatchLog([`🚀 Начинаем импорт с суры ${batchCurrentSurah}, аят ${batchCurrentAyah}...`])
    runBatchImport(batchCurrentSurah, batchCurrentAyah, batchCurrentPosition)
  }

  // Pause batch import
  const pauseBatchImport = () => {
    batchPausedRef.current = true
    setBatchPaused(true)
    setBatchLog(prev => [...prev, '⏸️ Импорт приостановлен'])
  }

  // Reset batch import
  const resetBatchImport = () => {
    localStorage.removeItem('mufradat_batch_progress')
    setBatchCurrentSurah(1)
    setBatchCurrentAyah(1)
    setBatchCurrentPosition(0)
    setBatchImported(0)
    setBatchTranslated(0)
    setBatchProgress(0)
    setBatchLog([])
    setBatchPaused(false)
  }

  // Context-aware translation for current surah
  const runContextTranslation = async () => {
    if (!searchSurah) return

    setContextTranslating(true)
    contextPausedRef.current = false
    setContextLog([`🧠 Начинаем контекстный перевод суры ${searchSurah}...`])

    let totalTranslated = 0

    while (!contextPausedRef.current) {
      try {
        const res = await fetch('/api/admin/quran/mufradat/translate-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surah: parseInt(searchSurah),
            limit: 50,
          }),
        })

        if (!res.ok) {
          const error = await res.json()
          setContextLog(prev => [...prev, `❌ Ошибка: ${error.error}`])
          break
        }

        const data = await res.json()
        totalTranslated += data.translated
        setContextProgress({ translated: totalTranslated, remaining: data.remaining })
        setContextLog(prev => [...prev.slice(-20), data.message])

        // Update surah stats in real-time
        setSurahStats(prev => ({
          ...prev,
          translated: prev.total - data.remaining,
          untranslated: data.remaining,
          progress: prev.total > 0 ? Math.round(((prev.total - data.remaining) / prev.total) * 100) : 0,
        }))

        if (data.isComplete) {
          setContextLog(prev => [...prev, `✅ Готово! Переведено ${totalTranslated} слов`])
          setMessage({ type: 'success', text: `Контекстный перевод завершён: ${totalTranslated} слов` })
          break
        }

        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        setContextLog(prev => [...prev, `❌ Сетевая ошибка: ${error}`])
        break
      }
    }

    setContextTranslating(false)
    fetchWords(currentPage) // Refresh
    fetchSurahStats(searchSurah) // Refresh stats
  }

  // Stop context translation
  const stopContextTranslation = () => {
    contextPausedRef.current = true
    setContextLog(prev => [...prev, '⏸️ Остановлено'])
  }

  // Load full context translation progress
  useEffect(() => {
    const saved = localStorage.getItem('mufradat_context_progress')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setFullContextSurah(data.surah || 1)
        setFullContextAyah(data.ayah || 1)
        setFullContextTotal(data.total || 0)
      } catch {}
    }
  }, [])

  // Save full context progress
  const saveFullContextProgress = (surah: number, ayah: number, total: number) => {
    localStorage.setItem('mufradat_context_progress', JSON.stringify({ surah, ayah, total }))
  }

  // Full Quran context translation
  const runFullContextTranslation = async () => {
    setFullContextTranslating(true)
    fullContextPausedRef.current = false
    setFullContextLog([`🧠 Начинаем контекстный перевод с суры ${fullContextSurah}...`])

    let surah = fullContextSurah
    let totalTranslated = fullContextTotal

    while (surah <= 114 && !fullContextPausedRef.current) {
      try {
        const res = await fetch('/api/admin/quran/mufradat/translate-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surah,
            limit: 30, // 30 words per batch
          }),
        })

        if (!res.ok) {
          const error = await res.json()
          setFullContextLog(prev => [...prev, `❌ Ошибка: ${error.error}`])
          saveFullContextProgress(surah, 1, totalTranslated)
          break
        }

        const data = await res.json()
        totalTranslated += data.translated
        setFullContextTotal(totalTranslated)
        setFullContextSurah(surah)
        setFullContextAyah(data.currentAyah || 1)

        const surahInfo = getSurahByNumber(surah)
        setFullContextLog(prev => [
          ...prev.slice(-15),
          `📖 Сура ${surah} (${surahInfo?.nameRussian || ''}): +${data.translated}, осталось: ${data.remaining}`,
        ])

        if (data.isComplete) {
          // Move to next surah
          surah++
          if (surah <= 114) {
            setFullContextLog(prev => [...prev, `➡️ Переход к суре ${surah}...`])
          }
        }

        saveFullContextProgress(surah, 1, totalTranslated)

        // Delay between batches
        await new Promise(resolve => setTimeout(resolve, 600))
      } catch (error) {
        setFullContextLog(prev => [...prev, `❌ Сетевая ошибка: ${error}`])
        saveFullContextProgress(surah, 1, totalTranslated)
        break
      }
    }

    if (surah > 114) {
      setFullContextLog(prev => [...prev, `✅ Перевод всего Корана завершён! Всего: ${totalTranslated} слов`])
      setMessage({ type: 'success', text: `Контекстный перевод завершён: ${totalTranslated} слов` })
      localStorage.removeItem('mufradat_context_progress')
    }

    setFullContextTranslating(false)
    fetchWords(currentPage)
  }

  // Stop full context translation
  const stopFullContextTranslation = () => {
    fullContextPausedRef.current = true
    setFullContextLog(prev => [...prev, '⏸️ Приостановлено'])
  }

  // Reset full context progress
  const resetFullContextProgress = () => {
    localStorage.removeItem('mufradat_context_progress')
    setFullContextSurah(1)
    setFullContextAyah(1)
    setFullContextTotal(0)
    setFullContextLog([])
  }

  // Import only selected surah
  const runSurahImport = async () => {
    if (!searchSurah) return

    setSurahImporting(true)
    setSurahImportLog([`📥 Импорт суры ${searchSurah}...`])

    try {
      const res = await fetch('/api/admin/quran/mufradat/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surah: parseInt(searchSurah) }),
      })

      if (res.ok) {
        const data = await res.json()
        setSurahImportLog(prev => [...prev, `✅ ${data.message}`])
        setMessage({ type: 'success', text: data.message })
        fetchSurahStats(searchSurah)
        fetchWords(currentPage)
      } else {
        const error = await res.json()
        setSurahImportLog(prev => [...prev, `❌ Ошибка: ${error.error}`])
      }
    } catch (error) {
      setSurahImportLog(prev => [...prev, `❌ Сетевая ошибка: ${error}`])
    } finally {
      setSurahImporting(false)
    }
  }

  useEffect(() => {
    fetchWords()
  }, [])

  // Fetch surah stats (import + translation)
  const fetchSurahStats = async (surah: string) => {
    if (!surah) return
    setLoadingSurahStats(true)
    try {
      const res = await fetch(`/api/admin/quran/mufradat/translate-context?surah=${surah}`)
      if (res.ok) {
        const data = await res.json()
        setSurahStats({
          total: data.total,
          translated: data.translated,
          untranslated: data.untranslated,
          progress: data.progress,
          imported: data.total, // total = imported words
        })
      }
    } catch (error) {
      console.error('Error fetching surah stats:', error)
    } finally {
      setLoadingSurahStats(false)
    }
  }

  // Reset state and fetch stats when surah changes
  useEffect(() => {
    setContextProgress({ translated: 0, remaining: 0 })
    setContextLog([])
    setSurahImportLog([])
    if (searchSurah) {
      fetchSurahStats(searchSurah)
    }
  }, [searchSurah])

  const openEditDialog = (word: WordTranslation) => {
    setEditWord(word)
    setEditValue(word.translationRu || '')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Муфрадат (Пословный перевод)
        </h1>
        <p className="text-muted-foreground">
          Управление русскими переводами слов Корана
        </p>
      </div>

      {/* Message */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'error' && <AlertCircle className="h-4 w-4" />}
          {message.type === 'success' && <Check className="h-4 w-4" />}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Всего слов</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600">{stats.translated}</div>
            <p className="text-xs text-muted-foreground">Переведено</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{stats.verified}</div>
            <p className="text-xs text-muted-foreground">Проверено</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{stats.aiGenerated}</div>
            <p className="text-xs text-muted-foreground">AI-перевод</p>
          </CardContent>
        </Card>
      </div>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5" />
            Импорт слов из Quran.com
          </CardTitle>
          <CardDescription>
            Импорт арабских слов с английским переводом из API Quran.com
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Surah Stats */}
          <div className="space-y-2 p-3 border rounded-md bg-muted/30">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                Сура {searchSurah}
                {getSurahByNumber(parseInt(searchSurah)) && (
                  <span className="text-muted-foreground"> ({getSurahByNumber(parseInt(searchSurah))?.nameRussian})</span>
                )}
              </span>
              {loadingSurahStats ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className={surahStats.total === 0 ? 'text-orange-600' : 'text-green-600'}>
                  {surahStats.total > 0 ? `${surahStats.total} слов импортировано` : 'Не импортировано'}
                </span>
              )}
            </div>
            {surahStats.total > 0 && (
              <p className="text-xs text-muted-foreground">
                Переведено: {surahStats.translated}/{surahStats.total} ({surahStats.progress}%)
              </p>
            )}
          </div>

          {/* Full Quran Progress - only show if started */}
          {(batchCurrentSurah > 1 || batchImported > 0) && (
            <div className="space-y-2 p-3 border rounded-md text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Весь Коран: сура {batchCurrentSurah}/114
                  {getSurahByNumber(batchCurrentSurah) && (
                    <span> ({getSurahByNumber(batchCurrentSurah)?.nameRussian})</span>
                  )}
                </span>
                <span>{batchProgress}%</span>
              </div>
              <Progress value={batchProgress} className="h-1" />
              <span className="text-muted-foreground">Импортировано: {batchImported}</span>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2 flex-wrap">
            {!batchImporting && !surahImporting ? (
              <>
                <Button
                  onClick={startBatchImport}
                  disabled={batchProgress >= 100}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {batchProgress > 0 && batchProgress < 100 ? 'Продолжить' : 'Импорт всего Корана'}
                </Button>
                <Button
                  onClick={runSurahImport}
                  disabled={!searchSurah || surahImporting}
                  variant="outline"
                  className="border-blue-200 text-blue-600"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Только суру {searchSurah}
                </Button>
              </>
            ) : (
              <Button onClick={pauseBatchImport} variant="secondary">
                <Pause className="h-4 w-4 mr-2" />
                Пауза
              </Button>
            )}
          </div>

          {/* Log */}
          {(batchLog.length > 0 || surahImportLog.length > 0) && (
            <div className="bg-muted rounded-md p-3 max-h-40 overflow-y-auto">
              <div className="space-y-1 text-xs font-mono">
                {[...batchLog, ...surahImportLog].slice(-12).map((log, i) => (
                  <div key={i} className="text-muted-foreground">{log}</div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Context-Aware Translation */}
      <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              Контекстный перевод
            </CardTitle>
            <CardDescription>
              Перевод с учётом контекста аята (перевод Кулиева)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 border rounded-md bg-purple-50 dark:bg-purple-950/30">
              <div className="flex items-start gap-2">
                <Languages className="h-4 w-4 mt-0.5 text-purple-600" />
                <div className="text-sm">
                  <p className="font-medium text-purple-900 dark:text-purple-100">Как это работает:</p>
                  <p className="text-purple-700 dark:text-purple-300 text-xs mt-1">
                    GPT получает перевод аята по Кулиеву и использует его как контекст для точного перевода каждого слова.
                  </p>
                </div>
              </div>
            </div>

            {/* Current Surah Stats */}
            <div className="space-y-2 p-3 border rounded-md bg-muted/30">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  Сура {searchSurah}
                  {getSurahByNumber(parseInt(searchSurah)) && (
                    <span className="text-muted-foreground"> ({getSurahByNumber(parseInt(searchSurah))?.nameRussian})</span>
                  )}
                </span>
                {loadingSurahStats ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className={surahStats.untranslated > 0 ? 'text-orange-600' : 'text-green-600'}>
                    {surahStats.translated}/{surahStats.total} ({surahStats.progress}%)
                  </span>
                )}
              </div>
              <Progress value={surahStats.progress} className="h-2" />
              {surahStats.untranslated > 0 && (
                <p className="text-xs text-muted-foreground">
                  Осталось перевести: {surahStats.untranslated} слов
                </p>
              )}
            </div>

            {/* Full Quran Progress - only show if started */}
            {(fullContextSurah > 1 || fullContextTotal > 0) && (
              <div className="space-y-2 p-3 border rounded-md text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Весь Коран: сура {fullContextSurah}/114</span>
                  <span className="text-purple-600">{fullContextTotal} слов</span>
                </div>
                <Progress value={(fullContextSurah / 114) * 100} className="h-1" />
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-2 flex-wrap">
              {!fullContextTranslating ? (
                <>
                  <Button
                    onClick={runFullContextTranslation}
                    disabled={fullContextTranslating}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {fullContextSurah > 1 || fullContextAyah > 1 ? 'Продолжить' : 'Перевести весь Коран'}
                  </Button>
                  <Button
                    onClick={runContextTranslation}
                    disabled={!searchSurah || contextTranslating}
                    variant="outline"
                    className="border-purple-200 text-purple-600"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Только суру {searchSurah}
                  </Button>
                  {(fullContextSurah > 1 || fullContextTotal > 0) && (
                    <Button onClick={resetFullContextProgress} variant="ghost" size="icon">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </>
              ) : (
                <Button onClick={stopFullContextTranslation} variant="secondary">
                  <Pause className="h-4 w-4 mr-2" />
                  Пауза
                </Button>
              )}
            </div>

            {/* Log */}
            {(fullContextLog.length > 0 || contextLog.length > 0) && (
              <div className="bg-muted rounded-md p-3 max-h-40 overflow-y-auto">
                <div className="space-y-1 text-xs font-mono">
                  {[...fullContextLog, ...contextLog].slice(-12).map((log, i) => (
                    <div key={i} className="text-muted-foreground">{log}</div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Поиск слов</CardTitle>
          <CardDescription>Введите номер суры и аята для поиска</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-2">
              <Label>Сура</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={114}
                  value={searchSurah}
                  onChange={(e) => setSearchSurah(e.target.value)}
                  placeholder="1-114"
                  className="w-24"
                />
                {searchSurah && getSurahByNumber(parseInt(searchSurah)) && (
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    <span className="font-arabic text-base">{getSurahByNumber(parseInt(searchSurah))?.nameArabic}</span>
                    {' '}
                    <span>({getSurahByNumber(parseInt(searchSurah))?.nameRussian})</span>
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Аят (опционально)</Label>
              <Input
                type="number"
                min={1}
                value={searchAyah}
                onChange={(e) => setSearchAyah(e.target.value)}
                placeholder="Все"
                className="w-24"
              />
            </div>
            <Button onClick={() => { setCurrentPage(1); fetchWords(1) }} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Найти
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Words table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Слова ({totalWords > 0 ? `${words.length} из ${totalWords}` : words.length})
            {searchSurah && getSurahByNumber(parseInt(searchSurah)) && (
              <span className="font-normal text-muted-foreground">
                — сура {searchSurah}. <span className="font-arabic">{getSurahByNumber(parseInt(searchSurah))?.nameArabic}</span> ({getSurahByNumber(parseInt(searchSurah))?.nameRussian})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : words.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground">
                Нет данных для суры {searchSurah}.
              </p>
              <Button onClick={importWords} disabled={importing || !searchSurah}>
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Импортировать суру {searchSurah}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Аят</TableHead>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Арабский</TableHead>
                  <TableHead>English</TableHead>
                  <TableHead>Русский</TableHead>
                  <TableHead className="w-24">Статус</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {words.map((word) => (
                  <TableRow key={word.wordKey}>
                    <TableCell className="font-mono text-sm">
                      {word.surahNumber}:{word.ayahNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {word.position}
                    </TableCell>
                    <TableCell className="font-arabic text-xl" dir="rtl">
                      {word.textArabic}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {word.translationEn || '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {word.translationRu || (
                        <span className="text-muted-foreground italic">Нет</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {word.isVerified && (
                          <Badge variant="default" className="bg-blue-500 text-xs">
                            <Check className="h-3 w-3 mr-1" />
                          </Badge>
                        )}
                        {word.aiGenerated && !word.isVerified && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(word)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Страница {currentPage} из {totalPages} ({totalWords} слов)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronFirst className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {/* Show page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        disabled={loading}
                        className="w-8"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages || loading}
                >
                  <ChevronLast className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editWord} onOpenChange={() => setEditWord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать перевод</DialogTitle>
            <DialogDescription>
              {editWord && `${editWord.surahNumber}:${editWord.ayahNumber}, слово ${editWord.position}`}
            </DialogDescription>
          </DialogHeader>

          {editWord && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="font-arabic text-3xl mb-2" dir="rtl">
                  {editWord.textArabic}
                </p>
                {editWord.translationEn && (
                  <p className="text-sm text-muted-foreground">
                    English: {editWord.translationEn}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Русский перевод</Label>
                <div className="flex gap-2">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Введите перевод..."
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={generateTranslation}
                    disabled={saving}
                    title="Сгенерировать с помощью AI"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditWord(null)}>
              Отмена
            </Button>
            <Button
              variant="secondary"
              onClick={() => saveTranslation(false)}
              disabled={saving || !editValue}
            >
              Сохранить
            </Button>
            <Button
              onClick={() => saveTranslation(true)}
              disabled={saving || !editValue}
            >
              <Check className="h-4 w-4 mr-2" />
              Сохранить и проверить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
