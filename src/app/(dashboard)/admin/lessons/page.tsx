'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { BookOpen, Plus, Search, Loader2, Pencil, Trash2, Users, Clock, Mic, Video, MessageSquare } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

interface Lesson {
  id: string
  name: string
  type: 'MEMORIZATION' | 'REVISION' | 'TRANSLATION'
  repetitionCount: number
  stage1Days: number
  stage2Days: number
  stage3Days: number
  allowVoice: boolean
  allowVideoNote: boolean
  allowText: boolean
  isActive: boolean
  groupId: string
  group: {
    id: string
    name: string
  }
  _count: {
    tasks: number
  }
}

interface Group {
  id: string
  name: string
}

const LESSON_TYPES = [
  { value: 'MEMORIZATION', label: 'Заучивание' },
  { value: 'REVISION', label: 'Повторение' },
  { value: 'TRANSLATION', label: 'Перевод' },
]

const TYPE_LABELS: Record<string, string> = {
  MEMORIZATION: 'Заучивание',
  REVISION: 'Повторение',
  TRANSLATION: 'Перевод',
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    type: 'MEMORIZATION',
    repetitionCount: 80,
    stage1Days: 1,
    stage2Days: 2,
    stage3Days: 2,
    groupId: '',
    allowVoice: true,
    allowVideoNote: true,
    allowText: false,
  })

  useEffect(() => {
    fetchLessons()
    fetchGroups()
  }, [selectedGroup])

  async function fetchLessons() {
    setLoading(true)
    try {
      let url = '/api/lessons?limit=50'
      if (selectedGroup) url += `&groupId=${selectedGroup}`

      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setLessons(data.items || data || [])
      }
    } catch (err) {
      console.error('Failed to fetch lessons:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchGroups() {
    try {
      const res = await fetch('/api/groups?limit=100')
      if (res.ok) {
        const data = await res.json()
        setGroups(data.items || [])
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err)
    }
  }

  const filteredLessons = lessons.filter(lesson =>
    lesson.name.toLowerCase().includes(search.toLowerCase()) ||
    lesson.group?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const openCreateDialog = () => {
    setEditingLesson(null)
    setFormData({
      name: '',
      type: 'MEMORIZATION',
      repetitionCount: 80,
      stage1Days: 1,
      stage2Days: 2,
      stage3Days: 2,
      groupId: groups[0]?.id || '',
      allowVoice: true,
      allowVideoNote: true,
      allowText: false,
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (lesson: Lesson) => {
    setEditingLesson(lesson)
    setFormData({
      name: lesson.name,
      type: lesson.type,
      repetitionCount: lesson.repetitionCount,
      stage1Days: lesson.stage1Days,
      stage2Days: lesson.stage2Days,
      stage3Days: lesson.stage3Days,
      groupId: lesson.groupId,
      allowVoice: lesson.allowVoice,
      allowVideoNote: lesson.allowVideoNote,
      allowText: lesson.allowText,
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = editingLesson ? `/api/lessons/${editingLesson.id}` : '/api/lessons'
      const method = editingLesson ? 'PATCH' : 'POST'

      // Авто-генерация имени если пустое
      const dataToSend = {
        ...formData,
        name: formData.name.trim() || `${TYPE_LABELS[formData.type]} - ${new Date().toLocaleDateString('ru')}`,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      })

      if (res.ok) {
        await fetchLessons()
        setIsDialogOpen(false)
      }
    } catch (err) {
      console.error('Failed to save lesson:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить урок?')) return

    try {
      const res = await fetch(`/api/lessons/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchLessons()
      }
    } catch (err) {
      console.error('Failed to delete lesson:', err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Уроки
          </h1>
          <p className="text-muted-foreground">
            Управление уроками и настройками этапов
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Новый урок
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingLesson ? 'Редактировать урок' : 'Новый урок'}
              </DialogTitle>
              <DialogDescription>
                Настройте параметры урока и этапов обучения
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="group">Группа *</Label>
                <Select
                  value={formData.groupId}
                  onValueChange={(v) => setFormData({ ...formData, groupId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите группу" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Тип урока *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LESSON_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Название</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={`${TYPE_LABELS[formData.type]} - ${new Date().toLocaleDateString('ru')}`}
                />
                <p className="text-xs text-muted-foreground">
                  Оставьте пустым для авто-генерации
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="repetitionCount">Количество повторений</Label>
                <Input
                  id="repetitionCount"
                  type="number"
                  min={1}
                  value={formData.repetitionCount}
                  onChange={(e) => setFormData({ ...formData, repetitionCount: parseInt(e.target.value) || 80 })}
                />
                <p className="text-xs text-muted-foreground">
                  Студент должен сдать ВСЕ повторения без ошибок
                </p>
              </div>

              <div className="space-y-3 p-3 bg-muted rounded-lg">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Дней на каждый этап
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="stage1Days" className="text-xs">Этап 1.x</Label>
                    <Input
                      id="stage1Days"
                      type="number"
                      min={1}
                      value={formData.stage1Days}
                      onChange={(e) => setFormData({ ...formData, stage1Days: parseInt(e.target.value) || 1 })}
                    />
                    <p className="text-xs text-muted-foreground">Изучение</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="stage2Days" className="text-xs">Этап 2.x</Label>
                    <Input
                      id="stage2Days"
                      type="number"
                      min={1}
                      value={formData.stage2Days}
                      onChange={(e) => setFormData({ ...formData, stage2Days: parseInt(e.target.value) || 2 })}
                    />
                    <p className="text-xs text-muted-foreground">Повторение</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="stage3Days" className="text-xs">Этап 3</Label>
                    <Input
                      id="stage3Days"
                      type="number"
                      min={1}
                      value={formData.stage3Days}
                      onChange={(e) => setFormData({ ...formData, stage3Days: parseInt(e.target.value) || 2 })}
                    />
                    <p className="text-xs text-muted-foreground">Вся страница</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-3 border rounded-lg">
                <Label>Принимаемые форматы сдачи</Label>
                <p className="text-xs text-muted-foreground">
                  Выберите, какие типы сообщений бот будет принимать от студентов
                </p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowVoice"
                      checked={formData.allowVoice}
                      onCheckedChange={(checked) => setFormData({ ...formData, allowVoice: checked as boolean })}
                    />
                    <label
                      htmlFor="allowVoice"
                      className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer"
                    >
                      <Mic className="h-4 w-4" />
                      Голосовые
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowVideoNote"
                      checked={formData.allowVideoNote}
                      onCheckedChange={(checked) => setFormData({ ...formData, allowVideoNote: checked as boolean })}
                    />
                    <label
                      htmlFor="allowVideoNote"
                      className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer"
                    >
                      <Video className="h-4 w-4" />
                      Кружочки
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allowText"
                      checked={formData.allowText}
                      onCheckedChange={(checked) => setFormData({ ...formData, allowText: checked as boolean })}
                    />
                    <label
                      htmlFor="allowText"
                      className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Текст
                    </label>
                  </div>
                </div>
                {!formData.allowVoice && !formData.allowVideoNote && !formData.allowText && (
                  <p className="text-xs text-destructive">
                    Выберите хотя бы один формат!
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" disabled={saving || !formData.groupId || (!formData.allowVoice && !formData.allowVideoNote && !formData.allowText)}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingLesson ? 'Сохранить' : 'Создать'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по названию..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <Select value={selectedGroup || 'all'} onValueChange={(v) => setSelectedGroup(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Все группы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все группы</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lessons Table */}
      <Card>
        <CardHeader>
          <CardTitle>Список уроков</CardTitle>
          <CardDescription>
            Всего: {filteredLessons.length} уроков
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredLessons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {lessons.length === 0 ? 'Уроки не созданы' : 'Уроки не найдены'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Группа</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead className="text-center">Повторений</TableHead>
                  <TableHead className="text-center">Форматы</TableHead>
                  <TableHead className="text-center">Дни (1/2/3)</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLessons.map((lesson) => (
                  <TableRow key={lesson.id}>
                    <TableCell>
                      <div className="font-medium">{lesson.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {lesson.group?.name || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TYPE_LABELS[lesson.type] || lesson.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{lesson.repetitionCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {lesson.allowVoice && (
                          <Badge variant="outline" className="gap-1">
                            <Mic className="h-3 w-3" />
                          </Badge>
                        )}
                        {lesson.allowVideoNote && (
                          <Badge variant="outline" className="gap-1">
                            <Video className="h-3 w-3" />
                          </Badge>
                        )}
                        {lesson.allowText && (
                          <Badge variant="outline" className="gap-1">
                            <MessageSquare className="h-3 w-3" />
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-sm">
                        <span className="text-muted-foreground">{lesson.stage1Days}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-muted-foreground">{lesson.stage2Days}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-muted-foreground">{lesson.stage3Days}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={lesson.isActive ? 'default' : 'secondary'}>
                        {lesson.isActive ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(lesson)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(lesson.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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
