'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  User,
  BookOpen,
  Users,
  Mic,
  Video,
  Bot,
  RefreshCw,
} from 'lucide-react'
import { SubmissionStatus } from '@prisma/client'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Submission {
  id: string
  status: SubmissionStatus
  fileType: string
  fileId: string
  telegramFileId: string
  duration?: number
  createdAt: string
  reviewedAt: string | null
  feedback: string | null
  // AI verification
  aiProvider?: string | null
  aiScore?: number | null
  aiTranscript?: string | null
  aiProcessedAt?: string | null
  student: {
    id: string
    firstName: string | null
    lastName: string | null
    phone: string
    studentGroup?: {
      id: string
      name: string
    } | null
  }
  task: {
    id: string
    stage: string
    startLine: number
    endLine: number
    passedCount: number
    requiredCount: number
    page: {
      pageNumber: number
    }
  }
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [tab, setTab] = useState('pending')
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchSubmissions()
  }, [tab])

  async function fetchSubmissions() {
    setLoading(true)
    try {
      const status = tab === 'pending' ? 'PENDING' : tab === 'passed' ? 'PASSED' : 'FAILED'
      const res = await fetch(`/api/submissions?status=${status}&limit=50`)
      const data = await res.json()
      setSubmissions(data.items || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Failed to fetch submissions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (id: string, status: 'PASSED' | 'FAILED') => {
    setReviewing(id)
    try {
      const res = await fetch(`/api/submissions/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (res.ok) {
        setSubmissions(prev => prev.filter(s => s.id !== id))
        setTotal(prev => prev - 1)
      }
    } catch (err) {
      console.error('Failed to review submission:', err)
    } finally {
      setReviewing(null)
    }
  }

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'STAGE_1_1': return 'Этап 1.1'
      case 'STAGE_1_2': return 'Этап 1.2'
      case 'STAGE_2_1': return 'Этап 2.1'
      case 'STAGE_2_2': return 'Этап 2.2'
      case 'STAGE_3': return 'Этап 3'
      default: return stage
    }
  }

  const getStageDescription = (stage: string) => {
    switch (stage) {
      case 'STAGE_1_1': return 'Изучение строк 1-7'
      case 'STAGE_1_2': return 'Повторение строк 1-7'
      case 'STAGE_2_1': return 'Изучение строк 8-15'
      case 'STAGE_2_2': return 'Повторение строк 8-15'
      case 'STAGE_3': return 'Вся страница'
      default: return ''
    }
  }

  const getStatusBadge = (status: SubmissionStatus) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Ожидает</Badge>
      case 'PASSED':
        return <Badge className="bg-green-500 gap-1"><CheckCircle className="h-3 w-3" />Принято</Badge>
      case 'FAILED':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Отклонено</Badge>
    }
  }

  const getAIScoreBadge = (score: number | null | undefined) => {
    if (score === null || score === undefined) return null
    const variant = score >= 85 ? 'default' : score >= 50 ? 'secondary' : 'destructive'
    const className = score >= 85 ? 'bg-green-500' : score >= 50 ? '' : ''
    return (
      <Badge variant={variant} className={`gap-1 ${className}`}>
        <Bot className="h-3 w-3" />
        AI: {Math.round(score)}%
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Проверка работ</h1>
          <p className="text-muted-foreground">Просмотр и оценка сдач студентов</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSubmissions} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Ожидают
          </TabsTrigger>
          <TabsTrigger value="passed" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Принятые
          </TabsTrigger>
          <TabsTrigger value="failed" className="gap-2">
            <XCircle className="h-4 w-4" />
            Отклоненные
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : submissions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  {tab === 'pending' ? (
                    <Clock className="h-6 w-6 text-muted-foreground" />
                  ) : tab === 'passed' ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-destructive" />
                  )}
                </div>
                <p className="text-muted-foreground">
                  {tab === 'pending'
                    ? 'Нет работ, ожидающих проверки'
                    : tab === 'passed'
                    ? 'Нет принятых работ'
                    : 'Нет отклоненных работ'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Всего: {total} {total === 1 ? 'работа' : total < 5 ? 'работы' : 'работ'}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {submissions.map((submission) => (
                  <Card key={submission.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-base truncate">
                              {submission.student.firstName || 'Без имени'} {submission.student.lastName || ''}
                            </CardTitle>
                            <CardDescription className="text-xs truncate">
                              {submission.student.studentGroup?.name || submission.student.phone}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 items-end shrink-0">
                          {getStatusBadge(submission.status)}
                          {getAIScoreBadge(submission.aiScore)}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Task info */}
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <BookOpen className="h-4 w-4" />
                          <span>Стр. {submission.task?.page?.pageNumber || '?'}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {getStageLabel(submission.task?.stage || '')}
                          {submission.task?.startLine && (
                            <>: {submission.task.startLine}
                              {submission.task.startLine !== submission.task.endLine && `-${submission.task.endLine}`}
                            </>
                          )}
                        </Badge>
                      </div>

                      {/* Progress */}
                      {submission.task?.requiredCount > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Прогресс задания</span>
                            <span>{submission.task.passedCount}/{submission.task.requiredCount}</span>
                          </div>
                          <Progress
                            value={(submission.task.passedCount / submission.task.requiredCount) * 100}
                            className="h-1.5"
                          />
                        </div>
                      )}

                      {/* File info */}
                      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          {submission.fileType === 'voice' ? (
                            <Mic className="h-4 w-4 text-primary" />
                          ) : (
                            <Video className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {submission.fileType === 'voice' ? 'Голосовое' : 'Видео-кружок'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(submission.createdAt), {
                              addSuffix: true,
                              locale: ru,
                            })}
                            {submission.duration && ` • ${Math.floor(submission.duration / 60)}:${String(submission.duration % 60).padStart(2, '0')}`}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* AI transcript preview */}
                      {submission.aiTranscript && (
                        <div className="text-xs p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                          <p className="font-medium text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
                            <Bot className="h-3 w-3" /> AI расшифровка:
                          </p>
                          <p className="text-blue-600 dark:text-blue-400 line-clamp-2 font-arabic" dir="rtl">
                            {submission.aiTranscript}
                          </p>
                        </div>
                      )}

                      {/* Review buttons */}
                      {submission.status === 'PENDING' && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            className="flex-1 bg-green-500 hover:bg-green-600"
                            onClick={() => handleReview(submission.id, 'PASSED')}
                            disabled={reviewing === submission.id}
                          >
                            {reviewing === submission.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Принять
                              </>
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={() => handleReview(submission.id, 'FAILED')}
                            disabled={reviewing === submission.id}
                          >
                            {reviewing === submission.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="mr-2 h-4 w-4" />
                                Отклонить
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Review info */}
                      {submission.reviewedAt && (
                        <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                          Проверено {formatDistanceToNow(new Date(submission.reviewedAt), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </p>
                      )}

                      {/* Feedback */}
                      {submission.feedback && (
                        <div className="text-xs p-2 bg-muted rounded">
                          <p className="font-medium mb-1">Комментарий:</p>
                          <p className="text-muted-foreground">{submission.feedback}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
