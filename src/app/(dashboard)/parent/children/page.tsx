'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  User,
  BookOpen,
  TrendingUp,
  ChevronRight
} from 'lucide-react'

interface Child {
  id: string
  firstName: string | null
  lastName: string | null
  phone: string
  currentPage: number
  currentLine: number
  currentStage: string
  studentGroup: {
    name: string
  } | null
  statistics: {
    totalPagesCompleted: number
    currentStreak: number
    globalRank: number | null
  } | null
}

export default function ChildrenPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchChildren() {
      try {
        // Get current parent info and children
        const res = await fetch('/api/auth/me')
        const me = await res.json()

        // For now, we'll need to implement a parent-children endpoint
        // This is a placeholder
        setChildren([])
      } catch (err) {
        console.error('Failed to fetch children:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchChildren()
  }, [])

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'STAGE_1_1': return 'Этап 1.1'
      case 'STAGE_1_2': return 'Этап 1.2'
      case 'STAGE_2_1': return 'Этап 2.1'
      case 'STAGE_2_2': return 'Этап 2.2'
      case 'STAGE_3': return 'Этап 3'
      default: return stage
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Мои дети</h1>
        <p className="text-muted-foreground">Прогресс изучения Корана вашими детьми</p>
      </div>

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Нет привязанных детей</h3>
            <p className="text-muted-foreground mb-4">
              Попросите администратора привязать аккаунты ваших детей к вашему профилю
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child) => (
            <Card key={child.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle>{child.firstName} {child.lastName}</CardTitle>
                      <CardDescription>
                        {child.studentGroup?.name || 'Без группы'}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {getStageLabel(child.currentStage)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Прогресс</span>
                  </div>
                  <span className="font-bold">
                    {child.currentPage}-{child.currentLine}
                  </span>
                </div>

                <div className="space-y-1">
                  <Progress
                    value={(child.currentPage / 602) * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {((child.currentPage / 602) * 100).toFixed(1)}% завершено
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="p-2 bg-muted rounded text-center">
                    <p className="text-lg font-bold">
                      {child.statistics?.totalPagesCompleted || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Страниц</p>
                  </div>
                  <div className="p-2 bg-muted rounded text-center">
                    <p className="text-lg font-bold">
                      #{child.statistics?.globalRank || '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">Рейтинг</p>
                  </div>
                </div>

                <Link href={`/parent/children/${child.id}`}>
                  <Button variant="outline" className="w-full">
                    Подробнее
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
