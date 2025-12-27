import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, ClipboardList, CheckCircle, Clock } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function UstazDashboard() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Get ustaz's groups
  const groups = await prisma.group.findMany({
    where: { ustazId: user.id },
    select: { id: true, name: true }
  })

  const groupIds = groups.map(g => g.id)

  const [
    totalStudents,
    pendingSubmissions,
    completedToday,
    activeTasksCount
  ] = await Promise.all([
    prisma.user.count({
      where: { studentGroups: { some: { groupId: { in: groupIds } } } }
    }),
    prisma.submission.count({
      where: {
        status: 'PENDING',
        task: { lesson: { groupId: { in: groupIds } } }
      }
    }),
    prisma.task.count({
      where: {
        status: 'PASSED',
        lesson: { groupId: { in: groupIds } },
        completedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    }),
    prisma.task.count({
      where: {
        status: 'IN_PROGRESS',
        lesson: { groupId: { in: groupIds } }
      }
    }),
  ])

  const stats = [
    {
      title: 'Мои группы',
      value: groups.length,
      icon: Users,
      color: 'text-blue-500',
    },
    {
      title: 'Студентов',
      value: totalStudents,
      icon: Users,
      color: 'text-green-500',
    },
    {
      title: 'На проверку',
      value: pendingSubmissions,
      icon: ClipboardList,
      color: 'text-orange-500',
    },
    {
      title: 'Сдано сегодня',
      value: completedToday,
      icon: CheckCircle,
      color: 'text-green-500',
    },
  ]

  // Get recent submissions
  const recentSubmissions = await prisma.submission.findMany({
    where: {
      status: 'PENDING',
      task: { lesson: { groupId: { in: groupIds } } }
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      task: {
        include: { page: { select: { pageNumber: true } } }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Добро пожаловать!</h2>
        <p className="text-muted-foreground">
          Обзор ваших групп и заданий на проверку
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <Card key={stat.title} className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <stat.icon className={`h-8 w-8 ${stat.color} opacity-80`} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Последние работы</CardTitle>
            <CardDescription>Ожидают вашей проверки</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSubmissions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Нет работ на проверку
              </p>
            ) : (
              <div className="space-y-3">
                {recentSubmissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent"
                  >
                    <div>
                      <div className="font-medium">
                        {sub.student.firstName || 'Студент'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Страница {sub.task.page.pageNumber}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(sub.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Мои группы</CardTitle>
            <CardDescription>Активные учебные группы</CardDescription>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                У вас пока нет групп
              </p>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <a
                    key={group.id}
                    href={`/ustaz/groups/${group.id}`}
                    className="block p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="font-medium">{group.name}</div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'только что'
  if (diffMins < 60) return `${diffMins} мин`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} ч`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays} д`
}
