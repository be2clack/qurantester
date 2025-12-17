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
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

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
  const [batchLog, setBatchLog] = useState<string[]>([])
  const batchPausedRef = useRef(false)

  // Fetch words
  const fetchWords = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchSurah) params.set('surah', searchSurah)
      if (searchAyah) params.set('ayah', searchAyah)

      const res = await fetch(`/api/admin/quran/mufradat?${params}`)
      if (res.ok) {
        const data = await res.json()
        setWords(data.words || [])
        setStats(data.stats || stats)
      }
    } catch (error) {
      console.error('Error fetching words:', error)
    } finally {
      setLoading(false)
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

  // Batch import function
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
          body: JSON.stringify({ surah, fromAyah: ayah, fromPosition: position }),
        })

        if (!res.ok) {
          const error = await res.json()
          setBatchLog(prev => [...prev, `❌ Ошибка: ${error.error || 'Unknown error'}`])
          // Save progress and pause on error
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

        // Save progress
        saveBatchProgress(data.nextSurah, data.nextAyah, data.nextPosition || 0, totalImported, data.progress)

        if (data.isComplete) {
          setBatchLog(prev => [...prev, '✅ Импорт завершён!'])
          setMessage({ type: 'success', text: `Импорт завершён! Всего импортировано: ${totalImported}` })
          localStorage.removeItem('mufradat_batch_progress')
          break
        }

        // Move to next position
        surah = data.nextSurah
        ayah = data.nextAyah
        position = data.nextPosition || 0

        // Small delay to prevent rate limiting
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
    setBatchProgress(0)
    setBatchLog([])
    setBatchPaused(false)
  }

  useEffect(() => {
    fetchWords()
  }, [])

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

      {/* Full Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5" />
            Полный импорт Корана
          </CardTitle>
          <CardDescription>
            Импорт всех 114 сур по 30 слов за раз. Прогресс сохраняется автоматически.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Прогресс: сура {batchCurrentSurah}/114, аят {batchCurrentAyah}</span>
              <span>{batchProgress}%</span>
            </div>
            <Progress value={batchProgress} className="h-2" />
            <div className="text-sm text-muted-foreground">
              Импортировано слов: {batchImported}
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {!batchImporting ? (
              <Button onClick={startBatchImport} disabled={batchProgress >= 100}>
                <Play className="h-4 w-4 mr-2" />
                {batchProgress > 0 && batchProgress < 100 ? 'Продолжить' : 'Начать импорт'}
              </Button>
            ) : (
              <Button onClick={pauseBatchImport} variant="secondary">
                <Pause className="h-4 w-4 mr-2" />
                Пауза
              </Button>
            )}
            <Button
              onClick={resetBatchImport}
              variant="outline"
              disabled={batchImporting}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Сбросить
            </Button>
          </div>

          {/* Log */}
          {batchLog.length > 0 && (
            <div className="bg-muted rounded-md p-3 max-h-40 overflow-y-auto">
              <div className="space-y-1 text-xs font-mono">
                {batchLog.slice(-10).map((log, i) => (
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
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label>Сура</Label>
              <Input
                type="number"
                min={1}
                max={114}
                value={searchSurah}
                onChange={(e) => setSearchSurah(e.target.value)}
                placeholder="1-114"
                className="w-24"
              />
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
            <Button onClick={fetchWords} disabled={loading || importing}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Найти
            </Button>
            <Button
              onClick={importWords}
              disabled={loading || importing || !searchSurah}
              variant="outline"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Импортировать суру
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Words table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Слова ({words.length})
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
