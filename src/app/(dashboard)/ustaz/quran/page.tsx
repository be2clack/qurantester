import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MedinaMushhafViewer } from '@/components/quran/medina-viewer'

interface PageProps {
  searchParams: Promise<{
    page?: string
    startLine?: string
    endLine?: string
  }>
}

export default async function UstazQuranPage({ searchParams }: PageProps) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (user.role !== 'USTAZ' && user.role !== 'ADMIN') {
    redirect('/student/quran')
  }

  const params = await searchParams
  const initialPage = params.page ? parseInt(params.page, 10) : 1
  const startLine = params.startLine ? parseInt(params.startLine, 10) : undefined
  const endLine = params.endLine ? parseInt(params.endLine, 10) : undefined

  // Ustaz views Quran - with optional line highlighting for submissions
  return (
    <div className="container mx-auto py-4 px-2 sm:px-4">
      <h1 className="text-xl font-bold mb-4">📖 Коран</h1>
      {startLine && endLine && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            📍 Страница {initialPage}, строки {startLine}-{endLine}
          </p>
        </div>
      )}
      <MedinaMushhafViewer
        initialPage={initialPage}
        highlightLines={startLine && endLine ? { start: startLine, end: endLine } : undefined}
      />
    </div>
  )
}
