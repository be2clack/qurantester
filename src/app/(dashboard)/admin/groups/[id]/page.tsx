'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, Save, Loader2, Users, BookOpen, Trash2, UserPlus, Search, Settings, GraduationCap, Edit3, Mic, Video, MessageSquare, Clock, ChevronDown, ChevronUp, BookText, RefreshCw, Languages, MessageCircle, CheckCircle2, Phone, Database, Cloud, Sparkles, Volume2, Check, Palette, Bot, Zap, Hand, PlayCircle } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Slider } from '@/components/ui/slider'
import { StageNumber, GroupLevel, LessonType, MushafType, AIProvider, VerificationMode } from '@prisma/client'

const GROUP_LEVELS = [
  { value: 'LEVEL_1', label: 'Уровень 1', description: '1 строка за 12ч', num: '1' },
  { value: 'LEVEL_2', label: 'Уровень 2', description: '3 строки за 12ч', num: '2' },
  { value: 'LEVEL_3', label: 'Уровень 3', description: '7 строк за 12ч', num: '3' },
]

const LESSON_TYPES = [
  { value: 'MEMORIZATION', label: 'Заучивание', prefix: 'ЗА' },
  { value: 'REVISION', label: 'Повторение', prefix: 'ПО' },
  { value: 'TRANSLATION', label: 'Перевод', prefix: 'ПЕ' },
]

const LESSON_TYPE_ICONS: Record<string, React.ReactNode> = {
  MEMORIZATION: <BookText className="h-5 w-5" />,
  REVISION: <RefreshCw className="h-5 w-5" />,
  TRANSLATION: <Languages className="h-5 w-5" />,
}

const LEVEL_COLORS: Record<string, string> = {
  LEVEL_1: 'bg-emerald-100 text-emerald-800',
  LEVEL_2: 'bg-blue-100 text-blue-800',
  LEVEL_3: 'bg-purple-100 text-purple-800',
}

const MUSHAF_TYPES = [
  { value: 'LOCAL', label: 'Наш Мусхаф', description: 'Локальная база данных', icon: Database },
  { value: 'MEDINA_API', label: 'Мединский', description: 'Quran.com API', icon: Cloud },
]

const RUSSIAN_TRANSLATIONS = [
  { id: 45, name: 'Кулиев', author: 'Эльмир Кулиев', isDefault: true },
  { id: 79, name: 'Абу Адель', author: 'Абу Адель', isDefault: false },
  { id: 78, name: 'Мин. вакуфов', author: 'Ministry of Awqaf', isDefault: false },
]

const RUSSIAN_TAFSIRS = [
  { id: 170, name: 'ас-Саади', author: 'Абдуррахман ас-Саади', isDefault: true },
]

const POPULAR_RECITERS = [
  { id: 7, name: 'Мишари Рашид', style: 'مرتل', isDefault: true },
  { id: 1, name: 'Абдуль-Басит (Муджаввад)', style: 'مجود' },
  { id: 2, name: 'Абдуль-Басит (Муратталь)', style: 'مرتل' },
  { id: 6, name: 'Махмуд аль-Хусари', style: 'مرتل' },
  { id: 5, name: 'Мухаммад аль-Минщави', style: 'مرتل' },
]

const AI_PROVIDERS = [
  { value: 'NONE', label: 'Без AI', description: 'Только ручная проверка устазом', icon: Hand },
  { value: 'QURANI_AI', label: 'Qurani.ai', description: 'QRC API для проверки чтения', icon: Sparkles },
  { value: 'WHISPER', label: 'OpenAI Whisper', description: 'Распознавание речи + сравнение', icon: Mic },
  { value: 'HUGGINGFACE', label: 'HuggingFace', description: 'Quran ASR модель (скоро)', icon: Bot },
]

const VERIFICATION_MODES = [
  { value: 'MANUAL', label: 'Ручная', description: 'Устаз проверяет все работы', icon: Hand },
  { value: 'SEMI_AUTO', label: 'Полуавто', description: 'AI помогает, устаз подтверждает', icon: Zap },
  { value: 'FULL_AUTO', label: 'Автоматическая', description: 'AI проверяет по порогам', icon: PlayCircle },
]

