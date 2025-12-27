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

const GROUP_LEVELS = [
  { value: 'LEVEL_1', label: 'Уровень 1', description: 'Начальный - студент сдаёт по 1 строке за раз', linesPerBatch: 1 },
  { value: 'LEVEL_2', label: 'Уровень 2', description: 'Средний - студент сдаёт по 3 строки за раз', linesPerBatch: 3 },
  { value: 'LEVEL_3', label: 'Уровень 3', description: 'Продвинутый - студент сдаёт по 7 строк за раз', linesPerBatch: 7 },
]

const GROUP_GENDERS = [
  { value: 'MALE', label: 'Мужская', prefix: 'М', icon: '👨' },
  { value: 'FEMALE', label: 'Женская', prefix: 'Ж', icon: '🧕' },
]

const LEVEL_COLORS: Record<string, string> = {
  LEVEL_1: 'bg-emerald-100 text-emerald-800',
  LEVEL_2: 'bg-blue-100 text-blue-800',
  LEVEL_3: 'bg-purple-100 text-purple-800',
}

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
    gender: 'MALE',
  })

  // Генерация превью имени: [ПОЛ]-[год]-[уровень]-X (например М-25-3-X)
  const getAutoName = () => {
    const genderPrefix = GROUP_GENDERS.find(g => g.value === formData.gender)?.prefix || 'М'
    const levelNumber = formData.level.replace('LEVEL_', '')
    const year = new Date().getFullYear().toString().slice(-2)
    return `${genderPrefix}-${year}-${levelNumber}`
  }

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
          gender: formData.gender,
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
            {/* Gender Selection */}
            <div className="space-y-2">
              <Label>Пол группы *</Label>
              <div className="grid grid-cols-2 gap-3">
                {GROUP_GENDERS.map((gender) => (
                  <button
                    key={gender.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: gender.value })}
                    className={`p-4 rounded-lg border-2 text-center transition-all ${
                      formData.gender === gender.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <span className="text-3xl block mb-1">{gender.icon}</span>
                    <span className="font-semibold">{gender.label}</span>
                    <span className="block text-sm text-muted-foreground">({gender.prefix})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="level">Уровень сложности *</Label>
              <div className="grid gap-3">
                {GROUP_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, level: level.value })}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      formData.level === level.value
                        ? `${LEVEL_COLORS[level.value]} border-current`
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-bold text-2xl w-10 h-10 flex items-center justify-center rounded-full ${LEVEL_COLORS[level.value]}`}>
                        {level.linesPerBatch}
                      </span>
                      <div>
                        <p className="font-semibold">{level.label}</p>
                        <p className="text-sm text-muted-foreground">{level.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
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

            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Название группы</p>
              <p className="text-2xl font-mono font-bold mt-1">{getAutoName()}-<span className="text-muted-foreground">X</span></p>
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                <p><strong>{GROUP_GENDERS.find(g => g.value === formData.gender)?.prefix}</strong> — {GROUP_GENDERS.find(g => g.value === formData.gender)?.label.toLowerCase()} группа</p>
                <p><strong>{new Date().getFullYear().toString().slice(-2)}</strong> — год создания</p>
                <p><strong>{formData.level.replace('LEVEL_', '')}</strong> — {GROUP_LEVELS.find(l => l.value === formData.level)?.linesPerBatch} {GROUP_LEVELS.find(l => l.value === formData.level)?.linesPerBatch === 1 ? 'строка' : 'строки'} за раз</p>
                <p><strong>X</strong> — порядковый номер группы</p>
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
