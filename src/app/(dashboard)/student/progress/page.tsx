'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  BookOpen,
  Trophy,
  Target,
  TrendingUp,
  Calendar,
  Flame
} from 'lucide-react'

interface UserStats {
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    currentPage: number
    currentLine: number
    currentStage: string
  }
  progress: {
    currentPage: number
    currentLine: number
    currentStage: string
    totalPages: number
    completedPages: number
    completionPercentage: number
    estimatedWeeksRemaining: number | null
  }
  tasks: {
    total: number
    passed: number
    failed: number
    inProgress: number
    passRate: string
  }
  submissions: {
    total: number
    passed: number
    failed: number
    passRate: string
  }
  statistics: {
    totalPagesCompleted: number
    totalSubmissions: number
    passedSubmissions: number
    currentStreak: number
    longestStreak: number
    globalRank: number | null
    groupRank: number | null
  } | null
}

export default function ProgressPage() {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        // First get current user
        const meRes = await fetch('/api/auth/me')
        const me = await meRes.json()

        // Then get stats
        const statsRes = await fetch(`/api/stats/user/${me.id}`)
        const data = await statsRes.json()
        setStats(data)
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'STAGE_1_1': return 'Этап 1.1 (изучение 1-7)'
      case 'STAGE_1_2': return 'Этап 1.2 (повторение 1-7)'
      case 'STAGE_2_1': return 'Этап 2.1 (изучение 8-15)'
      case 'STAGE_2_2': return 'Этап 2.2 (повторение 8-15)'
      case 'STAGE_3': return 'Этап 3 (вся страница)'
      default: return stage
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Не удалось загрузить статистику</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Мой прогресс</h1>
        <p className="text-muted-foreground">Статистика изучения Корана</p>
      </div>

      {/* Main Progress Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Общий прогресс
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-bold">
                {stats.progress.currentPage}
                <span className="text-lg text-muted-foreground">-{stats.progress.currentLine}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                из {stats.progress.totalPages} страниц
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">
                {stats.progress.completionPercentage}%
              </p>
              <Badge variant="outline">
                {getStageLabel(stats.progress.currentStage)}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Progress value={stats.progress.completionPercentage} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Начало</span>
              <span>{stats.progress.completedPages} страниц завершено</span>
              <span>Конец</span>
            </div>
          </div>

          {stats.progress.estimatedWeeksRemaining && (
            <div className="flex items-center gap-2 p-3 bg-background/50 rounded-lg">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">
                Примерное время завершения: <strong>{stats.progress.estimatedWeeksRemaining} недель</strong>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Trophy className="h-4 w-4" />
              Рейтинг
            </CardDescription>
            <CardTitle className="text-3xl">
              #{stats.statistics?.globalRank || '-'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Глобальный рейтинг среди всех студентов
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Flame className="h-4 w-4" />
              Текущая серия
            </CardDescription>
            <CardTitle className="text-3xl">
              {stats.statistics?.currentStreak || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Макс: {stats.statistics?.longestStreak || 0} дней подряд
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              Успешность заданий
            </CardDescription>
            <CardTitle className="text-3xl">
              {stats.tasks.passRate}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.tasks.passed} из {stats.tasks.total} заданий выполнено
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Успешность сдач
            </CardDescription>
            <CardTitle className="text-3xl">
              {stats.submissions.passRate}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.submissions.passed} из {stats.submissions.total} сдач принято
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Задания</CardTitle>
            <CardDescription>Статистика выполнения заданий</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Всего заданий</span>
              <Badge variant="outline">{stats.tasks.total}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-green-600">Выполнено</span>
              <Badge className="bg-green-500">{stats.tasks.passed}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-blue-600">В процессе</span>
              <Badge variant="outline" className="border-blue-500 text-blue-500">
                {stats.tasks.inProgress}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-destructive">Не выполнено</span>
              <Badge variant="destructive">{stats.tasks.failed}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Сдачи</CardTitle>
            <CardDescription>Статистика отправленных работ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Всего отправлено</span>
              <Badge variant="outline">{stats.submissions.total}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-green-600">Принято</span>
              <Badge className="bg-green-500">{stats.submissions.passed}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-destructive">Отклонено</span>
              <Badge variant="destructive">{stats.submissions.failed}</Badge>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="font-medium">Процент успеха</span>
                <span className="text-lg font-bold text-primary">
                  {stats.submissions.passRate}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
