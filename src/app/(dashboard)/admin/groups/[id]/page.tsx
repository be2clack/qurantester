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
import { ArrowLeft, Save, Loader2, Users, BookOpen, Trash2, UserPlus, Search, Settings, GraduationCap, Edit3, Mic, Video, MessageSquare, Clock, ChevronDown, ChevronUp, MessageCircle, CheckCircle2, Phone, Cloud, Sparkles, Volume2, Check, Palette, Bot, Zap, Hand, PlayCircle, Languages, BookText, RefreshCw, Pencil } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Slider } from '@/components/ui/slider'
import { StageNumber, GroupLevel, LessonType, MushafType, AIProvider, VerificationMode } from '@prisma/client'
import { StudentProgressEditDialog } from '@/components/student-progress-edit-dialog'
import { StudentStatsDetailDialog } from '@/components/student-stats-detail-dialog'

const GROUP_LEVELS = [
  { value: 'LEVEL_1', label: 'Уровень 1', description: '1 строка за раз (начальный)', num: '1', linesPerBatch: 1 },
  { value: 'LEVEL_2', label: 'Уровень 2', description: '3 строки за раз (средний)', num: '2', linesPerBatch: 3 },
  { value: 'LEVEL_3', label: 'Уровень 3', description: '7 строк за раз (продвинутый)', num: '3', linesPerBatch: 7 },
]

const GROUP_GENDERS = [
  { value: 'MALE', label: 'Мужская', prefix: 'М', icon: '👨' },
  { value: 'FEMALE', label: 'Женская', prefix: 'Ж', icon: '🧕' },
]

const LEVEL_COLORS: Record<string, string> = {
  LEVEL_1: 'bg-emerald-100 text-emerald-800',
  LEVEL_2: 'bg-blue-100 text-blue-800',
  LEVEL_3: 'bg-purple-100 text-purple-800',
}

// Only Medina API mushaf is supported
const MUSHAF_TYPE_LABEL = 'Мединский мусхаф (Quran.com API)'

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
  { value: 'QURANI_AI', label: 'Qurani.ai', description: 'Специализированный API для проверки чтения Корана с таджвидом', icon: Sparkles },
  { value: 'WHISPER', label: 'OpenAI Whisper', description: 'Распознавание речи + сравнение с текстом', icon: Mic },
]

// AI providers for QRC pre-check (excludes NONE)
const QRC_PRECHECK_PROVIDERS = [
  { value: 'QURANI_AI', label: 'Qurani.ai QRC', description: 'API проверки чтения Корана', icon: Sparkles },
  { value: 'WHISPER', label: 'OpenAI Whisper', description: 'Whisper + сравнение текста', icon: Mic },
]

const VERIFICATION_MODES = [
  {
    value: 'MANUAL',
    label: 'Ручная',
    description: 'Все работы проверяет устаз',
    details: 'AI оценивает, но решение за устазом',
    icon: Hand
  },
  {
    value: 'SEMI_AUTO',
    label: 'Полуавто',
    description: 'AI принимает хорошие работы',
    details: 'Работы выше порога принимаются автоматически, остальные проверяет устаз',
    icon: Zap
  },
  {
    value: 'FULL_AUTO',
    label: 'Автомат',
    description: 'AI принимает и отклоняет',
    details: 'Работы выше/ниже порогов обрабатываются автоматически, средние - к устазу',
    icon: PlayCircle
  },
]

// Parse group name like "ЗА-25-1-3" into components
function parseGroupName(name: string) {
  const parts = name.split('-')
  if (parts.length !== 4) return null

  const [prefix, year, levelNum, groupNum] = parts
  const level = GROUP_LEVELS.find(l => l.num === levelNum)?.value || 'LEVEL_1'

  return { prefix, year, levelNum, groupNum, lessonType: 'MEMORIZATION', level }
}

interface GroupData {
  id: string
  name: string
  description: string | null
  level: GroupLevel
  gender: 'MALE' | 'FEMALE'
  lessonType: LessonType
  isActive: boolean
  ustazId: string
  // Lesson settings
  repetitionCount: number
  stage1Hours: number
  stage2Hours: number
  stage3Hours: number
  deadlineEnabled: boolean
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
  // QRC Pre-check settings
  qrcPreCheckEnabled: boolean
  qrcPreCheckProvider: AIProvider
  qrcHafzLevel: number
  qrcTajweedLevel: number
  qrcPassThreshold: number
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
    // Progress stats
    completedTasksCount?: number
    revisionsPassed?: number
    revisionsPending?: number
    revisionsTotal?: number
    // Mufradat stats
    mufradatWeekPassed?: number
    mufradatWeekTotal?: number
    mufradatToday?: {
      wordsCorrect: number
      wordsTotal: number
      passed: boolean
    } | null
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

