'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Users,
  BookOpen,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  CalendarDays,
  UserCheck,
  UserX,
} from 'lucide-react'

interface MemorizationTask {
  taskId: string
  page: number
  stage: string
  passedCount: number
  requiredCount: number
  failedCount: number
  taskStatus: string
  submissionsToday: number
  passedToday: number
  failedToday: number
  pendingToday: number
}

interface RevisionPage {
  page: number
  status: string
  type: 'voice' | 'button'
}

interface TranslationSession {
  page: number
  wordsCorrect: number
  wordsTotal: number
  bestScore: number
  attempts: number
}

interface StudentReport {
  id: string
  name: string
  telegramUsername: string | null
  currentPage: number
  currentLine: number
  currentStage: string
  hasActivity: boolean
  memorization: MemorizationTask[]
  revision: RevisionPage[]
  translation: TranslationSession[]
}

interface ReportData {
  group: { id: string; name: string; lessonType: string }
  date: string
  summary: {
    totalStudents: number
    activeStudents: number
    inactiveStudents: number
    totalMemorizationSubmissions: number
    totalRevisionPages: number
    totalTranslationSessions: number
  }
  students: StudentReport[]
}

const stageLabels: Record<string, string> = {
  STAGE_1_1: '1.1 Изучение',
  STAGE_1_2: '1.2 Соединение',
  STAGE_2_1: '2.1 Изучение',
  STAGE_2_2: '2.2 Соединение',
  STAGE_3: '3 Полная стр.',
}

const stageShort: Record<string, string> = {
  STAGE_1_1: '1.1',
  STAGE_1_2: '1.2',
  STAGE_2_1: '2.1',
  STAGE_2_2: '2.2',
  STAGE_3: '3',
}

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
}

function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

