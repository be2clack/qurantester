'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Loader2,
  Users,
  BookOpen,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Award,
  Target,
} from 'lucide-react'

interface Analytics {
  totalStudents: number
  totalGroups: number
  totalSubmissions: number
  pendingSubmissions: number
  passedSubmissions: number
  failedSubmissions: number
  avgStudentPage: number
  topStudents: {
    id: string
    firstName: string | null
    lastName: string | null
    currentPage: number
    group: { name: string } | null
  }[]
  groupStats: {
    id: string
    name: string
    studentCount: number
    avgPage: number
  }[]
}

export default function UstazAnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  async function fetchAnalytics() {
    try {
      const res = await fetch('/api/ustaz/analytics')
      const data = await res.json()
      setAnalytics(data)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Не удалось загрузить аналитику</p>
        </CardContent>
      </Card>
    )
  }

  const passRate = analytics.totalSubmissions > 0
    ? Math.round((analytics.passedSubmissions / (analytics.passedSubmissions + analytics.failedSubmissions)) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Аналитика</h1>
        <p className="text-muted-foreground">Статистика ваших групп и студентов</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Всего студентов</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalStudents}</div>
            <p className="text-xs text-muted-foreground">
              В {analytics.totalGroups} группах
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ожидают проверки</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.pendingSubmissions}</div>
            <p className="text-xs text-muted-foreground">
              Всего {analytics.totalSubmissions} сдач
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Успешных сдач</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.passedSubmissions}</div>
            <p className="text-xs text-muted-foreground">
              {passRate}% успешность
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Средняя страница</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.avgStudentPage}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((analytics.avgStudentPage / 604) * 100)}% Корана
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Students */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              Лучшие студенты
            </CardTitle>
            <CardDescription>По текущему прогрессу</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.topStudents.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Нет данных</p>
            ) : (
              <div className="space-y-3">
                {analytics.topStudents.map((student, idx) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        idx === 0 ? 'bg-yellow-500 text-white' :
                        idx === 1 ? 'bg-gray-400 text-white' :
                        idx === 2 ? 'bg-amber-600 text-white' :
                        'bg-primary/10'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium">{student.firstName} {student.lastName}</p>
                        <p className="text-xs text-muted-foreground">
                          {student.group?.name || 'Без группы'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">Стр. {student.currentPage}</p>
                      <Progress
                        value={(student.currentPage / 604) * 100}
                        className="h-1.5 w-20"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Group Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Статистика по группам
            </CardTitle>
            <CardDescription>Средний прогресс каждой группы</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.groupStats.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Нет групп</p>
            ) : (
              <div className="space-y-4">
                {analytics.groupStats.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{group.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.studentCount} студентов
                        </p>
                      </div>
                      <Badge variant="secondary">
                        Стр. {group.avgPage}
                      </Badge>
                    </div>
                    <Progress value={(group.avgPage / 604) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