// Parse group name like "ЗА-25-1-3" into components
function parseGroupName(name: string) {
  const parts = name.split('-')
  if (parts.length !== 4) return null

  const [prefix, year, levelNum, groupNum] = parts
  const lessonType = LESSON_TYPES.find(t => t.prefix === prefix)?.value || 'MEMORIZATION'
  const level = GROUP_LEVELS.find(l => l.num === levelNum)?.value || 'LEVEL_1'

  return { prefix, year, levelNum, groupNum, lessonType, level }
}

interface GroupData {
  id: string
  name: string
  description: string | null
  level: GroupLevel
  lessonType: LessonType
  isActive: boolean
  ustazId: string
  // Lesson settings
  repetitionCount: number
  stage1Days: number
  stage2Days: number
  stage3Days: number
  allowVoice: boolean
  allowVideoNote: boolean
  allowText: boolean
  showText: boolean
  showImage: boolean
  showAudio: boolean
  // Mushaf settings
  mushafType: MushafType
  translationId: number | null
  tafsirId: number | null
  showTranslation: boolean
  showTafsir: boolean
  showTajweed: boolean
  reciterId: number | null
  // AI Verification settings
  aiProvider: AIProvider
  verificationMode: VerificationMode
  aiAcceptThreshold: number
  aiRejectThreshold: number
  // Relations
  ustaz: {
    id: string
    firstName: string | null
    lastName: string | null
    phone: string
  }
  students: {
    id: string
    firstName: string | null
    lastName: string | null
    phone: string
    telegramId: bigint | null
    currentPage: number
    currentLine: number
    currentStage: StageNumber
    tasks?: {
      passedCount: number
      requiredCount: number
    }[]
  }[]
}

interface Ustaz {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
}

interface AvailableStudent {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
  groupId: string | null
}

