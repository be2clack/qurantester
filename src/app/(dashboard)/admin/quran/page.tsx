'use client'

import Link from 'next/link'
import { BookOpen, Cloud, Languages } from 'lucide-react'
import { MedinaMushhafViewer } from '@/components/quran/medina-viewer'
import { Button } from '@/components/ui/button'

export default function QuranAdminPage() {
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

      <MedinaMushhafViewer />
    </div>
  )
}
