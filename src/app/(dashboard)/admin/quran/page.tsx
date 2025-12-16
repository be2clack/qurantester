'use client'

import { BookOpen, Cloud } from 'lucide-react'
import { MedinaMushhafViewer } from '@/components/quran/medina-viewer'

export default function QuranAdminPage() {
  return (
    <div className="space-y-6">
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

      <MedinaMushhafViewer />
    </div>
  )
}
