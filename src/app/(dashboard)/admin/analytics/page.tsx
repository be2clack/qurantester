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
  TrendingDown,
  Users,
  BookOpen,
  CheckCircle,
  XCircle,
  Clock,
  Loader2
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
    name: string
    page: number
    tasksCompleted: number
  }[]
  recentActivity: {
    type: string
    description: string
    time: string
  }[]
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    setLoading(true)
    try {
      // Fetch multiple endpoints in parallel
      const [usersRes, tasksRes, submissionsRes, groupsRes, rankingsRes] = await Promise.all([
        fetch('/api/users?limit=1'),
        fetch('/api/tasks?limit=1'),
        fetch('/api/submissions?limit=1'),
        fetch('/api/groups?limit=1'),
        fetch('/api/stats/rankings?limit=10'),
      ])

      const users = await usersRes.json()
      const rankings = rankingsRes.ok ? await rankingsRes.json() : []

      // Build stats from available data
      setStats({
        users: {
          total: users.total || 0,
          students: 0,
          ustaz: 0,
          active: 0,
        },
        tasks: {
          total: 0,
          inProgress: 0,
          completed: 0,
          failed: 0,
        },
        submissions: {
          total: 0,
          pending: 0,
          passed: 0,
          failed: 0,
        },
        groups: {
          total: 0,
          active: 0,
        },
        topStudents: rankings.slice(0, 5).map((r: any) => ({
          id: r.id,
          name: r.firstName || 'Студент',
          page: r.currentPage,
          tasksCompleted: r.statistics?.totalTasksCompleted || 0,
        })),
        recentActivity: [],
      })
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoading(false)
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
                    <TableHead className="text-right">Страница</TableHead>
                    <TableHead className="text-right">Заданий</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topStudents.map((student, index) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Badge variant={index === 0 ? 'default' : 'outline'}>
                          {index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell className="text-right">{student.page}</TableCell>
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
    </div>
  )
}
