'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Loader2,
  Users,
  BookOpen,
  ChevronRight,
  GraduationCap,
  Clock,
} from 'lucide-react'
import Link from 'next/link'

interface Group {
  id: string
  name: string
  description: string | null
  level: string
  lessonType: string
  isActive: boolean
  _count: {
    students: number
  }
  students: {
    id: string
    firstName: string | null
    lastName: string | null
    currentPage: number
    currentStage: string
    tasks: {
      passedCount: number
      requiredCount: number
    }[]
  }[]
}

export default function UstazGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGroups()
  }, [])

  async function fetchGroups() {
    try {
      const res = await fetch('/api/ustaz/groups')
      const data = await res.json()
      setGroups(data || [])
    } catch (err) {
      console.error('Failed to fetch groups:', err)
    } finally {
      setLoading(false)
    }
  }

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'LEVEL_1': return 'Уровень 1'
      case 'LEVEL_2': return 'Уровень 2'
      case 'LEVEL_3': return 'Уровень 3'
      default: return level
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'LEVEL_1': return 'bg-green-500'
      case 'LEVEL_2': return 'bg-yellow-500'
      case 'LEVEL_3': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'MEMORIZATION': return 'Заучивание'
      case 'REVISION': return 'Повторение'
      case 'TRANSLATION': return 'Перевод'
      default: return type
    }
  }

  const getGroupProgress = (group: Group) => {
    if (!group.students.length) return 0
    const totalPages = group.students.reduce((sum, s) => sum + s.currentPage, 0)
    const avgPage = totalPages / group.students.length
    return Math.round((avgPage / 604) * 100)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Мои группы</h1>
        <p className="text-muted-foreground">Управление вашими группами студентов</p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">У вас пока нет групп</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {group.name}
                      {!group.isActive && (
                        <Badge variant="secondary">Неактивна</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{group.description}</CardDescription>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${getLevelColor(group.level)}`} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{group._count.students} студентов</span>
                  </div>
                  <Badge variant="outline">{getLevelLabel(group.level)}</Badge>
                  <Badge variant="secondary">{getTypeLabel(group.lessonType)}</Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Средний прогресс</span>
                    <span className="font-medium">{getGroupProgress(group)}%</span>
                  </div>
                  <Progress value={getGroupProgress(group)} className="h-2" />
                </div>

                {/* Top students preview */}
                {group.students.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Лидеры группы:</p>
                    <div className="space-y-1">
                      {group.students.slice(0, 3).map((student, idx) => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                              {idx + 1}
                            </span>
                            <span>{student.firstName} {student.lastName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <BookOpen className="h-3 w-3" />
                            <span>Стр. {student.currentPage}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Link href={`/ustaz/groups/${group.id}`}>
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
