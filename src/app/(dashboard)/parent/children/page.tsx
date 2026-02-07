import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { BookOpen, User, Clock, CheckCircle, XCircle } from 'lucide-react'
import { QURAN_TOTAL_PAGES } from '@/lib/constants/quran'
import { ChildrenPageClient } from './children-client'

export default async function ChildrenPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // Fetch linked children
  const children = await prisma.user.findMany({
    where: {
      childOf: { some: { id: user.id } }
    },
    include: {
      statistics: true,
      studentGroups: {
        where: { isActive: true },
        include: {
          group: {
            select: { name: true, lessonType: true }
          }
        }
      }
    }
  })

  // Fetch link requests
  const linkRequests = await prisma.parentLinkRequest.findMany({
    where: { parentId: user.id },
    include: {
      student: {
        select: { firstName: true, lastName: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const stageLabels: Record<string, string> = {
    STAGE_1_1: '1.1',
    STAGE_1_2: '1.2',
    STAGE_2_1: '2.1',
    STAGE_2_2: '2.2',
    STAGE_3: '3',
  }

  const childrenData = children.map(child => {
    const progressPercent = ((child.currentPage - 1) / QURAN_TOTAL_PAGES) * 100
    const groups = child.studentGroups.map(sg => sg.group.name)

    return {
      id: child.id,
      name: [child.firstName, child.lastName].filter(Boolean).join(' ') || 'Ребёнок',
      currentPage: child.currentPage,
      currentLine: child.currentLine,
      stage: stageLabels[child.currentStage] || child.currentStage,
      progressPercent,
      groups,
      totalTasksCompleted: child.statistics?.totalTasksCompleted || 0,
      totalPagesCompleted: child.statistics?.totalPagesCompleted || 0,
      globalRank: child.statistics?.globalRank || null,
      currentStreak: child.statistics?.currentStreak || 0,
    }
  })

  const requestsData = linkRequests.map(r => ({
    id: r.id,
    studentName: [r.student.firstName, r.student.lastName].filter(Boolean).join(' ') || 'Студент',
    status: r.status as string,
    createdAt: r.createdAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <ChildrenPageClient
        children={childrenData}
        requests={requestsData}
      />
    </div>
  )
}
