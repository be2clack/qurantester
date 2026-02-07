'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Search, Phone, Loader2, Eye, ChevronLeft, ChevronRight, GraduationCap, Users, Pencil, UserPlus, UserCheck, Clock, BookOpen, User, ChevronsUpDown } from 'lucide-react'
import Link from 'next/link'
import { StageNumber } from '@prisma/client'
import { StudentNameGenderEditDialog } from '@/components/student-name-gender-edit-dialog'

interface Parent {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
}

interface Ustaz {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
  _count?: { ustazGroups: number }
}

interface Group {
  id: string
  name: string
  gender: 'MALE' | 'FEMALE'
  lessonType: string
  ustaz: {
    firstName: string | null
    lastName: string | null
  } | null
  _count: {
    students: number
  }
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
  gender: 'MALE' | 'FEMALE' | null
  telegramUsername: string | null
  isActive: boolean
  currentPage: number
  currentLine: number
  currentStage: StageNumber
  ustazId: string | null
  ustaz: Ustaz | null
  studentGroups: StudentGroup[]
  childOf: Parent[]
  taskCompletion: number
  taskPassedCount: number
  taskRequiredCount: number
}

interface PendingUser {
  id: string
  phone: string
  firstName: string | null
  lastName: string | null
  gender: 'MALE' | 'FEMALE' | null
  telegramUsername: string | null
  createdAt: string
}

