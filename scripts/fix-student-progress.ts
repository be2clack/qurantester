import { PrismaClient, TaskStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function fixStudentProgress() {
  const studentPhone = '+996708286868'

  console.log('🔧 Fixing student progress...\n')

  // Find student
  const student = await prisma.user.findUnique({
    where: { phone: studentPhone },
  })

  if (!student) {
    console.log('❌ Student not found')
    return
  }

  console.log('👤 Current state:')
  console.log(`   Page: ${student.currentPage}, Line: ${student.currentLine}, Stage: ${student.currentStage}\n`)

  // Find all IN_PROGRESS tasks for line 10
  const line10InProgressTasks = await prisma.task.findMany({
    where: {
      studentId: student.id,
      startLine: 10,
      endLine: 10,
      status: TaskStatus.IN_PROGRESS,
    },
    include: {
      submissions: true,
    },
  })

  console.log(`Found ${line10InProgressTasks.length} IN_PROGRESS tasks for line 10`)

  // Delete the duplicate IN_PROGRESS tasks for line 10 (ones with no submissions or only pending)
  for (const task of line10InProgressTasks) {
    if (task.submissions.length === 0 || task.submissions.every(s => s.status === 'PENDING')) {
      console.log(`   Deleting duplicate task ${task.id} for line 10...`)
      await prisma.task.delete({
        where: { id: task.id },
      })
    }
  }

  // Find the PASSED task for line 10 to understand what happened
  const passedLine10Task = await prisma.task.findFirst({
    where: {
      studentId: student.id,
      startLine: 10,
      endLine: 10,
      status: TaskStatus.PASSED,
    },
    include: {
      page: true,
    },
  })

  if (passedLine10Task) {
    console.log(`\n✅ Found PASSED task for line 10`)
    console.log(`   Task passed, but student didn't progress to line 11`)
    console.log(`   Updating student progress to line 11...\n`)

    // Update student to line 11
    await prisma.user.update({
      where: { id: student.id },
      data: {
        currentLine: 11,
      },
    })

    console.log('✨ Student progress updated!')
    console.log(`   New state: Page ${student.currentPage}, Line 11, Stage ${student.currentStage}`)
  } else {
    console.log('\n⚠️  No PASSED task found for line 10')
  }

  // Check if there's an active task for line 9
  const line9Task = await prisma.task.findFirst({
    where: {
      studentId: student.id,
      startLine: 9,
      endLine: 9,
      status: TaskStatus.IN_PROGRESS,
    },
    include: {
      submissions: true,
    },
  })

  if (line9Task) {
    console.log(`\n📝 Found active task for line 9:`)
    console.log(`   Submissions: ${line9Task.submissions.length}`)
    for (const sub of line9Task.submissions) {
      console.log(`   - ${sub.status} at ${sub.createdAt}`)
    }
  }

  await prisma.$disconnect()
}

fixStudentProgress().catch(console.error)
