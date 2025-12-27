'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
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
  Search,
  Phone,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Pencil,
} from 'lucide-react'
import { StudentProgressEditDialog } from '@/components/student-progress-edit-dialog'

interface Student {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
  telegramUsername: string | null
  currentPage: number
  currentLine: number
  currentStage: string
  isActive: boolean
  group: {
    id: string
    name: string
  } | null
  tasks: {
    id: string
    status: string
    passedCount: number
    requiredCount: number
    failedCount: number
  }[]
  _count: {
    submissions: number
  }
}

export default function UstazStudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Progress edit dialog
  const [progressDialogOpen, setProgressDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)

  useEffect(() => {
    fetchStudents()
  }, [])

  async function fetchStudents() {
    try {
      const res = await fetch('/api/ustaz/students')
      const data = await res.json()
      setStudents(data || [])
    } catch (err) {
      console.error('Failed to fetch students:', err)
    } finally {
      setLoading(false)
    }
  }

  const openProgressDialog = (student: Student) => {
    setEditingStudent(student)
    setProgressDialogOpen(true)
  }

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'STAGE_1_1': return '1.1'
      case 'STAGE_1_2': return '1.2'
      case 'STAGE_2_1': return '2.1'
      case 'STAGE_2_2': return '2.2'
      case 'STAGE_3': return '3'
      default: return stage
    }
  }

  const getStageBadgeColor = (stage: string) => {
    if (stage.startsWith('STAGE_1')) return 'bg-blue-500'
    if (stage.startsWith('STAGE_2')) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getTaskProgress = (student: Student) => {
    const activeTask = student.tasks.find(t => t.status === 'IN_PROGRESS')
    if (!activeTask) return null
    return {
      passed: activeTask.passedCount,
      required: activeTask.requiredCount,
      failed: activeTask.failedCount,
      percent: Math.round((activeTask.passedCount / activeTask.requiredCount) * 100)
    }
  }

  const filteredStudents = students.filter(s => {
    const query = search.toLowerCase()
    return (
      s.firstName?.toLowerCase().includes(query) ||
      s.lastName?.toLowerCase().includes(query) ||
      s.phone.includes(query) ||
      s.group?.name.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Mobile Card Component
  const StudentCard = ({ student }: { student: Student }) => {
    const taskProgress = getTaskProgress(student)
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-medium">
                  {student.firstName?.[0]}{student.lastName?.[0]}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">
                  {student.firstName} {student.lastName}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {student.phone}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openProgressDialog(student)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress */}
          <div className="mt-3 flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{student.currentPage}-{student.currentLine}</span>
            </div>
            <Badge className={getStageBadgeColor(student.currentStage)}>
              {getStageLabel(student.currentStage)}
            </Badge>
            {student.group && (
              <Badge variant="outline">{student.group.name}</Badge>
            )}
          </div>

          {/* Task Progress */}
          {taskProgress && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>{taskProgress.passed}</span>
                {taskProgress.failed > 0 && (
                  <>
                    <XCircle className="h-3 w-3 text-red-500 ml-2" />
                    <span>{taskProgress.failed}</span>
                  </>
                )}
                <span className="text-muted-foreground">/ {taskProgress.required}</span>
              </div>
              <Progress value={taskProgress.percent} className="h-1.5" />
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Мои студенты</h1>
          <p className="text-sm text-muted-foreground">Всего: {students.length} студентов</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по имени, телефону или группе..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search ? 'Студенты не найдены' : 'У вас пока нет студентов'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="md:hidden space-y-3">
            {filteredStudents.map((student) => (
              <StudentCard key={student.id} student={student} />
            ))}
          </div>

          {/* Desktop: Table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Студент</TableHead>
                    <TableHead>Группа</TableHead>
                    <TableHead className="text-center">Страница</TableHead>
                    <TableHead className="text-center">Этап</TableHead>
                    <TableHead>Прогресс задания</TableHead>
                    <TableHead className="text-center">Сдачи</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => {
                    const taskProgress = getTaskProgress(student)
                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium">
                                {student.firstName?.[0]}{student.lastName?.[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">
                                {student.firstName} {student.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {student.phone}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {student.group ? (
                            <Badge variant="outline">{student.group.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{student.currentPage}-{student.currentLine}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={getStageBadgeColor(student.currentStage)}>
                            {getStageLabel(student.currentStage)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {taskProgress ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-xs">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                <span>{taskProgress.passed}</span>
                                {taskProgress.failed > 0 && (
                                  <>
                                    <XCircle className="h-3 w-3 text-red-500 ml-2" />
                                    <span>{taskProgress.failed}</span>
                                  </>
                                )}
                                <span className="text-muted-foreground">/ {taskProgress.required}</span>
                              </div>
                              <Progress value={taskProgress.percent} className="h-1.5" />
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Нет активного</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">
                            {student._count.submissions}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openProgressDialog(student)}
                            title="Редактировать прогресс"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
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

      {/* Progress Edit Dialog */}
      <StudentProgressEditDialog
        open={progressDialogOpen}
        onOpenChange={setProgressDialogOpen}
        student={editingStudent}
        onSuccess={fetchStudents}
      />
    </div>
  )
}
