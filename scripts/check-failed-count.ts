import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkFailedCount() {
  const studentPhone = '+996708286868'

  // Find student
  const student = await prisma.user.findUnique({
    where: { phone: studentPhone },
  })

  if (!student) {
    console.log('❌ Student not found')
    return
  }

  // Find the PASSED task for line 10
  const line10Task = await prisma.task.findFirst({
    where: {
      studentId: student.id,
      startLine: 10,
      endLine: 10,
      status: 'PASSED',
    },
    include: {
      submissions: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (line10Task) {
    console.log('✅ PASSED Task for Line 10:')
    console.log(`   Task ID: ${line10Task.id}`)
    console.log(`   requiredCount: ${line10Task.requiredCount}`)
    console.log(`   currentCount: ${line10Task.currentCount}`)
    console.log(`   passedCount: ${line10Task.passedCount}`)
    console.log(`   failedCount: ${line10Task.failedCount}`)
    console.log(`\n📤 Submissions:`)

    if (line10Task.submissions.length === 0) {
      console.log('   No submissions')
    } else {
      for (const sub of line10Task.submissions) {
        console.log(`   - ${sub.status} at ${sub.createdAt}`)
        console.log(`     Reviewed at: ${sub.reviewedAt || 'N/A'}`)
        console.log(`     ReviewerId: ${sub.reviewerId || 'N/A'}`)
      }
    }

    console.log('\n🔧 Analysis:')
    console.log(`   Task was marked as PASSED: ${line10Task.status === 'PASSED'}`)
    console.log(`   Condition check: passedCount (${line10Task.passedCount}) >= requiredCount (${line10Task.requiredCount}) = ${line10Task.passedCount >= line10Task.requiredCount}`)
    console.log(`   Failed check: failedCount (${line10Task.failedCount}) === 0 = ${line10Task.failedCount === 0}`)
    console.log(`   Both conditions met: ${line10Task.passedCount >= line10Task.requiredCount && line10Task.failedCount === 0}`)

    if (line10Task.passedCount >= line10Task.requiredCount && line10Task.failedCount === 0) {
      console.log('\n   ✅ All conditions met - student SHOULD have progressed')
      console.log('   ⚠️  But something prevented the progress update')
    } else {
      console.log('\n   ❌ Conditions NOT met - progress update was blocked')
      if (line10Task.failedCount > 0) {
        console.log(`   Reason: Task has ${line10Task.failedCount} failed submissions`)
      }
    }
  } else {
    console.log('❌ No PASSED task found for line 10')
  }

  await prisma.$disconnect()
}

checkFailedCount().catch(console.error)
