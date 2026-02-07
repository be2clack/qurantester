'use client'

import { useState, useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Loader2, UserPlus, Check, X } from 'lucide-react'

interface LinkRequest {
  id: string
  parentName: string
  createdAt: string
}

export function LinkRequestBanner() {
  const [requests, setRequests] = useState<LinkRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<string | null>(null)

  useEffect(() => {
    fetchRequests()
  }, [])

  async function fetchRequests() {
    try {
      const res = await fetch('/api/student/link-requests')
      if (res.ok) {
        const data = await res.json()
        setRequests(data.items)
      }
    } catch {
      // Silently ignore
    } finally {
      setLoading(false)
    }
  }

  async function respond(requestId: string, action: 'accept' | 'reject') {
    setResponding(requestId)
    try {
      const res = await fetch(`/api/parent/link-request/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setRequests(prev => prev.filter(r => r.id !== requestId))
      }
    } catch {
      // Silently ignore
    } finally {
      setResponding(null)
    }
  }

  if (loading || requests.length === 0) return null

  return (
    <div className="space-y-2">
      {requests.map((req) => (
        <Alert key={req.id} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <UserPlus className="h-4 w-4 shrink-0 text-blue-500" />
            <AlertDescription className="text-sm">
              <b>{req.parentName}</b> хочет привязать вас как ребёнка
            </AlertDescription>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {responding === req.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-2 text-xs"
                  onClick={() => respond(req.id, 'accept')}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Принять
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => respond(req.id, 'reject')}
                >
                  <X className="h-3 w-3 mr-1" />
                  Отклонить
                </Button>
              </>
            )}
          </div>
        </Alert>
      ))}
    </div>
  )
}