  // Progress edit dialog
  const [progressDialogOpen, setProgressDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<GroupData['students'][0] | null>(null)

  // Stats detail dialog
  const [statsDialogOpen, setStatsDialogOpen] = useState(false)
  const [statsDialogType, setStatsDialogType] = useState<'memorization' | 'revision' | 'mufradat'>('memorization')
  const [statsStudent, setStatsStudent] = useState<{ id: string; name: string } | null>(null)

  // Collapsible settings
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false)
  const [lessonSettingsOpen, setLessonSettingsOpen] = useState(false)
  const [mushafSettingsOpen, setMushafSettingsOpen] = useState(false)

  const [formData, setFormData] = useState({
    description: '',
    ustazId: '',
    level: 'LEVEL_1' as GroupLevel,
    gender: 'MALE' as 'MALE' | 'FEMALE',
    isActive: true,
    lessonType: 'MEMORIZATION',
    // MEMORIZATION settings (Заучивание)
    repetitionCount: 80,
    stage1Hours: 24,  // 24 часа = 1 день
    stage2Hours: 48,  // 48 часов = 2 дня
    stage3Hours: 48,
    deadlineEnabled: true,
    // REVISION settings (Повторение)
    revisionPagesPerDay: 3,
    revisionAllPages: false,
    revisionButtonOnly: false,
    // TRANSLATION settings (Переводы)
    wordsPerDay: 10,
    wordsPassThreshold: 8,
    mufradatTimeLimit: 180,
    // Content settings
    allowVoice: true,
    allowVideoNote: true,
    allowText: false,
    showText: false,
    showImage: false,
    showAudio: false,
    // Mushaf settings (always MEDINA_API)
    mushafType: 'MEDINA_API' as MushafType,
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
    // QRC Pre-check settings
    qrcPreCheckEnabled: false,
    qrcPreCheckProvider: 'QURANI_AI' as AIProvider,
    qrcHafzLevel: 1,
    qrcTajweedLevel: 1,
    qrcPassThreshold: 70,
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
          gender: groupData.gender || 'MALE',
          isActive: groupData.isActive,
          lessonType: groupData.lessonType || 'MEMORIZATION',
          // MEMORIZATION settings
          repetitionCount: groupData.repetitionCount || 80,
          stage1Hours: groupData.stage1Hours || 24,
          stage2Hours: groupData.stage2Hours || 48,
          stage3Hours: groupData.stage3Hours || 48,
          deadlineEnabled: groupData.deadlineEnabled ?? true,
          // REVISION settings
          revisionPagesPerDay: groupData.revisionPagesPerDay || 3,
          revisionAllPages: groupData.revisionAllPages ?? false,
          revisionButtonOnly: groupData.revisionButtonOnly ?? false,
          // TRANSLATION settings
          wordsPerDay: groupData.wordsPerDay || 10,
          wordsPassThreshold: groupData.wordsPassThreshold || 8,
          mufradatTimeLimit: groupData.mufradatTimeLimit || 180,
          // Content settings
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
          // QRC Pre-check settings
          qrcPreCheckEnabled: groupData.qrcPreCheckEnabled ?? false,
          qrcPreCheckProvider: groupData.qrcPreCheckProvider || 'QURANI_AI',
          qrcHafzLevel: groupData.qrcHafzLevel ?? 1,
          qrcTajweedLevel: groupData.qrcTajweedLevel ?? 1,
          qrcPassThreshold: groupData.qrcPassThreshold ?? 70,
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
          gender: formData.gender,
          isActive: formData.isActive,
          lessonType: formData.lessonType,
          // MEMORIZATION settings
          repetitionCount: formData.repetitionCount,
          stage1Hours: formData.stage1Hours,
          stage2Hours: formData.stage2Hours,
          stage3Hours: formData.stage3Hours,
          deadlineEnabled: formData.deadlineEnabled,
          // REVISION settings
          revisionPagesPerDay: formData.revisionPagesPerDay,
          revisionAllPages: formData.revisionAllPages,
          revisionButtonOnly: formData.revisionButtonOnly,
          // TRANSLATION settings
          wordsPerDay: formData.wordsPerDay,
          wordsPassThreshold: formData.wordsPassThreshold,
          mufradatTimeLimit: formData.mufradatTimeLimit,
          // Content settings
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
          // QRC Pre-check settings
          qrcPreCheckEnabled: formData.qrcPreCheckEnabled,
          qrcPreCheckProvider: formData.qrcPreCheckProvider,
          qrcHafzLevel: formData.qrcHafzLevel,
          qrcTajweedLevel: formData.qrcTajweedLevel,
          qrcPassThreshold: formData.qrcPassThreshold,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update')
      }

      // Update group with new data (including new name, gender, level if changed)
      if (group) {
        setGroup({
          ...group,
          name: data.name || group.name,
          gender: formData.gender,
          level: formData.level
        })
      }

      // Show success and stay on page
      setSavedSection('group')
      setTimeout(() => setSavedSection(null), 3000)
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
          gender: formData.gender,
          isActive: formData.isActive,
          lessonType: formData.lessonType,
          // MEMORIZATION settings
          repetitionCount: formData.repetitionCount,
          stage1Hours: formData.stage1Hours,
          stage2Hours: formData.stage2Hours,
          stage3Hours: formData.stage3Hours,
          deadlineEnabled: formData.deadlineEnabled,
          // REVISION settings
          revisionPagesPerDay: formData.revisionPagesPerDay,
          revisionAllPages: formData.revisionAllPages,
          revisionButtonOnly: formData.revisionButtonOnly,
          // TRANSLATION settings
          wordsPerDay: formData.wordsPerDay,
          wordsPassThreshold: formData.wordsPassThreshold,
          mufradatTimeLimit: formData.mufradatTimeLimit,
          // Content settings
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
          // QRC Pre-check settings
          qrcPreCheckEnabled: formData.qrcPreCheckEnabled,
          qrcPreCheckProvider: formData.qrcPreCheckProvider,
          qrcHafzLevel: formData.qrcHafzLevel,
          qrcTajweedLevel: formData.qrcTajweedLevel,
          qrcPassThreshold: formData.qrcPassThreshold,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update')
      }

