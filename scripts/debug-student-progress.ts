import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugStudentProgress() {
  const studentPhone = '+996708286868'
  const ustazPhone = '+996700173295'

  console.log('🔍 Investigating student progress issue...\n')

  // Find student
  const student = await prisma.user.findUnique({
    where: { phone: studentPhone },
    include: {
      studentGroups: {
        include: {
          group: {
            include: {
              ustaz: true,
            },
          },
        },
      },
    },
  })

  if (!student) {
    console.log('❌ Student not found')
    return
  }

  console.log('👤 STUDENT INFO:')
  console.log(`   Name: ${student.firstName} ${student.lastName}`)
  console.log(`   Phone: ${student.phone}`)
  console.log(`   Current Progress: Page ${student.currentPage}, Line ${student.currentLine}, Stage ${student.currentStage}`)
  console.log(`   Active: ${student.isActive}\n`)

  // Find ustaz
  const ustaz = await prisma.user.findUnique({
    where: { phone: ustazPhone },
  })

  if (ustaz) {
    console.log('👨‍🏫 USTAZ INFO:')
    console.log(`   Name: ${ustaz.firstName} ${ustaz.lastName}`)
    console.log(`   Phone: ${ustaz.phone}\n`)
  }

  // Find active task
  const activeTask = await prisma.task.findFirst({
    where: {
      studentId: student.id,
      status: 'IN_PROGRESS',
    },
    include: {
      page: true,
      lesson: true,
      submissions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (activeTask) {
    console.log('📝 ACTIVE TASK:')
    console.log(`   Task ID: ${activeTask.id}`)
    console.log(`   Page: ${activeTask.page.pageNumber}`)
    console.log(`   Lines: ${activeTask.startLine}-${activeTask.endLine}`)
    console.log(`   Stage: ${activeTask.stage}`)
    console.log(`   Status: ${activeTask.status}`)
    console.log(`   Required: ${activeTask.requiredCount}`)
    console.log(`   Current: ${activeTask.currentCount}`)
    console.log(`   Passed: ${activeTask.passedCount}`)
    console.log(`   Failed: ${activeTask.failedCount}`)
    console.log(`   Deadline: ${activeTask.deadline}\n`)

    console.log('📤 SUBMISSIONS FOR THIS TASK:')
    if (activeTask.submissions.length === 0) {
      console.log('   No submissions yet')
    } else {
      for (const sub of activeTask.submissions) {
        console.log(`   - ${sub.status} (reviewerId: ${sub.reviewerId || 'N/A'}) at ${sub.reviewedAt || 'pending'}`)
        if (sub.feedback) {
          console.log(`     Feedback: ${sub.feedback}`)
        }
      }
    }
    console.log()
  } else {
    console.log('⚠️  NO ACTIVE TASK FOUND\n')
  }

  // Find ALL tasks for this student on line 10
  const line10Tasks = await prisma.task.findMany({
    where: {
      studentId: student.id,
      OR: [
        { startLine: 10, endLine: 10 },
        { AND: [{ startLine: { lte: 10 } }, { endLine: { gte: 10 } }] },
      ],
    },
    include: {
      page: true,
      submissions: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log('🔎 ALL TASKS INVOLVING LINE 10:')
  if (line10Tasks.length === 0) {
    console.log('   No tasks found for line 10\n')
  } else {
    for (const task of line10Tasks) {
      console.log(`   Task ID: ${task.id}`)
      console.log(`   Page: ${task.page.pageNumber}, Lines: ${task.startLine}-${task.endLine}`)
      console.log(`   Stage: ${task.stage}, Status: ${task.status}`)
      console.log(`   Counts: ${task.passedCount}/${task.requiredCount} passed, ${task.failedCount} failed`)
      console.log(`   Submissions:`)
      if (task.submissions.length === 0) {
        console.log(`      - None`)
      } else {
        for (const sub of task.submissions) {
          console.log(`      - ${sub.status} (reviewerId: ${sub.reviewerId || 'N/A'}) at ${sub.createdAt}`)
        }
      }
      console.log()
    }
  }

  // Check if there's a mismatch
  console.log('🔧 DIAGNOSIS:')
  if (student.currentLine === 10 && activeTask && activeTask.startLine === 10) {
    console.log('   ⚠️  Student is on line 10, but has an active task for line 10')
    console.log('   This suggests the task was not properly completed when ustaz reviewed it.')

    if (activeTask.passedCount >= activeTask.requiredCount && activeTask.failedCount === 0) {
      console.log('   ✅ Task has enough passes - should have progressed to line 11')
      console.log('   SOLUTION: Task should be marked as PASSED and student progress updated')
    } else {
      console.log(`   ❌ Task needs more passes: ${activeTask.passedCount}/${activeTask.requiredCount} (${activeTask.failedCount} failed)`)
    }
  }

  await prisma.$disconnect()
}

debugStudentProgress().catch(console.error)
