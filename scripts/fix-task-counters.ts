import { PrismaClient, SubmissionStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function fixTaskCounters() {
  console.log('🔧 Fixing task counters...\n')

  // Get all IN_PROGRESS tasks
  const tasks = await prisma.task.findMany({
    where: {
      status: 'IN_PROGRESS'
    },
    include: {
      _count: {
        select: {
          submissions: true
        }
      },
      submissions: {
        select: {
          id: true,
          status: true
        }
      }
    }
  })

  console.log(`Found ${tasks.length} in-progress tasks\n`)

  let fixedCount = 0

  for (const task of tasks) {
    // Calculate actual counts from submissions
    const actualTotal = task.submissions.length
    const actualPassed = task.submissions.filter(s => s.status === SubmissionStatus.PASSED).length
    const actualFailed = task.submissions.filter(s => s.status === SubmissionStatus.FAILED).length
    const actualPending = task.submissions.filter(s => s.status === SubmissionStatus.PENDING).length

    // Check if currentCount is wrong
    const needsFix = task.currentCount !== actualTotal ||
                     task.passedCount !== actualPassed ||
                     task.failedCount !== actualFailed

    if (needsFix) {
      console.log(`Task ${task.id}:`)
      console.log(`  Before: currentCount=${task.currentCount}, passed=${task.passedCount}, failed=${task.failedCount}`)
      console.log(`  Actual: total=${actualTotal}, passed=${actualPassed}, failed=${actualFailed}, pending=${actualPending}`)

      await prisma.task.update({
        where: { id: task.id },
        data: {
          currentCount: actualTotal,
          passedCount: actualPassed,
          failedCount: actualFailed
        }
      })

      console.log(`  ✅ Fixed!\n`)
      fixedCount++
    }
  }

  console.log(`\n✅ Done! Fixed ${fixedCount} tasks out of ${tasks.length} total.`)
}

fixTaskCounters()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
