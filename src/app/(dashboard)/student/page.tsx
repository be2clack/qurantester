import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Target, TrendingUp, Clock, CheckCircle } from 'lucide-react'
import { redirect } from 'next/navigation'
import { STAGES, QURAN_TOTAL_PAGES } from '@/lib/constants/quran'

export default async function StudentDashboard() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Get current task
  const currentTask = await prisma.task.findFirst({
    where: {
      studentId: user.id,
      status: 'IN_PROGRESS',
    },
    include: {
      page: true,
      lesson: true,
      _count: { select: { submissions: true } }
    }
  })

  // Get statistics
  const stats = await prisma.userStatistics.findUnique({
    where: { userId: user.id }
  })

  // Get recent completed tasks
  const recentTasks = await prisma.task.findMany({
    where: {
      studentId: user.id,
      status: 'PASSED'
    },
    include: { page: true },
    orderBy: { completedAt: 'desc' },
    take: 5
  })

  const progressPercent = ((user.currentPage - 1) / QURAN_TOTAL_PAGES) * 100
  const stageInfo = STAGES[user.currentStage as keyof typeof STAGES]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Ассаляму алейкум, {user.firstName || 'студент'}!
        </h2>
        <p className="text-muted-foreground">
          Ваш текущий прогресс в изучении Корана
        </p>
      </div>

      {/* Current Position Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Текущая позиция
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">
                {user.currentPage}
              </div>
              <div className="text-sm text-muted-foreground">страница</div>
            </div>
            <div className="text-3xl text-muted-foreground">:</div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">
                {user.currentLine}
              </div>
              <div className="text-sm text-muted-foreground">строка</div>
            </div>
            <div className="ml-auto">
              <Badge variant="secondary" className="text-sm">
                {stageInfo.name}
              </Badge>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Общий прогресс</span>
              <span>{progressPercent.toFixed(1)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {user.currentPage - 1} из {QURAN_TOTAL_PAGES} страниц пройдено
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Выполнено
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalTasksCompleted || 0}
            </div>
            <p className="text-xs text-muted-foreground">заданий</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Эта неделя
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.thisWeekProgress || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.lastWeekProgress !== undefined && (
                <>
                  {stats.thisWeekProgress >= stats.lastWeekProgress ? '+' : ''}
                  {(stats?.thisWeekProgress || 0) - (stats?.lastWeekProgress || 0)} к прошлой
                </>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Рейтинг
            </CardTitle>
            <Target className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              #{stats?.globalRank || '-'}
            </div>
            <p className="text-xs text-muted-foreground">общий</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Среднее время
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.averageCompletionTime
                ? `${stats.averageCompletionTime.toFixed(1)}ч`
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">на страницу</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Current Task */}
        <Card>
          <CardHeader>
            <CardTitle>Текущее задание</CardTitle>
            <CardDescription>Ваше активное задание</CardDescription>
          </CardHeader>
          <CardContent>
            {currentTask ? (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      Страница {currentTask.page.pageNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {currentTask.startLine === currentTask.endLine
                        ? `Строка ${currentTask.startLine}`
                        : `Строки ${currentTask.startLine}-${currentTask.endLine}`}
                    </p>
                  </div>
                  <Badge>{currentTask.lesson.name}</Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Прогресс</span>
                    <span>{currentTask.currentCount}/{currentTask.requiredCount}</span>
                  </div>
                  <Progress
                    value={(currentTask.currentCount / currentTask.requiredCount) * 100}
                    className="h-2"
                  />
                </div>

                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Принято: {currentTask.passedCount}</span>
                  <span>Отклонено: {currentTask.failedCount}</span>
                </div>

                <p className="text-sm text-muted-foreground">
                  Отправьте голосовое сообщение или кружок через бота @QuranTesterBot
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Нет активных заданий. Обратитесь к устазу.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Completed */}
        <Card>
          <CardHeader>
            <CardTitle>Последние задания</CardTitle>
            <CardDescription>Успешно выполненные</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTasks.length === 0 ? (
              <p className="text-muted-foreground">
                Пока нет выполненных заданий
              </p>
            ) : (
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Страница {task.page.pageNumber}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {task.passedCount}/{task.requiredCount}
                    </span>
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
