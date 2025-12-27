import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { STAGES } from '@/lib/constants/quran'
import { StudentQuranViewer } from './student-quran-viewer'

export default async function StudentQuranPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Get student's primary group progress
  const studentGroup = await prisma.studentGroup.findFirst({
    where: { studentId: user.id },
    orderBy: { joinedAt: 'asc' }
  })

  // Use group progress or fallback to user's direct progress
  const currentPage = studentGroup?.currentPage ?? user.currentPage
  const currentLine = studentGroup?.currentLine ?? user.currentLine
  const currentStage = studentGroup?.currentStage ?? user.currentStage
  const stageName = STAGES[currentStage as keyof typeof STAGES]?.name || currentStage

  return (
    <StudentQuranViewer
      currentPage={currentPage}
      currentLine={currentLine}
      currentStage={currentStage}
      stageName={stageName}
    />
  )
}
