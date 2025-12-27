'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BarChart3,
  TrendingUp,
  Users,
  BookOpen,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Bot,
  Sparkles,
  DollarSign,
  Mic,
} from 'lucide-react'

interface Stats {
  users: {
    total: number
    students: number
    ustaz: number
    active: number
  }
  tasks: {
    total: number
    inProgress: number
    completed: number
    failed: number
  }
  submissions: {
    total: number
    pending: number
    passed: number
    failed: number
  }
  groups: {
    total: number
    active: number
  }
  topStudents: {
    id: string
    rank: number
    name: string
    page: number
    line: number
    tasksCompleted: number
  }[]
}

interface AIUsageStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalCost: number
  totalAudioMinutes: number
  byProvider: {
    provider: string
    requests: number
    cost: number
    successRate: number
  }[]
  dailyStats: {
    date: string
    requests: number
    cost: number
  }[]
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [aiStats, setAiStats] = useState<AIUsageStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    fetchAIStats()
  }, [])

  async function fetchStats() {
    setLoading(true)
    try {
      const res = await fetch('/api/stats/overview')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      } else {
        console.error('Failed to fetch stats:', await res.text())
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchAIStats() {
    try {
      const res = await fetch('/api/stats/ai-usage')
      if (res.ok) {
        const data = await res.json()
        setAiStats(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch AI stats:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Аналитика
        </h1>
        <p className="text-muted-foreground">
          Статистика и отчеты системы
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Пользователи</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              Всего зарегистрировано
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активные задания</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.tasks.inProgress || 0}</div>
            <p className="text-xs text-muted-foreground">
              В процессе выполнения
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Выполнено</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.tasks.completed || 0}</div>
            <p className="text-xs text-muted-foreground">
              Успешно завершено
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">На проверке</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.submissions.pending || 0}</div>
            <p className="text-xs text-muted-foreground">
              Ожидают проверки
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Students */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Лучшие студенты
            </CardTitle>
            <CardDescription>По количеству выполненных заданий</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.topStudents && stats.topStudents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Имя</TableHead>
                    <TableHead className="text-right">Прогресс</TableHead>
                    <TableHead className="text-right">Заданий</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Badge variant={student.rank === 1 ? 'default' : 'outline'}>
                          {student.rank}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{student.page}-{student.line}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{student.tasksCompleted}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Нет данных о студентах
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Статистика заданий</CardTitle>
            <CardDescription>Распределение по статусам</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>В процессе</span>
              </div>
              <span className="font-bold">{stats?.tasks.inProgress || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Выполнено</span>
              </div>
              <span className="font-bold">{stats?.tasks.completed || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Не сдано</span>
              </div>
              <span className="font-bold">{stats?.tasks.failed || 0}</span>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Успешность</span>
                <span className="font-bold">
                  {stats?.tasks.total ?
                    Math.round((stats.tasks.completed / stats.tasks.total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-green-500 rounded-full h-2 transition-all"
                  style={{
                    width: `${stats?.tasks.total ?
                      (stats.tasks.completed / stats.tasks.total) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submissions Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Проверка работ</CardTitle>
            <CardDescription>Статистика отправленных работ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span>Ожидают проверки</span>
              </div>
              <span className="font-bold">{stats?.submissions.pending || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Принято</span>
              </div>
              <span className="font-bold">{stats?.submissions.passed || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span>Отклонено</span>
              </div>
              <span className="font-bold">{stats?.submissions.failed || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Groups Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Группы</CardTitle>
            <CardDescription>Статистика учебных групп</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <div className="text-4xl font-bold">{stats?.groups.total || 0}</div>
              <p className="text-muted-foreground">Всего групп</p>
            </div>
            <div className="flex items-center justify-between pt-4 border-t">
              <span>Активных групп</span>
              <Badge variant="default">{stats?.groups.active || 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Usage Statistics */}
      <div className="mt-6">
        <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-600" />
                  AI Использование
                </CardTitle>
                <CardDescription>Статистика использования AI моделей за 30 дней</CardDescription>
              </div>
              <Badge variant="outline" className="text-lg px-3 py-1">
                <DollarSign className="h-4 w-4 mr-1" />
                ${aiStats?.totalCost.toFixed(4) || '0.0000'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-lg">
                <div className="text-3xl font-bold">{aiStats?.totalRequests || 0}</div>
                <p className="text-sm text-muted-foreground">Всего запросов</p>
              </div>
              <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{aiStats?.successfulRequests || 0}</div>
                <p className="text-sm text-muted-foreground">Успешных</p>
              </div>
              <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{aiStats?.failedRequests || 0}</div>
                <p className="text-sm text-muted-foreground">Ошибок</p>
              </div>
              <div className="text-center p-4 bg-white/50 dark:bg-black/20 rounded-lg">
                <div className="text-3xl font-bold">{aiStats?.totalAudioMinutes.toFixed(1) || '0.0'}</div>
                <p className="text-sm text-muted-foreground">Минут аудио</p>
              </div>
            </div>

            {/* By Provider */}
            {aiStats?.byProvider && aiStats.byProvider.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">По провайдерам</h4>
                <div className="grid gap-3">
                  {aiStats.byProvider.map((provider) => (
                    <div key={provider.provider} className="flex items-center justify-between p-3 bg-white/50 dark:bg-black/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        {provider.provider === 'WHISPER' ? (
                          <Mic className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-amber-600" />
                        )}
                        <span className="font-medium">
                          {provider.provider === 'WHISPER' ? 'OpenAI Whisper' : 'Qurani.ai QRC'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>{provider.requests} запросов</span>
                        <span className="text-green-600">{provider.successRate.toFixed(0)}% успех</span>
                        <Badge variant="outline">${provider.cost.toFixed(4)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!aiStats || aiStats.totalRequests === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                Нет данных об использовании AI
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