interface ActivationFormData {
  firstName: string
  lastName: string
  gender: 'MALE' | 'FEMALE' | ''
  groupId: string
  parentId: string
  currentPage: number
  currentLine: number
  currentStage: StageNumber
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [ustazList, setUstazList] = useState<Ustaz[]>([])
  const [groupList, setGroupList] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingLoading, setPendingLoading] = useState(true)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<string>('')
  const [genderFilter, setGenderFilter] = useState<string>('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  // Group assignment dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState('')

  // Name/gender edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)

  // Activation dialog
  const [activationDialogOpen, setActivationDialogOpen] = useState(false)
  const [activatingUser, setActivatingUser] = useState<PendingUser | null>(null)
  const [activationForm, setActivationForm] = useState<ActivationFormData>({
    firstName: '',
    lastName: '',
    gender: '',
    groupId: '',
    parentId: '',
    currentPage: 1,
    currentLine: 1,
    currentStage: 'STAGE_1_1',
  })
  const [activationLoading, setActivationLoading] = useState(false)
  const [activationError, setActivationError] = useState('')
  const [parentList, setParentList] = useState<Parent[]>([])

  // Searchable combobox state for activation dialog
  const [groupSearchOpen, setGroupSearchOpen] = useState(false)
  const [groupSearch, setGroupSearch] = useState('')
  const [parentSearchOpen, setParentSearchOpen] = useState(false)
  const [parentSearch, setParentSearch] = useState('')

  const fetchPendingUsers = useCallback(async () => {
    setPendingLoading(true)
    try {
      const res = await fetch('/api/users?role=PENDING&limit=50')
      const data = await res.json()
      setPendingUsers(data.items || [])
    } catch (err) {
      console.error('Failed to fetch pending users:', err)
    } finally {
      setPendingLoading(false)
    }
  }, [])

  const activateUser = async (userId: string) => {
    setActivatingId(userId)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'STUDENT', isActive: true }),
      })
      if (res.ok) {
        // Remove from pending list and refresh students
        setPendingUsers(prev => prev.filter(u => u.id !== userId))
        fetchStudents()
      }
    } catch (err) {
      console.error('Failed to activate user:', err)
    } finally {
      setActivatingId(null)
    }
  }

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        role: 'STUDENT',
      })
      if (search) params.set('search', search)
      if (groupFilter) params.set('groupId', groupFilter)
      if (genderFilter) params.set('gender', genderFilter)

      const res = await fetch(`/api/users?${params}`)
      const data = await res.json()
      setStudents(data.items || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Failed to fetch students:', err)
    } finally {
      setLoading(false)
    }
  }, [page, search, groupFilter, genderFilter])

  const fetchUstazList = useCallback(async () => {
    try {
      const res = await fetch('/api/users?role=USTAZ&limit=100')
      const data = await res.json()
      setUstazList(data.items || [])
    } catch (err) {
      console.error('Failed to fetch ustaz list:', err)
    }
  }, [])

  const fetchGroupList = useCallback(async () => {
    try {
      const res = await fetch('/api/groups?activeOnly=true&limit=100')
      const data = await res.json()
      setGroupList(data.items || [])
    } catch (err) {
      console.error('Failed to fetch group list:', err)
    }
  }, [])

  const fetchParentList = useCallback(async () => {
    try {
      const res = await fetch('/api/users?role=PARENT&limit=100')
      const data = await res.json()
      setParentList(data.items || [])
    } catch (err) {
      console.error('Failed to fetch parent list:', err)
    }
  }, [])

  useEffect(() => {
    fetchPendingUsers()
    fetchStudents()
    fetchUstazList()
    fetchGroupList()
    fetchParentList()
  }, [fetchPendingUsers, fetchStudents, fetchUstazList, fetchGroupList, fetchParentList])

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

  const openEditDialog = (student: Student) => {
    setEditingStudent(student)
    setEditDialogOpen(true)
  }

  const openActivationDialog = (user: PendingUser) => {
    setActivatingUser(user)

    // Auto-select a group matching the student's gender
    let autoGroupId = ''
    if (user.gender && groupList.length > 0) {
      const matchingGroup = groupList.find(g => g.gender === user.gender)
      if (matchingGroup) {
        autoGroupId = matchingGroup.id
      }
    }

    setActivationForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      gender: user.gender || '',
      groupId: autoGroupId,
      parentId: '',
      currentPage: 1,
      currentLine: 1,
      currentStage: 'STAGE_1_1',
    })
    setActivationError('')
    setGroupSearch('')
    setParentSearch('')
    setActivationDialogOpen(true)
  }

  const submitActivation = async () => {
    if (!activatingUser) return
    if (!activationForm.groupId) {
      setActivationError('Выберите группу')
      return
    }

    setActivationLoading(true)
    setActivationError('')

    try {
      // First, update user data and activate
      const userData: Record<string, unknown> = {
        firstName: activationForm.firstName || null,
        lastName: activationForm.lastName || null,
        gender: activationForm.gender || null,
        role: 'STUDENT',
        isActive: true,
        currentPage: activationForm.currentPage,
        currentLine: activationForm.currentLine,
        currentStage: activationForm.currentStage,
      }

      // Add parent if selected
      if (activationForm.parentId) {
        userData.childOf = { connect: [{ id: activationForm.parentId }] }
      }

      const userRes = await fetch(`/api/users/${activatingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      })

      if (!userRes.ok) {
        const data = await userRes.json()
        throw new Error(data.error || 'Не удалось активировать пользователя')
      }

      // Add to selected group
      const groupRes = await fetch(`/api/groups/${activationForm.groupId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: activatingUser.id,
          currentPage: activationForm.currentPage,
          currentLine: activationForm.currentLine,
          currentStage: activationForm.currentStage,
        }),
      })

      if (!groupRes.ok) {
        const data = await groupRes.json()
        throw new Error(data.error || 'Не удалось добавить в группу')
      }

      // Success - close dialog and refresh
      setActivationDialogOpen(false)
      setActivatingUser(null)
      setPendingUsers(prev => prev.filter(u => u.id !== activatingUser.id))
      fetchStudents()
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : 'Ошибка активации')
    } finally {
      setActivationLoading(false)
    }
  }

  const addToGroup = async (groupId: string, preserveProgress: boolean = true) => {
    if (!selectedStudent) return

    setAssigning(true)
    setAssignError('')

    try {
      // If preserving progress, send current progress from existing group
      const body: Record<string, unknown> = { studentId: selectedStudent.id }
      if (preserveProgress && selectedStudent.studentGroups.length > 0) {
        const currentGroup = selectedStudent.studentGroups[0]
        body.currentPage = currentGroup.currentPage
        body.currentLine = currentGroup.currentLine
        body.currentStage = currentGroup.currentStage
      }

      const res = await fetch(`/api/groups/${groupId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Не удалось добавить в группу')
      }

      // Refresh the list
      await fetchStudents()
      setAssignDialogOpen(false)
      setSelectedStudent(null)
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Ошибка добавления в группу')
    } finally {
      setAssigning(false)
    }
  }

  const removeFromGroup = async (groupId: string) => {
    if (!selectedStudent) return

    setAssigning(true)
    setAssignError('')

    try {
      const res = await fetch(`/api/groups/${groupId}/students?studentId=${selectedStudent.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Не удалось удалить из группы')
      }

      // Refresh the list
      await fetchStudents()
      setAssignDialogOpen(false)
      setSelectedStudent(null)
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Ошибка удаления из группы')
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

        {/* Gender & Edit */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xl">
              {student.gender === 'MALE' ? '👨' : student.gender === 'FEMALE' ? '🧕' : '—'}
            </span>
            <span className="text-muted-foreground">
              {student.gender === 'MALE' ? 'Мужской' : student.gender === 'FEMALE' ? 'Женский' : 'Не указан'}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(student)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Groups */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            {student.studentGroups && student.studentGroups.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {student.studentGroups.map((sg) => (
                  <Badge key={sg.group.id} variant="secondary" className="text-xs">
                    {sg.group.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Нет групп</span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => openAssignDialog(student)}>
            <UserPlus className="h-4 w-4 mr-1" />
            {student.studentGroups?.length ? 'Изменить' : 'Добавить'}
          </Button>
        </div>
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

      {/* Pending Users Section */}
      {pendingUsers.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Ожидают подтверждения ({pendingUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-background rounded-lg border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                        {(user.firstName?.charAt(0) || user.phone.charAt(0)).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {user.firstName || user.lastName
                          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                          : user.phone}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {user.phone}
                        </span>
                        {user.telegramUsername && (
                          <span>@{user.telegramUsername}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openActivationDialog(user)}
                    className="shrink-0"
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    Активировать
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
            <div className="flex gap-2 flex-wrap">
              <Select value={genderFilter || 'all'} onValueChange={(v) => { setGenderFilter(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Пол" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="MALE">👨 Мужской</SelectItem>
                  <SelectItem value="FEMALE">🧕 Женский</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupFilter || 'all'} onValueChange={(v) => { setGroupFilter(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Все группы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все группы</SelectItem>
                  <SelectItem value="none">Без группы</SelectItem>
                  {groupList.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.gender === 'MALE' ? '👨' : '🧕'} {group.name}
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
                  <TableHead>Пол</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Группы</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                        <span className="text-xl">
                          {student.gender === 'MALE' ? '👨' : student.gender === 'FEMALE' ? '🧕' : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {student.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {student.studentGroups && student.studentGroups.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {student.studentGroups.slice(0, 2).map((sg) => (
                                <Badge key={sg.group.id} variant="secondary" className="text-xs">
                                  {sg.group.name}
                                </Badge>
                              ))}
                              {student.studentGroups.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{student.studentGroups.length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Нет групп</span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openAssignDialog(student)}
                            title="Управление группами"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={student.isActive ? 'default' : 'secondary'}>
                          {student.isActive ? 'Активен' : 'Неактивен'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(student)}
                            title="Редактировать имя и пол"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
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
                        </div>
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

      {/* Group Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Назначить группу
            </DialogTitle>
            <DialogDescription>
              {selectedStudent && (
                <>Студент: <strong>{getStudentName(selectedStudent)}</strong></>
              )}
              <br />
              <span className="text-xs text-amber-600">Студент может быть только в одной группе</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {assignError && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {assignError}
              </div>
            )}

            {/* Current group */}
            {selectedStudent?.studentGroups && selectedStudent.studentGroups.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Текущая группа:</p>
                <div className="space-y-1">
                  {selectedStudent.studentGroups.slice(0, 1).map((sg) => (
                    <div key={sg.group.id} className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          <span className="font-medium">{sg.group.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeFromGroup(sg.group.id)}
                          disabled={assigning}
                        >
                          Удалить
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          Стр. {sg.currentPage}:{sg.currentLine}
                        </span>
                        <span>Этап {getStageLabel(sg.currentStage)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available groups */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {selectedStudent?.studentGroups?.length ? 'Перенести в группу (с сохранением прогресса):' : 'Выберите группу:'}
              </p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {groupList
                  .filter(g => !selectedStudent?.studentGroups?.some(sg => sg.group.id === g.id))
                  .map((group) => {
                    const genderEmoji = group.gender === 'MALE' ? '👨' : '🧕'
                    const ustazName = group.ustaz
                      ? `${group.ustaz.firstName || ''} ${group.ustaz.lastName || ''}`.trim() || 'Без имени'
                      : 'Без устаза'
                    return (
                      <button
                        key={group.id}
                        type="button"
                        className="w-full p-3 text-left rounded-lg border hover:bg-accent transition-colors"
                        onClick={() => addToGroup(group.id, true)}
                        disabled={assigning}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              <span>{genderEmoji}</span>
                              {group.name}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <GraduationCap className="h-3 w-3" />
                              {ustazName}
                            </div>
                          </div>
                          <Badge variant="outline">
                            {group._count.students} студ.
                          </Badge>
                        </div>
                      </button>
                    )
                  })}
                {groupList.filter(g => !selectedStudent?.studentGroups?.some(sg => sg.group.id === g.id)).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Нет доступных групп
                  </p>
                )}
              </div>
            </div>

            {assigning && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Обработка...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Name/Gender Edit Dialog */}
      <StudentNameGenderEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        student={editingStudent}
        onSuccess={fetchStudents}
      />

      {/* Activation Dialog */}
      <Dialog open={activationDialogOpen} onOpenChange={setActivationDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Активация студента
            </DialogTitle>
            <DialogDescription>
              {activatingUser && (
                <>Телефон: <strong>{activatingUser.phone}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {activationError && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {activationError}
              </div>
            )}

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Имя</Label>
                <Input
                  id="firstName"
                  value={activationForm.firstName}
                  onChange={(e) => setActivationForm(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Имя"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Фамилия</Label>
                <Input
                  id="lastName"
                  value={activationForm.lastName}
                  onChange={(e) => setActivationForm(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Фамилия"
                />
              </div>
            </div>

            {/* Gender */}
            <div className="space-y-1.5">
              <Label>Пол</Label>
              <RadioGroup
                value={activationForm.gender}
                onValueChange={(v) => setActivationForm(prev => ({ ...prev, gender: v as 'MALE' | 'FEMALE' }))}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="MALE" id="gender-male" />
                  <Label htmlFor="gender-male" className="cursor-pointer">👨 Мужской</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="FEMALE" id="gender-female" />
                  <Label htmlFor="gender-female" className="cursor-pointer">🧕 Женский</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Group selection with search */}
            <div className="space-y-1.5">
              <Label>Группа *</Label>
              <Popover open={groupSearchOpen} onOpenChange={setGroupSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={groupSearchOpen}
                    className="w-full justify-between"
                  >
                    {activationForm.groupId ? (
                      (() => {
                        const selectedGroup = groupList.find(g => g.id === activationForm.groupId)
                        return selectedGroup ? (
                          <span>
                            {selectedGroup.gender === 'MALE' ? '👨' : '🧕'} {selectedGroup.name}
                            {selectedGroup.ustaz && ` - ${selectedGroup.ustaz.firstName || ''} ${selectedGroup.ustaz.lastName || ''}`.trim()}
                          </span>
                        ) : 'Выберите группу'
                      })()
                    ) : (
                      <span className="text-muted-foreground">Выберите группу...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Поиск группы..."
                      value={groupSearch}
                      onValueChange={setGroupSearch}
                    />
                    <CommandList>
                      {groupList.length === 0 ? (
                        <CommandEmpty>Группы не найдены</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {groupList
                            .filter(g => {
                              if (!groupSearch) return true
                              const search = groupSearch.toLowerCase()
                              const name = g.name.toLowerCase()
                              const ustazName = g.ustaz
                                ? `${g.ustaz.firstName || ''} ${g.ustaz.lastName || ''}`.toLowerCase()
                                : ''
                              return name.includes(search) || ustazName.includes(search)
                            })
                            .map((group) => (
                              <CommandItem
                                key={group.id}
                                value={group.id}
                                onSelect={() => {
                                  setActivationForm(prev => ({ ...prev, groupId: group.id }))
                                  setGroupSearchOpen(false)
                                  setGroupSearch('')
                                }}
                              >
                                <Users className="mr-2 h-4 w-4" />
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {group.gender === 'MALE' ? '👨' : '🧕'} {group.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {group.ustaz
                                      ? `${group.ustaz.firstName || ''} ${group.ustaz.lastName || ''}`.trim()
                                      : 'Без устаза'} • {group._count.students} студ.
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Parent selection with search */}
            <div className="space-y-1.5">
              <Label>Родитель (опционально)</Label>
              <Popover open={parentSearchOpen} onOpenChange={setParentSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={parentSearchOpen}
                    className="w-full justify-between"
                  >
                    {activationForm.parentId ? (
                      (() => {
                        const selectedParent = parentList.find(p => p.id === activationForm.parentId)
                        return selectedParent ? (
                          <span>
                            <User className="h-3 w-3 inline mr-1" />
                            {selectedParent.firstName || selectedParent.lastName
                              ? `${selectedParent.firstName || ''} ${selectedParent.lastName || ''}`.trim()
                              : selectedParent.phone}
                          </span>
                        ) : 'Без родителя'
                      })()
                    ) : (
                      <span className="text-muted-foreground">Выберите родителя...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Поиск по имени или телефону..."
                      value={parentSearch}
                      onValueChange={setParentSearch}
                    />
                    <CommandList>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setActivationForm(prev => ({ ...prev, parentId: '' }))
                            setParentSearchOpen(false)
                            setParentSearch('')
                          }}
                        >
                          Без родителя
                        </CommandItem>
                        {parentList
                          .filter(p => {
                            if (!parentSearch) return true
                            const search = parentSearch.toLowerCase()
                            const name = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase()
                            const phone = p.phone.toLowerCase()
                            return name.includes(search) || phone.includes(search)
                          })
                          .map((parent) => (
                            <CommandItem
                              key={parent.id}
                              value={parent.id}
                              onSelect={() => {
                                setActivationForm(prev => ({ ...prev, parentId: parent.id }))
                                setParentSearchOpen(false)
                                setParentSearch('')
                              }}
                            >
                              <User className="mr-2 h-4 w-4" />
                              <div className="flex-1">
                                <div className="font-medium">
                                  {parent.firstName || parent.lastName
                                    ? `${parent.firstName || ''} ${parent.lastName || ''}`.trim()
                                    : 'Без имени'}
                                </div>
                                <div className="text-xs text-muted-foreground">{parent.phone}</div>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Progress settings */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                Начальный прогресс
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="currentPage" className="text-xs text-muted-foreground">Страница</Label>
                  <Input
                    id="currentPage"
                    type="number"
                    min={1}
                    max={604}
                    value={activationForm.currentPage}
                    onChange={(e) => setActivationForm(prev => ({ ...prev, currentPage: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="currentLine" className="text-xs text-muted-foreground">Строка</Label>
                  <Input
                    id="currentLine"
                    type="number"
                    min={1}
                    max={15}
                    value={activationForm.currentLine}
                    onChange={(e) => setActivationForm(prev => ({ ...prev, currentLine: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="currentStage" className="text-xs text-muted-foreground">Этап</Label>
                  <Select
                    value={activationForm.currentStage}
                    onValueChange={(v) => setActivationForm(prev => ({ ...prev, currentStage: v as StageNumber }))}
                  >
                    <SelectTrigger id="currentStage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STAGE_1_1">1.1</SelectItem>
                      <SelectItem value="STAGE_1_2">1.2</SelectItem>
                      <SelectItem value="STAGE_2_1">2.1</SelectItem>
                      <SelectItem value="STAGE_2_2">2.2</SelectItem>
                      <SelectItem value="STAGE_3">3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Submit button */}
            <Button
              className="w-full"
              onClick={submitActivation}
              disabled={activationLoading || !activationForm.groupId}
            >
              {activationLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserCheck className="h-4 w-4 mr-2" />
              )}
              Сохранить и активировать
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