export default function EditGroupPage() {
  const params = useParams()
  const router = useRouter()
  const [group, setGroup] = useState<GroupData | null>(null)
  const [ustazList, setUstazList] = useState<Ustaz[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Student add dialog
  const [studentDialogOpen, setStudentDialogOpen] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [availableStudents, setAvailableStudents] = useState<AvailableStudent[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [addingStudent, setAddingStudent] = useState<string | null>(null)

  // Collapsible settings
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false)
  const [lessonSettingsOpen, setLessonSettingsOpen] = useState(false)
  const [mushafSettingsOpen, setMushafSettingsOpen] = useState(false)

  const [formData, setFormData] = useState({
    description: '',
    ustazId: '',
    level: 'LEVEL_1' as GroupLevel,
    isActive: true,
    lessonType: 'MEMORIZATION',
    // Lesson settings
    repetitionCount: 80,
    stage1Days: 1,
    stage2Days: 2,
    stage3Days: 2,
    allowVoice: true,
    allowVideoNote: true,
    allowText: false,
    showText: false,
    showImage: false,
    showAudio: false,
    // Mushaf settings
    mushafType: 'LOCAL' as MushafType,
    translationId: 45 as number | null,
    tafsirId: 170 as number | null,
    showTranslation: false,
    showTafsir: false,
    showTajweed: false,
    reciterId: 7 as number | null,
    // AI Verification settings
    aiProvider: 'NONE' as AIProvider,
    verificationMode: 'MANUAL' as VerificationMode,
    aiAcceptThreshold: 85,
    aiRejectThreshold: 50,
  })
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [savedSection, setSavedSection] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [groupRes, ustazRes] = await Promise.all([
          fetch(`/api/groups/${params.id}`),
          fetch('/api/users?role=USTAZ&limit=100'),
        ])

        if (!groupRes.ok) throw new Error('Failed to fetch group')

        const groupData = await groupRes.json()
        const ustazData = await ustazRes.json()

        setGroup(groupData)
        setUstazList(ustazData.items || [])

        setFormData({
          description: groupData.description || '',
          ustazId: groupData.ustazId,
          level: groupData.level || 'LEVEL_1',
          isActive: groupData.isActive,
          lessonType: groupData.lessonType || 'MEMORIZATION',
          // Lesson settings
          repetitionCount: groupData.repetitionCount || 80,
          stage1Days: groupData.stage1Days || 1,
          stage2Days: groupData.stage2Days || 2,
          stage3Days: groupData.stage3Days || 2,
          allowVoice: groupData.allowVoice ?? true,
          allowVideoNote: groupData.allowVideoNote ?? true,
          allowText: groupData.allowText ?? false,
          showText: groupData.showText ?? false,
          showImage: groupData.showImage ?? false,
          showAudio: groupData.showAudio ?? false,
          // Mushaf settings
          mushafType: groupData.mushafType || 'LOCAL',
          translationId: groupData.translationId ?? 45,
          tafsirId: groupData.tafsirId ?? 170,
          showTranslation: groupData.showTranslation ?? false,
          showTafsir: groupData.showTafsir ?? false,
          showTajweed: groupData.showTajweed ?? false,
          reciterId: groupData.reciterId ?? 7,
          // AI Verification settings
          aiProvider: groupData.aiProvider || 'NONE',
          verificationMode: groupData.verificationMode || 'MANUAL',
          aiAcceptThreshold: groupData.aiAcceptThreshold ?? 85,
          aiRejectThreshold: groupData.aiRejectThreshold ?? 50,
        })
      } catch (err) {
        setError('Ошибка загрузки данных')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/groups/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: formData.description,
          ustazId: formData.ustazId,
          level: formData.level,
          isActive: formData.isActive,
          lessonType: formData.lessonType,
          // Lesson settings
          repetitionCount: formData.repetitionCount,
          stage1Days: formData.stage1Days,
          stage2Days: formData.stage2Days,
          stage3Days: formData.stage3Days,
          allowVoice: formData.allowVoice,
          allowVideoNote: formData.allowVideoNote,
          allowText: formData.allowText,
          showText: formData.showText,
          showImage: formData.showImage,
          showAudio: formData.showAudio,
          // Mushaf settings
          mushafType: formData.mushafType,
          translationId: formData.translationId,
          tafsirId: formData.tafsirId,
          showTranslation: formData.showTranslation,
          showTafsir: formData.showTafsir,
          showTajweed: formData.showTajweed,
          reciterId: formData.reciterId,
          // AI Verification settings
          aiProvider: formData.aiProvider,
          verificationMode: formData.verificationMode,
          aiAcceptThreshold: formData.aiAcceptThreshold,
          aiRejectThreshold: formData.aiRejectThreshold,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }

      router.push('/admin/groups')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  // Save without redirect (for individual sections)
  const handleSaveSection = async (section: string) => {
    setSavingSection(section)
    setError('')
    setSavedSection(null)

    try {
      const res = await fetch(`/api/groups/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: formData.description,
          ustazId: formData.ustazId,
          level: formData.level,
          isActive: formData.isActive,
          lessonType: formData.lessonType,
          // Lesson settings
          repetitionCount: formData.repetitionCount,
          stage1Days: formData.stage1Days,
          stage2Days: formData.stage2Days,
          stage3Days: formData.stage3Days,
          allowVoice: formData.allowVoice,
          allowVideoNote: formData.allowVideoNote,
          allowText: formData.allowText,
          showText: formData.showText,
          showImage: formData.showImage,
          showAudio: formData.showAudio,
          // Mushaf settings
          mushafType: formData.mushafType,
          translationId: formData.translationId,
          tafsirId: formData.tafsirId,
          showTranslation: formData.showTranslation,
          showTafsir: formData.showTafsir,
          showTajweed: formData.showTajweed,
          reciterId: formData.reciterId,
          // AI Verification settings
          aiProvider: formData.aiProvider,
          verificationMode: formData.verificationMode,
          aiAcceptThreshold: formData.aiAcceptThreshold,
          aiRejectThreshold: formData.aiRejectThreshold,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }

      setSavedSection(section)
      setTimeout(() => setSavedSection(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSavingSection(null)
    }
  }

  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm('Удалить студента из группы?')) return

    try {
      const res = await fetch(`/api/groups/${params.id}/students?studentId=${studentId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setGroup(prev => prev ? {
          ...prev,
          students: prev.students.filter(s => s.id !== studentId)
        } : null)
      }
    } catch (err) {
      console.error('Failed to remove student:', err)
    }
  }

  const searchStudents = async (query: string) => {
    setLoadingStudents(true)
    try {
      const res = await fetch(`/api/users?role=STUDENT&search=${encodeURIComponent(query)}&limit=20&noGroup=true`)
      if (res.ok) {
        const data = await res.json()
        setAvailableStudents(data.items || [])
      }
    } catch (err) {
      console.error('Failed to search students:', err)
    } finally {
      setLoadingStudents(false)
    }
  }

  const handleAddStudent = async (studentId: string) => {
    setAddingStudent(studentId)
    try {
      const res = await fetch(`/api/groups/${params.id}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      if (res.ok) {
        const addedStudent = availableStudents.find(s => s.id === studentId)
        if (addedStudent && group) {
          setGroup({
            ...group,
            students: [...group.students, {
              ...addedStudent,
              telegramId: null,
              currentPage: 1,
              currentLine: 1,
              currentStage: 'STAGE_1_1' as StageNumber,
              tasks: [],
            }]
          })
        }
        setAvailableStudents(prev => prev.filter(s => s.id !== studentId))
      }
    } catch (err) {
      console.error('Failed to add student:', err)
    } finally {
      setAddingStudent(null)
    }
  }

  const getStageLabel = (stage: StageNumber) => {
    switch (stage) {
      case 'STAGE_1_1': return '1.1'
      case 'STAGE_1_2': return '1.2'
      case 'STAGE_2_1': return '2.1'
      case 'STAGE_2_2': return '2.2'
      case 'STAGE_3': return '3'
    }
  }

  const getLevelLabel = (level: GroupLevel) => GROUP_LEVELS.find(l => l.value === level)?.label || level

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Группа не найдена</p>
        <Button variant="link" onClick={() => router.back()}>
          Вернуться назад
        </Button>
      </div>
    )
  }

  const currentLessonType = LESSON_TYPES.find(t => t.value === formData.lessonType)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
            <Badge variant={formData.isActive ? 'default' : 'secondary'}>
              {formData.isActive ? 'Активна' : 'Неактивна'}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {LESSON_TYPES.find(t => t.value === formData.lessonType)?.label || 'Без урока'} • {getLevelLabel(formData.level)} • {group.students.length} студентов
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription>Студентов</CardDescription>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-3xl">{group.students.length}</CardTitle>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription>Устаз</CardDescription>
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-lg truncate">
              {group.ustaz.firstName} {group.ustaz.lastName}
            </CardTitle>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription>Уровень</CardDescription>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${LEVEL_COLORS[group.level]}`}>
              <span className="text-sm font-bold">{group.level.replace('LEVEL_', '')}</span>
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-lg">
              {getLevelLabel(group.level)}
            </CardTitle>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardDescription>Тип урока</CardDescription>
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              {LESSON_TYPE_ICONS[formData.lessonType]}
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-lg">
              {currentLessonType?.label || '—'}
            </CardTitle>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Settings Card */}
        <Collapsible open={groupSettingsOpen} onOpenChange={setGroupSettingsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Настройки группы
                  </CardTitle>
                  {groupSettingsOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Group Name Section */}
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                  <Label className="font-medium">Название группы</Label>
                </div>
                <p className="text-2xl font-bold">{group.name}</p>
                <p className="text-xs text-muted-foreground">Год и номер генерируются автоматически при создании</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Тип урока</Label>
                    <Select
                      value={formData.lessonType}
                      onValueChange={(value) => setFormData({ ...formData, lessonType: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LESSON_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.prefix} - {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Уровень</Label>
                    <Select
                      value={formData.level}
                      onValueChange={(value) => setFormData({ ...formData, level: value as GroupLevel })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GROUP_LEVELS.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.num} - {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ustaz">Устаз</Label>
                <Select
                  value={formData.ustazId}
                  onValueChange={(value) => setFormData({ ...formData, ustazId: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ustazList.map((ustaz) => (
                      <SelectItem key={ustaz.id} value={ustaz.id}>
                        {ustaz.firstName} {ustaz.lastName} ({ustaz.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Необязательное описание группы..."
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <Label htmlFor="isActive" className="font-medium">Группа активна</Label>
                  <p className="text-xs text-muted-foreground">Неактивные группы скрыты от студентов</p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Сохранить изменения
                  </>
                )}
              </Button>
            </form>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Lesson Settings Card */}
        <Collapsible open={lessonSettingsOpen} onOpenChange={setLessonSettingsOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Настройки урока
                  </CardTitle>
                  {lessonSettingsOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
            {/* Repetition Count */}
            <div className="space-y-2">
              <Label htmlFor="repetitionCount">Количество повторений</Label>
              <Input
                id="repetitionCount"
                type="number"
                min={1}
                max={200}
                value={formData.repetitionCount}
                onChange={(e) => setFormData({ ...formData, repetitionCount: parseInt(e.target.value) || 80 })}
              />
              <p className="text-xs text-muted-foreground">Сколько раз студент должен сдать строку</p>
            </div>

            {/* Days per Stage */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Дней на этап
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Этап 1</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={formData.stage1Days}
                    onChange={(e) => setFormData({ ...formData, stage1Days: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Этап 2</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={formData.stage2Days}
                    onChange={(e) => setFormData({ ...formData, stage2Days: parseInt(e.target.value) || 2 })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Этап 3</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={formData.stage3Days}
                    onChange={(e) => setFormData({ ...formData, stage3Days: parseInt(e.target.value) || 2 })}
                  />
                </div>
              </div>
            </div>

            {/* Submission Formats */}
            <div className="space-y-3">
              <Label>Форматы сдачи</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Голосовое сообщение</span>
                  </div>
                  <Switch
                    checked={formData.allowVoice}
                    onCheckedChange={(checked) => setFormData({ ...formData, allowVoice: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Видеокружок</span>
                  </div>
                  <Switch
                    checked={formData.allowVideoNote}
                    onCheckedChange={(checked) => setFormData({ ...formData, allowVideoNote: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-2 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Текстовое сообщение</span>
                  </div>
                  <Switch
                    checked={formData.allowText}
                    onCheckedChange={(checked) => setFormData({ ...formData, allowText: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Content Display Options */}
            <div className="space-y-3">
              <Label>Отображение материала</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showText"
                    checked={formData.showText}
                    onCheckedChange={(checked) => setFormData({ ...formData, showText: !!checked })}
                  />
                  <Label htmlFor="showText" className="text-sm font-normal">Показывать текст</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showImage"
                    checked={formData.showImage}
                    onCheckedChange={(checked) => setFormData({ ...formData, showImage: !!checked })}
                  />
                  <Label htmlFor="showImage" className="text-sm font-normal">Показывать изображение</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showAudio"
                    checked={formData.showAudio}
                    onCheckedChange={(checked) => setFormData({ ...formData, showAudio: !!checked })}
                  />
                  <Label htmlFor="showAudio" className="text-sm font-normal">Показывать аудио</Label>
                </div>
              </div>
            </div>

                {/* Save button */}
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => handleSaveSection('lesson')}
                  disabled={savingSection === 'lesson'}
                >
                  {savingSection === 'lesson' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Сохранение...
                    </>
                  ) : savedSection === 'lesson' ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Сохранено
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Сохранить настройки урока
                    </>
                  )}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      {/* Mushaf Settings Card */}
      <Collapsible open={mushafSettingsOpen} onOpenChange={setMushafSettingsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Настройки мусхафа
                  </CardTitle>
                  <Badge variant={formData.mushafType === 'MEDINA_API' ? 'default' : 'secondary'}>
                    {MUSHAF_TYPES.find(m => m.value === formData.mushafType)?.label}
                  </Badge>
                </div>
                {mushafSettingsOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Mushaf Type Selection */}
              <div className="space-y-2">
                <Label>Источник контента</Label>
                <div className="grid grid-cols-2 gap-3">
                  {MUSHAF_TYPES.map((type) => {
                    const Icon = type.icon
                    const isSelected = formData.mushafType === type.value
                    return (
                      <div
                        key={type.value}
                        onClick={() => setFormData({ ...formData, mushafType: type.value as MushafType })}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                            <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <p className="font-medium">{type.label}</p>
                            <p className="text-xs text-muted-foreground">{type.description}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Medina API Settings */}
              {formData.mushafType === 'MEDINA_API' && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Cloud className="h-4 w-4" />
                    Настройки Quran.com API
                  </p>

                  {/* Translation Settings */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Languages className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="showTranslation">Показывать перевод</Label>
                      </div>
                      <Switch
                        id="showTranslation"
                        checked={formData.showTranslation}
                        onCheckedChange={(checked) => setFormData({ ...formData, showTranslation: checked })}
                      />
                    </div>
                    {formData.showTranslation && (
                      <Select
                        value={formData.translationId?.toString() || '45'}
                        onValueChange={(value) => setFormData({ ...formData, translationId: parseInt(value) })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Выберите перевод" />
                        </SelectTrigger>
                        <SelectContent>
                          {RUSSIAN_TRANSLATIONS.map((t) => (
                            <SelectItem key={t.id} value={t.id.toString()}>
                              {t.name} ({t.author})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Tafsir Settings */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookText className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="showTafsir">Показывать тафсир</Label>
                      </div>
                      <Switch
                        id="showTafsir"
                        checked={formData.showTafsir}
                        onCheckedChange={(checked) => setFormData({ ...formData, showTafsir: checked })}
                      />
                    </div>
                    {formData.showTafsir && (
                      <Select
                        value={formData.tafsirId?.toString() || '170'}
                        onValueChange={(value) => setFormData({ ...formData, tafsirId: parseInt(value) })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Выберите тафсир" />
                        </SelectTrigger>
                        <SelectContent>
                          {RUSSIAN_TAFSIRS.map((t) => (
                            <SelectItem key={t.id} value={t.id.toString()}>
                              {t.name} ({t.author})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Tajweed Settings */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="showTajweed">Показывать таджвид</Label>
                    </div>
                    <Switch
                      id="showTajweed"
                      checked={formData.showTajweed}
                      onCheckedChange={(checked) => setFormData({ ...formData, showTajweed: checked })}
                    />
                  </div>

                  {/* Reciter Selection */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                      Чтец
                    </Label>
                    <Select
                      value={formData.reciterId?.toString() || '7'}
                      onValueChange={(value) => setFormData({ ...formData, reciterId: parseInt(value) })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите чтеца" />
                      </SelectTrigger>
                      <SelectContent>
                        {POPULAR_RECITERS.map((r) => (
                          <SelectItem key={r.id} value={r.id.toString()}>
                            {r.name} <span className="text-muted-foreground font-arabic">{r.style}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </div>
              )}

              {/* AI Verification Settings */}
              <div className="space-y-4 p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Bot className="h-4 w-4 text-amber-600" />
                  AI Проверка чтения
                </p>

                {/* AI Provider Selection */}
                <div className="space-y-2">
                  <Label>AI провайдер</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {AI_PROVIDERS.map((provider) => {
                      const Icon = provider.icon
                      const isSelected = formData.aiProvider === provider.value
                      const isDisabled = provider.value === 'HUGGINGFACE'
                      return (
                        <div
                          key={provider.value}
                          onClick={() => !isDisabled && setFormData({ ...formData, aiProvider: provider.value as AIProvider })}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            isDisabled
                              ? 'opacity-50 cursor-not-allowed border-muted bg-muted/30'
                              : isSelected
                                ? 'border-amber-500 bg-amber-100/50 dark:bg-amber-900/30 cursor-pointer'
                                : 'border-transparent bg-background hover:border-muted-foreground/50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${isSelected ? 'text-amber-600' : 'text-muted-foreground'}`} />
                            <div>
                              <p className="text-sm font-medium">{provider.label}</p>
                              <p className="text-xs text-muted-foreground">{provider.description}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Verification Mode (only when AI is enabled) */}
                {formData.aiProvider !== 'NONE' && (
                  <>
                    <div className="space-y-2">
                      <Label>Режим верификации</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {VERIFICATION_MODES.map((mode) => {
                          const Icon = mode.icon
                          const isSelected = formData.verificationMode === mode.value
                          return (
                            <div
                              key={mode.value}
                              onClick={() => setFormData({ ...formData, verificationMode: mode.value as VerificationMode })}
                              className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : 'border-transparent bg-background hover:border-muted-foreground/50'
                              }`}
                            >
                              <div className="text-center">
                                <Icon className={`h-5 w-5 mx-auto mb-1 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                <p className="text-xs font-medium">{mode.label}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {VERIFICATION_MODES.find(m => m.value === formData.verificationMode)?.description}
                      </p>
                    </div>

                    {/* Thresholds (only for SEMI_AUTO and FULL_AUTO) */}
                    {formData.verificationMode !== 'MANUAL' && (
                      <div className="space-y-4 pt-2 border-t border-amber-200 dark:border-amber-800">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-green-700 dark:text-green-400">Порог автопринятия</Label>
                            <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                              {formData.aiAcceptThreshold}%
                            </Badge>
                          </div>
                          <Slider
                            value={[formData.aiAcceptThreshold]}
                            onValueChange={([value]) => setFormData({ ...formData, aiAcceptThreshold: value })}
                            min={50}
                            max={100}
                            step={5}
                            className="[&_[role=slider]]:bg-green-500"
                          />
                          <p className="text-xs text-muted-foreground">
                            Работы с оценкой выше {formData.aiAcceptThreshold}% будут автоматически приняты
                          </p>
                        </div>

                        {formData.verificationMode === 'FULL_AUTO' && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-red-700 dark:text-red-400">Порог автоотклонения</Label>
                              <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                {formData.aiRejectThreshold}%
                              </Badge>
                            </div>
                            <Slider
                              value={[formData.aiRejectThreshold]}
                              onValueChange={([value]) => setFormData({ ...formData, aiRejectThreshold: value })}
                              min={0}
                              max={formData.aiAcceptThreshold - 10}
                              step={5}
                              className="[&_[role=slider]]:bg-red-500"
                            />
                            <p className="text-xs text-muted-foreground">
                              Работы с оценкой ниже {formData.aiRejectThreshold}% будут автоматически отклонены
                            </p>
                          </div>
                        )}

                        <div className="p-2 bg-amber-100/50 dark:bg-amber-900/30 rounded text-xs text-amber-800 dark:text-amber-200">
                          Работы с оценкой между порогами отправляются устазу на ручную проверку
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {formData.mushafType === 'LOCAL' && (
                <div className="p-4 bg-muted/30 rounded-lg border border-dashed text-center">
                  <Database className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Контент берется из локальной базы данных.
                    <br />
                    Редактируйте на странице <strong>Коран → Наш Мусхаф</strong>
                  </p>
                </div>
              )}

              {/* Save button */}
              <Button
                type="button"
                className="w-full"
                onClick={() => handleSaveSection('mushaf')}
                disabled={savingSection === 'mushaf'}
              >
                {savingSection === 'mushaf' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : savedSection === 'mushaf' ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Сохранено
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Сохранить настройки мусхафа
                  </>
                )}
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Students Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Студенты группы
              </CardTitle>
              <CardDescription>
                {group.students.length} студентов в группе
              </CardDescription>
            </div>
            <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { searchStudents(''); setStudentSearch('') }}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Добавить
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Добавить студента</DialogTitle>
                  <DialogDescription>
                    Поиск студентов без группы
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Поиск по имени или телефону..."
                      value={studentSearch}
                      onChange={(e) => {
                        setStudentSearch(e.target.value)
                        searchStudents(e.target.value)
                      }}
                      className="pl-8"
                    />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto space-y-2">
                    {loadingStudents ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : availableStudents.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        {studentSearch ? 'Студенты не найдены' : 'Введите имя или телефон'}
                      </p>
                    ) : (
                      availableStudents.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <p className="font-medium">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {student.phone}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddStudent(student.id)}
                            disabled={addingStudent === student.id}
                          >
                            {addingStudent === student.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Добавить'
                            )}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {group.students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>В группе пока нет студентов</p>
              <p className="text-sm">Добавьте студентов или дождитесь регистрации через бота</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Студент</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Прогресс</TableHead>
                  <TableHead className="text-center">Чат</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.students.map((student) => {
                  const activeTask = student.tasks?.[0]
                  const taskCompletion = activeTask
                    ? Math.round((activeTask.passedCount / activeTask.requiredCount) * 100)
                    : 0
                  const phoneClean = student.phone.replace(/\D/g, '')

                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Link
                          href={`/admin/users/${student.id}`}
                          className="font-medium hover:underline"
                        >
                          {student.firstName} {student.lastName}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {student.phone}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3 text-sm">
                            <div className="flex items-center gap-1">
                              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{student.currentPage}-{student.currentLine}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{activeTask?.passedCount || 0}/{activeTask?.requiredCount || 0}</span>
                            </div>
                          </div>
                          <Progress value={taskCompletion} className="h-1.5 w-24" />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {student.telegramId && (
                            <a
                              href={`https://t.me/${student.telegramId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Telegram">
                                <MessageCircle className="h-4 w-4 text-blue-500" />
                              </Button>
                            </a>
                          )}
                          <a
                            href={`https://wa.me/${phoneClean}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="WhatsApp">
                              <svg className="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                            </Button>
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveStudent(student.id)}
                          title="Удалить из группы"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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
    </div>
  )
}