      // Update group with new data (including new name if changed)
      if (data.name && group) {
        setGroup({ ...group, name: data.name })
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

  const getStageName = (stage: StageNumber | string) => {
    const names: Record<string, string> = {
      'STAGE_1_1': 'Этап 1.1',
      'STAGE_1_2': 'Этап 1.2',
      'STAGE_2_1': 'Этап 2.1',
      'STAGE_2_2': 'Этап 2.2',
      'STAGE_3': 'Этап 3',
    }
    return names[stage] || stage
  }

  const getLevelLabel = (level: GroupLevel) => GROUP_LEVELS.find(l => l.value === level)?.label || level

  const openProgressDialog = (student: GroupData['students'][0]) => {
    setEditingStudent(student)
    setProgressDialogOpen(true)
  }

  const openStatsDialog = (student: GroupData['students'][0], type: 'memorization' | 'revision' | 'mufradat') => {
    const name = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Студент'
    setStatsStudent({ id: student.id, name })
    setStatsDialogType(type)
    setStatsDialogOpen(true)
  }

  const handleProgressUpdate = async () => {
    // Refresh group data
    const res = await fetch(`/api/groups/${params.id}`)
    if (res.ok) {
      const data = await res.json()
      setGroup(data)
    }
  }

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
            Заучивание • {getLevelLabel(formData.level)} • {group.students.length} студентов
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
              <BookOpen className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-lg">
              Заучивание
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
              {/* Gender Selection */}
              <div className="space-y-2">
                <Label>Пол группы</Label>
                <div className="grid grid-cols-2 gap-2">
                  {GROUP_GENDERS.map((gender) => (
                    <button
                      key={gender.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, gender: gender.value as 'MALE' | 'FEMALE' })}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        formData.gender === gender.value
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground/30'
                      }`}
                    >
                      <span className="text-2xl block mb-1">{gender.icon}</span>
                      <span className="font-semibold text-sm">{gender.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Group Name Section with Preview */}
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                  <Label className="font-medium">Название группы</Label>
                </div>
                {(() => {
                  // Generate preview name based on current formData
                  const genderPrefix = formData.gender === 'MALE' ? 'М' : 'Ж'
                  const year = new Date().getFullYear().toString().slice(-2)
                  const levelNum = formData.level.replace('LEVEL_', '')
                  const previewBase = `${genderPrefix}-${year}-${levelNum}`
                  // Check if gender or level changed
                  const hasChanges = formData.gender !== group.gender || formData.level !== group.level

                  return hasChanges ? (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground line-through">{group.name}</p>
                      <p className="text-2xl font-bold text-primary">{previewBase}-<span className="text-muted-foreground">X</span></p>
                      <p className="text-xs text-amber-600">Номер будет присвоен автоматически при сохранении</p>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold">{group.name}</p>
                  )
                })()}
                <p className="text-xs text-muted-foreground">Формат: [Пол]-[Год]-[Уровень]-[Номер]</p>

                {/* Level Selection */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Уровень сложности</Label>
                  <div className="grid gap-2">
                    {GROUP_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, level: level.value as GroupLevel })}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          formData.level === level.value
                            ? `${LEVEL_COLORS[level.value]} border-current`
                            : 'border-muted hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`font-bold text-xl w-8 h-8 flex items-center justify-center rounded-full ${LEVEL_COLORS[level.value]}`}>
                            {level.linesPerBatch}
                          </span>
                          <div>
                            <p className="font-semibold text-sm">{level.label}</p>
                            <p className="text-xs text-muted-foreground">{level.description}</p>
                          </div>
                        </div>
                      </button>
                    ))}
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

              {savedSection === 'group' && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Настройки группы сохранены!</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : savedSection === 'group' ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Сохранено
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
              <CardContent className="space-y-6">

            {/* === MEMORIZATION (Заучивание) === */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800 space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-emerald-600" />
                <h4 className="font-semibold text-emerald-800 dark:text-emerald-300">Заучивание</h4>
              </div>

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
                <p className="text-xs text-muted-foreground">Сколько раз студент должен повторить строку для заучивания</p>
              </div>

              {/* Deadline Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
                <div className="space-y-0.5">
                  <Label htmlFor="deadlineEnabled" className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    Включить дедлайны
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {formData.deadlineEnabled
                      ? 'Студенты должны сдавать работы вовремя'
                      : 'Студенты могут сдавать в любое время (время фиксируется для статистики)'}
                  </p>
                </div>
                <Switch
                  id="deadlineEnabled"
                  checked={formData.deadlineEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, deadlineEnabled: checked })}
                />
              </div>

              {/* Hours per Stage */}
              <div className={`space-y-2 ${!formData.deadlineEnabled ? 'opacity-50' : ''}`}>
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Часов на этап {!formData.deadlineEnabled && '(только для статистики)'}
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Этап 1.1/1.2</Label>
                    <Input
                      type="number"
                      min={1}
                      max={720}
                      value={formData.stage1Hours}
                      onChange={(e) => setFormData({ ...formData, stage1Hours: parseInt(e.target.value) || 24 })}
                    />
                    <p className="text-xs text-muted-foreground">{formData.stage1Hours}ч = {(formData.stage1Hours / 24).toFixed(1)} дн.</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Этап 2.1/2.2</Label>
                    <Input
                      type="number"
                      min={1}
                      max={720}
                      value={formData.stage2Hours}
                      onChange={(e) => setFormData({ ...formData, stage2Hours: parseInt(e.target.value) || 48 })}
                    />
                    <p className="text-xs text-muted-foreground">{formData.stage2Hours}ч = {(formData.stage2Hours / 24).toFixed(1)} дн.</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Этап 3</Label>
                    <Input
                      type="number"
                      min={1}
                      max={720}
                      value={formData.stage3Hours}
                      onChange={(e) => setFormData({ ...formData, stage3Hours: parseInt(e.target.value) || 48 })}
                    />
                    <p className="text-xs text-muted-foreground">{formData.stage3Hours}ч = {(formData.stage3Hours / 24).toFixed(1)} дн.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* === REVISION (Повторение) === */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 space-y-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-blue-800 dark:text-blue-300">Повторение</h4>
              </div>
              <p className="text-xs text-muted-foreground">Ежедневное повторение выученных страниц. Задания обнуляются каждый день.</p>

              <div className="space-y-2">
                <Label htmlFor="revisionPagesPerDay">Минимум страниц в день</Label>
                <Input
                  id="revisionPagesPerDay"
                  type="number"
                  min={1}
                  max={20}
                  value={formData.revisionPagesPerDay}
                  onChange={(e) => setFormData({ ...formData, revisionPagesPerDay: parseInt(e.target.value) || 3 })}
                  disabled={formData.revisionAllPages}
                />
                <p className="text-xs text-muted-foreground">Минимум страниц для повторения (игнорируется если включено "Все страницы")</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="revisionAllPages">Все выученные страницы</Label>
                  <p className="text-xs text-muted-foreground">Студент должен повторить все страницы до его текущего прогресса</p>
                </div>
                <Switch
                  id="revisionAllPages"
                  checked={formData.revisionAllPages}
                  onCheckedChange={(checked) => setFormData({ ...formData, revisionAllPages: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="revisionButtonOnly">Только кнопка (без голоса)</Label>
                  <p className="text-xs text-muted-foreground">Студент просто нажимает "Повторил" без отправки голоса. Устаз получает уведомление.</p>
                </div>
                <Switch
                  id="revisionButtonOnly"
                  checked={formData.revisionButtonOnly}
                  onCheckedChange={(checked) => setFormData({ ...formData, revisionButtonOnly: checked })}
                />
              </div>
            </div>

            {/* === TRANSLATION (Переводы/Муфрадат) === */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800 space-y-4">
              <div className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-purple-600" />
                <h4 className="font-semibold text-purple-800 dark:text-purple-300">Переводы (Муфрадат)</h4>
              </div>
              <p className="text-xs text-muted-foreground">Ежедневное изучение новых слов через игру. Задания обнуляются каждый день.</p>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wordsPerDay">Слов в день</Label>
                  <Input
                    id="wordsPerDay"
                    type="number"
                    min={1}
                    max={50}
                    value={formData.wordsPerDay}
                    onChange={(e) => setFormData({ ...formData, wordsPerDay: parseInt(e.target.value) || 10 })}
                  />
                  <p className="text-xs text-muted-foreground">Сколько слов студент должен выучить</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wordsPassThreshold">Порог сдачи</Label>
                  <Input
                    id="wordsPassThreshold"
                    type="number"
                    min={1}
                    max={formData.wordsPerDay}
                    value={formData.wordsPassThreshold}
                    onChange={(e) => setFormData({ ...formData, wordsPassThreshold: parseInt(e.target.value) || 8 })}
                  />
                  <p className="text-xs text-muted-foreground">Минимум правильных для сдачи</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mufradatTimeLimit" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Время (сек)
                  </Label>
                  <Input
                    id="mufradatTimeLimit"
                    type="number"
                    min={30}
                    max={600}
                    value={formData.mufradatTimeLimit}
                    onChange={(e) => setFormData({ ...formData, mufradatTimeLimit: parseInt(e.target.value) || 180 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {Math.floor(formData.mufradatTimeLimit / 60)} мин. {formData.mufradatTimeLimit % 60} сек.
                  </p>
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
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Настройки мусхафа
                </CardTitle>
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
              {/* Mushaf Info */}
              <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Cloud className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{MUSHAF_TYPE_LABEL}</p>
                    <p className="text-xs text-muted-foreground">Контент загружается через API</p>
                  </div>
                </div>
              </div>

              {/* Medina API Settings */}
              {true && (
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
                      return (
                        <div
                          key={provider.value}
                          onClick={() => setFormData({ ...formData, aiProvider: provider.value as AIProvider })}
                          className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-amber-500 bg-amber-100/50 dark:bg-amber-900/30'
                              : 'border-transparent bg-background hover:border-muted-foreground/50'
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
                        {VERIFICATION_MODES.find(m => m.value === formData.verificationMode)?.details}
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

                        {/* Mode-specific info box */}
                        {formData.verificationMode === 'SEMI_AUTO' && (
                          <div className="p-3 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg text-xs">
                            <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">Режим ПОЛУАВТО:</p>
                            <ul className="space-y-1 text-amber-700 dark:text-amber-300">
                              <li>✅ Оценка ≥ {formData.aiAcceptThreshold}% → автопринятие</li>
                              <li>📋 Оценка &lt; {formData.aiAcceptThreshold}% → устазу на проверку</li>
                            </ul>
                          </div>
                        )}
                        {formData.verificationMode === 'FULL_AUTO' && (
                          <div className="p-3 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg text-xs">
                            <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">Режим АВТОМАТ:</p>
                            <ul className="space-y-1 text-amber-700 dark:text-amber-300">
                              <li>✅ Оценка ≥ {formData.aiAcceptThreshold}% → автопринятие</li>
                              <li>📋 Оценка {formData.aiRejectThreshold}-{formData.aiAcceptThreshold}% → устазу</li>
                              <li>❌ Оценка &lt; {formData.aiRejectThreshold}% → автоотклонение</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* QRC Pre-check Settings (for MEMORIZATION only) */}
              {formData.lessonType === 'MEMORIZATION' && (
                <div className="space-y-4 p-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium">AI Предпроверка</span>
                    </div>
                    <Switch
                      checked={formData.qrcPreCheckEnabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, qrcPreCheckEnabled: checked })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Перед сдачей работ на этапах 1.1 и 2.1, студент должен пройти AI проверку чтения через WebApp
                  </p>

                  {formData.qrcPreCheckEnabled && (
                    <div className="space-y-4 pt-3 border-t border-purple-200 dark:border-purple-800">
                      {/* AI Provider Selection */}
                      <div className="space-y-2">
                        <Label>AI Модель</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {QRC_PRECHECK_PROVIDERS.map((provider) => {
                            const Icon = provider.icon
                            const isSelected = formData.qrcPreCheckProvider === provider.value
                            return (
                              <div
                                key={provider.value}
                                onClick={() => setFormData({ ...formData, qrcPreCheckProvider: provider.value as AIProvider })}
                                className={`p-2 rounded-lg border-2 text-center cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-purple-500 bg-purple-100/50 dark:bg-purple-900/30'
                                    : 'border-transparent bg-background hover:border-muted-foreground/50'
                                }`}
                              >
                                <Icon className={`h-4 w-4 mx-auto mb-1 ${isSelected ? 'text-purple-600' : 'text-muted-foreground'}`} />
                                <p className="text-xs font-medium">{provider.label}</p>
                              </div>
                            )
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {QRC_PRECHECK_PROVIDERS.find(p => p.value === formData.qrcPreCheckProvider)?.description}
                        </p>
                      </div>

                      {/* Pass Threshold */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Порог прохождения</Label>
                          <Badge variant="outline" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            {formData.qrcPassThreshold}%
                          </Badge>
                        </div>
                        <Slider
                          value={[formData.qrcPassThreshold]}
                          onValueChange={([value]) => setFormData({ ...formData, qrcPassThreshold: value })}
                          min={50}
                          max={95}
                          step={5}
                          className="[&_[role=slider]]:bg-purple-500"
                        />
                        <p className="text-xs text-muted-foreground">
                          Студент должен набрать минимум {formData.qrcPassThreshold}% для прохождения
                        </p>
                      </div>

                      {/* Hafz Level - For both Qurani.ai and Whisper */}
                      <div className="space-y-2">
                        <Label>Уровень строгости проверки</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {[1, 2, 3].map((level) => (
                            <div
                              key={level}
                              onClick={() => setFormData({ ...formData, qrcHafzLevel: level })}
                              className={`p-2 rounded-lg border-2 text-center cursor-pointer transition-all ${
                                formData.qrcHafzLevel === level
                                  ? 'border-purple-500 bg-purple-100/50 dark:bg-purple-900/30'
                                  : 'border-transparent bg-background hover:border-muted-foreground/50'
                              }`}
                            >
                              <span className="font-semibold">{level}</span>
                              <p className="text-xs text-muted-foreground">
                                {level === 1 ? 'Лёгкий' : level === 2 ? 'Средний' : 'Строгий'}
                              </p>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formData.qrcPreCheckProvider === 'WHISPER'
                            ? 'Уровень 1: допускает больше вариаций в произношении. Уровень 3: требует точного соответствия.'
                            : 'Насколько строго проверять точность заучивания'}
                        </p>
                      </div>

                      {/* Tajweed Level - Only for Qurani.ai QRC */}
                      {formData.qrcPreCheckProvider === 'QURANI_AI' && (
                        <div className="space-y-2">
                          <Label>Уровень проверки таджвида</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {[1, 2, 3].map((level) => (
                              <div
                                key={level}
                                onClick={() => setFormData({ ...formData, qrcTajweedLevel: level })}
                                className={`p-2 rounded-lg border-2 text-center cursor-pointer transition-all ${
                                  formData.qrcTajweedLevel === level
                                    ? 'border-purple-500 bg-purple-100/50 dark:bg-purple-900/30'
                                    : 'border-transparent bg-background hover:border-muted-foreground/50'
                                }`}
                              >
                                <span className="font-semibold">{level}</span>
                                <p className="text-xs text-muted-foreground">
                                  {level === 1 ? 'Лёгкий' : level === 2 ? 'Средний' : 'Строгий'}
                                </p>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Насколько строго проверять правила таджвида
                          </p>
                        </div>
                      )}

                      {/* Info for Whisper */}
                      {formData.qrcPreCheckProvider === 'WHISPER' && (
                        <div className="p-2 bg-emerald-100/50 dark:bg-emerald-900/30 rounded text-xs text-emerald-800 dark:text-emerald-200">
                          OpenAI Whisper распознает речь и сравнивает с ожидаемым текстом.
                          Уровень влияет на допустимые отклонения в порядке слов.
                        </div>
                      )}

                      <div className="p-2 bg-purple-100/50 dark:bg-purple-900/30 rounded text-xs text-purple-800 dark:text-purple-200">
                        AI предпроверка работает только на этапах изучения (1.1 и 2.1). На этапах соединения проверка не требуется.
                      </div>
                    </div>
                  )}
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
                  <TableHead>Заучивание</TableHead>
                  <TableHead>Повторение</TableHead>
                  <TableHead>Переводы</TableHead>
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
                        <div>
                          <Link
                            href={`/admin/users/${student.id}`}
                            className="font-medium hover:underline"
                          >
                            {student.firstName} {student.lastName}
                          </Link>
                          <p className="text-xs text-muted-foreground font-mono">{student.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => openStatsDialog(student, 'memorization')}
                          className="w-full text-left hover:bg-muted/50 rounded p-1 -m-1 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="font-medium">стр. {student.currentPage}, строка {student.currentLine}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {getStageName(student.currentStage)}
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={taskCompletion} className="h-1.5 w-16" />
                              <span className="text-xs text-muted-foreground">
                                {activeTask?.passedCount || 0}/{activeTask?.requiredCount || formData.repetitionCount}
                              </span>
                            </div>
                          </div>
                        </button>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => openStatsDialog(student, 'revision')}
                          className="w-full text-left hover:bg-muted/50 rounded p-1 -m-1 transition-colors"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
                            <span className="font-medium">{student.revisionsPassed || 0}</span>
                            {(student.revisionsPending || 0) > 0 && (
                              <Badge variant="secondary" className="text-xs">+{student.revisionsPending} на проверке</Badge>
                            )}
                          </div>
                        </button>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => openStatsDialog(student, 'mufradat')}
                          className="w-full text-left hover:bg-muted/50 rounded p-1 -m-1 transition-colors"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <Languages className="h-3.5 w-3.5 text-purple-500" />
                            {student.mufradatToday ? (
                              <span className="font-medium">
                                {student.mufradatToday.passed ? '✅' : '❌'} {student.mufradatToday.wordsCorrect}/{student.mufradatToday.wordsTotal}
                              </span>
                            ) : student.mufradatWeekTotal && student.mufradatWeekTotal > 0 ? (
                              <span className="text-muted-foreground">
                                {student.mufradatWeekPassed}/{student.mufradatWeekTotal} дн.
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </button>
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
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openProgressDialog(student)}
                            title="Редактировать прогресс"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveStudent(student.id)}
                            title="Удалить из группы"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Progress Edit Dialog */}
      <StudentProgressEditDialog
        open={progressDialogOpen}
        onOpenChange={setProgressDialogOpen}
        student={editingStudent}
        groupId={group.id}
        defaultRepetitionCount={formData.repetitionCount}
        onSuccess={handleProgressUpdate}
      />

      {/* Stats Detail Dialog */}
      <StudentStatsDetailDialog
        open={statsDialogOpen}
        onOpenChange={setStatsDialogOpen}
        studentId={statsStudent?.id || null}
        studentName={statsStudent?.name || ''}
        type={statsDialogType}
        groupRepetitionCount={formData.repetitionCount}
      />
    </div>
  )
}
