'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Settings, Save, Loader2, Phone, MessageSquare, BookOpen, Layers, GraduationCap, Key, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Setting {
  id: string
  key: string
  value: string
  description: string | null
}

// Group settings by category
const settingGroups = {
  contact: {
    title: 'Контакты для связи',
    description: 'Информация для новых пользователей',
    icon: Phone,
    keys: ['admin_contact_telegram', 'admin_contact_phone', 'support_message']
  },
  lessons: {
    title: 'Параметры уроков по умолчанию',
    description: 'Настройки создаваемых уроков',
    icon: BookOpen,
    keys: ['default_repetition_count', 'stage1_days', 'stage2_days', 'stage3_days']
  },
  bot: {
    title: 'Сообщения бота',
    description: 'Текст сообщений Telegram бота',
    icon: MessageSquare,
    keys: ['bot_welcome_message', 'bot_registration_message']
  }
}

const settingLabels: Record<string, string> = {
  'admin_contact_telegram': 'Telegram админа',
  'admin_contact_phone': 'Телефон админа',
  'support_message': 'Сообщение поддержки',
  'default_repetition_count': 'Количество повторений (все должны быть сданы)',
  'stage1_days': 'Дней на этап 1 (1.1 и 1.2)',
  'stage2_days': 'Дней на этап 2 (2.1 и 2.2)',
  'stage3_days': 'Дней на этап 3 (вся страница)',
  'bot_welcome_message': 'Приветственное сообщение',
  'bot_registration_message': 'Сообщение регистрации',
}

const LEVELS_INFO = [
  { level: 'LEVEL_1', name: 'Уровень 1', description: '1 строка за 12 часов', color: 'bg-green-500' },
  { level: 'LEVEL_2', name: 'Уровень 2', description: '3 строки за 12 часов', color: 'bg-yellow-500' },
  { level: 'LEVEL_3', name: 'Уровень 3', description: '7 строк за 12 часов', color: 'bg-red-500' },
]

const STAGES_INFO = [
  {
    stage: 'STAGE_1_1',
    name: 'Этап 1.1',
    description: 'Учим строки 1-7 по одной (или 3/7 в зависимости от уровня)',
    details: 'Студент заучивает первые 7 строк страницы поочередно'
  },
  {
    stage: 'STAGE_1_2',
    name: 'Этап 1.2',
    description: 'Повторяем строки 1-7 вместе',
    details: 'Все 80 повторений должны быть сданы правильно'
  },
  {
    stage: 'STAGE_2_1',
    name: 'Этап 2.1',
    description: 'Учим строки 8-15 по одной',
    details: 'Студент заучивает оставшиеся строки страницы'
  },
  {
    stage: 'STAGE_2_2',
    name: 'Этап 2.2',
    description: 'Повторяем строки 8-15 вместе',
    details: 'Все 80 повторений должны быть сданы правильно'
  },
  {
    stage: 'STAGE_3',
    name: 'Этап 3',
    description: 'Повторяем всю страницу 1-15',
    details: 'Финальное закрепление всей страницы (80 раз)'
  },
]

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modified, setModified] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleChange(key: string, value: string) {
    setModified(prev => ({ ...prev, [key]: value }))
  }

  function getValue(key: string): string {
    if (key in modified) return modified[key]
    const setting = settings.find(s => s.key === key)
    return setting?.value || ''
  }

  async function handleSave() {
    setSaving(true)
    try {
      const settingsToUpdate = Object.entries(modified).map(([key, value]) => ({
        key,
        value
      }))

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsToUpdate })
      })

      if (res.ok) {
        await fetchSettings()
        setModified({})
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = Object.keys(modified).length > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Настройки системы
          </h2>
          <p className="text-muted-foreground">
            Управление параметрами системы
          </p>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Сохранить изменения
          </Button>
        )}
      </div>

      {/* API Settings Link */}
      <Link href="/admin/settings/api">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer mb-2">
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                  <Key className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Настройки API</CardTitle>
                  <CardDescription>Ключи Qurani.ai, Quran.com</CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>
      </Link>

      {/* Levels Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Уровни групп
          </CardTitle>
          <CardDescription>
            Уровень группы определяет скорость прохождения материала
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {LEVELS_INFO.map((level) => (
              <div key={level.level} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${level.color}`} />
                  <span className="font-medium">{level.name}</span>
                </div>
                <p className="text-sm text-muted-foreground">{level.description}</p>
                <Badge variant="outline" className="mt-2 text-xs">
                  {level.level}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            При создании группы выбирается уровень. Это влияет на количество строк,
            которые студент должен выучить за одно задание.
          </p>
        </CardContent>
      </Card>

      {/* Stages Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Этапы обучения
          </CardTitle>
          <CardDescription>
            Каждая страница Корана проходится через 5 этапов
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {STAGES_INFO.map((stage, index) => (
              <div key={stage.stage} className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{stage.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {stage.stage}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1">{stage.description}</p>
                  <p className="text-xs text-muted-foreground">{stage.details}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Важно:</strong> Студент должен сдать ВСЕ повторения правильно.
              Если есть ошибки после 80 повторений, создается задание на пересдачу.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Settings Groups */}
      {Object.entries(settingGroups).map(([groupKey, group]) => (
        <Card key={groupKey}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <group.icon className="h-5 w-5" />
              {group.title}
            </CardTitle>
            <CardDescription>{group.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.keys.map(key => {
              const isTextarea = key.includes('message')
              const isBoolean = key.startsWith('allow_')
              const label = settingLabels[key] || key

              return (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  {isTextarea ? (
                    <Textarea
                      id={key}
                      value={getValue(key)}
                      onChange={(e) => handleChange(key, e.target.value)}
                      rows={3}
                    />
                  ) : isBoolean ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={key}
                        checked={getValue(key) === 'true'}
                        onChange={(e) => handleChange(key, e.target.checked ? 'true' : 'false')}
                        className="h-4 w-4"
                      />
                      <Label htmlFor={key} className="font-normal">
                        {getValue(key) === 'true' ? 'Включено' : 'Выключено'}
                      </Label>
                    </div>
                  ) : (
                    <Input
                      id={key}
                      value={getValue(key)}
                      onChange={(e) => handleChange(key, e.target.value)}
                    />
                  )}
                  {settings.find(s => s.key === key)?.description && (
                    <p className="text-sm text-muted-foreground">
                      {settings.find(s => s.key === key)?.description}
                    </p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
