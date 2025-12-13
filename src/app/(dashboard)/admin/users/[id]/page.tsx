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
import { ArrowLeft, Phone, User, BookOpen, Users, GraduationCap, Loader2, Calendar, Target, TrendingUp, Award } from 'lucide-react'
import { RoleBadge } from '@/components/users/role-badge'
import Link from 'next/link'
import { UserRole, StageNumber } from '@prisma/client'

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

interface UserDetail {
  id: string
  phone: string
  firstName: string | null
  lastName: string | null
  telegramUsername: string | null
  telegramId: string | null
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch(`/api/users/${params.id}`)
        if (res.ok) {
          const data = await res.json()
          setUser(data)
        }
      } catch (err) {
        console.error('Failed to fetch user:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
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
        <StudentView user={user} progressPercent={progressPercent} formatStageName={formatStageName} />
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

function StudentView({ user, progressPercent, formatStageName }: {
  user: UserDetail
  progressPercent: number
  formatStageName: (stage: StageNumber) => string
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
            <CardDescription>Всего заданий</CardDescription>
            <CardTitle className="text-3xl">{user._count.tasks}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats?.totalTasksCompleted || 0} завершено
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
  const totalStudents = user.ustazGroups?.reduce((acc, g) => acc + g._count.students, 0) || 0

  return (
    <>
      {/* Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Всего групп</CardDescription>
            <CardTitle className="text-3xl">{user.ustazGroups?.length || 0}</CardTitle>
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
      {user.ustazGroups && user.ustazGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Группы устаза
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
                {user.ustazGroups.map(group => (
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
