'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Search, Phone, Loader2, Eye, ChevronLeft, ChevronRight, BookOpen, CheckCircle2, GraduationCap, Users } from 'lucide-react'
import Link from 'next/link'
import { StageNumber } from '@prisma/client'

interface Ustaz {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
  _count?: { ustazGroups: number }
}

interface StudentGroup {
  group: {
    id: string
    name: string
    lessonType: string
  }
  currentPage: number
  currentLine: number
  currentStage: StageNumber
}

interface Student {
  id: string
  phone: string
  firstName: string | null
  lastName: string | null
  telegramUsername: string | null
  isActive: boolean
  currentPage: number
  currentLine: number
  currentStage: StageNumber
  ustazId: string | null
  ustaz: Ustaz | null
  studentGroups: StudentGroup[]
  taskCompletion: number
  taskPassedCount: number
  taskRequiredCount: number
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [ustazList, setUstazList] = useState<Ustaz[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [ustazFilter, setUstazFilter] = useState<string>('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  // Ustaz assignment dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        role: 'STUDENT',
      })
      if (search) params.set('search', search)
      if (ustazFilter) params.set('ustazId', ustazFilter)

      const res = await fetch(`/api/users?${params}`)
      const data = await res.json()
      setStudents(data.items || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Failed to fetch students:', err)
    } finally {
      setLoading(false)
    }
  }, [page, search, ustazFilter])

  const fetchUstazList = useCallback(async () => {
    try {
      const res = await fetch('/api/users?role=USTAZ&limit=100')
      const data = await res.json()
      setUstazList(data.items || [])
    } catch (err) {
      console.error('Failed to fetch ustaz list:', err)
    }
  }, [])

  useEffect(() => {
    fetchStudents()
    fetchUstazList()
  }, [fetchStudents, fetchUstazList])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchStudents()
  }

  const openAssignDialog = (student: Student) => {
    setSelectedStudent(student)
    setAssignDialogOpen(true)
    setAssignError('')
  }

  const assignUstaz = async (ustazId: string | null) => {
    if (!selectedStudent) return

    setAssigning(true)
    setAssignError('')

    try {
      const res = await fetch(`/api/users/${selectedStudent.id}/ustaz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ustazId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to assign ustaz')
      }

      // Refresh the list
      await fetchStudents()
      setAssignDialogOpen(false)
      setSelectedStudent(null)
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Error assigning ustaz')
    } finally {
      setAssigning(false)
    }
  }

  const totalPages = Math.ceil(total / 20)

  function getInitials(firstName?: string | null, lastName?: string | null): string {
    const first = firstName?.charAt(0)?.toUpperCase() || ''
    const last = lastName?.charAt(0)?.toUpperCase() || ''
    return first + last || 'S'
  }

  function getStageLabel(stage: StageNumber): string {
    switch (stage) {
      case 'STAGE_1_1': return '1.1'
      case 'STAGE_1_2': return '1.2'
      case 'STAGE_2_1': return '2.1'
      case 'STAGE_2_2': return '2.2'
      case 'STAGE_3': return '3'
      default: return stage
    }
  }

  function getStudentName(student: Student): string {
    return student.firstName || student.lastName
      ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
      : 'Без имени'
  }

  function getUstazName(ustaz: Ustaz | null): string {
    if (!ustaz) return 'Не назначен'
    return ustaz.firstName || ustaz.lastName
      ? `${ustaz.firstName || ''} ${ustaz.lastName || ''}`.trim()
      : ustaz.phone
  }

  // Mobile Card Component
  const StudentCard = ({ student }: { student: Student }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(student.firstName, student.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{getStudentName(student)}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {student.phone}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href={`/admin/users/${student.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Progress */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{student.currentPage}-{student.currentLine}</span>
              <Badge variant="outline" className="ml-1 text-xs">
                {getStageLabel(student.currentStage)}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{student.taskPassedCount}/{student.taskRequiredCount}</span>
            </div>
          </div>
          <Progress value={student.taskCompletion} className="h-2" />
        </div>

        {/* Ustaz */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {student.ustaz ? getUstazName(student.ustaz) : <span className="text-muted-foreground">Не назначен</span>}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => openAssignDialog(student)}>
            {student.ustaz ? 'Сменить' : 'Назначить'}
          </Button>
        </div>

        {/* Groups */}
        {student.studentGroups && student.studentGroups.length > 0 && (
          <div className="mt-2">
            <div className="flex flex-wrap gap-1">
              {student.studentGroups.map((sg) => (
                <Badge key={sg.group.id} variant="secondary" className="text-xs">
                  {sg.group.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6" />
          Студенты
        </h2>
        <p className="text-sm text-muted-foreground">
          Всего: {total} студентов
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 md:pt-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени или телефону..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={ustazFilter || 'all'} onValueChange={(v) => { setUstazFilter(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Все устазы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все устазы</SelectItem>
                  <SelectItem value="none">Без устаза</SelectItem>
                  {ustazList.map((ustaz) => (
                    <SelectItem key={ustaz.id} value={ustaz.id}>
                      {getUstazName(ustaz)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" className="shrink-0">Найти</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="md:hidden space-y-3">
            {students.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Студенты не найдены
                </CardContent>
              </Card>
            ) : (
              students.map((student) => <StudentCard key={student.id} student={student} />)
            )}
          </div>

          {/* Desktop: Table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Студент</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Устаз</TableHead>
                  <TableHead>Группы</TableHead>
                  <TableHead>Прогресс</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Студенты не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(student.firstName, student.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{getStudentName(student)}</div>
                            {student.telegramUsername && (
                              <div className="text-sm text-muted-foreground">
                                @{student.telegramUsername}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {student.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {student.ustaz ? (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {getUstazName(student.ustaz)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Не назначен</span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => openAssignDialog(student)}
                          >
                            {student.ustaz ? 'Сменить' : 'Назначить'}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.studentGroups && student.studentGroups.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {student.studentGroups.slice(0, 3).map((sg) => (
                              <Badge key={sg.group.id} variant="secondary" className="text-xs">
                                {sg.group.name}
                              </Badge>
                            ))}
                            {student.studentGroups.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{student.studentGroups.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Нет групп</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3 text-sm">
                            <div className="flex items-center gap-1">
                              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{student.currentPage}-{student.currentLine}</span>
                              <Badge variant="outline" className="text-xs ml-1">
                                {getStageLabel(student.currentStage)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{student.taskPassedCount}/{student.taskRequiredCount}</span>
                            </div>
                          </div>
                          <Progress value={student.taskCompletion} className="h-1.5 w-32" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={student.isActive ? 'default' : 'secondary'}>
                          {student.isActive ? 'Активен' : 'Неактивен'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          asChild
                        >
                          <Link href={`/admin/users/${student.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Ustaz Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Назначить устаза</DialogTitle>
            <DialogDescription>
              {selectedStudent && (
                <>
                  Студент: <strong>{getStudentName(selectedStudent)}</strong>
                  <br />
                  При выборе устаза студент автоматически вступит во все группы этого устаза.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {assignError && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {assignError}
              </div>
            )}

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {/* Remove ustaz option */}
              {selectedStudent?.ustaz && (
                <button
                  type="button"
                  className="w-full p-3 text-left rounded-lg border border-destructive/50 bg-destructive/5 hover:bg-destructive/10 transition-colors"
                  onClick={() => assignUstaz(null)}
                  disabled={assigning}
                >
                  <div className="font-medium text-destructive">Убрать устаза</div>
                  <div className="text-sm text-muted-foreground">
                    Студент будет удален из всех групп
                  </div>
                </button>
              )}

              {ustazList.map((ustaz) => {
                const isCurrentUstaz = selectedStudent?.ustazId === ustaz.id
                return (
                  <button
                    key={ustaz.id}
                    type="button"
                    className={`w-full p-3 text-left rounded-lg border hover:bg-accent transition-colors ${
                      isCurrentUstaz ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => assignUstaz(ustaz.id)}
                    disabled={assigning || isCurrentUstaz}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" />
                          {getUstazName(ustaz)}
                          {isCurrentUstaz && (
                            <Badge variant="secondary" className="text-xs">Текущий</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {ustaz.phone}
                        </div>
                      </div>
                      {ustaz._count?.ustazGroups !== undefined && (
                        <Badge variant="outline">
                          {ustaz._count.ustazGroups} групп
                        </Badge>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {assigning && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Назначение устаза...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
