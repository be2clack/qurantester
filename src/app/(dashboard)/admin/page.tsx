import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, GraduationCap, BookOpen, ClipboardList, CheckCircle, XCircle } from 'lucide-react'

export default async function AdminDashboard() {
  const [
    userCounts,
    groupCount,
    activeTasksCount,
    pendingSubmissions,
    completedTasks,
    failedTasks
  ] = await Promise.all([
    prisma.user.groupBy({
      by: ['role'],
      _count: true
    }),
    prisma.group.count(),
    prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.submission.count({ where: { status: 'PENDING' } }),
    prisma.task.count({ where: { status: 'PASSED' } }),
    prisma.task.count({ where: { status: 'FAILED' } }),
  ])

  const getUserCount = (role: string) =>
    userCounts.find(u => u.role === role)?._count || 0

  const stats = [
    {
      title: 'Администраторы',
      value: getUserCount('ADMIN'),
      icon: Users,
      color: 'text-red-500',
    },
    {
      title: 'Устазы',
      value: getUserCount('USTAZ'),
      icon: GraduationCap,
      color: 'text-blue-500',
    },
    {
      title: 'Студенты',
      value: getUserCount('STUDENT'),
      icon: BookOpen,
      color: 'text-green-500',
    },
    {
      title: 'Родители',
      value: getUserCount('PARENT'),
      icon: Users,
      color: 'text-purple-500',
    },
  ]

  const taskStats = [
    {
      title: 'Групп',
      value: groupCount,
      icon: GraduationCap,
      color: 'text-blue-500',
    },
    {
      title: 'Активных заданий',
      value: activeTasksCount,
      icon: ClipboardList,
      color: 'text-orange-500',
    },
    {
      title: 'Ожидают проверки',
      value: pendingSubmissions,
      icon: ClipboardList,
      color: 'text-yellow-500',
    },
    {
      title: 'Выполнено заданий',
      value: completedTasks,
      icon: CheckCircle,
      color: 'text-green-500',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Обзор</h2>
        <p className="text-muted-foreground">
          Статистика системы изучения Корана
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {taskStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
            <CardDescription>Часто используемые операции</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a href="/admin/users" className="block p-3 rounded-lg hover:bg-accent transition-colors">
              <div className="font-medium">Добавить пользователя</div>
              <div className="text-sm text-muted-foreground">Создать нового студента, устаза или родителя</div>
            </a>
            <a href="/admin/groups" className="block p-3 rounded-lg hover:bg-accent transition-colors">
              <div className="font-medium">Создать группу</div>
              <div className="text-sm text-muted-foreground">Добавить новую учебную группу</div>
            </a>
            <a href="/admin/lessons" className="block p-3 rounded-lg hover:bg-accent transition-colors">
              <div className="font-medium">Настроить урок</div>
              <div className="text-sm text-muted-foreground">Изменить параметры уроков</div>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Статистика заданий</CardTitle>
            <CardDescription>Общий прогресс системы</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Выполнено</span>
                </div>
                <span className="font-bold">{completedTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>Не сдано</span>
                </div>
                <span className="font-bold">{failedTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-orange-500" />
                  <span>В процессе</span>
                </div>
                <span className="font-bold">{activeTasksCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
