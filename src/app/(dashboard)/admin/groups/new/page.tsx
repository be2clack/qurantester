'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Loader2, Users } from 'lucide-react'

interface Ustaz {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
}

const LESSON_TYPES = [
  { value: 'MEMORIZATION', label: 'Заучивание', prefix: 'ЗА' },
  { value: 'REVISION', label: 'Повторение', prefix: 'ПО' },
  { value: 'TRANSLATION', label: 'Перевод', prefix: 'ПЕ' },
]

const GROUP_LEVELS = [
  { value: 'LEVEL_1', label: 'Уровень 1', description: '1 строка за 12ч' },
  { value: 'LEVEL_2', label: 'Уровень 2', description: '3 строки за 12ч' },
  { value: 'LEVEL_3', label: 'Уровень 3', description: '7 строк за 12ч' },
]

export default function NewGroupPage() {
  const router = useRouter()
  const [ustazList, setUstazList] = useState<Ustaz[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    description: '',
    ustazId: '',
    level: 'LEVEL_1',
    lessonType: 'MEMORIZATION',
  })

  // Генерация превью имени: ЗА-25-1-X
  const getAutoName = () => {
    const typePrefix = LESSON_TYPES.find(t => t.value === formData.lessonType)?.prefix || 'ЗА'
    const levelNumber = formData.level.replace('LEVEL_', '')
    const year = new Date().getFullYear().toString().slice(-2)
    return `${typePrefix}-${year}-${levelNumber}`
  }

  const getTypeName = (value: string) => LESSON_TYPES.find(t => t.value === value)?.label || value

  useEffect(() => {
    async function fetchUstazs() {
      try {
        const res = await fetch('/api/users?role=USTAZ&limit=100')
        const data = await res.json()
        setUstazList(data.items || [])
      } catch (err) {
        console.error('Failed to fetch ustazs:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUstazs()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    if (!formData.ustazId) {
      setError('Выберите устаза')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: formData.description || undefined,
          ustazId: formData.ustazId,
          level: formData.level,
          lessonType: formData.lessonType,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create group')
      }

      router.push('/admin/groups')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания группы')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Новая группа</h1>
          <p className="text-muted-foreground">Создание учебной группы</p>
        </div>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Данные группы
          </CardTitle>
          <CardDescription>
            Заполните информацию о новой группе
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lessonType">Тип урока *</Label>
              <Select
                value={formData.lessonType}
                onValueChange={(value) => setFormData({ ...formData, lessonType: value })}
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
              <Label htmlFor="level">Уровень группы *</Label>
              <Select
                value={formData.level}
                onValueChange={(value) => setFormData({ ...formData, level: value })}
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

            <div className="space-y-2">
              <Label htmlFor="ustaz">Устаз (учитель) *</Label>
              <Select
                value={formData.ustazId}
                onValueChange={(value) => setFormData({ ...formData, ustazId: value })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите устаза" />
                </SelectTrigger>
                <SelectContent>
                  {ustazList.map((ustaz) => (
                    <SelectItem key={ustaz.id} value={ustaz.id}>
                      {ustaz.firstName} {ustaz.lastName} ({ustaz.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ustazList.length === 0 && !loading && (
                <p className="text-xs text-muted-foreground">
                  Нет доступных устазов. Сначала создайте пользователя с ролью Устаз.
                </p>
              )}
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm text-muted-foreground">Название группы (генерируется автоматически)</p>
              <p className="text-2xl font-bold">{getAutoName()}-<span className="text-muted-foreground">X</span></p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• {getTypeName(formData.lessonType)} → <span className="font-mono">{LESSON_TYPES.find(t => t.value === formData.lessonType)?.prefix}</span></p>
                <p>• {GROUP_LEVELS.find(l => l.value === formData.level)?.label} → <span className="font-mono">{formData.level.replace('LEVEL_', '')}</span></p>
                <p>• X = порядковый номер группы</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Краткое описание группы..."
                rows={3}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving || loading}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Создание...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Создать группу
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
