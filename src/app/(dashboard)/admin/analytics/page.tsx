'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  BarChart3,
  TrendingUp,
  Users,
  BookOpen,
  CheckCircle,
  Clock,
  Loader2,
  Bot,
  Sparkles,
  DollarSign,
  Mic,
} from 'lucide-react'
import {
  Pie,
  PieChart,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Label,
} from 'recharts'

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
    gender: 'MALE' | 'FEMALE' | null
    age: number | null
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

type GenderFilter = 'all' | 'MALE' | 'FEMALE'
type AgeFilter = 'all' | 'children' | 'adults'

const taskChartConfig = {
  inProgress: { label: 'В процессе', color: 'oklch(0.623 0.214 259.815)' },
  completed: { label: 'Выполнено', color: 'oklch(0.723 0.191 149.579)' },
  failed: { label: 'Не сдано', color: 'oklch(0.637 0.237 25.331)' },
} satisfies ChartConfig

const submissionChartConfig = {
  pending: { label: 'На проверке', color: 'oklch(0.795 0.184 86.047)' },
  passed: { label: 'Принято', color: 'oklch(0.723 0.191 149.579)' },
  failed: { label: 'Отклонено', color: 'oklch(0.637 0.237 25.331)' },
} satisfies ChartConfig

const aiDailyChartConfig = {
  requests: { label: 'Запросы', color: 'oklch(0.627 0.265 303.9)' },
  cost: { label: 'Расход ($)', color: 'oklch(0.723 0.191 149.579)' },
} satisfies ChartConfig

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [aiStats, setAiStats] = useState<AIUsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all')
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all')

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (genderFilter !== 'all') params.set('gender', genderFilter)
      if (ageFilter !== 'all') params.set('age', ageFilter)

      const res = await fetch(`/api/stats/overview?${params}`)
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
  }, [genderFilter, ageFilter])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchAIStats()
  }, [])

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

  const taskPieData = useMemo(() => {
    if (!stats) return []
    return [
      { name: 'inProgress', value: stats.tasks.inProgress, fill: taskChartConfig.inProgress.color },
      { name: 'completed', value: stats.tasks.completed, fill: taskChartConfig.completed.color },
      { name: 'failed', value: stats.tasks.failed, fill: taskChartConfig.failed.color },
    ].filter(d => d.value > 0)
  }, [stats])

  const submissionPieData = useMemo(() => {
    if (!stats) return []
    return [
      { name: 'pending', value: stats.submissions.pending, fill: submissionChartConfig.pending.color },
      { name: 'passed', value: stats.submissions.passed, fill: submissionChartConfig.passed.color },
      { name: 'failed', value: stats.submissions.failed, fill: submissionChartConfig.failed.color },
    ].filter(d => d.value > 0)
  }, [stats])

  const aiDailyData = useMemo(() => {
    if (!aiStats?.dailyStats) return []
    return aiStats.dailyStats.map(d => ({
      date: new Date(d.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      requests: d.requests,
      cost: Number(d.cost.toFixed(4)),
    }))
  }, [aiStats])

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const successRate = stats?.tasks.total
    ? Math.round((stats.tasks.completed / stats.tasks.total) * 100)
    : 0

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-lg md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-5 w-5 md:h-6 md:w-6" />
          Аналитика
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Статистика и отчеты системы
        </p>
      </div>

      {/* KPI Cards - 2x2 on mobile, 4 in row on desktop */}
      <div className="grid grid-cols-2 gap-2 md:gap-4 md:grid-cols-4">
        <Card className="p-3 md:p-0">
          <CardContent className="p-0 md:pt-6 md:px-6 md:pb-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{stats?.users.total || 0}</p>
                <p className="text-[11px] md:text-xs text-muted-foreground truncate">
                  Пользователей
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="p-3 md:p-0">
          <CardContent className="p-0 md:pt-6 md:px-6 md:pb-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 md:h-5 md:w-5 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{stats?.tasks.inProgress || 0}</p>
                <p className="text-[11px] md:text-xs text-muted-foreground truncate">
                  Активных
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="p-3 md:p-0">
          <CardContent className="p-0 md:pt-6 md:px-6 md:pb-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold text-green-600">{stats?.tasks.completed || 0}</p>
                <p className="text-[11px] md:text-xs text-muted-foreground truncate">
                  Выполнено
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="p-3 md:p-0">
          <CardContent className="p-0 md:pt-6 md:px-6 md:pb-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 md:h-5 md:w-5 text-yellow-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold text-yellow-600">{stats?.submissions.pending || 0}</p>
                <p className="text-[11px] md:text-xs text-muted-foreground truncate">
                  На проверке
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row - pie charts side by side */}
      <div className="grid gap-3 md:gap-6 grid-cols-1 md:grid-cols-2">
        {/* Task Status Pie */}
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-sm md:text-base">Задания</CardTitle>
            <CardDescription className="text-xs">Распределение по статусам</CardDescription>
          </CardHeader>
          <CardContent className="pb-3 md:pb-6">
            {taskPieData.length > 0 ? (
              <ChartContainer config={taskChartConfig} className="mx-auto aspect-square max-h-[200px] md:max-h-[250px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie
                    data={taskPieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    strokeWidth={2}
                    stroke="var(--background)"
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                                {successRate}%
                              </tspan>
                              <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 18} className="fill-muted-foreground text-xs">
                                успех
                              </tspan>
                            </text>
                          )
                        }
                      }}
                    />
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="name" className="flex-wrap text-xs" />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                Нет данных
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submission Status Pie */}
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-sm md:text-base">Проверка работ</CardTitle>
            <CardDescription className="text-xs">Статистика отправленных работ</CardDescription>
          </CardHeader>
          <CardContent className="pb-3 md:pb-6">
            {submissionPieData.length > 0 ? (
              <ChartContainer config={submissionChartConfig} className="mx-auto aspect-square max-h-[200px] md:max-h-[250px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie
                    data={submissionPieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    strokeWidth={2}
                    stroke="var(--background)"
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                                {stats?.submissions.total || 0}
                              </tspan>
                              <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 18} className="fill-muted-foreground text-xs">
                                всего
                              </tspan>
                            </text>
                          )
                        }
                      }}
                    />
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="name" className="flex-wrap text-xs" />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                Нет данных
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Students + Groups */}
      <div className="grid gap-3 md:gap-6 grid-cols-1 md:grid-cols-3">
        {/* Top Students - spans 2 cols on desktop */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Лучшие студенты
            </CardTitle>
            <CardDescription className="text-xs">По прогрессу заучивания</CardDescription>

            {/* Filters - compact on mobile */}
            <div className="flex flex-wrap gap-1.5 pt-2">
              <div className="flex gap-1">
                <Button
                  variant={genderFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setGenderFilter('all')}
                >
                  Все
                </Button>
                <Button
                  variant={genderFilter === 'MALE' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setGenderFilter('MALE')}
                >
                  М
                </Button>
                <Button
                  variant={genderFilter === 'FEMALE' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setGenderFilter('FEMALE')}
                >
                  Ж
                </Button>
              </div>
              <div className="flex gap-1">
                <Button
                  variant={ageFilter === 'all' ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setAgeFilter('all')}
                >
                  Все
                </Button>
                <Button
                  variant={ageFilter === 'children' ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setAgeFilter('children')}
                >
                  &lt;18
                </Button>
                <Button
                  variant={ageFilter === 'adults' ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setAgeFilter('adults')}
                >
                  18+
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-3 md:pb-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : stats?.topStudents && stats.topStudents.length > 0 ? (
              <>
                {/* Mobile: compact list */}
                <div className="md:hidden space-y-1.5">
                  {stats.topStudents.map((student) => (
                    <div key={student.id} className="flex items-center gap-2 py-1.5 border-b last:border-0">
                      <Badge variant={student.rank <= 3 ? 'default' : 'outline'} className="w-6 h-6 p-0 justify-center text-xs shrink-0">
                        {student.rank}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{student.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {student.gender === 'MALE' ? 'М' : student.gender === 'FEMALE' ? 'Ж' : '—'}
                          {student.age !== null && ` ${student.age}л`}
                          {' · '}{student.tasksCompleted} зад.
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{student.page}-{student.line}</Badge>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <Table className="hidden md:table">
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
                        <TableCell>
                          <div className="font-medium">{student.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {student.gender === 'MALE' ? 'М' : student.gender === 'FEMALE' ? 'Ж' : '—'}
                            {student.age !== null && ` · ${student.age} лет`}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{student.page}-{student.line}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{student.tasksCompleted}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Нет данных о студентах
              </div>
            )}
          </CardContent>
        </Card>

        {/* Groups + Users breakdown */}
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-sm md:text-base">Общая сводка</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-3 md:pb-6">
            <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold">{stats?.users.students || 0}</p>
                <p className="text-[11px] text-muted-foreground">Студентов</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold">{stats?.users.ustaz || 0}</p>
                <p className="text-[11px] text-muted-foreground">Учителей</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold">{stats?.groups.total || 0}</p>
                <p className="text-[11px] text-muted-foreground">Групп</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{stats?.groups.active || 0}</p>
                <p className="text-[11px] text-muted-foreground">Активных</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Usage Section */}
      {aiStats && aiStats.totalRequests > 0 && (
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2 md:pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm md:text-base flex items-center gap-2">
                  <Bot className="h-4 w-4 text-purple-600" />
                  AI Использование
                </CardTitle>
                <CardDescription className="text-xs">За 30 дней</CardDescription>
              </div>
              <Badge variant="outline" className="text-sm md:text-base px-2 py-0.5">
                <DollarSign className="h-3 w-3 mr-0.5" />
                ${aiStats.totalCost.toFixed(4)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pb-3 md:pb-6">
            {/* AI KPI - 2x2 on mobile, 4 row on desktop */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
              <div className="text-center p-2.5 md:p-3 bg-muted/50 rounded-lg">
                <p className="text-xl md:text-2xl font-bold">{aiStats.totalRequests}</p>
                <p className="text-[11px] text-muted-foreground">Запросов</p>
              </div>
              <div className="text-center p-2.5 md:p-3 bg-muted/50 rounded-lg">
                <p className="text-xl md:text-2xl font-bold text-green-600">{aiStats.successfulRequests}</p>
                <p className="text-[11px] text-muted-foreground">Успешных</p>
              </div>
              <div className="text-center p-2.5 md:p-3 bg-muted/50 rounded-lg">
                <p className="text-xl md:text-2xl font-bold text-red-600">{aiStats.failedRequests}</p>
                <p className="text-[11px] text-muted-foreground">Ошибок</p>
              </div>
              <div className="text-center p-2.5 md:p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center gap-1">
                  <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xl md:text-2xl font-bold">{aiStats.totalAudioMinutes.toFixed(1)}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">Мин. аудио</p>
              </div>
            </div>

            {/* AI Providers */}
            {aiStats.byProvider && aiStats.byProvider.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground">Провайдеры</h4>
                <div className="grid gap-2 md:grid-cols-2">
                  {aiStats.byProvider.map((provider) => (
                    <div key={provider.provider} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        {provider.provider === 'WHISPER' ? (
                          <Mic className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
                        )}
                        <div>
                          <p className="text-xs font-medium">
                            {provider.provider === 'WHISPER' ? 'Whisper' : 'QRC'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {provider.requests} зап. · {provider.successRate.toFixed(0)}%
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">${provider.cost.toFixed(4)}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Daily Usage Area Chart */}
            {aiDailyData.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground">Запросы по дням</h4>
                <ChartContainer config={aiDailyChartConfig} className="h-[180px] md:h-[220px] w-full">
                  <AreaChart data={aiDailyData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={10}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={4}
                      fontSize={10}
                      width={30}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="requests"
                      stroke="var(--color-requests)"
                      fill="var(--color-requests)"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
