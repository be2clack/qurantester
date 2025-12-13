import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { BookOpen, TrendingUp, TrendingDown, Minus, CheckCircle } from 'lucide-react'
import { redirect } from 'next/navigation'
import { QURAN_TOTAL_PAGES } from '@/lib/constants/quran'

export default async function ParentDashboard() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Get children
  const children = await prisma.user.findMany({
    where: {
      childOf: { some: { id: user.id } }
    },
    include: {
      statistics: true,
      studentGroup: {
        include: {
          ustaz: { select: { firstName: true, lastName: true } }
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

        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              У вас пока не добавлено детей.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Обратитесь к администратору для привязки детей к вашему аккаунту.
            </p>
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
                {child.studentGroup && (
                  <CardDescription>
                    Группа: {child.studentGroup.name}
                    {child.studentGroup.ustaz && (
                      <> · Устаз: {child.studentGroup.ustaz.firstName}</>
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
