'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Loader2, UserPlus } from 'lucide-react'
import { UserRole } from '@prisma/client'
import { PhoneInput } from '@/components/users/phone-input'

interface Group {
  id: string
  name: string
}

export default function NewUserPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    phone: '',
    firstName: '',
    lastName: '',
    role: 'STUDENT' as UserRole,
    groupId: '',
  })

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('/api/groups?limit=100&activeOnly=true')
        const data = await res.json()
        setGroups(data.items || [])
      } catch (err) {
        console.error('Failed to fetch groups:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchGroups()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    if (!formData.phone.startsWith('+') || formData.phone.length < 10) {
      setError('Введите корректный номер телефона с кодом страны')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          groupId: formData.role === UserRole.STUDENT ? formData.groupId || undefined : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create user')
      }

      router.push('/admin/users')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания пользователя')
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
          <h1 className="text-2xl font-bold">Новый пользователь</h1>
          <p className="text-muted-foreground">Создание нового пользователя в системе</p>
        </div>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Данные пользователя
          </CardTitle>
          <CardDescription>
            Заполните информацию о новом пользователе
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Номер телефона *</Label>
              <PhoneInput
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
              />
              <p className="text-xs text-muted-foreground">
                Формат: +7XXXXXXXXXX или +1XXXXXXXXXX
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Имя</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Имя"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Фамилия</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Фамилия"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Роль *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Администратор</SelectItem>
                  <SelectItem value="USTAZ">Устаз (учитель)</SelectItem>
                  <SelectItem value="STUDENT">Студент</SelectItem>
                  <SelectItem value="PARENT">Родитель</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.role === UserRole.STUDENT && (
              <div className="space-y-2">
                <Label htmlFor="group">Группа</Label>
                <Select
                  value={formData.groupId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, groupId: value === 'none' ? '' : value })}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите группу (опционально)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без группы</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Студента можно добавить в группу позже
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Создание...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Создать
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
