'use client'

import { MedinaMushhafViewer } from '@/components/quran/medina-viewer'

interface StudentQuranViewerProps {
  currentPage: number
  currentLine: number
  stageName: string
}

export function StudentQuranViewer({ currentPage, currentLine, stageName }: StudentQuranViewerProps) {
  return (
    <MedinaMushhafViewer
      initialPage={currentPage}
      initialLine={currentLine}
      showProgress={{
        currentPage,
        currentLine,
        stageName,
      }}
    />
  )
}
