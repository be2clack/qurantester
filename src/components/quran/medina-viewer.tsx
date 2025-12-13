'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Lock,
  Cloud,
  BookOpen,
  Languages,
  Search,
  BookText,
  Palette,
} from 'lucide-react'

interface MedinaWord {
  text_uthmani: string
  position: number
  line_number: number
}

interface MedinaLine {
  lineNumber: number
  textArabic: string
  textTajweed?: string
  words: MedinaWord[]
  verseKeys: string[]
}

interface MedinaChapter {
  id: number
  name_arabic: string
  name_simple: string
  translated_name: string
}

interface MedinaPageData {
  pageNumber: number
  totalLines: number
  lines: MedinaLine[]
  chapters?: MedinaChapter[]
  translations?: Record<string, string>
  meta: {
    mushafType: string
    source: string
    translationId: number | null
  }
}

interface RussianTranslation {
  id: number
  name: string
  author: string
  isDefault: boolean
}

const RUSSIAN_TRANSLATIONS: RussianTranslation[] = [
  { id: 45, name: 'Кулиев', author: 'Эльмир Кулиев', isDefault: true },
  { id: 79, name: 'Абу Адель', author: 'Абу Адель', isDefault: false },
  { id: 78, name: 'Мин. вакуфов', author: 'Ministry of Awqaf', isDefault: false },
]

interface RussianTafsir {
  id: number
  name: string
  author: string
}

const RUSSIAN_TAFSIRS: RussianTafsir[] = [
  { id: 170, name: 'ас-Саади', author: 'Абдуррахман ас-Саади' },
]

