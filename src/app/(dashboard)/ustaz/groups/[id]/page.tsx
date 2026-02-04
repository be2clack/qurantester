'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Loader2,
  Users,
  BookOpen,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  ClipboardList,
} from 'lucide-react'
import Link from 'next/link'

interface Student {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
  currentPage: number
  currentLine: number
  currentStage: string
  _count: {
    tasks: number
  }
  tasks: {
    id: string
    status: string
    passedCount: number
    requiredCount: number
    createdAt: string
  }[]
}

interface Group {
  id: string
  name: string
  description: string | null
  level: string
  lessonType: string
  isActive: boolean
  _count: {
    students: number
  }
  students: Student[]
}

export default function UstazGroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchGroup()
  }, [groupId])

  async function fetchGroup() {
    try {
      const res = await fetch(`/api/ustaz/groups/${groupId}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Группа не найдена')
        } else {
          setError('Ошибка загрузки группы')
        }
        return
      }
      const data = await res.json()
      setGroup(data)
    } catch (err) {
      setError('Ошибка загрузки группы')
      console.error('Failed to fetch group:', err)
    } finally {
      setLoading(false)
    }
  }

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'LEVEL_1': return 'Уровень 1'
      case 'LEVEL_2': return 'Уровень 2'
      case 'LEVEL_3': return 'Уровень 3'
      default: return level
    }
  }

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'STAGE_1_1': return 'Этап 1.1'
      case 'STAGE_1_2': return 'Этап 1.2'
      case 'STAGE_2_1': return 'Этап 2.1'
      case 'STAGE_2_2': return 'Этап 2.2'
      case 'STAGE_3': return 'Этап 3'
      default: return stage
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'MEMORIZATION': return 'Заучивание'
      case 'REVISION': return 'Повторение'
      case 'TRANSLATION': return 'Перевод'
      default: return type
    }
  }

  const getStudentProgress = (student: Student) => {
    return Math.round((student.currentPage / 604) * 100)
  }

  const getActiveTask = (student: Student) => {
    return student.tasks?.find(t => t.status === 'IN_PROGRESS')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <p className="text-muted-foreground">{error || 'Группа не найдена'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-muted-foreground">{group.description}</p>
        </div>
        <Link href={`/ustaz/groups/${groupId}/report`}>
          <Button variant="outline" size="sm">
            <ClipboardList className="h-4 w-4 mr-2" />
            Отчёт
          </Button>
        </Link>
      </div>

      {/* Group stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{group._count.students}</p>
                <p className="text-xs text-muted-foreground">Студентов</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{getLevelLabel(group.level)}</p>
                <p className="text-xs text-muted-foreground">Уровень</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{getTypeLabel(group.lessonType)}</p>
                <p className="text-xs text-muted-foreground">Тип</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {group.isActive ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-2xl font-bold">{group.isActive ? 'Активна' : 'Неактивна'}</p>
                <p className="text-xs text-muted-foreground">Статус</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students table */}
      <Card>
        <CardHeader>
          <CardTitle>Студенты</CardTitle>
          <CardDescription>
            Прогресс и активные задания студентов группы
          </CardDescription>
        </CardHeader>
        <CardContent>
          {group.students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              В этой группе пока нет студентов
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Страница</TableHead>
                  <TableHead>Этап</TableHead>
                  <TableHead>Прогресс</TableHead>
                  <TableHead>Активное задание</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.students.map((student) => {
                  const activeTask = getActiveTask(student)
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        {student.firstName || ''} {student.lastName || ''}
                        {!student.firstName && !student.lastName && (
                          <span className="text-muted-foreground">Без имени</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {student.phone}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          {student.currentPage}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getStageLabel(student.currentStage)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress value={getStudentProgress(student)} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {getStudentProgress(student)}%
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {activeTask ? (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm">
                              {activeTask.passedCount}/{activeTask.requiredCount}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
