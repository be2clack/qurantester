'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, Cloud, Languages, RefreshCw, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { MedinaMushhafViewer } from '@/components/quran/medina-viewer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

const TOTAL_PAGES = 604
const BATCH_SIZE = 20

export default function QuranAdminPage() {
  const [isOpen, setIsOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncedCount, setSyncedCount] = useState(0)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const syncAllPages = async () => {
    setSyncing(true)
    setSyncedCount(0)
    setError('')
    setDone(false)

    try {
      for (let start = 1; start <= TOTAL_PAGES; start += BATCH_SIZE) {
        const end = Math.min(start + BATCH_SIZE - 1, TOTAL_PAGES)

        const res = await fetch('/api/admin/quran/sync-pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startPage: start, endPage: end })
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || `Ошибка на страницах ${start}-${end}`)
        }

        setSyncedCount(end)
      }

      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  const progress = (syncedCount / TOTAL_PAGES) * 100

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Коран
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Мединский мусхаф (Quran.com API)
          </p>
        </div>
        <Link href="/admin/quran/mufradat">
          <Button variant="outline">
            <Languages className="h-4 w-4 mr-2" />
            Муфрадат (переводы)
          </Button>
        </Link>
      </div>

      {/* Collapsible Sync Section */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none py-3"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <RefreshCw className="h-4 w-4" />
                Синхронизация страниц
              </CardTitle>
              <CardDescription className="text-sm">
                Синхронизация количества строк с Quran.com API
              </CardDescription>
            </div>
            {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </CardHeader>

        {isOpen && (
          <CardContent className="space-y-4 pt-0">
            <Button
              onClick={syncAllPages}
              disabled={syncing}
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? `Синхронизация... ${syncedCount}/${TOTAL_PAGES}` : 'Синхронизировать все страницы'}
            </Button>

            {syncing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">
                  {syncedCount} из {TOTAL_PAGES} страниц
                </p>
              </div>
            )}

            {done && !syncing && (
              <div className="flex items-center gap-2 p-2 rounded-md text-sm bg-green-50 text-green-700">
                <Check className="h-4 w-4" />
                Синхронизировано {TOTAL_PAGES} страниц
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-2 rounded-md text-sm bg-red-50 text-red-700">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <MedinaMushhafViewer />
    </div>
  )
}
