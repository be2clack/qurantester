'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  BookOpen,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Save,
  X,
  Layers,
  GraduationCap,
  BookMarked,
  ListOrdered,
  Repeat,
  Target,
  CheckCircle2,
  Music,
  Image as ImageIcon,
  FileAudio,
  Trash2,
} from 'lucide-react'

interface QuranLine {
  id: string
  lineNumber: number
  textArabic: string | null
  textTajweed: string | null
  audioFileId: string | null
  imageFileId: string | null
}

interface QuranPage {
  id: string
  pageNumber: number
  totalLines: number
  lines: QuranLine[]
}

const STAGES_INFO = [
  {
    stage: 'STAGE_1_1',
    name: 'Этап 1.1',
    shortName: '1.1',
    icon: ListOrdered,
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
    description: 'Заучивание строк 1-7 по одной',
    details: 'Студент учит первую половину страницы (строки 1-7) поочередно. Количество строк за раз зависит от уровня группы (1/3/7).',
  },
  {
    stage: 'STAGE_1_2',
    name: 'Этап 1.2',
    shortName: '1.2',
    icon: Repeat,
    color: 'bg-indigo-500',
    borderColor: 'border-indigo-500',
    description: 'Повторение строк 1-7 вместе',
    details: 'После заучивания всех строк первой половины, студент повторяет их вместе 80 раз. Все 80 должны быть сданы.',
  },
  {
    stage: 'STAGE_2_1',
    name: 'Этап 2.1',
    shortName: '2.1',
    icon: ListOrdered,
    color: 'bg-violet-500',
    borderColor: 'border-violet-500',
    description: 'Заучивание строк 8-15 по одной',
    details: 'Студент учит вторую половину страницы (строки 8-15) поочередно по той же схеме.',
  },
  {
    stage: 'STAGE_2_2',
    name: 'Этап 2.2',
    shortName: '2.2',
    icon: Repeat,
    color: 'bg-purple-500',
    borderColor: 'border-purple-500',
    description: 'Повторение строк 8-15 вместе',
    details: 'Повторение второй половины страницы 80 раз. Все повторения должны быть приняты.',
  },
  {
    stage: 'STAGE_3',
    name: 'Этап 3',
    shortName: '3',
    icon: Target,
    color: 'bg-green-500',
    borderColor: 'border-green-500',
    description: 'Закрепление всей страницы',
    details: 'Финальный этап - повторение всей страницы (1-15) целиком 80 раз перед переходом к следующей странице.',
  },
]

const LEVELS_INFO = [
  { level: 'LEVEL_1', name: 'Уровень 1', lines: '1 строка', time: '12 часов', color: 'text-green-600' },
  { level: 'LEVEL_2', name: 'Уровень 2', lines: '3 строки', time: '12 часов', color: 'text-yellow-600' },
  { level: 'LEVEL_3', name: 'Уровень 3', lines: '7 строк', time: '12 часов', color: 'text-red-600' },
]

