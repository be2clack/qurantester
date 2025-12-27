'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Phone, User, BookOpen, Users, GraduationCap, Loader2, Calendar, Target, TrendingUp, Award, RefreshCw, Languages, ChevronDown } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RoleBadge } from '@/components/users/role-badge'
import Link from 'next/link'
import { UserRole, StageNumber } from '@prisma/client'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Parent {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
}

interface Child {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
  currentPage: number
  currentLine: number
  currentStage: StageNumber
}

interface Group {
  id: string
  name: string
  isActive: boolean
  _count: { students: number }
}

interface Statistics {
  totalPagesCompleted: number
  totalLinesCompleted: number
  totalTasksCompleted: number
  totalTasksFailed: number
  currentStreak: number
  longestStreak: number
  passedSubmissions: number
  totalSubmissions: number
  totalReviews: number
  globalRank: number | null
  groupRank: number | null
  averagePagesPerWeek: number
}

interface MufradatStats {
  summary: {
    totalDays: number
    passedDays: number
    totalWords: number
    correctWords: number
    passRate: number
    accuracy: number
  }
  week: {
    totalDays: number
    passedDays: number
    totalWords: number
    correctWords: number
  }
  daily: Array<{
    date: string
    wordsTotal: number
    wordsCorrect: number
    passed: boolean
  }>
}

interface RevisionStats {
  total: number
  passed: number
  pending: number
  failed: number
}

interface DetailedStatsData {
  period: {
    start: string
    end: string
    label: string
  }
  summary: {
    memorization: { totalTasks: number; passed: number; failed: number; inProgress: number }
    revision: { totalSubmitted: number; passed: number; failed: number; pending: number; daysComplete: number; totalDays: number }
    mufradat: { totalGames: number; passed: number; avgScore: number }
  }
  daily: Array<{
    date: string
    memorization: { tasks: number; passed: number; failed: number }
    revision: { submitted: number; passed: number; failed: number; required: number }
    mufradat: { games: number; passed: number; avgScore: number }
  }>
  availableMonths: string[]
}

