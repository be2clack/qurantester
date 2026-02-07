'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { BookOpen, User, Clock, CheckCircle, XCircle } from 'lucide-react'
import { AddChildDialog } from '@/components/add-child-dialog'
import { QURAN_TOTAL_PAGES } from '@/lib/constants/quran'

interface ChildData {
  id: string
  name: string
  currentPage: number
  currentLine: number
  stage: string
  progressPercent: number
  groups: string[]
  totalTasksCompleted: number
  totalPagesCompleted: number
  globalRank: number | null
  currentStreak: number
}

interface RequestData {
  id: string
  studentName: string
  status: string
  createdAt: string
}

export function ChildrenPageClient({
  children,
  requests,
}: {
  children: ChildData[]
  requests: RequestData[]
}) {
  const router = useRouter()

  const pendingRequests = requests.filter(r => r.status === 'PENDING')
  const recentRequests = requests.filter(r => r.status !== 'PENDING').slice(0, 5)

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Мои дети</h1>
          <p className="text-muted-foreground text-sm">
            Прогресс изучения Корана вашими детьми
          </p>
        </div>
        <AddChildDialog onRequestSent={() => router.refresh()} />
      </div>

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Ожидают подтверждения
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/20"
              >
                <span className="text-sm">{req.studentName}</span>
                <Badge variant="outline" className="text-yellow-600">
                  Ожидание
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Children list */}
      {children.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Нет привязанных детей</h3>
            <p className="text-muted-foreground mb-4">
              Нажмите &laquo;Добавить ребёнка&raquo; для поиска и отправки заявки на привязку
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child) => (
            <Card key={child.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{child.name}</CardTitle>
                      {child.groups.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {child.groups.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Эт. {child.stage}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      Стр. {child.currentPage}:{child.currentLine}
                    </span>
                    <span>{child.progressPercent.toFixed(1)}%</span>
                  </div>
                  <Progress value={child.progressPercent} className="h-1.5" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-muted rounded text-center">
                    <p className="text-sm font-bold">{child.totalPagesCompleted}</p>
                    <p className="text-[10px] text-muted-foreground">Страниц</p>
                  </div>
                  <div className="p-2 bg-muted rounded text-center">
                    <p className="text-sm font-bold">{child.totalTasksCompleted}</p>
                    <p className="text-[10px] text-muted-foreground">Заданий</p>
                  </div>
                  <div className="p-2 bg-muted rounded text-center">
                    <p className="text-sm font-bold">
                      {child.globalRank ? `#${child.globalRank}` : '-'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Рейтинг</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent completed/rejected requests */}
      {recentRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">
              Недавние заявки
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {recentRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-2 rounded text-sm"
              >
                <span>{req.studentName}</span>
                {req.status === 'ACCEPTED' ? (
                  <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Принято
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-red-600">
                    <XCircle className="h-3 w-3 mr-1" />
                    Отклонено
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  )
}
