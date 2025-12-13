'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  BookOpen,
  Calendar
} from 'lucide-react'
import { TaskStatus, StageNumber } from '@prisma/client'
import { formatDistanceToNow, format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface Task {
  id: string
  status: TaskStatus
  stage: StageNumber
  startLine: number
  endLine: number
  requiredCount: number
  currentCount: number
  passedCount: number
  deadline: string
  createdAt: string
  page: {
    pageNumber: number
    totalLines: number
  }
  _count: {
    submissions: number
  }
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')

  useEffect(() => {
    fetchTasks()
  }, [tab])

  async function fetchTasks() {
    setLoading(true)
    try {
      let url = '/api/tasks?limit=50'
      if (tab !== 'all') {
        url += `&status=${tab.toUpperCase()}`
      }
      const res = await fetch(url)
      const data = await res.json()
      setTasks(data.items || [])
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'IN_PROGRESS':
        return <Badge variant="outline" className="border-blue-500 text-blue-500"><Clock className="mr-1 h-3 w-3" />В процессе</Badge>
      case 'PASSED':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" />Сдано</Badge>
      case 'FAILED':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Не сдано</Badge>
    }
  }

  const getStageLabel = (stage: StageNumber) => {
    switch (stage) {
      case 'STAGE_1_1': return 'Этап 1.1 (изучение 1-7)'
      case 'STAGE_1_2': return 'Этап 1.2 (повторение 1-7)'
      case 'STAGE_2_1': return 'Этап 2.1 (изучение 8-15)'
      case 'STAGE_2_2': return 'Этап 2.2 (повторение 8-15)'
      case 'STAGE_3': return 'Этап 3 (страница)'
    }
  }

  const getLinesLabel = (task: Task) => {
    if (task.startLine === task.endLine) {
      return `Строка ${task.startLine}`
    }
    return `Строки ${task.startLine}-${task.endLine}`
  }

  const isOverdue = (task: Task) => {
    return task.status === 'IN_PROGRESS' && new Date(task.deadline) < new Date()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Мои задания</h1>
        <p className="text-muted-foreground">История всех заданий по изучению Корана</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">Все</TabsTrigger>
          <TabsTrigger value="in_progress">
            <Clock className="mr-2 h-4 w-4" />
            В процессе
          </TabsTrigger>
          <TabsTrigger value="passed">
            <CheckCircle className="mr-2 h-4 w-4" />
            Выполненные
          </TabsTrigger>
          <TabsTrigger value="failed">
            <XCircle className="mr-2 h-4 w-4" />
            Не сданные
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Нет заданий</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => (
                <Card key={task.id} className={isOverdue(task) ? 'border-destructive' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-lg font-bold">{task.page.pageNumber}</span>
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            Страница {task.page.pageNumber}
                          </CardTitle>
                          <CardDescription>
                            {getLinesLabel(task)} · {getStageLabel(task.stage)}
                          </CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(task.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Прогресс</p>
                        <p className="text-lg font-bold">
                          {task.passedCount}/{task.requiredCount}
                        </p>
                        <div className="mt-1 h-1.5 bg-background rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(task.passedCount / task.requiredCount) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Всего сдач</p>
                        <p className="text-lg font-bold">{task._count.submissions}</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Создано</p>
                        <p className="text-sm font-medium">
                          {format(new Date(task.createdAt), 'd MMM yyyy', { locale: ru })}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg ${isOverdue(task) ? 'bg-destructive/10' : 'bg-muted'}`}>
                        <p className="text-xs text-muted-foreground">Дедлайн</p>
                        <p className={`text-sm font-medium ${isOverdue(task) ? 'text-destructive' : ''}`}>
                          {format(new Date(task.deadline), 'd MMM yyyy', { locale: ru })}
                        </p>
                        {task.status === 'IN_PROGRESS' && (
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(task.deadline), { addSuffix: true, locale: ru })}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
