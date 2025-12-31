'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, BookOpen, RefreshCw, Languages, CheckCircle2, XCircle, Clock, Timer, TrendingUp, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface StudentStatsDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string | null
  studentName: string
  type: 'memorization' | 'revision' | 'mufradat'
  groupRepetitionCount?: number
  groupId?: string
}

interface TaskData {
  id: string
  status: string
  currentCount: number
  passedCount: number
  requiredCount: number
  startedAt: string
  deadline: string
  completedAt: string | null
  page: { pageNumber: number }
  startLine: number
  endLine: number
  stage: string
}

interface MemorizationStats {
  summary: {
    totalTasksCompleted: number
    learningTasksCompleted: number
    connectionTasksCompleted: number
    fullPageTasksCompleted: number
    averageTimeByStage: Record<string, number>
  }
  activeTasks: Array<{
    id: string
    pageNumber: number
    startLine: number
    endLine: number
    stage: string
    passedCount: number
    requiredCount: number
    pendingCount: number
  }>
  recentTasks: Array<{
    id: string
    pageNumber: number
    startLine: number
    endLine: number
    stage: string
    passedCount: number
    requiredCount: number
    completedAt: string
    durationMinutes: number
  }>
  pageRevisionStats: Array<{
    pageNumber: number
    todayCount: number
    weekCount: number
    monthCount: number
    yearCount: number
    totalCount: number
    lastRevisedAt: string | null
    lastResult: string | null
  }>
}

interface RevisionData {
  id: string
  pageNumber: number
  status: string
  createdAt: string
  reviewedAt: string | null
}

interface MufradatData {
  id: string
  date: string
  wordsTotal: number
  wordsCorrect: number
  wordsMistakes: number
  passed: boolean
}

interface TranslationDayData {
  date: string
  pagesStudied: number
  pagesLearned: number
  totalAttempts: number
  avgScore: number
  pages: {
    pageNumber: number
    bestScore: number
    attempts: number
    wordsCorrect: number
    wordsWrong: number
  }[]
}