interface UserDetail {
  id: string
  phone: string
  firstName: string | null
  lastName: string | null
  telegramUsername: string | null
  telegramId: string | null
  gender: 'MALE' | 'FEMALE' | null
  role: UserRole
  isActive: boolean
  currentPage: number
  currentLine: number
  currentStage: StageNumber
  createdAt: string
  studentGroup: { id: string; name: string; ustazId: string } | null
  childOf: Parent[]
  parentOf: Child[]
  ustazGroups: Group[]
  statistics: Statistics | null
  _count: { tasks: number; submissions: number }
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [mufradatStats, setMufradatStats] = useState<MufradatStats | null>(null)
  const [revisionStats, setRevisionStats] = useState<RevisionStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/users/${params.id}`)
        if (res.ok) {
          const data = await res.json()
          setUser(data)

          // Fetch additional stats for students
          if (data.role === 'STUDENT') {
            // Fetch mufradat stats
            const mufradatRes = await fetch(`/api/student/mufradat/stats?studentId=${params.id}&days=30`)
            if (mufradatRes.ok) {
              setMufradatStats(await mufradatRes.json())
            }

            // Fetch revision stats
            const revisionRes = await fetch(`/api/student/revisions?studentId=${params.id}&limit=100`)
            if (revisionRes.ok) {
              const revData = await revisionRes.json()
              const items = revData.items || []
              setRevisionStats({
                total: items.length,
                passed: items.filter((r: any) => r.status === 'PASSED').length,
                pending: items.filter((r: any) => r.status === 'PENDING').length,
                failed: items.filter((r: any) => r.status === 'FAILED').length,
              })
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch user:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Пользователь не найден</p>
        <Button variant="link" onClick={() => router.back()}>
          Вернуться назад
        </Button>
      </div>
    )
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Без имени'
  const initials = (user.firstName?.charAt(0) || '') + (user.lastName?.charAt(0) || '') || 'U'
  const totalPages = 602
  const progressPercent = Math.round((user.currentPage / totalPages) * 100)

  function formatStageName(stage: StageNumber): string {
    const stages: Record<StageNumber, string> = {
      STAGE_1_1: 'Этап 1.1 (по строке)',
      STAGE_1_2: 'Этап 1.2 (строки 1-7)',
      STAGE_2_1: 'Этап 2.1 (по строке)',
      STAGE_2_2: 'Этап 2.2 (строки 8-15)',
      STAGE_3: 'Этап 3 (вся страница)',
    }
    return stages[stage] || stage
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{fullName}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              {user.phone}
              {user.telegramUsername && (
                <span className="text-sm">(@{user.telegramUsername})</span>
              )}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <RoleBadge role={user.role} />
            <Badge variant={user.isActive ? 'default' : 'secondary'}>
              {user.isActive ? 'Активен' : 'Неактивен'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Role-specific content */}
      {user.role === UserRole.STUDENT && (
        <StudentView
          user={user}
          progressPercent={progressPercent}
          formatStageName={formatStageName}
          mufradatStats={mufradatStats}
          revisionStats={revisionStats}
        />
      )}
      {user.role === UserRole.USTAZ && (
        <UstazView user={user} />
      )}
      {user.role === UserRole.PARENT && (
        <ParentView user={user} formatStageName={formatStageName} />
      )}
      {user.role === UserRole.ADMIN && (
        <AdminView user={user} />
      )}

      {/* Registration info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Информация об аккаунте
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Дата регистрации:</span>
              <p className="font-medium">{new Date(user.createdAt).toLocaleDateString('ru-RU')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Telegram ID:</span>
              <p className="font-medium">{user.telegramId || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">ID пользователя:</span>
              <p className="font-medium font-mono text-xs">{user.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StudentView({ user, progressPercent, formatStageName, mufradatStats, revisionStats }: {
  user: UserDetail
  progressPercent: number
  formatStageName: (stage: StageNumber) => string
  mufradatStats: MufradatStats | null
  revisionStats: RevisionStats | null
}) {
  const stats = user.statistics

  return (
    <>
      {/* Progress Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Текущая страница</CardDescription>
            <CardTitle className="text-3xl">{user.currentPage}</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{progressPercent}% из 602 страниц</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Текущая строка</CardDescription>
            <CardTitle className="text-3xl">{user.currentLine}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{formatStageName(user.currentStage)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Пол</CardDescription>
            <CardTitle className="text-3xl">
              {user.gender === 'MALE' ? '👨' : user.gender === 'FEMALE' ? '🧕' : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {user.gender === 'MALE' ? 'Мужской' : user.gender === 'FEMALE' ? 'Женский' : 'Не указан'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Группа</CardDescription>
            <CardTitle className="text-xl truncate">
              {user.studentGroup?.name || 'Без группы'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Lesson Type Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Memorization */}
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-emerald-500" />
              Заучивание
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Всего заданий:</span>
              <span className="font-medium">{user._count.tasks}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Завершено:</span>
              <span className="font-medium text-emerald-600">{stats?.totalTasksCompleted || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Страниц пройдено:</span>
              <span className="font-medium">{stats?.totalPagesCompleted || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Revision */}
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="h-5 w-5 text-blue-500" />
              Повторение
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {revisionStats ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Всего сдано:</span>
                  <span className="font-medium">{revisionStats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Принято:</span>
                  <span className="font-medium text-emerald-600">{revisionStats.passed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">На проверке:</span>
                  <span className="font-medium text-yellow-600">{revisionStats.pending}</span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Нет данных</p>
            )}
          </CardContent>
        </Card>

        {/* Mufradat */}
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Languages className="h-5 w-5 text-purple-500" />
              Переводы
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {mufradatStats ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Дней сдано (30д):</span>
                  <span className="font-medium">{mufradatStats.summary.passedDays}/{mufradatStats.summary.totalDays}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Слов выучено:</span>
                  <span className="font-medium text-emerald-600">{mufradatStats.summary.correctWords}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Точность:</span>
                  <span className="font-medium">{mufradatStats.summary.accuracy}%</span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Нет данных</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Статистика
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Страниц завершено</p>
                  <p className="text-2xl font-bold">{stats.totalPagesCompleted}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Строк завершено</p>
                  <p className="text-2xl font-bold">{stats.totalLinesCompleted}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Сдано/Всего</p>
                  <p className="text-2xl font-bold">
                    {stats.passedSubmissions}/{stats.totalSubmissions}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Процент успеха</p>
                  <p className="text-2xl font-bold">
                    {stats.totalSubmissions > 0
                      ? Math.round((stats.passedSubmissions / stats.totalSubmissions) * 100)
                      : 0}%
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Текущий streak</p>
                    <p className="text-2xl font-bold">{stats.currentStreak} дней</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Лучший streak</p>
                  <p className="text-2xl font-bold">{stats.longestStreak} дней</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Рейтинг в группе</p>
                  <p className="text-2xl font-bold">#{stats.groupRank || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Страниц в неделю</p>
                  <p className="text-2xl font-bold">{stats.averagePagesPerWeek.toFixed(1)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed KPI Statistics */}
      <DetailedStatsSection userId={user.id} />

      {/* Parents */}
      {user.childOf && user.childOf.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Родители
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {user.childOf.map(parent => (
                <div key={parent.id} className="flex items-center gap-3 p-2 rounded-lg border">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {[parent.firstName, parent.lastName].filter(Boolean).join(' ') || 'Без имени'}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {parent.phone}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function UstazView({ user }: { user: UserDetail }) {
  const activeGroups = user.ustazGroups?.filter(g => g.isActive) || []
  const inactiveCount = (user.ustazGroups?.length || 0) - activeGroups.length
  const totalStudents = activeGroups.reduce((acc, g) => acc + g._count.students, 0)

  return (
    <>
      {/* Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Активных групп</CardDescription>
            <CardTitle className="text-3xl">{activeGroups.length}</CardTitle>
            {inactiveCount > 0 && (
              <p className="text-xs text-muted-foreground">+ {inactiveCount} неактивных</p>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Всего студентов</CardDescription>
            <CardTitle className="text-3xl">{totalStudents}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Проверок</CardDescription>
            <CardTitle className="text-3xl">{user.statistics?.totalReviews || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Groups */}
      {activeGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Активные группы устаза
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название группы</TableHead>
                  <TableHead>Студентов</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeGroups.map(group => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{group._count.students}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/groups/${group.id}`}>
                          Открыть
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  )
}

