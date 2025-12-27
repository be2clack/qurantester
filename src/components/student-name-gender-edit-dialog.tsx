'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Loader2, Check, ChevronsUpDown, User, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Parent {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
}

interface StudentNameGenderEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: {
    id: string
    firstName: string | null
    lastName: string | null
    gender: 'MALE' | 'FEMALE' | null
    childOf?: Parent[]
  } | null
  onSuccess: () => void
}

const GENDERS = [
  { value: 'MALE', label: 'Мужской', icon: '👨' },
  { value: 'FEMALE', label: 'Женский', icon: '🧕' },
]

export function StudentNameGenderEditDialog({
  open,
  onOpenChange,
  student,
  onSuccess,
}: StudentNameGenderEditDialogProps) {
  const [firstName, setFirstName] = useState(student?.firstName || '')
  const [lastName, setLastName] = useState(student?.lastName || '')
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | null>(student?.gender || null)
  const [selectedParents, setSelectedParents] = useState<Parent[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Parent search state
  const [parentSearchOpen, setParentSearchOpen] = useState(false)
  const [parentSearch, setParentSearch] = useState('')
  const [parentList, setParentList] = useState<Parent[]>([])
  const [loadingParents, setLoadingParents] = useState(false)

  // Fetch parents with search
  const fetchParents = useCallback(async (search: string) => {
    setLoadingParents(true)
    try {
      const params = new URLSearchParams({ role: 'PARENT', limit: '50' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/users?${params}`)
      const data = await res.json()
      setParentList(data.items || [])
    } catch (err) {
      console.error('Failed to fetch parents:', err)
    } finally {
      setLoadingParents(false)
    }
  }, [])

  // Load parents when dialog opens
  useEffect(() => {
    if (open) {
      fetchParents('')
    }
  }, [open, fetchParents])

  // Update state when student changes
  useEffect(() => {
    if (student) {
      setFirstName(student.firstName || '')
      setLastName(student.lastName || '')
      setGender(student.gender || null)
      setSelectedParents(student.childOf || [])
    }
  }, [student])

  // Debounced parent search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (parentSearchOpen) {
        fetchParents(parentSearch)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [parentSearch, parentSearchOpen, fetchParents])

  const handleSave = async () => {
    if (!student) return

    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/users/${student.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName || null,
          lastName: lastName || null,
          gender: gender,
          parentIds: selectedParents.map(p => p.id),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update')
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving')
    } finally {
      setSaving(false)
    }
  }

  const addParent = (parent: Parent) => {
    if (!selectedParents.some(p => p.id === parent.id)) {
      setSelectedParents([...selectedParents, parent])
    }
    setParentSearchOpen(false)
    setParentSearch('')
  }

  const removeParent = (parentId: string) => {
    setSelectedParents(selectedParents.filter(p => p.id !== parentId))
  }

  const getParentName = (parent: Parent) => {
    return parent.firstName || parent.lastName
      ? `${parent.firstName || ''} ${parent.lastName || ''}`.trim()
      : parent.phone
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Редактировать студента</DialogTitle>
          <DialogDescription>
            Изменить данные студента
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Имя</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Имя"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Фамилия</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Фамилия"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Пол</Label>
            <div className="grid grid-cols-2 gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGender(g.value as 'MALE' | 'FEMALE')}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    gender === g.value
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <span className="text-2xl block mb-1">{g.icon}</span>
                  <span className="font-semibold text-sm">{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Parent selection with search */}
          <div className="space-y-2">
            <Label>Родители</Label>

            {/* Selected parents */}
            {selectedParents.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedParents.map((parent) => (
                  <Badge key={parent.id} variant="secondary" className="flex items-center gap-1 pr-1">
                    <User className="h-3 w-3" />
                    {getParentName(parent)}
                    <button
                      type="button"
                      onClick={() => removeParent(parent.id)}
                      className="ml-1 rounded-full hover:bg-muted p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Parent search combobox */}
            <Popover open={parentSearchOpen} onOpenChange={setParentSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={parentSearchOpen}
                  className="w-full justify-between"
                >
                  <span className="text-muted-foreground">Добавить родителя...</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Поиск по имени или телефону..."
                    value={parentSearch}
                    onValueChange={setParentSearch}
                  />
                  <CommandList>
                    {loadingParents ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : parentList.length === 0 ? (
                      <CommandEmpty>Родители не найдены</CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {parentList
                          .filter(p => !selectedParents.some(sp => sp.id === p.id))
                          .map((parent) => (
                            <CommandItem
                              key={parent.id}
                              value={parent.id}
                              onSelect={() => addParent(parent)}
                            >
                              <User className="mr-2 h-4 w-4" />
                              <div className="flex-1">
                                <div className="font-medium">{getParentName(parent)}</div>
                                <div className="text-xs text-muted-foreground">{parent.phone}</div>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
