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
import { Loader2, BookOpen, RefreshCw, Languages, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface StudentStatsDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string | null
  studentName: string
  type: 'memorization' | 'revision' | 'mufradat'
  groupRepetitionCount?: number
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

export function StudentStatsDetailDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  type,
  groupRepetitionCount = 80,
}: StudentStatsDetailDialogProps) {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<TaskData[]>([])
  const [revisions, setRevisions] = useState<RevisionData[]>([])
  const [mufradatSubs, setMufradatSubs] = useState<MufradatData[]>([])

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
              <>
                {tasks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Нет заданий</p>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-3 border rounded-lg space-y-2"
                      >
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
                )}
              </>
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
                {mufradatSubs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Нет данных о переводах</p>
                ) : (
                  <div className="space-y-2">
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