export default function QuranAdminPage() {
  const [pages, setPages] = useState<QuranPage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchPage, setSearchPage] = useState('')
  const [currentRange, setCurrentRange] = useState({ start: 1, end: 50 })
  const [selectedPage, setSelectedPage] = useState<QuranPage | null>(null)
  const [editingLines, setEditingLines] = useState<QuranLine[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPages()
  }, [currentRange])

  async function fetchPages() {
    setLoading(true)
    try {
      const res = await fetch(`/api/quran/pages?from=${currentRange.start}&to=${currentRange.end}`)
      if (res.ok) {
        const data = await res.json()
        setPages(data.items || [])
      }
    } catch (err) {
      console.error('Failed to fetch pages:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const pageNum = parseInt(searchPage)
    if (pageNum >= 1 && pageNum <= 602) {
      const start = Math.floor((pageNum - 1) / 50) * 50 + 1
      setCurrentRange({ start, end: Math.min(start + 49, 602) })
    }
  }

  const goToRange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentRange.start > 1) {
      const newStart = Math.max(1, currentRange.start - 50)
      setCurrentRange({ start: newStart, end: newStart + 49 })
    } else if (direction === 'next' && currentRange.end < 602) {
      const newStart = currentRange.end + 1
      setCurrentRange({ start: newStart, end: Math.min(newStart + 49, 602) })
    }
  }

  const openPageEditor = (page: QuranPage) => {
    setSelectedPage(page)
    setEditingLines([...page.lines].sort((a, b) => a.lineNumber - b.lineNumber))
  }

  const closeEditor = () => {
    setSelectedPage(null)
    setEditingLines([])
  }

  const updateLine = (lineId: string, field: keyof QuranLine, value: string | null) => {
    setEditingLines(prev => prev.map(line =>
      line.id === lineId ? { ...line, [field]: value || null } : line
    ))
  }

  const savePage = async () => {
    if (!selectedPage) return
    setSaving(true)

    try {
      // Save each line
      for (const line of editingLines) {
        await fetch(`/api/quran/pages/${selectedPage.pageNumber}/lines`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineId: line.id,
            textArabic: line.textArabic,
            textTajweed: line.textTajweed,
            audioFileId: line.audioFileId,
            imageFileId: line.imageFileId,
          }),
        })
      }

      await fetchPages()
      closeEditor()
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  // Stats
  const totalPages = 602
  const page1Lines = 5
  const page2Lines = 6
  const regularLines = 15
  const totalLines = page1Lines + page2Lines + (totalPages - 2) * regularLines

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Коран
        </h1>
        <p className="text-muted-foreground">
          Просмотр и редактирование страниц Корана
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <BookMarked className="h-4 w-4" />
              Всего страниц
            </CardDescription>
            <CardTitle className="text-3xl">{totalPages}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <ListOrdered className="h-4 w-4" />
              Всего строк
            </CardDescription>
            <CardTitle className="text-3xl">{totalLines.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Layers className="h-4 w-4" />
              Строк на странице
            </CardDescription>
            <CardTitle className="text-3xl">15</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">стр. 1 = 5, стр. 2 = 6</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              Этапов на страницу
            </CardDescription>
            <CardTitle className="text-3xl">5</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">1.1, 1.2, 2.1, 2.2, 3</p>
          </CardContent>
        </Card>
      </div>

      {/* Stages System */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Система 5 этапов
          </CardTitle>
          <CardDescription>
            Каждая страница Корана проходится через 5 последовательных этапов
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {STAGES_INFO.map((stage, index) => {
              const Icon = stage.icon
              return (
                <div
                  key={stage.stage}
                  className={`relative p-4 rounded-lg border-2 ${stage.borderColor} bg-gradient-to-b from-background to-muted/30`}
                >
                  <div className={`absolute -top-3 left-3 ${stage.color} text-white text-xs font-bold px-2 py-0.5 rounded`}>
                    {stage.shortName}
                  </div>
                  <div className="pt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded ${stage.color}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-semibold text-sm">{stage.name}</span>
                    </div>
                    <p className="text-sm font-medium mb-1">{stage.description}</p>
                    <p className="text-xs text-muted-foreground">{stage.details}</p>
                  </div>
                  {index < STAGES_INFO.length - 1 && (
                    <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10">
                      →
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Levels Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Уровни групп
          </CardTitle>
          <CardDescription>
            Скорость прохождения материала зависит от уровня группы
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {LEVELS_INFO.map((level) => (
              <div key={level.level} className="flex items-center gap-4 p-4 rounded-lg border">
                <div className={`text-3xl font-bold ${level.color}`}>
                  {level.lines.split(' ')[0]}
                </div>
                <div>
                  <p className="font-medium">{level.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {level.lines} за {level.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>Правило сдачи:</strong> Студент должен сдать ВСЕ 80 повторений.
                Если есть ошибки, создается задание на пересдачу только неправильных ответов.
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Search and Navigation */}
      <Card>
        <CardHeader>
          <CardTitle>Навигация по страницам</CardTitle>
          <div className="flex items-center gap-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Номер страницы..."
                  type="number"
                  min={1}
                  max={602}
                  className="pl-8 w-40"
                  value={searchPage}
                  onChange={(e) => setSearchPage(e.target.value)}
                />
              </div>
              <Button type="submit">Перейти</Button>
            </form>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="icon"
                onClick={() => goToRange('prev')}
                disabled={currentRange.start === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[120px] text-center">
                Страницы {currentRange.start}-{currentRange.end}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => goToRange('next')}
                disabled={currentRange.end >= 602}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Страница</TableHead>
                  <TableHead>Строк</TableHead>
                  <TableHead>Заполнено</TableHead>
                  <TableHead>Медиа</TableHead>
                  <TableHead>Этапы</TableHead>
                  <TableHead className="w-24">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => {
                  const filledLines = page.lines?.filter(l => l.textArabic).length || 0
                  const audioCount = page.lines?.filter(l => l.audioFileId).length || 0
                  const imageCount = page.lines?.filter(l => l.imageFileId).length || 0
                  return (
                    <TableRow key={page.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {page.pageNumber}
                        </Badge>
                      </TableCell>
                      <TableCell>{page.totalLines}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary rounded-full h-2"
                              style={{ width: `${(filledLines / page.totalLines) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {filledLines}/{page.totalLines}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Badge variant={audioCount > 0 ? 'default' : 'outline'} className="text-xs">
                            <Music className="h-3 w-3 mr-1" />
                            {audioCount}
                          </Badge>
                          <Badge variant={imageCount > 0 ? 'default' : 'outline'} className="text-xs">
                            <ImageIcon className="h-3 w-3 mr-1" />
                            {imageCount}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {['1.1', '1.2', '2.1', '2.2', '3'].map((s, i) => (
                            <Badge
                              key={s}
                              variant="secondary"
                              className="text-xs"
                              style={{
                                backgroundColor: STAGES_INFO[i].color.replace('bg-', '').includes('500')
                                  ? undefined
                                  : undefined
                              }}
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPageEditor(page)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Строки
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Page Editor Dialog */}
      <Dialog open={!!selectedPage} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Страница {selectedPage?.pageNumber}
            </DialogTitle>
            <DialogDescription>
              Редактирование строк страницы ({selectedPage?.totalLines} строк)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {editingLines.map((line) => (
              <div key={line.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-base px-3 py-1">
                    Строка {line.lineNumber}
                  </Badge>
                  <div className="flex gap-2">
                    {line.audioFileId && (
                      <Badge variant="secondary" className="gap-1">
                        <Music className="h-3 w-3" />
                        Аудио
                      </Badge>
                    )}
                    {line.imageFileId && (
                      <Badge variant="secondary" className="gap-1">
                        <ImageIcon className="h-3 w-3" />
                        Картинка
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`arabic-${line.id}`}>Арабский текст</Label>
                    <Textarea
                      id={`arabic-${line.id}`}
                      dir="rtl"
                      className="font-arabic text-xl leading-loose"
                      placeholder="اكتب النص العربي هنا..."
                      value={line.textArabic || ''}
                      onChange={(e) => updateLine(line.id, 'textArabic', e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`tajweed-${line.id}`}>Таджвид / Перевод</Label>
                    <Textarea
                      id={`tajweed-${line.id}`}
                      placeholder="Правила таджвида или перевод..."
                      value={line.textTajweed || ''}
                      onChange={(e) => updateLine(line.id, 'textTajweed', e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`audio-${line.id}`} className="flex items-center gap-2">
                      <FileAudio className="h-4 w-4" />
                      Аудио (Telegram file_id)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={`audio-${line.id}`}
                        placeholder="CQACAgIAAxkBAAI..."
                        value={line.audioFileId || ''}
                        onChange={(e) => updateLine(line.id, 'audioFileId', e.target.value)}
                      />
                      {line.audioFileId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateLine(line.id, 'audioFileId', null)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Отправьте аудио боту и скопируйте file_id из логов
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`image-${line.id}`} className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Картинка (Telegram file_id)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={`image-${line.id}`}
                        placeholder="AgACAgIAAxkBAAI..."
                        value={line.imageFileId || ''}
                        onChange={(e) => updateLine(line.id, 'imageFileId', e.target.value)}
                      />
                      {line.imageFileId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateLine(line.id, 'imageFileId', null)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Отправьте фото боту и скопируйте file_id из логов
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background">
            <Button variant="outline" onClick={closeEditor}>
              <X className="h-4 w-4 mr-1" />
              Отмена
            </Button>
            <Button onClick={savePage} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
