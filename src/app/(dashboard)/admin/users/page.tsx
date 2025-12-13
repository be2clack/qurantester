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
import { Plus, Search, Phone, Loader2, Check, X, Pencil, Eye, Users } from 'lucide-react'
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
  role: UserRole
  isActive: boolean
  currentPage: number
  currentLine: number
  currentStage: StageNumber
  groupId: string | null
  telegramUsername: string | null
  studentGroup: { id: string; name: string } | null
  childOf: Parent[]
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
  const [editData, setEditData] = useState<Partial<User & { parentIds: string[] }>>({})
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Пользователи</h2>
          <p className="text-muted-foreground">
            Всего: {total} пользователей
          </p>
        </div>

        <Button asChild>
          <Link href="/admin/users/new">
            <Plus className="mr-2 h-4 w-4" />
            Добавить
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
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
            <Select value={roleFilter || 'all'} onValueChange={(v) => { setRoleFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Все роли" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все роли</SelectItem>
                <SelectItem value="ADMIN">Администраторы</SelectItem>
                <SelectItem value="USTAZ">Устазы</SelectItem>
                <SelectItem value="STUDENT">Студенты</SelectItem>
                <SelectItem value="PARENT">Родители</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit">Найти</Button>
          </form>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Группа</TableHead>
                <TableHead>Родители</TableHead>
                <TableHead>Прогресс</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Пользователи не найдены
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const isEditing = editingUser === user.id

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {getInitials(user.firstName, user.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {user.firstName || user.lastName
                                ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                                : 'Без имени'}
                            </div>
                            {user.telegramUsername && (
                              <div className="text-sm text-muted-foreground">
                                @{user.telegramUsername}
                              </div>
                            )}
                          </div>
                        </div>
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
                          <Select
                            value={editData.groupId || 'none'}
                            onValueChange={(v) => setEditData({ ...editData, groupId: v === 'none' ? null : v })}
                          >
                            <SelectTrigger className="w-[150px] h-8">
                              <SelectValue placeholder="Без группы" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Без группы</SelectItem>
                              {groups.map((g) => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          user.studentGroup?.name || '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {user.role === 'STUDENT' ? (
                          isEditing ? (
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
                          ) : (
                            user.childOf && user.childOf.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {user.childOf.map(p => (
                                  <Badge key={p.id} variant="outline" className="text-xs">
                                    {formatParentName(p)}
                                  </Badge>
                                ))}
                              </div>
                            ) : '-'
                          )
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {user.role === 'STUDENT' ? (
                          isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={1}
                                max={602}
                                className="w-16 h-8"
                                value={editData.currentPage || 1}
                                onChange={(e) => setEditData({ ...editData, currentPage: parseInt(e.target.value) || 1 })}
                              />
                              <span className="text-muted-foreground">-</span>
                              <Input
                                type="number"
                                min={1}
                                max={15}
                                className="w-14 h-8"
                                value={editData.currentLine || 1}
                                onChange={(e) => setEditData({ ...editData, currentLine: parseInt(e.target.value) || 1 })}
                              />
                            </div>
                          ) : (
                            <Badge variant="outline">
                              {user.currentPage}-{user.currentLine}
                            </Badge>
                          )
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
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Назад
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            Страница {page} из {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages}
          >
            Вперед
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
