import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixLine9Issue() {
  const studentPhone = '+996708286868'
  const ustazPhone = '+996700173295'

  console.log('🔧 Fixing line 9 pending submission issue...\n')

  // Find student
  const student = await prisma.user.findUnique({
    where: { phone: studentPhone },
  })

  if (!student) {
    console.log('❌ Student not found')
    return
  }

  // Find ustaz
  const ustaz = await prisma.user.findUnique({
    where: { phone: ustazPhone },
  })

  if (!ustaz) {
    console.log('❌ Ustaz not found')
    return
  }

  // Find the pending submission for line 9
  const line9Task = await prisma.task.findFirst({
    where: {
      studentId: student.id,
      startLine: 9,
      endLine: 9,
      status: 'IN_PROGRESS',
    },
    include: {
      submissions: {
        where: {
          status: 'PENDING',
        },
      },
    },
  })

  if (!line9Task) {
    console.log('❌ No pending task for line 9 found')
    return
  }

  console.log('📝 Found task for line 9:')
  console.log(`   Task ID: ${line9Task.id}`)
  console.log(`   Pending submissions: ${line9Task.submissions.length}`)

  if (line9Task.submissions.length === 0) {
    console.log('   No pending submissions to review')
    return
  }

  // Auto-approve the pending submission for line 9
  const pendingSubmission = line9Task.submissions[0]
  console.log(`\n✅ Auto-approving submission ${pendingSubmission.id} for line 9...`)

  await prisma.submission.update({
    where: { id: pendingSubmission.id },
    data: {
      status: 'PASSED',
      reviewerId: ustaz.id,
      reviewedAt: new Date(),
      feedback: 'Auto-approved to fix progress issue (student already completed line 10)',
    },
  })

  // Update task
  await prisma.task.update({
    where: { id: line9Task.id },
    data: {
      status: 'PASSED',
      passedCount: 1,
      currentCount: 1,
    },
  })

  console.log('✨ Line 9 submission approved and task marked as PASSED')
  console.log('\n📊 Current student state:')
  console.log(`   Page: ${student.currentPage}, Line: ${student.currentLine}, Stage: ${student.currentStage}`)
  console.log('\n✅ Student should now be able to continue from line 11')

  await prisma.$disconnect()
}

fixLine9Issue().catch(console.error)
