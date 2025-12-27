'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Search, Users, Loader2, MoreHorizontal, Pencil, Trash2, Power, PowerOff, Eye, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Group {
  id: string
  name: string
  description: string | null
  level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'
  lessonType: 'MEMORIZATION' | 'REVISION' | 'TRANSLATION'
  isActive: boolean
  createdAt: string
  ustaz: {
    id: string
    firstName: string | null
    lastName: string | null
    phone: string
  }
  _count: {
    students: number
    lessons: number
  }
}

interface Ustaz {
  id: string
  firstName: string | null
  lastName: string | null
}

const LEVEL_LABELS: Record<string, { label: string; lines: string }> = {
  LEVEL_1: { label: 'Уровень 1', lines: '1 строка' },
  LEVEL_2: { label: 'Уровень 2', lines: '3 строки' },
  LEVEL_3: { label: 'Уровень 3', lines: '7 строк' },
}

const LEVEL_COLORS: Record<string, string> = {
  LEVEL_1: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  LEVEL_2: 'bg-blue-100 text-blue-800 border-blue-200',
  LEVEL_3: 'bg-purple-100 text-purple-800 border-purple-200',
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [ustazList, setUstazList] = useState<Ustaz[]>([])
  const [filterUstaz, setFilterUstaz] = useState<string>('all')
  const [filterLevel, setFilterLevel] = useState<string>('all')

  useEffect(() => {
    fetchGroups()
    fetchUstazList()
  }, [page])

  async function fetchGroups() {
    setLoading(true)
    try {
      const res = await fetch(`/api/groups?page=${page}&limit=100`)
      const data = await res.json()
      setGroups(data.items || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Failed to fetch groups:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchUstazList() {
    try {
      const res = await fetch('/api/users?role=USTAZ&limit=100')
      const data = await res.json()
      setUstazList(data.items || [])
    } catch (err) {
      console.error('Failed to fetch ustaz list:', err)
    }
  }

  const filteredGroups = groups.filter(group => {
    const matchesSearch =
      group.name.toLowerCase().includes(search.toLowerCase()) ||
      group.ustaz?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      group.ustaz?.lastName?.toLowerCase().includes(search.toLowerCase())
    const matchesUstaz = filterUstaz === 'all' || group.ustaz?.id === filterUstaz
    const matchesLevel = filterLevel === 'all' || group.level === filterLevel
    return matchesSearch && matchesUstaz && matchesLevel
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту группу?')) return

    try {
      const res = await fetch(`/api/groups/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchGroups()
      }
    } catch (err) {
      console.error('Failed to delete group:', err)
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/groups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      })
      if (res.ok) {
        fetchGroups()
      }
    } catch (err) {
      console.error('Failed to toggle group status:', err)
    }
  }

  const totalPages = Math.ceil(total / 20)

  // Mobile Card Component
  const GroupCard = ({ group }: { group: Group }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link href={`/admin/groups/${group.id}`} className="font-semibold hover:underline">
              {group.name}
            </Link>
            {group.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {group.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link href={`/admin/groups/${group.id}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Eye className="h-4 w-4" />
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Link href={`/admin/groups/${group.id}`}>
                  <DropdownMenuItem>
                    <Pencil className="mr-2 h-4 w-4" />
                    Редактировать
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem onClick={() => handleToggleActive(group.id, group.isActive)}>
                  {group.isActive ? (
                    <>
                      <PowerOff className="mr-2 h-4 w-4" />
                      Деактивировать
                    </>
                  ) : (
                    <>
                      <Power className="mr-2 h-4 w-4" />
                      Активировать
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(group.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={group.isActive ? 'default' : 'secondary'}>
            {group.isActive ? 'Активна' : 'Неактивна'}
          </Badge>
          <Badge className={`${LEVEL_COLORS[group.level]} border`}>
            <GraduationCap className="mr-1 h-3 w-3" />
            {LEVEL_LABELS[group.level]?.lines || group.level}
          </Badge>
          <Badge variant="outline">
            <Users className="mr-1 h-3 w-3" />
            {group._count.students} студ.
          </Badge>
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="h-3 w-3" />
          </div>
          <span className="truncate">
            {group.ustaz?.firstName} {group.ustaz?.lastName}
          </span>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Группы</h1>
          <p className="text-sm text-muted-foreground">Управление учебными группами</p>
        </div>
        <Link href="/admin/groups/new">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Новая группа
          </Button>
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardHeader className="p-3 md:p-4 pb-1 md:pb-2">
            <CardDescription className="text-xs">Всего</CardDescription>
            <CardTitle className="text-xl md:text-3xl">{total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 md:p-4 pb-1 md:pb-2">
            <CardDescription className="text-xs">Активных</CardDescription>
            <CardTitle className="text-xl md:text-3xl">
              {groups.filter(g => g.isActive).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 md:p-4 pb-1 md:pb-2">
            <CardDescription className="text-xs">Студентов</CardDescription>
            <CardTitle className="text-xl md:text-3xl">
              {groups.reduce((sum, g) => sum + g._count.students, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию или устазу..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterUstaz} onValueChange={setFilterUstaz}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Устаз" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все устазы</SelectItem>
                {ustazList.map((ustaz) => (
                  <SelectItem key={ustaz.id} value={ustaz.id}>
                    {ustaz.firstName} {ustaz.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Уровень" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все уровни</SelectItem>
                <SelectItem value="LEVEL_1">1 строка</SelectItem>
                <SelectItem value="LEVEL_2">3 строки</SelectItem>
                <SelectItem value="LEVEL_3">7 строк</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Группы не найдены
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: Cards */}
          <div className="md:hidden space-y-3">
            {filteredGroups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>

          {/* Desktop: Table */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Устаз</TableHead>
                  <TableHead className="text-center">Уровень</TableHead>
                  <TableHead className="text-center">Студенты</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <Link href={`/admin/groups/${group.id}`} className="font-medium hover:underline">
                        {group.name}
                      </Link>
                      {group.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {group.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {group.ustaz?.firstName} {group.ustaz?.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {group.ustaz?.phone}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`${LEVEL_COLORS[group.level]} border`}>
                        <GraduationCap className="mr-1 h-3 w-3" />
                        {LEVEL_LABELS[group.level]?.lines || group.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        <Users className="mr-1 h-3 w-3" />
                        {group._count.students}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={group.isActive ? 'default' : 'secondary'}>
                        {group.isActive ? 'Активна' : 'Неактивна'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/groups/${group.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <Link href={`/admin/groups/${group.id}`}>
                              <DropdownMenuItem>
                                <Pencil className="mr-2 h-4 w-4" />
                                Редактировать
                              </DropdownMenuItem>
                            </Link>
                            <DropdownMenuItem onClick={() => handleToggleActive(group.id, group.isActive)}>
                              {group.isActive ? (
                                <>
                                  <PowerOff className="mr-2 h-4 w-4" />
                                  Деактивировать
                                </>
                              ) : (
                                <>
                                  <Power className="mr-2 h-4 w-4" />
                                  Активировать
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(group.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
    </div>
  )
}
