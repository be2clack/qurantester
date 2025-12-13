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
import { Plus, Search, Users, BookOpen, Loader2, MoreHorizontal, Pencil, Trash2, Power, PowerOff } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Group {
  id: string
  name: string
  description: string | null
  level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'
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

const LEVEL_LABELS: Record<string, string> = {
  LEVEL_1: 'Ур. 1',
  LEVEL_2: 'Ур. 2',
  LEVEL_3: 'Ур. 3',
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchGroups()
  }, [page])

  async function fetchGroups() {
    setLoading(true)
    try {
      const res = await fetch(`/api/groups?page=${page}&limit=20`)
      const data = await res.json()
      setGroups(data.items || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Failed to fetch groups:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(search.toLowerCase()) ||
    group.ustaz?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
    group.ustaz?.lastName?.toLowerCase().includes(search.toLowerCase())
  )

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Группы</h1>
          <p className="text-muted-foreground">Управление учебными группами</p>
        </div>
        <Link href="/admin/groups/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Новая группа
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Всего групп</CardDescription>
            <CardTitle className="text-3xl">{total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Активных групп</CardDescription>
            <CardTitle className="text-3xl">
              {groups.filter(g => g.isActive).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Всего студентов</CardDescription>
            <CardTitle className="text-3xl">
              {groups.reduce((sum, g) => sum + g._count.students, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список групп</CardTitle>
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию или устазу..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Группы не найдены
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Устаз</TableHead>
                  <TableHead className="text-center">Уровень</TableHead>
                  <TableHead className="text-center">Студенты</TableHead>
                  <TableHead className="text-center">Уроки</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <Link
                        href={`/admin/groups/${group.id}`}
                        className="font-medium hover:underline"
                      >
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
                      <Badge variant="secondary">
                        {LEVEL_LABELS[group.level] || group.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        <Users className="mr-1 h-3 w-3" />
                        {group._count.students}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        <BookOpen className="mr-1 h-3 w-3" />
                        {group._count.lessons}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={group.isActive ? 'default' : 'secondary'}>
                        {group.isActive ? 'Активна' : 'Неактивна'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
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
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(group.id, group.isActive)}
                          >
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
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(group.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {total > 20 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Назад
              </Button>
              <span className="flex items-center px-4">
                Страница {page} из {Math.ceil(total / 20)}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => p + 1)}
                disabled={page * 20 >= total}
              >
                Далее
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
