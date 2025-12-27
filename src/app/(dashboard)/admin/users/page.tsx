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
import { Search, Phone, Loader2, Check, X, Pencil, Eye, Users, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { RoleBadge } from '@/components/users/role-badge'
import Link from 'next/link'
import { UserRole, StageNumber } from '@prisma/client'

interface Parent {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
}

interface User {
  id: string
  phone: string
  firstName: string | null
  lastName: string | null
  birthDate: string | null
  role: UserRole
  isActive: boolean
  currentPage: number
  currentLine: number
  currentStage: StageNumber
  groupId: string | null
  telegramUsername: string | null
  studentGroup: { id: string; name: string } | null
  childOf: Parent[]
  taskCompletion: number
  taskPassedCount: number
  taskRequiredCount: number
  _count: { tasks: number }
}

interface Group {
  id: string
  name: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<User & { parentIds: string[], birthDate: string }>>({})
  const [saving, setSaving] = useState(false)

  // Parent selection
  const [parentDialogOpen, setParentDialogOpen] = useState(false)
  const [parentSearch, setParentSearch] = useState('')
  const [parentResults, setParentResults] = useState<Parent[]>([])
  const [searchingParents, setSearchingParents] = useState(false)
  const [selectedParents, setSelectedParents] = useState<Parent[]>([])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })
      if (roleFilter) params.set('role', roleFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/users?${params}`)
      const data = await res.json()
      setUsers(data.items || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Failed to fetch users:', err)
    } finally {
      setLoading(false)
    }
  }, [page, roleFilter, search])

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/groups?limit=100&activeOnly=true')
      const data = await res.json()
      setGroups(data.items || [])
    } catch (err) {
      console.error('Failed to fetch groups:', err)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchGroups()
  }, [fetchUsers, fetchGroups])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchUsers()
  }

  const searchParents = async (query: string) => {
    if (!query || query.length < 2) {
      setParentResults([])
      return
    }
    setSearchingParents(true)
    try {
      const res = await fetch(`/api/users/parents?search=${encodeURIComponent(query)}`)
      const data = await res.json()
      setParentResults(data.items || [])
    } catch (err) {
      console.error('Failed to search parents:', err)
    } finally {
      setSearchingParents(false)
    }
  }

  const startEdit = (user: User) => {
    setEditingUser(user.id)
    setEditData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      birthDate: user.birthDate ? user.birthDate.split('T')[0] : '',
      groupId: user.groupId,
      currentPage: user.currentPage,
      currentLine: user.currentLine,
      currentStage: user.currentStage,
      role: user.role,
      isActive: user.isActive,
      parentIds: user.childOf?.map(p => p.id) || [],
    })
    setSelectedParents(user.childOf || [])
  }

  const cancelEdit = () => {
    setEditingUser(null)
    setEditData({})
    setSelectedParents([])
  }

  const openParentDialog = () => {
    setParentDialogOpen(true)
    setParentSearch('')
    setParentResults([])
  }

  const selectParent = (parent: Parent) => {
    if (!selectedParents.find(p => p.id === parent.id)) {
      const newParents = [...selectedParents, parent]
      setSelectedParents(newParents)
      setEditData({ ...editData, parentIds: newParents.map(p => p.id) })
    }
    setParentDialogOpen(false)
  }

  const removeParent = (parentId: string) => {
    const newParents = selectedParents.filter(p => p.id !== parentId)
    setSelectedParents(newParents)
    setEditData({ ...editData, parentIds: newParents.map(p => p.id) })
  }

  const saveEdit = async (userId: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })

      if (res.ok) {
        await fetchUsers()
        setEditingUser(null)
        setEditData({})
        setSelectedParents([])
      }
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / 20)

  function getInitials(firstName?: string | null, lastName?: string | null): string {
    const first = firstName?.charAt(0)?.toUpperCase() || ''
    const last = lastName?.charAt(0)?.toUpperCase() || ''
    return first + last || 'U'
  }

  function formatParentName(parent: Parent): string {
    const name = [parent.firstName, parent.lastName].filter(Boolean).join(' ')
    return name || parent.phone
  }

  function getUserName(user: User): string {
    return user.firstName || user.lastName
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
      : 'Без имени'
  }

  // Mobile Card Component
  const UserCard = ({ user }: { user: User }) => (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(user.firstName, user.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{getUserName(user)}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {user.phone}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/admin/users/${user.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(user)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <RoleBadge role={user.role} />
          <Badge variant={user.isActive ? 'default' : 'secondary'}>
            {user.isActive ? 'Активен' : 'Неактивен'}
          </Badge>
        </div>

        {user.role === 'STUDENT' && user.childOf && user.childOf.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-1">Родители:</p>
            <div className="flex flex-wrap gap-1">
              {user.childOf.map(p => (
                <Badge key={p.id} variant="outline" className="text-xs">
                  {formatParentName(p)}
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
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">Пользователи</h2>
        <p className="text-sm text-muted-foreground">
          Всего: {total} пользователей
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
                  placeholder="Поиск..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter || 'all'} onValueChange={(v) => { setRoleFilter(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Все роли" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все роли</SelectItem>
                  <SelectItem value="ADMIN">Админы</SelectItem>
                  <SelectItem value="USTAZ">Устазы</SelectItem>
                  <SelectItem value="STUDENT">Студенты</SelectItem>
                  <SelectItem value="PARENT">Родители</SelectItem>
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
            {users.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Пользователи не найдены
                </CardContent>
              </Card>
            ) : (
              users.map((user) => <UserCard key={user.id} user={user} />)
            )}
          </div>

          {/* Desktop: Table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Родители</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Пользователи не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
                    const isEditing = editingUser === user.id

                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Имя"
                                  className="h-8 w-24"
                                  value={editData.firstName || ''}
                                  onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                                />
                                <Input
                                  placeholder="Фамилия"
                                  className="h-8 w-24"
                                  value={editData.lastName || ''}
                                  onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <Input
                                  type="date"
                                  className="h-7 w-32 text-xs"
                                  value={editData.birthDate || ''}
                                  onChange={(e) => setEditData({ ...editData, birthDate: e.target.value })}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {getInitials(user.firstName, user.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{getUserName(user)}</div>
                                {user.telegramUsername && (
                                  <div className="text-sm text-muted-foreground">
                                    @{user.telegramUsername}
                                  </div>
                                )}
                                {user.birthDate && (
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(user.birthDate).toLocaleDateString('ru-RU')}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {user.phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Select
                              value={editData.role}
                              onValueChange={(v) => setEditData({ ...editData, role: v as UserRole })}
                            >
                              <SelectTrigger className="w-[130px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ADMIN">Админ</SelectItem>
                                <SelectItem value="USTAZ">Устаз</SelectItem>
                                <SelectItem value="STUDENT">Студент</SelectItem>
                                <SelectItem value="PARENT">Родитель</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <RoleBadge role={user.role} />
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing && editData.role === 'STUDENT' ? (
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1">
                                {selectedParents.map(p => (
                                  <Badge key={p.id} variant="secondary" className="text-xs">
                                    {formatParentName(p)}
                                    <button
                                      type="button"
                                      onClick={() => removeParent(p.id)}
                                      className="ml-1 hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={openParentDialog}
                              >
                                <Users className="h-3 w-3 mr-1" />
                                Добавить
                              </Button>
                            </div>
                          ) : user.role === 'STUDENT' && user.childOf && user.childOf.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {user.childOf.map(p => (
                                <Badge key={p.id} variant="outline" className="text-xs">
                                  {formatParentName(p)}
                                </Badge>
                              ))}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Select
                              value={editData.isActive ? 'active' : 'inactive'}
                              onValueChange={(v) => setEditData({ ...editData, isActive: v === 'active' })}
                            >
                              <SelectTrigger className="w-[110px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Активен</SelectItem>
                                <SelectItem value="inactive">Неактивен</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={user.isActive ? 'default' : 'secondary'}>
                              {user.isActive ? 'Активен' : 'Неактивен'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {isEditing ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => saveEdit(user.id)}
                                  disabled={saving}
                                >
                                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={cancelEdit}
                                >
                                  <X className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  asChild
                                >
                                  <Link href={`/admin/users/${user.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => startEdit(user)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
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

      {/* Parent Selection Dialog */}
      <Dialog open={parentDialogOpen} onOpenChange={setParentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выбор родителя</DialogTitle>
            <DialogDescription>
              Найдите и выберите родителя для студента
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени или телефону..."
                className="pl-10"
                value={parentSearch}
                onChange={(e) => {
                  setParentSearch(e.target.value)
                  searchParents(e.target.value)
                }}
              />
            </div>

            {searchingParents ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : parentResults.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {parentResults.map(parent => (
                  <button
                    key={parent.id}
                    type="button"
                    className="w-full p-3 text-left rounded-lg border hover:bg-accent transition-colors"
                    onClick={() => selectParent(parent)}
                  >
                    <div className="font-medium">
                      {parent.firstName || parent.lastName
                        ? `${parent.firstName || ''} ${parent.lastName || ''}`.trim()
                        : 'Без имени'}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {parent.phone}
                    </div>
                  </button>
                ))}
              </div>
            ) : parentSearch.length >= 2 ? (
              <p className="text-center text-muted-foreground py-4">
                Родители не найдены
              </p>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Введите минимум 2 символа для поиска
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
