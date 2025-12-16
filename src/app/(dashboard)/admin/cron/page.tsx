'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Clock,
  Play,
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

interface CronJob {
  id: string
  name: string
  url: string
  schedule: string
  isEnabled: boolean
  externalId?: string
  lastRunAt?: string
  lastStatus?: string
  lastError?: string
  runCount: number
  errorCount: number
  createdAt: string
  updatedAt: string
}

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/admin/cron')
      const data = await response.json()
      setJobs(data.jobs || [])
    } catch (error) {
      toast.error('Не удалось загрузить задачи')
    } finally {
      setLoading(false)
    }
  }

  const handleSetup = async () => {
    setActionLoading('setup')
    try {
      const response = await fetch('/api/admin/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      })
      const data = await response.json()

      if (data.success) {
        toast.success('Cron задача настроена на cron-job.org')
        fetchJobs()
      } else {
        toast.error(data.error || 'Ошибка настройки')
      }
    } catch (error) {
      toast.error('Ошибка при настройке cron')
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggle = async (jobId: string) => {
    setActionLoading(jobId)
    try {
      const response = await fetch('/api/admin/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', jobId }),
      })
      const data = await response.json()

      if (data.success) {
        toast.success('Статус изменен')
        fetchJobs()
      } else {
        toast.error(data.error || 'Ошибка')
      }
    } catch (error) {
      toast.error('Ошибка при изменении статуса')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRun = async (jobId: string) => {
    setActionLoading(`run-${jobId}`)
    try {
      const response = await fetch('/api/admin/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', jobId }),
      })
      const data = await response.json()

      if (data.success) {
        toast.success(`Выполнено: ${JSON.stringify(data.result)}`)
        fetchJobs()
      } else {
        toast.error(data.error || 'Ошибка выполнения')
      }
    } catch (error) {
      toast.error('Ошибка при запуске задачи')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSync = async () => {
    setActionLoading('sync')
    try {
      const response = await fetch('/api/admin/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      })
      const data = await response.json()

      if (data.success) {
        toast.success(`Найдено ${data.total} задач на cron-job.org`)
        console.log('External jobs:', data.externalJobs)
      } else {
        toast.error(data.error || 'Ошибка синхронизации')
      }
    } catch (error) {
      toast.error('Ошибка при синхронизации')
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">Не запускался</Badge>
    if (status === 'success') {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          Успешно
        </Badge>
      )
    }
    return (
      <Badge variant="destructive">
        <XCircle className="w-3 h-3 mr-1" />
        Ошибка
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cron задачи</h1>
          <p className="text-muted-foreground">
            Управление фоновыми задачами проекта
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={actionLoading === 'sync'}
          >
            {actionLoading === 'sync' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Синхронизация
          </Button>
          <Button
            onClick={handleSetup}
            disabled={actionLoading === 'setup'}
          >
            {actionLoading === 'setup' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Settings className="w-4 h-4 mr-2" />
            )}
            Настроить cron-job.org
          </Button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Нет cron задач</h3>
            <p className="text-muted-foreground text-center mb-4">
              Нажмите кнопку "Настроить cron-job.org" чтобы создать задачу<br />
              для автоматической очистки сообщений
            </p>
            <Button onClick={handleSetup} disabled={actionLoading === 'setup'}>
              {actionLoading === 'setup' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Settings className="w-4 h-4 mr-2" />
              )}
              Настроить
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Задачи проекта</CardTitle>
            <CardDescription>
              Отображаются только задачи QuranTester
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Расписание</TableHead>
                  <TableHead>Последний запуск</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-center">Запусков</TableHead>
                  <TableHead className="text-center">Ошибок</TableHead>
                  <TableHead className="text-center">Активна</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{job.name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {job.url}
                        </div>
                        {job.externalId && (
                          <div className="text-xs text-blue-500">
                            ID: {job.externalId}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {job.schedule}
                      </code>
                    </TableCell>
                    <TableCell>{formatDate(job.lastRunAt)}</TableCell>
                    <TableCell>
                      {getStatusBadge(job.lastStatus)}
                      {job.lastError && (
                        <div className="text-xs text-destructive mt-1 max-w-[150px] truncate">
                          {job.lastError}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{job.runCount}</TableCell>
                    <TableCell className="text-center">
                      {job.errorCount > 0 ? (
                        <span className="text-destructive">{job.errorCount}</span>
                      ) : (
                        job.errorCount
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={job.isEnabled}
                        onCheckedChange={() => handleToggle(job.id)}
                        disabled={actionLoading === job.id}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRun(job.id)}
                        disabled={actionLoading === `run-${job.id}`}
                      >
                        {actionLoading === `run-${job.id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Информация
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>cleanup-messages</strong> - очищает сообщения бота с истекшим временем жизни.
            Запускается каждые 5 минут.
          </p>
          <p>
            Подтверждения отправки работ автоматически удаляются через 2 минуты после отправки.
          </p>
          <p className="text-xs">
            Сервис: <a href="https://cron-job.org" target="_blank" rel="noopener" className="text-blue-500 hover:underline">cron-job.org</a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
