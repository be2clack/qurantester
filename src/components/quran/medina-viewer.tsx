'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Cloud,
  BookOpen,
  Languages,
  Search,
  BookText,
  Palette,
  Volume2,
  Pause,
  Play,
  Type,
  Settings2,
  ChevronDown,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface MedinaWord {
  text_uthmani: string
  position: number
  line_number: number
  translation?: {
    text: string
    language_name: string
  }
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
  audio?: {
    url: string
    reciter: string
  }
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

interface Reciter {
  id: number
  name: string
  style: string
  audioSubdir: string
}

const RECITERS: Reciter[] = [
  { id: 7, name: 'Мишари Рашид', style: 'Murattal', audioSubdir: 'Alafasy/mp3' },
  { id: 1, name: 'Абдуль-Басит', style: 'Murattal', audioSubdir: 'AbdulBaset/Mujawwad/mp3' },
  { id: 6, name: 'Махмуд аль-Хусари', style: 'Murattal', audioSubdir: 'Husary/mp3' },
  { id: 2, name: 'Абдур-Рахман ас-Судайс', style: 'Murattal', audioSubdir: 'Sudais/mp3' },
]

const VERSES_AUDIO_BASE = 'https://verses.quran.com'

const STORAGE_KEY = 'quran-viewer-settings'

interface ViewerSettings {
  showTranslation: boolean
  translationId: number
  showTafsir: boolean
  tafsirId: number
  showTajweed: boolean
  showChapters: boolean
  showMufradat: boolean
  showAudio: boolean
  reciterId: number
}

const DEFAULT_SETTINGS: ViewerSettings = {
  showTranslation: false,
  translationId: 45,
  showTafsir: false,
  tafsirId: 170,
  showTajweed: true,
  showChapters: true,
  showMufradat: true,
  showAudio: true,
  reciterId: 7,
}

function loadSettings(): ViewerSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    }
  } catch (e) {
    console.error('Failed to load settings:', e)
  }
  return DEFAULT_SETTINGS
}

function saveSettings(settings: ViewerSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}

interface MedinaMushhafViewerProps {
  initialPage?: number
  initialLine?: number
  showProgress?: {
    currentPage: number
    currentLine: number
    stageName: string
  }
}

