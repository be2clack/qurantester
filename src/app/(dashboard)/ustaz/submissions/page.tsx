'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  User,
  BookOpen
} from 'lucide-react'
import { SubmissionStatus } from '@prisma/client'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Submission {
  id: string
  status: SubmissionStatus
  fileType: string
  telegramFileId: string
  createdAt: string
  reviewedAt: string | null
  feedback: string | null
  student: {
    id: string
    firstName: string | null
    lastName: string | null
    phone: string
  }
  task: {
    id: string
    stage: string
    startLine: number
    endLine: number
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
        // Remove from list or update
        setSubmissions(prev => prev.filter(s => s.id !== id))
      }
    } catch (err) {
      console.error('Failed to review submission:', err)
    } finally {
      setReviewing(null)
    }
  }

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'STAGE_1_1': return 'Изучение 1-7'
      case 'STAGE_1_2': return 'Повторение 1-7'
      case 'STAGE_2_1': return 'Изучение 8-15'
      case 'STAGE_2_2': return 'Повторение 8-15'
      case 'STAGE_3': return 'Страница'
      default: return stage
    }
  }

  const getStatusBadge = (status: SubmissionStatus) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Ожидает</Badge>
      case 'PASSED':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" />Сдано</Badge>
      case 'FAILED':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Не сдано</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Проверка работ</h1>
        <p className="text-muted-foreground">Просмотр и оценка сдач студентов</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="mr-2 h-4 w-4" />
            Ожидают проверки
          </TabsTrigger>
          <TabsTrigger value="passed">
            <CheckCircle className="mr-2 h-4 w-4" />
            Принятые
          </TabsTrigger>
          <TabsTrigger value="failed">
            <XCircle className="mr-2 h-4 w-4" />
            Отклоненные
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : submissions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {tab === 'pending' ? 'Нет работ, ожидающих проверки' : 'Нет работ'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {submissions.map((submission) => (
                <Card key={submission.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {submission.student.firstName} {submission.student.lastName}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {submission.student.phone}
                          </CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(submission.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <BookOpen className="h-4 w-4" />
                        <span>Страница {submission.task.page.pageNumber}</span>
                      </div>
                      <Badge variant="outline">
                        {getStageLabel(submission.task.stage)}: {submission.task.startLine}
                        {submission.task.startLine !== submission.task.endLine && `-${submission.task.endLine}`}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Play className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {submission.fileType === 'VOICE' ? 'Голосовое сообщение' : 'Видео-кружок'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(submission.createdAt), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </p>
                      </div>
                    </div>

                    {submission.status === 'PENDING' && (
                      <div className="flex gap-2">
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

                    {submission.reviewedAt && (
                      <p className="text-xs text-muted-foreground text-center">
                        Проверено {formatDistanceToNow(new Date(submission.reviewedAt), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