export default function GroupReportPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string

  const [date, setDate] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/ustaz/groups/${groupId}/report?date=${formatDateLocal(date)}`
      )
      if (res.ok) {
        const data = await res.json()
        setReport(data)
      }
    } catch (err) {
      console.error('Failed to fetch report:', err)
    } finally {
      setLoading(false)
    }
  }, [groupId, date])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const prevDay = () => {
    setDate((d) => {
      const nd = new Date(d)
      nd.setDate(nd.getDate() - 1)
      return nd
    })
  }

  const nextDay = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (date < tomorrow) {
      setDate((d) => {
        const nd = new Date(d)
        nd.setDate(nd.getDate() + 1)
        return nd
      })
    }
  }

  const goToday = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setDate(d)
  }

  const activeStudents = report?.students.filter((s) => s.hasActivity) || []
  const inactiveStudents = report?.students.filter((s) => !s.hasActivity) || []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/ustaz/groups/${groupId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">
            {report?.group.name || 'Отчёт'}
          </h1>
          <p className="text-sm text-muted-foreground">Ежедневный отчёт</p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchReport}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Date navigation */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="icon" onClick={prevDay}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <button
              onClick={goToday}
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="capitalize">{formatDateDisplay(date)}</span>
              {isToday(date) && (
                <Badge variant="secondary" className="text-xs">
                  Сегодня
                </Badge>
              )}
            </button>
            <Button variant="ghost" size="icon" onClick={nextDay}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : !report ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Не удалось загрузить отчёт
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xl font-bold">{report.summary.activeStudents}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">Активных</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-400" />
                <div>
                  <p className="text-xl font-bold">{report.summary.inactiveStudents}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">Неактивных</p>
                </div>
              </div>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-xl font-bold">{report.summary.totalStudents}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">Всего</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Activity summary badges */}
          <div className="flex flex-wrap gap-2">
            {report.summary.totalMemorizationSubmissions > 0 && (
              <Badge variant="outline" className="gap-1">
                <BookOpen className="h-3 w-3" />
                Заучивание: {report.summary.totalMemorizationSubmissions} сдач
              </Badge>
            )}
            {report.summary.totalRevisionPages > 0 && (
              <Badge variant="outline" className="gap-1">
                <RefreshCw className="h-3 w-3" />
                Повторение: {report.summary.totalRevisionPages} стр.
              </Badge>
            )}
            {report.summary.totalTranslationSessions > 0 && (
              <Badge variant="outline" className="gap-1">
                <BookOpen className="h-3 w-3" />
                Перевод: {report.summary.totalTranslationSessions} сессий
              </Badge>
            )}
          </div>

          {/* Active students */}
          {activeStudents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Отправили работы ({activeStudents.length})
              </h3>
              <div className="space-y-2">
                {activeStudents.map((student) => (
                  <StudentCard key={student.id} student={student} />
                ))}
              </div>
            </div>
          )}

          {/* Inactive students */}
          {inactiveStudents.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowInactive(!showInactive)}
                className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <XCircle className="h-4 w-4 text-red-400" />
                Не отправляли ({inactiveStudents.length})
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${showInactive ? 'rotate-90' : ''}`}
                />
              </button>
              {showInactive && (
                <div className="space-y-1">
                  {inactiveStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-sm"
                    >
                      <span className="text-muted-foreground">{student.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Стр. {student.currentPage}, Эт. {stageShort[student.currentStage] || student.currentStage}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {activeStudents.length === 0 && inactiveStudents.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Нет данных за эту дату
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function StudentCard({ student }: { student: StudentReport }) {
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        {/* Student name and current position */}
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{student.name}</span>
          <Badge variant="secondary" className="text-xs">
            Стр. {student.currentPage}, Эт. {stageShort[student.currentStage] || student.currentStage}
          </Badge>
        </div>

        {/* Memorization submissions */}
        {student.memorization.length > 0 && (
          <div className="space-y-1">
            {student.memorization.map((task) => (
              <div
                key={task.taskId}
                className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1.5"
              >
                <BookOpen className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="font-medium text-blue-700 dark:text-blue-300">Заучивание</span>
                <span className="text-muted-foreground">
                  Стр. {task.page}, {stageLabels[task.stage] || task.stage}
                </span>
                <span className="ml-auto flex items-center gap-1 shrink-0">
                  {task.passedToday > 0 && (
                    <span className="text-green-600 flex items-center gap-0.5">
                      <CheckCircle className="h-3 w-3" />
                      {task.passedToday}
                    </span>
                  )}
                  {task.pendingToday > 0 && (
                    <span className="text-yellow-600 flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {task.pendingToday}
                    </span>
                  )}
                  {task.failedToday > 0 && (
                    <span className="text-red-600 flex items-center gap-0.5">
                      <XCircle className="h-3 w-3" />
                      {task.failedToday}
                    </span>
                  )}
                  <span className="text-muted-foreground ml-1">
                    ({task.passedCount}/{task.requiredCount})
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Revision */}
        {student.revision.length > 0 && (
          <div className="flex items-center gap-2 text-xs bg-purple-50 dark:bg-purple-950/30 rounded px-2 py-1.5 flex-wrap">
            <RefreshCw className="h-3.5 w-3.5 text-purple-500 shrink-0" />
            <span className="font-medium text-purple-700 dark:text-purple-300">Повторение</span>
            <div className="flex flex-wrap gap-1">
              {student.revision.map((rev, i) => (
                <Badge
                  key={i}
                  variant={rev.status === 'PASSED' ? 'default' : 'outline'}
                  className={`text-[10px] px-1.5 py-0 ${
                    rev.status === 'PASSED'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : rev.status === 'FAILED'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : ''
                  }`}
                >
                  {rev.page}
                </Badge>
              ))}
            </div>
            <span className="text-muted-foreground ml-auto shrink-0">
              {student.revision.length} стр.
            </span>
          </div>
        )}

        {/* Translation */}
        {student.translation.length > 0 && (
          <div className="space-y-1">
            {student.translation.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1.5"
              >
                <span className="text-base shrink-0">📝</span>
                <span className="font-medium text-amber-700 dark:text-amber-300">Перевод</span>
                <span className="text-muted-foreground">Стр. {t.page}</span>
                <span className="ml-auto shrink-0">
                  {t.wordsCorrect}/{t.wordsTotal} слов
                  {t.bestScore > 0 && (
                    <span className="ml-1 text-green-600">{t.bestScore}%</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
