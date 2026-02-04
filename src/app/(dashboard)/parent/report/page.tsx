'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  CalendarDays,
} from 'lucide-react'

interface MemorizationTask {
  page: number
  stage: string
  groupName: string
  passedCount: number
  requiredCount: number
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

interface ChildReport {
  id: string
  name: string
  currentPage: number
  currentLine: number
  currentStage: string
  groups: { name: string; lessonType: string; ustaz: string | null }[]
  hasActivity: boolean
  memorization: MemorizationTask[]
  revision: RevisionPage[]
  translation: TranslationSession[]
}

interface ReportData {
  date: string
  children: ChildReport[]
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

export default function ParentReportPage() {
  const [date, setDate] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/parent/report?date=${formatDateLocal(date)}`
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
  }, [date])

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Ежедневный отчёт</h1>
          <p className="text-xs text-muted-foreground">Активность детей за день</p>
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
      ) : report.children.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            У вас не добавлено детей. Обратитесь к администратору.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {report.children.map((child) => (
            <ChildCard key={child.id} child={child} />
          ))}
        </div>
      )}
    </div>
  )
}

function ChildCard({ child }: { child: ChildReport }) {
  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        {/* Child name and position */}
        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold text-sm">{child.name}</span>
            {child.groups.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {child.groups.map((g) => g.name).join(', ')}
              </p>
            )}
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            Стр. {child.currentPage}, Эт. {stageShort[child.currentStage] || child.currentStage}
          </Badge>
        </div>

        {!child.hasActivity ? (
          <div className="text-center py-3 bg-muted/40 rounded-lg">
            <XCircle className="h-5 w-5 text-red-400 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Нет активности за этот день</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Memorization */}
            {child.memorization.map((task, i) => (
              <div
                key={i}
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

            {/* Revision */}
            {child.revision.length > 0 && (
              <div className="flex items-center gap-2 text-xs bg-purple-50 dark:bg-purple-950/30 rounded px-2 py-1.5 flex-wrap">
                <RefreshCw className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                <span className="font-medium text-purple-700 dark:text-purple-300">Повторение</span>
                <div className="flex flex-wrap gap-1">
                  {child.revision.map((rev, i) => (
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
                  {child.revision.length} стр.
                </span>
              </div>
            )}

            {/* Translation */}
            {child.translation.map((t, i) => (
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
                  {t.attempts > 1 && (
                    <span className="ml-1 text-muted-foreground">({t.attempts} поп.)</span>
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
