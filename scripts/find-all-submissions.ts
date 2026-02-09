import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function findAllSubmissions() {
  const studentPhone = '+996708286868'

  // Find student
  const student = await prisma.user.findUnique({
    where: { phone: studentPhone },
  })

  if (!student) {
    console.log('❌ Student not found')
    return
  }

  // Find ALL submissions for this student
  const allSubmissions = await prisma.submission.findMany({
    where: {
      studentId: student.id,
    },
    include: {
      task: {
        include: {
          page: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  console.log(`📤 Last 20 submissions for student:\n`)

  for (const sub of allSubmissions) {
    console.log(`Submission ID: ${sub.id}`)
    console.log(`  Task: Page ${sub.task.page.pageNumber}, Lines ${sub.task.startLine}-${sub.task.endLine}, Stage ${sub.task.stage}`)
    console.log(`  Status: ${sub.status}`)
    console.log(`  Created: ${sub.createdAt}`)
    console.log(`  Reviewed: ${sub.reviewedAt || 'N/A'}`)
    console.log(`  Reviewer: ${sub.reviewerId || 'N/A'}`)
    console.log(`  Task Status: ${sub.task.status}`)
    console.log(`  Task ID: ${sub.taskId}`)
    console.log()
  }

  await prisma.$disconnect()
}

findAllSubmissions().catch(console.error)
