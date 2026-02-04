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

const stageShort: Record<string, string> = {
  STAGE_1_1: '1.1',
  STAGE_1_2: '1.2',
  STAGE_2_1: '2.1',
  STAGE_2_2: '2.2',
  STAGE_3: '3',
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

  const getStageLabel = (stage: string) => stageShort[stage] || stage

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

  const getStageBadgeColor = (stage: string) => {
    if (stage.startsWith('STAGE_1')) return 'bg-blue-500'
    if (stage.startsWith('STAGE_2')) return 'bg-yellow-500'
    return 'bg-green-500'
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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-2xl font-bold truncate">{group.name}</h1>
          {group.description && (
            <p className="text-sm text-muted-foreground truncate">{group.description}</p>
          )}
        </div>
        <Link href={`/ustaz/groups/${groupId}/report`}>
          <Button variant="outline" size="sm">
            <ClipboardList className="h-4 w-4 mr-1 md:mr-2" />
            Отчёт
          </Button>
        </Link>
      </div>

      {/* Group stats - 2x2 on mobile, 4 in row on desktop */}
      <div className="grid grid-cols-2 gap-2 md:gap-4 md:grid-cols-4">
        <Card className="p-3 md:p-0">
          <CardContent className="p-0 md:pt-6 md:px-6 md:pb-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
              <div>
                <p className="text-xl md:text-2xl font-bold">{group._count.students}</p>
                <p className="text-[11px] md:text-xs text-muted-foreground">Студентов</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="p-3 md:p-0">
          <CardContent className="p-0 md:pt-6 md:px-6 md:pb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-purple-500" />
              <div>
                <p className="text-xl md:text-2xl font-bold">{getTypeLabel(group.lessonType)}</p>
                <p className="text-[11px] md:text-xs text-muted-foreground">Тип</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="p-3 md:p-0">
          <CardContent className="p-0 md:pt-6 md:px-6 md:pb-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
              <div>
                <p className="text-xl md:text-2xl font-bold">
                  {group.students.length > 0
                    ? Math.round(group.students.reduce((s, st) => s + st.currentPage, 0) / group.students.length)
                    : 0}
                </p>
                <p className="text-[11px] md:text-xs text-muted-foreground">Сред. страница</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="p-3 md:p-0">
          <CardContent className="p-0 md:pt-6 md:px-6 md:pb-6">
            <div className="flex items-center gap-2">
              {group.isActive ? (
                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-xl md:text-2xl font-bold">{group.isActive ? 'Активна' : 'Неактивна'}</p>
                <p className="text-[11px] md:text-xs text-muted-foreground">Статус</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Students */}
      {group.students.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            В этой группе пока нет студентов
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: Student cards */}
          <div className="md:hidden space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground px-1">
              Студенты ({group.students.length})
            </h3>
            {group.students.map((student) => {
              const activeTask = getActiveTask(student)
              return (
                <Card key={student.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {student.firstName || ''} {student.lastName || ''}
                        {!student.firstName && !student.lastName && (
                          <span className="text-muted-foreground">Без имени</span>
                        )}
                      </span>
                      <Badge className={getStageBadgeColor(student.currentStage)}>
                        {getStageLabel(student.currentStage)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        Стр. {student.currentPage}
                      </span>
                      {activeTask && (
                        <span className="flex items-center gap-1 text-yellow-600">
                          <Clock className="h-3 w-3" />
                          {activeTask.passedCount}/{activeTask.requiredCount}
                        </span>
                      )}
                    </div>
                    <Progress value={getStudentProgress(student)} className="h-1.5" />
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Desktop: Students table */}
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle>Студенты</CardTitle>
              <CardDescription>
                Прогресс и активные задания студентов группы
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                            Этап {getStageLabel(student.currentStage)}
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
