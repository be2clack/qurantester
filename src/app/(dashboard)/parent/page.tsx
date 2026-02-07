import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { BookOpen, TrendingUp, TrendingDown, Minus, CheckCircle, UserPlus, Clock } from 'lucide-react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { QURAN_TOTAL_PAGES } from '@/lib/constants/quran'

export default async function ParentDashboard() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Get pending link requests count
  const pendingRequestsCount = await prisma.parentLinkRequest.count({
    where: { parentId: user.id, status: 'PENDING' }
  })

  // Get children (where current user is in their parent list)
  const children = await prisma.user.findMany({
    where: {
      childOf: { some: { id: user.id } }
    },
    include: {
      statistics: true,
      studentGroups: {
        include: {
          group: {
            include: {
              ustaz: { select: { firstName: true, lastName: true } }
            }
          }
        }
      }
    }
  })

  if (children.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Добро пожаловать!
          </h2>
          <p className="text-muted-foreground">
            Отслеживайте успеваемость ваших детей
          </p>
        </div>

        {pendingRequestsCount > 0 && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span>Заявок на привязку ожидает подтверждения: <b>{pendingRequestsCount}</b></span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="py-10 text-center">
            <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              У вас пока не добавлено детей.
            </p>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Найдите ребёнка по имени и отправьте заявку на привязку.
            </p>
            <Link
              href="/parent/children"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
            >
              <UserPlus className="h-4 w-4" />
              Добавить ребёнка
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Успеваемость детей
        </h2>
        <p className="text-muted-foreground">
          Отслеживайте прогресс ваших детей в изучении Корана
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {children.map((child) => {
          const progressPercent = ((child.currentPage - 1) / QURAN_TOTAL_PAGES) * 100
          const weekTrend = (child.statistics?.thisWeekProgress || 0) - (child.statistics?.lastWeekProgress || 0)

          return (
            <Card key={child.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {child.firstName || 'Ребенок'}
                  </CardTitle>
                  <Badge variant="outline">
                    {child.currentPage}-{child.currentLine}
                  </Badge>
                </div>
                {child.studentGroups[0]?.group && (
                  <CardDescription>
                    Группа: {child.studentGroups[0].group.name}
                    {child.studentGroups[0].group.ustaz && (
                      <> · Устаз: {child.studentGroups[0].group.ustaz.firstName}</>
                    )}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Прогресс</span>
                    <span>{progressPercent.toFixed(1)}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Страница {child.currentPage} из {QURAN_TOTAL_PAGES}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">
                        {child.statistics?.totalTasksCompleted || 0}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">выполнено</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      {weekTrend > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : weekTrend < 0 ? (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">
                        {weekTrend >= 0 ? '+' : ''}{weekTrend}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">за неделю</p>
                  </div>
                </div>

                {child.statistics?.globalRank && (
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Рейтинг</span>
                      <span className="font-medium">#{child.statistics.globalRank}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