export function MedinaMushhafViewer() {
  const [pageNumber, setPageNumber] = useState(1)
  const [pageData, setPageData] = useState<MedinaPageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchPage, setSearchPage] = useState('')

  // Display options
  const [showTranslation, setShowTranslation] = useState(false)
  const [translationId, setTranslationId] = useState<number>(45)
  const [showTafsir, setShowTafsir] = useState(false)
  const [tafsirId, setTafsirId] = useState<number>(170)
  const [showTajweed, setShowTajweed] = useState(false)
  const [showChapters, setShowChapters] = useState(true)
  const [tafsirs, setTafsirs] = useState<Record<string, string>>({})
  const [loadingTafsir, setLoadingTafsir] = useState<string | null>(null)

  async function fetchPage(page: number) {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (showTranslation) {
        params.set('translation', translationId.toString())
      }
      if (showTajweed) {
        params.set('tajweed', 'true')
      }
      if (showChapters) {
        params.set('chapters', 'true')
      }

      const res = await fetch(`/api/quran/medina/pages/${page}?${params}`)
      if (!res.ok) {
        throw new Error('Failed to fetch page')
      }
      const data = await res.json()
      setPageData(data)
    } catch (err) {
      console.error('Failed to fetch Medina page:', err)
      setError('Не удалось загрузить страницу')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPage(pageNumber)
    setTafsirs({}) // Clear tafsirs when page changes
  }, [pageNumber, showTranslation, translationId, showTajweed, showChapters])

  // Fetch tafsir for a specific verse
  async function fetchTafsir(verseKey: string) {
    if (tafsirs[verseKey] || loadingTafsir === verseKey) return

    setLoadingTafsir(verseKey)
    try {
      const res = await fetch(`https://api.quran.com/api/v4/tafsirs/${tafsirId}/by_ayah/${verseKey}`)
      if (res.ok) {
        const data = await res.json()
        setTafsirs(prev => ({
          ...prev,
          [verseKey]: data.tafsir?.text || 'Тафсир не найден'
        }))
      }
    } catch (err) {
      console.error('Failed to fetch tafsir:', err)
    } finally {
      setLoadingTafsir(null)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseInt(searchPage)
    if (p >= 1 && p <= 604) {
      setPageNumber(p)
      setSearchPage('')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-blue-500" />
                Мединский мусхаф
                <Badge variant="secondary" className="ml-2 gap-1">
                  <Lock className="h-3 w-3" />
                  API
                </Badge>
              </CardTitle>
              <CardDescription>
                Данные из Quran.com (604 страницы, 15 строк)
              </CardDescription>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                disabled={pageNumber === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <form onSubmit={handleSearch} className="flex gap-1">
                <Input
                  type="number"
                  min={1}
                  max={604}
                  value={searchPage}
                  onChange={(e) => setSearchPage(e.target.value)}
                  placeholder={pageNumber.toString()}
                  className="w-20 text-center"
                />
                <Button type="submit" variant="ghost" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </form>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setPageNumber(p => Math.min(604, p + 1))}
                disabled={pageNumber === 604 || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Display options */}
        <CardContent className="border-t pt-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Translation toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="showTranslation"
                checked={showTranslation}
                onCheckedChange={setShowTranslation}
              />
              <Label htmlFor="showTranslation" className="flex items-center gap-1">
                <Languages className="h-4 w-4" />
                Перевод
              </Label>
            </div>

            {showTranslation && (
              <Select
                value={translationId.toString()}
                onValueChange={(v) => setTranslationId(parseInt(v))}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RUSSIAN_TRANSLATIONS.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Tafsir toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="showTafsir"
                checked={showTafsir}
                onCheckedChange={setShowTafsir}
              />
              <Label htmlFor="showTafsir" className="flex items-center gap-1">
                <BookText className="h-4 w-4" />
                Тафсир
              </Label>
            </div>

            {showTafsir && (
              <Select
                value={tafsirId.toString()}
                onValueChange={(v) => setTafsirId(parseInt(v))}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RUSSIAN_TAFSIRS.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Tajweed toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="showTajweed"
                checked={showTajweed}
                onCheckedChange={setShowTajweed}
              />
              <Label htmlFor="showTajweed" className="flex items-center gap-1">
                <Palette className="h-4 w-4" />
                Таджвид
              </Label>
            </div>

            {/* Chapters toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="showChapters"
                checked={showChapters}
                onCheckedChange={setShowChapters}
              />
              <Label htmlFor="showChapters" className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                Суры
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Page content */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-lg px-3 py-1">
                {pageNumber}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {pageData?.totalLines || 0} строк
              </span>
            </div>

            {/* Chapter badges */}
            {pageData?.chapters && pageData.chapters.length > 0 && (
              <div className="flex gap-2">
                {pageData.chapters.map((chapter) => (
                  <Badge key={chapter.id} variant="secondary" className="gap-1">
                    <span className="font-arabic">{chapter.name_arabic}</span>
                    <span className="text-xs text-muted-foreground">
                      ({chapter.id})
                    </span>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              <p>{error}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => fetchPage(pageNumber)}
              >
                Повторить
              </Button>
            </div>
          ) : pageData ? (
            <div className="space-y-3">
              {pageData.lines.map((line) => (
                <div
                  key={line.lineNumber}
                  className="p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Badge
                      variant="outline"
                      className="shrink-0 mt-1 min-w-[2rem] justify-center"
                    >
                      {line.lineNumber}
                    </Badge>

                    <div className="flex-1 space-y-2">
                      {/* Arabic text */}
                      {line.textTajweed ? (
                        <p
                          dir="rtl"
                          className="font-arabic text-2xl leading-loose text-right"
                          dangerouslySetInnerHTML={{ __html: line.textTajweed }}
                        />
                      ) : (
                        <p
                          dir="rtl"
                          className="font-arabic text-2xl leading-loose text-right"
                        >
                          {line.textArabic}
                        </p>
                      )}

                      {/* Verse keys */}
                      {line.verseKeys.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {line.verseKeys.map((key) => (
                            <Badge
                              key={key}
                              variant="secondary"
                              className="text-xs"
                            >
                              {key}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Translation */}
                      {showTranslation && pageData.translations && (
                        <div className="text-sm text-muted-foreground border-t pt-2 mt-2">
                          {line.verseKeys.map((key) => (
                            pageData.translations![key] && (
                              <p key={key} className="mb-1">
                                <span className="font-medium">{key}:</span>{' '}
                                <span dangerouslySetInnerHTML={{ __html: pageData.translations![key] }} />
                              </p>
                            )
                          ))}
                        </div>
                      )}

                      {/* Tafsir */}
                      {showTafsir && (
                        <div className="text-sm border-t pt-2 mt-2">
                          {line.verseKeys.map((key) => (
                            <div key={key} className="mb-3 last:mb-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">{key}</Badge>
                                {!tafsirs[key] && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={() => fetchTafsir(key)}
                                    disabled={loadingTafsir === key}
                                  >
                                    {loadingTafsir === key ? (
                                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    ) : (
                                      <BookText className="h-3 w-3 mr-1" />
                                    )}
                                    Загрузить тафсир
                                  </Button>
                                )}
                              </div>
                              {tafsirs[key] && (
                                <p
                                  className="text-muted-foreground bg-amber-50 dark:bg-amber-950/20 p-2 rounded text-sm"
                                  dangerouslySetInnerHTML={{ __html: tafsirs[key] }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Данные не загружены
            </p>
          )}
        </CardContent>
      </Card>

      {/* Info footer */}
      <div className="text-center text-xs text-muted-foreground">
        Источник: <a href="https://quran.com" target="_blank" rel="noopener noreferrer" className="underline">Quran.com API</a>
        {' '}| Мединский мусхаф (Хафс от Асыма) | Только чтение
      </div>
    </div>
  )
}
