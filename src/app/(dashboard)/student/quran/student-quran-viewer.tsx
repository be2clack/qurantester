'use client'

import { MedinaMushhafViewer } from '@/components/quran/medina-viewer'

interface StudentQuranViewerProps {
  currentPage: number
  currentLine: number
  currentStage: string
  stageName: string
}

export function StudentQuranViewer({ currentPage, currentLine, currentStage, stageName }: StudentQuranViewerProps) {
  return (
    <MedinaMushhafViewer
      initialPage={currentPage}
      initialLine={currentLine}
      showProgress={{
        currentPage,
        currentLine,
        currentStage,
        stageName,
      }}
    />
  )
}