export function StudentStatsDetailDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  type,
  groupRepetitionCount = 80,
  groupId,
}: StudentStatsDetailDialogProps) {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<TaskData[]>([])
  const [memStats, setMemStats] = useState<MemorizationStats | null>(null)
  const [revisions, setRevisions] = useState<RevisionData[]>([])
  const [mufradatSubs, setMufradatSubs] = useState<MufradatData[]>([])
  const [translationDays, setTranslationDays] = useState<TranslationDayData[]>([])

  useEffect(() => {
    if (open && studentId) {
      fetchData()
    }
  }, [open, studentId, type])

  const fetchData = async () => {
    if (!studentId) return
    setLoading(true)

    try {
      if (type === 'memorization') {
        // Fetch extended memorization stats
        const statsUrl = groupId
          ? `/api/student/stats/memorization?studentId=${studentId}&groupId=${groupId}`
          : `/api/student/stats/memorization?studentId=${studentId}`
        const statsRes = await fetch(statsUrl)
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setMemStats(statsData)
        }

        // Also fetch tasks for backward compatibility
        const res = await fetch(`/api/tasks?studentId=${studentId}&limit=10`)
        if (res.ok) {
          const data = await res.json()
          setTasks(data.items || [])
        }
      } else if (type === 'revision') {
        const res = await fetch(`/api/student/revisions?studentId=${studentId}&limit=20`)
        if (res.ok) {
          const data = await res.json()
          setRevisions(data.items || [])
        }
      } else if (type === 'mufradat') {
        const res = await fetch(`/api/student/mufradat/stats?studentId=${studentId}&days=30`)
        if (res.ok) {
          const data = await res.json()
          setMufradatSubs(data.daily || [])
          setTranslationDays(data.translation?.daily || [])
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTitle = () => {
    switch (type) {
      case 'memorization': return 'Заучивание'
      case 'revision': return 'Повторение'
      case 'mufradat': return 'Переводы (Муфрадат)'
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'memorization': return <BookOpen className="h-5 w-5 text-emerald-500" />
      case 'revision': return <RefreshCw className="h-5 w-5 text-blue-500" />
      case 'mufradat': return <Languages className="h-5 w-5 text-purple-500" />
    }
  }

  const getStageName = (stage: string) => {
    const stages: Record<string, string> = {
      'STAGE_1_1': 'Этап 1.1',
      'STAGE_1_2': 'Этап 1.2',
      'STAGE_2_1': 'Этап 2.1',
      'STAGE_2_2': 'Этап 2.2',
      'STAGE_3': 'Этап 3',
    }
    return stages[stage] || stage
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">В процессе</Badge>
      case 'PASSED':
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Сдано</Badge>
      case 'FAILED':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Не сдано</Badge>
      case 'PENDING':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">На проверке</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            {studentName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {type === 'memorization' && (
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="summary">Сводка</TabsTrigger>
                  <TabsTrigger value="tasks">Задания</TabsTrigger>
                  <TabsTrigger value="revisions">Повторения</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-4 mt-4">
                  {memStats ? (
                    <>
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                          <div className="text-2xl font-bold text-emerald-600">{memStats.summary.totalTasksCompleted}</div>
                          <div className="text-xs text-muted-foreground">Всего заданий</div>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{memStats.summary.learningTasksCompleted}</div>
                          <div className="text-xs text-muted-foreground">Заучивание (1.1, 2.1)</div>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">{memStats.summary.connectionTasksCompleted}</div>
                          <div className="text-xs text-muted-foreground">Соединение (1.2, 2.2)</div>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">{memStats.summary.fullPageTasksCompleted}</div>
                          <div className="text-xs text-muted-foreground">Повторение (3)</div>
                        </div>
                      </div>

                      {/* Average Time by Stage */}
                      {Object.keys(memStats.summary.averageTimeByStage).length > 0 && (
                        <div className="p-3 border rounded-lg space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Timer className="h-4 w-4" />
                            Среднее время на строку
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(memStats.summary.averageTimeByStage).map(([stage, minutes]) => (
                              <div key={stage} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                                <span className="text-muted-foreground">{getStageName(stage)}</span>
                                <span className="font-medium">{minutes} мин</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Active Tasks */}
                      {memStats.activeTasks.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-blue-500" />
                            Активные задания
                          </h4>
                          {memStats.activeTasks.map(task => (
                            <div key={task.id} className="p-2 border rounded-lg flex justify-between items-center">
                              <div>
                                <span className="font-medium">Стр. {task.pageNumber}</span>
                                <span className="text-muted-foreground text-sm ml-2">
                                  строки {task.startLine}-{task.endLine}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{task.passedCount}/{task.requiredCount}</div>
                                {task.pendingCount > 0 && (
                                  <span className="text-xs text-yellow-600">⏳ {task.pendingCount}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Нет данных</p>
                  )}
                </TabsContent>

                <TabsContent value="tasks" className="mt-4">
                  {memStats?.recentTasks.length ? (
                    <div className="space-y-3">
                      {memStats.recentTasks.map((task) => (
                        <div key={task.id} className="p-3 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">
                              Стр. {task.pageNumber}, строки {task.startLine}-{task.endLine}
                            </div>
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">✓</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {getStageName(task.stage)}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span>Сдано: <strong>{task.passedCount}/{task.requiredCount}</strong></span>
                            <span className="text-muted-foreground">
                              <Timer className="h-3 w-3 inline mr-1" />
                              {task.durationMinutes} мин
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(task.completedAt), 'd MMM yyyy HH:mm', { locale: ru })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : tasks.length > 0 ? (
                    <div className="space-y-3">
                      {tasks.map((task) => (
                        <div key={task.id} className="p-3 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">
                              Стр. {task.page.pageNumber}, строки {task.startLine}-{task.endLine}
                            </div>
                            {getStatusBadge(task.status)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {getStageName(task.stage)}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span>Сдано: <strong>{task.passedCount}/{task.requiredCount}</strong></span>
                            <span>Отправлено: {task.currentCount}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(task.startedAt), 'd MMM', { locale: ru })}
                            {' → '}
                            {format(new Date(task.deadline), 'd MMM HH:mm', { locale: ru })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Нет заданий</p>
                  )}
                </TabsContent>

                <TabsContent value="revisions" className="mt-4">
                  {memStats?.pageRevisionStats.length ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-5 gap-2 text-xs text-muted-foreground font-medium border-b pb-2">
                        <div>Стр.</div>
                        <div>День</div>
                        <div>Неделя</div>
                        <div>Месяц</div>
                        <div>Всего</div>
                      </div>
                      {memStats.pageRevisionStats.slice(0, 30).map((page) => (
                        <div key={page.pageNumber} className="grid grid-cols-5 gap-2 text-sm items-center">
                          <div className="font-medium">{page.pageNumber}</div>
                          <div>{page.todayCount}</div>
                          <div>{page.weekCount}</div>
                          <div>{page.monthCount}</div>
                          <div>{page.totalCount}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Нет данных о повторениях</p>
                  )}
                </TabsContent>
              </Tabs>
            )}

            {type === 'revision' && (
              <>
                {revisions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Нет повторений</p>
                ) : (
                  <div className="space-y-2">
                    {revisions.map((rev) => (
                      <div
                        key={rev.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {rev.status === 'PASSED' ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : rev.status === 'FAILED' ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <Clock className="h-5 w-5 text-yellow-500" />
                          )}
                          <span className="font-medium">Страница {rev.pageNumber}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(rev.createdAt), 'd MMM yyyy', { locale: ru })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {type === 'mufradat' && (
              <>
                {translationDays.length === 0 && mufradatSubs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Нет данных о переводах</p>
                ) : (
                  <div className="space-y-3">
                    {/* New translation page progress */}
                    {translationDays.length > 0 && (
                      <>
                        <h4 className="font-medium text-sm text-purple-600">Прогресс по страницам</h4>
                        {translationDays.map((day, idx) => (
                          <div key={idx} className="p-3 border rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">
                                {format(new Date(day.date), 'd MMM yyyy', { locale: ru })}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {day.pagesStudied} стр., {day.totalAttempts} попыток
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {day.pages.map((page) => (
                                <div
                                  key={page.pageNumber}
                                  className={`px-2 py-1 rounded text-xs ${
                                    page.bestScore >= 80
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : page.bestScore >= 50
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  стр. {page.pageNumber}: {page.bestScore}%
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Legacy mufradat data */}
                    {mufradatSubs.length > 0 && translationDays.length > 0 && (
                      <h4 className="font-medium text-sm text-muted-foreground mt-4">Старые данные</h4>
                    )}
                    {mufradatSubs.map((sub, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {sub.passed ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <div>
                            <span className="font-medium">
                              {sub.wordsCorrect}/{sub.wordsTotal} слов
                            </span>
                            {sub.wordsMistakes > 0 && (
                              <span className="text-sm text-red-500 ml-2">
                                ({sub.wordsMistakes} ошибок)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(sub.date), 'd MMM yyyy', { locale: ru })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
