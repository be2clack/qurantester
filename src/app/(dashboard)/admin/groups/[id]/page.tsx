'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Save, Loader2, Users, BookOpen, UserPlus, Trash2 } from 'lucide-react'
import { StageNumber, GroupLevel } from '@prisma/client'

const GROUP_LEVELS = [
  { value: 'LEVEL_1', label: 'Уровень 1 (1 строка за 12ч)' },
  { value: 'LEVEL_2', label: 'Уровень 2 (3 строки за 12ч)' },
  { value: 'LEVEL_3', label: 'Уровень 3 (7 строк за 12ч)' },
]

interface GroupData {
  id: string
  name: string
  description: string | null
  level: GroupLevel
  isActive: boolean
  ustazId: string
  ustaz: {
    id: string
    firstName: string | null
    lastName: string | null
    phone: string
  }
  students: {
    id: string
    firstName: string | null
    lastName: string | null
    phone: string
    currentPage: number
    currentLine: number
    currentStage: StageNumber
  }[]
  lessons: {
    id: string
    repetitionCount: number
    stage1Days: number
    stage2Days: number
    stage3Days: number
    isActive: boolean
  }[]
}

interface Ustaz {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
}

export default function EditGroupPage() {
  const params = useParams()
  const router = useRouter()
  const [group, setGroup] = useState<GroupData | null>(null)
  const [ustazList, setUstazList] = useState<Ustaz[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ustazId: '',
    level: 'LEVEL_1' as GroupLevel,
    isActive: true,
  })

  useEffect(() => {
    async function fetchData() {
      try {
        const [groupRes, ustazRes] = await Promise.all([
          fetch(`/api/groups/${params.id}`),
          fetch('/api/users?role=USTAZ&limit=100'),
        ])

        if (!groupRes.ok) throw new Error('Failed to fetch group')

        const groupData = await groupRes.json()
        const ustazData = await ustazRes.json()

        setGroup(groupData)
        setUstazList(ustazData.items || [])
        setFormData({
          name: groupData.name,
          description: groupData.description || '',
          ustazId: groupData.ustazId,
          level: groupData.level || 'LEVEL_1',
          isActive: groupData.isActive,
        })
      } catch (err) {
        setError('Ошибка загрузки данных')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/groups/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }

      router.push('/admin/groups')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm('Удалить студента из группы?')) return

    try {
      const res = await fetch(`/api/groups/${params.id}/students?studentId=${studentId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setGroup(prev => prev ? {
          ...prev,
          students: prev.students.filter(s => s.id !== studentId)
        } : null)
      }
    } catch (err) {
      console.error('Failed to remove student:', err)
    }
  }

  const getStageLabel = (stage: StageNumber) => {
    switch (stage) {
      case 'STAGE_1_1': return 'Этап 1.1'
      case 'STAGE_1_2': return 'Этап 1.2'
      case 'STAGE_2_1': return 'Этап 2.1'
      case 'STAGE_2_2': return 'Этап 2.2'
      case 'STAGE_3': return 'Этап 3'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Группа не найдена</p>
        <Button variant="link" onClick={() => router.back()}>
          Вернуться назад
        </Button>
      </div>
    )
  }

  const activeLesson = group.lessons.find(l => l.isActive)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-muted-foreground">
            {group.students.length} студентов
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Настройки группы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ustaz">Устаз</Label>
                <Select
                  value={formData.ustazId}
                  onValueChange={(value) => setFormData({ ...formData, ustazId: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ustazList.map((ustaz) => (
                      <SelectItem key={ustaz.id} value={ustaz.id}>
                        {ustaz.firstName} {ustaz.lastName} ({ustaz.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="level">Уровень группы</Label>
                <Select
                  value={formData.level}
                  onValueChange={(value) => setFormData({ ...formData, level: value as GroupLevel })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Определяет скорость прохождения материала
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Активна</Label>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Сохранить
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Настройки урока
            </CardTitle>
            <CardDescription>
              Текущие параметры обучения
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeLesson ? (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Повторений (все должны быть сданы)</p>
                  <p className="text-xl font-bold">{activeLesson.repetitionCount}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Дней на этап:</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-muted rounded">
                      <p className="text-lg font-bold">{activeLesson.stage1Days}</p>
                      <p className="text-xs text-muted-foreground">Этап 1</p>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <p className="text-lg font-bold">{activeLesson.stage2Days}</p>
                      <p className="text-xs text-muted-foreground">Этап 2</p>
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <p className="text-lg font-bold">{activeLesson.stage3Days}</p>
                      <p className="text-xs text-muted-foreground">Этап 3</p>
                    </div>
                  </div>
                </div>
                <Link href={`/admin/lessons/${activeLesson.id}`}>
                  <Button variant="outline" className="w-full">
                    Редактировать урок
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">Нет активного урока</p>
                <Link href={`/admin/lessons/new?groupId=${group.id}`}>
                  <Button>Создать урок</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Студенты группы</CardTitle>
            <Link href={`/admin/users/new?groupId=${group.id}`}>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Добавить студента
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {group.students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              В группе пока нет студентов
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Студент</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead className="text-center">Прогресс</TableHead>
                  <TableHead className="text-center">Этап</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <Link
                        href={`/admin/users/${student.id}`}
                        className="font-medium hover:underline"
                      >
                        {student.firstName} {student.lastName}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {student.phone}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {student.currentPage}-{student.currentLine}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {getStageLabel(student.currentStage)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveStudent(student.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
