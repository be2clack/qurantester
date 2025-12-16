'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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
  RefreshCw,
} from 'lucide-react'

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
            <Button onClick={fetchWords} disabled={loading}>
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
            <p className="text-center text-muted-foreground py-8">
              Нет данных. Откройте страницу Корана с включенным муфрадатом чтобы загрузить слова.
            </p>
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