function ParentView({ user, formatStageName }: {
  user: UserDetail
  formatStageName: (stage: StageNumber) => string
}) {
  return (
    <>
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Дети ({user.parentOf?.length || 0})
          </CardTitle>
          <CardDescription>
            Прогресс детей студента
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.parentOf && user.parentOf.length > 0 ? (
            <div className="space-y-4">
              {user.parentOf.map(child => {
                const childProgress = Math.round((child.currentPage / 602) * 100)
                return (
                  <div key={child.id} className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {[child.firstName, child.lastName].filter(Boolean).join(' ') || 'Без имени'}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {child.phone}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/users/${child.id}`}>
                          Подробнее
                        </Link>
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Страница:</span>
                        <p className="font-medium">{child.currentPage} / 602</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Строка:</span>
                        <p className="font-medium">{child.currentLine}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Этап:</span>
                        <p className="font-medium text-xs">{formatStageName(child.currentStage)}</p>
                      </div>
                    </div>
                    <div>
                      <Progress value={childProgress} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">{childProgress}% завершено</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Нет привязанных детей
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function AdminView({ user }: { user: UserDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Администратор</CardTitle>
        <CardDescription>
          Полный доступ к системе
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-muted-foreground">Всего действий:</span>
            <p className="font-medium">{user._count.tasks + user._count.submissions}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DetailedStatsSection({ userId }: { userId: string }) {
  const [period, setPeriod] = useState('week')
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [data, setData] = useState<DetailedStatsData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      try {
        let url = `/api/users/${userId}/stats?period=${period}`
        if (selectedMonth) {
          url = `/api/users/${userId}/stats?month=${selectedMonth}`
        }
        const res = await fetch(url)
        if (res.ok) {
          setData(await res.json())
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [userId, period, selectedMonth])

  const periodOptions = [
    { value: 'week', label: 'Эта неделя' },
    { value: 'last_week', label: 'Прошлая неделя' },
    { value: 'month', label: 'Этот месяц' },
    { value: 'last_month', label: 'Прошлый месяц' },
  ]

  const formatMonthLabel = (m: string) => {
    const [year, month] = m.split('-')
    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
    return `${months[parseInt(month) - 1]} ${year}`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Детальная статистика KPI
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={selectedMonth || period}
              onValueChange={(v) => {
                if (v.includes('-')) {
                  setSelectedMonth(v)
                  setPeriod('')
                } else {
                  setSelectedMonth(null)
                  setPeriod(v)
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Выберите период" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
                {data?.availableMonths && data.availableMonths.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      По месяцам
                    </div>
                    {data.availableMonths.slice(-12).reverse().map(m => (
                      <SelectItem key={m} value={m}>
                        {formatMonthLabel(m)}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        {data && (
          <CardDescription>
            {format(new Date(data.period.start), 'dd.MM.yyyy')} - {format(new Date(data.period.end), 'dd.MM.yyyy')}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border bg-emerald-50 dark:bg-emerald-950">
                <p className="text-sm text-muted-foreground">📖 Заучивание</p>
                <p className="text-2xl font-bold text-emerald-600">{data.summary.memorization.passed}</p>
                <p className="text-xs text-muted-foreground">заданий сдано из {data.summary.memorization.totalTasks}</p>
              </div>
              <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950">
                <p className="text-sm text-muted-foreground">🔄 Повторение</p>
                <p className="text-2xl font-bold text-blue-600">{data.summary.revision.passed}</p>
                <p className="text-xs text-muted-foreground">страниц сдано из {data.summary.revision.totalSubmitted}</p>
              </div>
              <div className="p-4 rounded-lg border bg-purple-50 dark:bg-purple-950">
                <p className="text-sm text-muted-foreground">📝 Переводы</p>
                <p className="text-2xl font-bold text-purple-600">{data.summary.mufradat.avgScore}%</p>
                <p className="text-xs text-muted-foreground">средний балл из {data.summary.mufradat.totalGames} игр</p>
              </div>
            </div>

            {/* Daily Table */}
            <div>
              <h4 className="font-semibold mb-3">По дням:</h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead className="text-center">📖 Заучивание</TableHead>
                      <TableHead className="text-center">🔄 Повторение</TableHead>
                      <TableHead className="text-center">📝 Переводы</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.daily.map(day => {
                      const dateObj = new Date(day.date)
                      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
                      return (
                        <TableRow key={day.date} className={isWeekend ? 'bg-muted/30' : ''}>
                          <TableCell className="font-medium">
                            {format(dateObj, 'dd.MM (EEE)', { locale: ru })}
                          </TableCell>
                          <TableCell className="text-center">
                            {day.memorization.tasks > 0 ? (
                              <span className={day.memorization.passed > 0 ? 'text-emerald-600' : 'text-yellow-600'}>
                                {day.memorization.passed > 0 ? '✅' : '⏳'} {day.memorization.passed}/{day.memorization.tasks}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {day.revision.submitted > 0 ? (
                              <span className={day.revision.passed >= day.revision.required ? 'text-emerald-600' : 'text-yellow-600'}>
                                {day.revision.passed >= day.revision.required ? '✅' : '📝'} {day.revision.passed}/{day.revision.required || day.revision.submitted}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {day.mufradat.games > 0 ? (
                              <span className={day.mufradat.avgScore >= 80 ? 'text-emerald-600' : 'text-yellow-600'}>
                                {day.mufradat.avgScore}% ({day.mufradat.games})
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Нет данных</p>
        )}
      </CardContent>
    </Card>
  )
}
