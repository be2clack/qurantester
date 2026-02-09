import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, GraduationCap, BookOpen, ClipboardList, CheckCircle, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react'

export default async function AdminDashboard() {
  const [
    userCounts,
    groupCount,
    activeTasksCount,
    pendingSubmissions,
    completedTasks,
    failedTasks,
    orphanedTaskStudents,
    studentsWithoutTasks,
    cancelledOrphanedCount,
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
    // Students with orphaned tasks (task stage/line doesn't match student's current position)
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT t."studentId") as count
      FROM "Task" t
      JOIN "User" u ON t."studentId" = u.id
      WHERE t.status IN ('IN_PROGRESS', 'FAILED')
      AND (
        t.stage != u."currentStage"::text::"StageNumber"
        OR (
          t.stage IN ('STAGE_1_1', 'STAGE_2_1')
          AND t."startLine" != u."currentLine"
        )
      )
    `.then(r => Number(r[0]?.count ?? 0)).catch(() => 0),
    // Active students without any active task
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM "User" u
      WHERE u.role = 'STUDENT'
      AND u."isActive" = true
      AND EXISTS (SELECT 1 FROM "StudentGroup" sg WHERE sg."studentId" = u.id)
      AND NOT EXISTS (
        SELECT 1 FROM "Task" t
        WHERE t."studentId" = u.id AND t.status = 'IN_PROGRESS'
      )
    `.then(r => Number(r[0]?.count ?? 0)).catch(() => 0),
    // Recently auto-cancelled orphaned tasks (last 24h)
    prisma.task.count({
      where: {
        status: 'CANCELLED',
        updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    }),
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      {/* Health check */}
      <Card className={orphanedTaskStudents > 0 ? 'border-amber-500/50' : 'border-green-500/50'}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Состояние системы</CardTitle>
            <CardDescription>Автоматическая проверка прогресса студентов</CardDescription>
          </div>
          {orphanedTaskStudents > 0
            ? <AlertTriangle className="h-5 w-5 text-amber-500" />
            : <ShieldCheck className="h-5 w-5 text-green-500" />
          }
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orphanedTaskStudents > 0 ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-600 dark:text-amber-400">
                  Студенты с устаревшими заданиями
                </span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{orphanedTaskStudents}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-600 dark:text-green-400">
                  Устаревших заданий нет
                </span>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Студенты без активного задания</span>
              <span className="font-bold">{studentsWithoutTasks}</span>
            </div>
            {cancelledOrphanedCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Автоматически исправлено (24ч)</span>
                <span className="font-bold text-blue-500">{cancelledOrphanedCount}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-1">
              Устаревшие задания автоматически отменяются при следующем запуске крон-задачи.
              Новые задания создаются для текущей позиции студента.
            </p>
          </div>
        </CardContent>
      </Card>

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