export function MedinaMushhafViewer({ initialPage = 1, initialLine, showProgress }: MedinaMushhafViewerProps) {
  const [pageNumber, setPageNumber] = useState(initialPage)
  const [pageData, setPageData] = useState<MedinaPageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchPage, setSearchPage] = useState('')

  // Audio state
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const verseAudioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loadingAudio, setLoadingAudio] = useState(false)

  // Verse audio state
  const [playingVerseKey, setPlayingVerseKey] = useState<string | null>(null)
  const [verseAudioQueue, setVerseAudioQueue] = useState<string[]>([])
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0)

  // Display options - load from localStorage
  const [settings, setSettings] = useState<ViewerSettings>(DEFAULT_SETTINGS)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  // Tafsirs state
  const [tafsirs, setTafsirs] = useState<Record<string, string>>({})
  const [loadingTafsir, setLoadingTafsir] = useState<string | null>(null)

  // Word translations for Mufradat
  const [wordTranslations, setWordTranslations] = useState<Record<string, string>>({})
  const [loadingWordTrans, setLoadingWordTrans] = useState(false)

  // Settings panel state for mobile
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    const loaded = loadSettings()
    setSettings(loaded)
    setSettingsLoaded(true)
  }, [])

  // Save settings whenever they change
  useEffect(() => {
    if (settingsLoaded) {
      saveSettings(settings)
    }
  }, [settings, settingsLoaded])

  const updateSetting = useCallback(<K extends keyof ViewerSettings>(key: K, value: ViewerSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  async function fetchPage(page: number) {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (settings.showTranslation) {
        params.set('translation', settings.translationId.toString())
      }
      if (settings.showTajweed) {
        params.set('tajweed', 'true')
      }
      if (settings.showChapters) {
        params.set('chapters', 'true')
      }
      if (settings.showMufradat) {
        params.set('words', 'true')
      }

      const res = await fetch(`/api/quran/medina/pages/${page}?${params}`)
      if (!res.ok) {
        throw new Error('Failed to fetch page')
      }
      const data = await res.json()
      setPageData(data)

      // Fetch audio if enabled
      if (settings.showAudio && data.chapters && data.chapters.length > 0) {
        fetchAudio(data.chapters[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch Medina page:', err)
      setError('Не удалось загрузить страницу')
    } finally {
      setLoading(false)
    }
  }

  async function fetchAudio(chapterId: number) {
    setLoadingAudio(true)
    try {
      const res = await fetch(`https://api.quran.com/api/v4/chapter_recitations/${settings.reciterId}/${chapterId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.audio_file?.audio_url) {
          setAudioUrl(data.audio_file.audio_url)
        }
      }
    } catch (err) {
      console.error('Failed to fetch audio:', err)
    } finally {
      setLoadingAudio(false)
    }
  }

  useEffect(() => {
    if (settingsLoaded) {
      fetchPage(pageNumber)
      setTafsirs({}) // Clear tafsirs when page changes
      setIsPlaying(false)
      setAudioUrl(null)
    }
  }, [pageNumber, settings.showTranslation, settings.translationId, settings.showTajweed, settings.showChapters, settings.showMufradat, settingsLoaded])

  // Refetch audio when reciter changes
  useEffect(() => {
    if (settingsLoaded && settings.showAudio && pageData?.chapters?.[0]) {
      fetchAudio(pageData.chapters[0].id)
    }
  }, [settings.reciterId, settings.showAudio, settingsLoaded])

  // Audio controls
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => setIsPlaying(false)
    }
  }, [audioUrl])

  const toggleAudio = () => {
    if (!audioRef.current || !audioUrl) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  // Get verse audio URL
  const getVerseAudioUrl = (verseKey: string) => {
    const reciter = RECITERS.find(r => r.id === settings.reciterId)
    if (!reciter) return null

    // Convert verse key like "1:1" to "001001"
    const [surah, ayah] = verseKey.split(':').map(Number)
    const paddedSurah = surah.toString().padStart(3, '0')
    const paddedAyah = ayah.toString().padStart(3, '0')

    return `${VERSES_AUDIO_BASE}/${reciter.audioSubdir}/${paddedSurah}${paddedAyah}.mp3`
  }

  // Play verse audio for a line
  const playLineVerses = (verseKeys: string[]) => {
    if (verseKeys.length === 0) return

    // Stop any currently playing verse audio
    if (verseAudioRef.current) {
      verseAudioRef.current.pause()
    }

    // If clicking on same line that's playing, stop
    if (playingVerseKey && verseKeys.includes(playingVerseKey)) {
      setPlayingVerseKey(null)
      setVerseAudioQueue([])
      return
    }

    // Set up queue and start playing
    setVerseAudioQueue(verseKeys)
    setCurrentQueueIndex(0)
    setPlayingVerseKey(verseKeys[0])

    const url = getVerseAudioUrl(verseKeys[0])
    if (url && verseAudioRef.current) {
      verseAudioRef.current.src = url
      verseAudioRef.current.play().catch(console.error)
    }
  }

  // Handle verse audio ended - play next in queue
  useEffect(() => {
    if (verseAudioRef.current) {
      verseAudioRef.current.onended = () => {
        const nextIndex = currentQueueIndex + 1
        if (nextIndex < verseAudioQueue.length) {
          setCurrentQueueIndex(nextIndex)
          setPlayingVerseKey(verseAudioQueue[nextIndex])
          const url = getVerseAudioUrl(verseAudioQueue[nextIndex])
          if (url && verseAudioRef.current) {
            verseAudioRef.current.src = url
            verseAudioRef.current.play().catch(console.error)
          }
        } else {
          // Queue finished
          setPlayingVerseKey(null)
          setVerseAudioQueue([])
          setCurrentQueueIndex(0)
        }
      }
    }
  }, [currentQueueIndex, verseAudioQueue, settings.reciterId])

  // Fetch tafsir for a specific verse
  async function fetchTafsir(verseKey: string) {
    if (tafsirs[verseKey] || loadingTafsir === verseKey) return

    setLoadingTafsir(verseKey)
    try {
      const res = await fetch(`https://api.quran.com/api/v4/tafsirs/${settings.tafsirId}/by_ayah/${verseKey}`)
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

  // Scroll to highlighted line
  useEffect(() => {
    if (initialLine && pageData) {
      const lineElement = document.getElementById(`line-${initialLine}`)
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [initialLine, pageData])

  if (!settingsLoaded) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Функция перехода к прогрессу
  const goToProgress = () => {
    if (showProgress) {
      setPageNumber(showProgress.currentPage)
    }
  }

  const isOnProgressPage = showProgress && showProgress.currentPage === pageNumber

  return (
    <TooltipProvider>
      <div className="space-y-2 sm:space-y-3">
        {/* Compact header with navigation */}
        <div className="flex items-center justify-between gap-2 p-2 bg-card border rounded-lg">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageNumber(p => Math.max(1, p - 1))}
              disabled={pageNumber === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Badge variant="outline" className="text-sm font-semibold px-2 py-0.5 min-w-[3rem] justify-center">
              {pageNumber}
            </Badge>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPageNumber(p => Math.min(604, p + 1))}
              disabled={pageNumber === 604 || loading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress info & Go to progress button */}
          {showProgress && (
            <div className="flex items-center gap-2">
              {!isOnProgressPage && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                  onClick={goToProgress}
                >
                  📍 К прогрессу
                </Button>
              )}
              {isOnProgressPage && (
                <Badge className="bg-emerald-500 text-white text-xs">
                  📍 Стр. {showProgress.currentPage}, строка {showProgress.currentLine}
                </Badge>
              )}
            </div>
          )}

          {/* Settings button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Settings panel - collapsible */}
        {settingsOpen && (
          <Card>
            <CardContent className="p-3">
              {/* Settings grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {/* Mufradat toggle */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Switch
                      id="showMufradat"
                      className="scale-90 sm:scale-100"
                      checked={settings.showMufradat}
                      onCheckedChange={(v) => updateSetting('showMufradat', v)}
                    />
                    <Label htmlFor="showMufradat" className="flex items-center gap-1 cursor-pointer text-xs sm:text-sm">
                      <Type className="h-3 w-3 sm:h-4 sm:w-4" />
                      Муфрадат
                    </Label>
                  </div>

                  {/* Tajweed toggle */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Switch
                      id="showTajweed"
                      className="scale-90 sm:scale-100"
                      checked={settings.showTajweed}
                      onCheckedChange={(v) => updateSetting('showTajweed', v)}
                    />
                    <Label htmlFor="showTajweed" className="flex items-center gap-1 cursor-pointer text-xs sm:text-sm">
                      <Palette className="h-3 w-3 sm:h-4 sm:w-4" />
                      Таджвид
                    </Label>
                  </div>

                  {/* Translation toggle */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Switch
                      id="showTranslation"
                      className="scale-90 sm:scale-100"
                      checked={settings.showTranslation}
                      onCheckedChange={(v) => updateSetting('showTranslation', v)}
                    />
                    <Label htmlFor="showTranslation" className="flex items-center gap-1 cursor-pointer text-xs sm:text-sm">
                      <Languages className="h-3 w-3 sm:h-4 sm:w-4" />
                      Перевод
                    </Label>
                  </div>

                  {/* Audio toggle */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Switch
                      id="showAudio"
                      className="scale-90 sm:scale-100"
                      checked={settings.showAudio}
                      onCheckedChange={(v) => updateSetting('showAudio', v)}
                    />
                    <Label htmlFor="showAudio" className="flex items-center gap-1 cursor-pointer text-xs sm:text-sm">
                      <Volume2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      Аудио
                    </Label>
                  </div>

                  {/* Tafsir toggle */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Switch
                      id="showTafsir"
                      className="scale-90 sm:scale-100"
                      checked={settings.showTafsir}
                      onCheckedChange={(v) => updateSetting('showTafsir', v)}
                    />
                    <Label htmlFor="showTafsir" className="flex items-center gap-1 cursor-pointer text-xs sm:text-sm">
                      <BookText className="h-3 w-3 sm:h-4 sm:w-4" />
                      Тафсир
                    </Label>
                  </div>

                  {/* Chapters toggle */}
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Switch
                      id="showChapters"
                      className="scale-90 sm:scale-100"
                      checked={settings.showChapters}
                      onCheckedChange={(v) => updateSetting('showChapters', v)}
                    />
                    <Label htmlFor="showChapters" className="flex items-center gap-1 cursor-pointer text-xs sm:text-sm">
                      <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                      Суры
                    </Label>
                  </div>
              </div>

              {/* Selects row - only show when relevant */}
              {(settings.showTranslation || settings.showTafsir || settings.showAudio) && (
                <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t">
                  {settings.showTranslation && (
                    <Select
                      value={settings.translationId.toString()}
                      onValueChange={(v) => updateSetting('translationId', parseInt(v))}
                    >
                      <SelectTrigger className="w-28 h-7 text-xs">
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

                  {settings.showTafsir && (
                    <Select
                      value={settings.tafsirId.toString()}
                      onValueChange={(v) => updateSetting('tafsirId', parseInt(v))}
                    >
                      <SelectTrigger className="w-28 h-7 text-xs">
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

                  {settings.showAudio && (
                    <Select
                      value={settings.reciterId.toString()}
                      onValueChange={(v) => updateSetting('reciterId', parseInt(v))}
                    >
                      <SelectTrigger className="w-32 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RECITERS.map((r) => (
                          <SelectItem key={r.id} value={r.id.toString()}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Audio player - compact */}
        {settings.showAudio && audioUrl && (
          <div className="p-2 bg-card border rounded-lg flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={toggleAudio}
              disabled={loadingAudio}
            >
              {loadingAudio ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {RECITERS.find(r => r.id === settings.reciterId)?.name || 'Чтец'}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {pageData?.chapters?.[0]?.name_simple || 'Загрузка...'}
              </p>
            </div>
            <audio ref={audioRef} src={audioUrl} />
          </div>
        )}

        {/* Hidden verse audio element */}
        <audio ref={verseAudioRef} className="hidden" />

        {/* Page content */}
        <Card>
          <CardHeader className="pb-2 px-3 sm:px-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* Hide page badge on mobile (shown in header) */}
              <div className="hidden sm:flex items-center gap-3">
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {pageNumber}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {pageData?.totalLines || 0} строк
                </span>
              </div>

              {/* Chapter badges */}
              {pageData?.chapters && pageData.chapters.length > 0 && (
                <div className="flex gap-1 sm:gap-2 flex-wrap">
                  {pageData.chapters.map((chapter) => (
                    <Badge key={chapter.id} variant="secondary" className="gap-1 text-xs sm:text-sm">
                      <span className="font-arabic">{chapter.name_arabic}</span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        ({chapter.id})
                      </span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="px-2 sm:px-6">
            {loading ? (
              <div className="flex justify-center py-8 sm:py-12">
                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8 sm:py-12 text-destructive">
                <p className="text-sm sm:text-base">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 sm:mt-4"
                  onClick={() => fetchPage(pageNumber)}
                >
                  Повторить
                </Button>
              </div>
            ) : pageData ? (
              <div className="space-y-2 sm:space-y-3">
                {pageData.lines.map((line) => {
                  const isProgressLine = showProgress &&
                    showProgress.currentPage === pageNumber &&
                    showProgress.currentLine === line.lineNumber

                  return (
                    <div
                      key={line.lineNumber}
                      id={`line-${line.lineNumber}`}
                      className={`p-2 sm:p-3 border rounded-lg transition-colors ${
                        isProgressLine
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 border-2 shadow-sm'
                          : 'bg-muted/30 hover:bg-muted/50'
                      }`}
                    >
                      {/* Progress indicator badge */}
                      {isProgressLine && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-emerald-200 dark:border-emerald-800">
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] sm:text-xs">
                            📍 Ваш прогресс
                          </Badge>
                          <span className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400">
                            {showProgress.stageName}
                          </span>
                        </div>
                      )}
                      <div className="flex items-start gap-1.5 sm:gap-3">
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <Badge
                            variant={isProgressLine ? 'default' : 'outline'}
                            className={`min-w-[1.5rem] sm:min-w-[2rem] justify-center text-[10px] sm:text-xs ${
                              isProgressLine ? 'bg-emerald-500 hover:bg-emerald-600' : ''
                            }`}
                          >
                            {line.lineNumber}
                          </Badge>
                          {/* Per-line audio play button */}
                          {settings.showAudio && line.verseKeys.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-6 w-6 sm:h-7 sm:w-7 ${
                                verseAudioQueue.some(k => line.verseKeys.includes(k))
                                  ? 'text-primary bg-primary/10'
                                  : 'text-muted-foreground hover:text-primary'
                              }`}
                              onClick={() => playLineVerses(line.verseKeys)}
                            >
                              {verseAudioQueue.some(k => line.verseKeys.includes(k)) ? (
                                <Pause className="h-3 w-3 sm:h-4 sm:w-4" />
                              ) : (
                                <Play className="h-3 w-3 sm:h-4 sm:w-4" />
                              )}
                            </Button>
                          )}
                        </div>

                        <div className="flex-1 space-y-1.5 sm:space-y-2">
                          {/* Arabic text - with Mufradat if enabled */}
                          {settings.showMufradat && line.words.length > 0 ? (
                            <div dir="rtl" className="flex flex-wrap gap-0.5 sm:gap-2 justify-end">
                              {line.words.map((word, idx) => (
                                <div key={idx} className="flex flex-col items-center group">
                                  {/* Arabic word */}
                                  <span
                                    className="font-arabic text-lg sm:text-2xl leading-relaxed px-0.5 sm:px-1 rounded bg-muted/30 group-hover:bg-primary/10 transition-colors"
                                  >
                                    {word.text_uthmani}
                                  </span>
                                  {/* Russian translation below - always visible */}
                                  {word.translation?.text && (
                                    <span className="text-[8px] sm:text-xs text-muted-foreground mt-0.5 max-w-[50px] sm:max-w-[80px] text-center leading-tight line-clamp-2" title={word.translation.text}>
                                      {word.translation.text}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : line.textTajweed && settings.showTajweed ? (
                            <p
                              dir="rtl"
                              className="font-arabic text-lg sm:text-2xl leading-loose text-right"
                              dangerouslySetInnerHTML={{ __html: line.textTajweed }}
                            />
                          ) : (
                            <p
                              dir="rtl"
                              className="font-arabic text-lg sm:text-2xl leading-loose text-right"
                            >
                              {line.textArabic}
                            </p>
                          )}

                          {/* Verse keys */}
                          {line.verseKeys.length > 0 && (
                            <div className="flex gap-0.5 sm:gap-1 flex-wrap">
                              {line.verseKeys.map((key) => (
                                <Badge
                                  key={key}
                                  variant="secondary"
                                  className="text-[10px] sm:text-xs px-1.5 sm:px-2"
                                >
                                  {key}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Translation */}
                          {settings.showTranslation && pageData.translations && (
                            <div className="text-xs sm:text-sm text-muted-foreground border-t pt-1.5 sm:pt-2 mt-1.5 sm:mt-2">
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
                          {settings.showTafsir && (
                            <div className="text-xs sm:text-sm border-t pt-1.5 sm:pt-2 mt-1.5 sm:mt-2">
                              {line.verseKeys.map((key) => (
                                <div key={key} className="mb-2 sm:mb-3 last:mb-0">
                                  <div className="flex items-center gap-1 sm:gap-2 mb-1">
                                    <Badge variant="outline" className="text-[10px] sm:text-xs">{key}</Badge>
                                    {!tafsirs[key] && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 sm:h-6 text-[10px] sm:text-xs px-1 sm:px-2"
                                        onClick={() => fetchTafsir(key)}
                                        disabled={loadingTafsir === key}
                                      >
                                        {loadingTafsir === key ? (
                                          <Loader2 className="h-3 w-3 animate-spin mr-0.5 sm:mr-1" />
                                        ) : (
                                          <BookText className="h-3 w-3 mr-0.5 sm:mr-1" />
                                        )}
                                        <span className="hidden sm:inline">Загрузить тафсир</span>
                                        <span className="sm:hidden">Тафсир</span>
                                      </Button>
                                    )}
                                  </div>
                                  {tafsirs[key] && (
                                    <p
                                      className="text-muted-foreground bg-amber-50 dark:bg-amber-950/20 p-1.5 sm:p-2 rounded text-xs sm:text-sm"
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
                  )
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
                Данные не загружены
              </p>
            )}
          </CardContent>
        </Card>

        {/* Info footer - hidden on mobile for cleaner look */}
        <div className="hidden sm:block text-center text-xs text-muted-foreground">
          Источник: <a href="https://quran.com" target="_blank" rel="noopener noreferrer" className="underline">Quran.com API</a>
          {' '}| Мединский мусхаф (Хафс от Асыма) | Только чтение
        </div>
      </div>
    </TooltipProvider>
  )
}
