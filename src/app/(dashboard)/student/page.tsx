import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Target, TrendingUp, Clock, CheckCircle, User, Users, GraduationCap } from 'lucide-react'
import { redirect } from 'next/navigation'
import { STAGES, QURAN_TOTAL_PAGES } from '@/lib/constants/quran'
import { LessonType } from '@prisma/client'
import Link from 'next/link'

const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  MEMORIZATION: 'Заучивание',
  REVISION: 'Повторение',
  TRANSLATION: 'Перевод',
}

const LESSON_TYPE_COLORS: Record<LessonType, string> = {
  MEMORIZATION: 'bg-emerald-100 text-emerald-800',
  REVISION: 'bg-blue-100 text-blue-800',
  TRANSLATION: 'bg-purple-100 text-purple-800',
}

export default async function StudentDashboard() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Get student groups with progress
  const studentGroups = await prisma.studentGroup.findMany({
    where: { studentId: user.id, isActive: true },
    include: {
      group: {
        include: {
          ustaz: {
            select: { id: true, firstName: true, lastName: true, phone: true }
          },
          _count: { select: { students: true } }
        }
      }
    }
  })

  // Get ustaz info from primary group (not from legacy user.ustazId field)
  const ustaz = studentGroups[0]?.group?.ustaz || null

  // Get all active tasks
  const activeTasks = await prisma.task.findMany({
    where: {
      studentId: user.id,
      status: 'IN_PROGRESS',
    },
    include: {
      page: true,
      group: true,
      _count: { select: { submissions: true } }
    },
    orderBy: { createdAt: 'desc' }
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
    include: { page: true, group: true },
    orderBy: { completedAt: 'desc' },
    take: 5
  })

  // Calculate overall progress (average across groups)
  const hasGroups = studentGroups.length > 0
  const avgPage = hasGroups
    ? Math.round(studentGroups.reduce((acc, sg) => acc + sg.currentPage, 0) / studentGroups.length)
    : user.currentPage
  const progressPercent = ((avgPage - 1) / QURAN_TOTAL_PAGES) * 100

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

      {/* Ustaz Info Card */}
      {ustaz && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Ваш устаз</p>
                <p className="font-semibold">
                  {ustaz.firstName} {ustaz.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{ustaz.phone}</p>
              </div>
              <Badge variant="outline" className="hidden sm:inline-flex">
                <Users className="mr-1 h-3 w-3" />
                {studentGroups.length} групп
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Groups Progress */}
      {hasGroups && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {studentGroups.map((sg) => {
            const stageInfo = STAGES[sg.currentStage as keyof typeof STAGES]
            const groupProgress = ((sg.currentPage - 1) / QURAN_TOTAL_PAGES) * 100
            const activeTask = activeTasks.find(t => t.groupId === sg.groupId)

            return (
              <Card key={sg.id} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 ${LESSON_TYPE_COLORS[sg.group.lessonType]?.replace('text-', 'bg-').split(' ')[0] || 'bg-primary'}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{sg.group.name}</CardTitle>
                    <Badge className={LESSON_TYPE_COLORS[sg.group.lessonType]}>
                      {LESSON_TYPE_LABELS[sg.group.lessonType]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-2xl font-bold text-primary">{sg.currentPage}</span>
                      <span className="text-muted-foreground"> стр.</span>
                    </div>
                    <div className="text-muted-foreground">:</div>
                    <div>
                      <span className="text-2xl font-bold text-primary">{sg.currentLine}</span>
                      <span className="text-muted-foreground"> строка</span>
                    </div>
                    <Badge variant="secondary" className="ml-auto">
                      {stageInfo?.name || sg.currentStage}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Прогресс</span>
                      <span>{groupProgress.toFixed(1)}%</span>
                    </div>
                    <Progress value={groupProgress} className="h-1.5" />
                  </div>

                  {activeTask && (
                    <div className="rounded-md bg-muted/50 p-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">Активное задание</span>
                        <span>{activeTask.passedCount}/{activeTask.requiredCount}</span>
                      </div>
                      <Progress
                        value={(activeTask.passedCount / activeTask.requiredCount) * 100}
                        className="mt-1 h-1"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* No Groups Message */}
      {!hasGroups && (
        <Card>
          <CardContent className="py-8 text-center">
            <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">Нет групп</h3>
            <p className="text-sm text-muted-foreground">
              Вы пока не добавлены ни в одну группу. Обратитесь к устазу.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Выполнено</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTasksCompleted || 0}</div>
            <p className="text-xs text-muted-foreground">заданий</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Эта неделя</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.thisWeekProgress || 0}</div>
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
            <CardTitle className="text-sm font-medium">Рейтинг</CardTitle>
            <Target className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">#{stats?.globalRank || '-'}</div>
            <p className="text-xs text-muted-foreground">общий</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Среднее время</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.averageCompletionTime
                ? `${stats.averageCompletionTime.toFixed(1)}ч`
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">на задание</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Active Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Активные задания</CardTitle>
            <CardDescription>Задания в процессе выполнения</CardDescription>
          </CardHeader>
          <CardContent>
            {activeTasks.length === 0 ? (
              <p className="text-muted-foreground">
                Нет активных заданий
              </p>
            ) : (
              <div className="space-y-4">
                {activeTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          Страница {task.page.pageNumber}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {task.startLine === task.endLine
                            ? `Строка ${task.startLine}`
                            : `Строки ${task.startLine}-${task.endLine}`}
                        </p>
                      </div>
                      {task.group && (
                        <Badge className={LESSON_TYPE_COLORS[task.group.lessonType]}>
                          {LESSON_TYPE_LABELS[task.group.lessonType]}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Прогресс</span>
                        <span>{task.passedCount}/{task.requiredCount}</span>
                      </div>
                      <Progress
                        value={(task.passedCount / task.requiredCount) * 100}
                        className="h-2"
                      />
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Принято: {task.passedCount}</span>
                      <span>Отклонено: {task.failedCount}</span>
                    </div>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground text-center pt-2">
                  Отправьте через бота @QuranTesterBot
                </p>
              </div>
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
                      {task.group && (
                        <Badge variant="outline" className="text-xs">
                          {LESSON_TYPE_LABELS[task.group.lessonType]}
                        </Badge>
                      )}
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
