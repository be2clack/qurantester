'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, UserPlus, Check, BookOpen, Phone } from 'lucide-react'

interface StudentResult {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
  currentPage: number
  groups: { name: string }[]
}

export function AddChildDialog({ onRequestSent }: { onRequestSent?: () => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StudentResult[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/parent/search-students?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.items)
      }
    } catch {
      setError('Ошибка поиска')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  const sendRequest = async (studentId: string) => {
    setSending(studentId)
    setError(null)
    try {
      const res = await fetch('/api/parent/link-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })

      if (res.ok) {
        setSentIds(prev => new Set(prev).add(studentId))
        onRequestSent?.()
      } else {
        const data = await res.json()
        if (res.status === 409) {
          setError(data.error === 'Already linked to this student'
            ? 'Ребёнок уже привязан'
            : 'Заявка уже отправлена')
        } else {
          setError(data.error || 'Ошибка отправки')
        }
      }
    } catch {
      setError('Ошибка сети')
    } finally {
      setSending(null)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      setQuery('')
      setResults([])
      setSentIds(new Set())
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Добавить ребёнка
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Найти ребёнка</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="+7 700 123 4567"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              type="tel"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : query.replace(/[^\d]/g, '').length < 3 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Введите номер телефона ребёнка
              </p>
            ) : results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Ничего не найдено
              </p>
            ) : (
              results.map((student) => {
                const name = [student.firstName, student.lastName].filter(Boolean).join(' ') || 'Студент'
                const isSent = sentIds.has(student.id)

                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{student.phone}</span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <BookOpen className="h-3 w-3" />
                          <span>Стр. {student.currentPage}</span>
                        </div>
                        {student.groups.map((g, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {g.name}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {isSent ? (
                      <Button size="sm" variant="ghost" disabled>
                        <Check className="h-4 w-4 mr-1 text-green-500" />
                        <span className="text-xs">Отправлено</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendRequest(student.id)}
                        disabled={sending === student.id}
                      >
                        {sending === student.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-1" />
                            <span className="text-xs">Заявка</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            После отправки заявки ребёнок получит уведомление и должен будет подтвердить привязку.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
