import { PrismaClient } from '@prisma/client'

// Source database (Supabase)
const sourceDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

// Target database (Prisma Postgres)
const targetDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.NEW_DATABASE_URL
    }
  }
})

const BATCH_SIZE = 500

async function migrateData() {
  console.log('🚀 Starting database migration (optimized)...')

  try {
    // 1. Migrate SystemSettings
    console.log('\n📦 Migrating SystemSettings...')
    const systemSettings = await sourceDb.systemSettings.findMany()
    if (systemSettings.length > 0) {
      await targetDb.systemSettings.deleteMany({})
      await targetDb.systemSettings.createMany({ data: systemSettings })
      console.log(`   ✅ ${systemSettings.length} settings migrated`)
    } else {
      console.log('   ⏭️  No settings to migrate')
    }

    // 2. Migrate BotSession
    console.log('\n📦 Migrating BotSession...')
    const botSessions = await sourceDb.botSession.findMany()
    if (botSessions.length > 0) {
      await targetDb.botSession.deleteMany({})
      await targetDb.botSession.createMany({ data: botSessions })
      console.log(`   ✅ ${botSessions.length} sessions migrated`)
    } else {
      console.log('   ⏭️  No sessions to migrate')
    }

    // 3. Migrate QuranPage
    console.log('\n📦 Migrating QuranPage...')
    const quranPages = await sourceDb.quranPage.findMany()
    if (quranPages.length > 0) {
      await targetDb.quranPage.deleteMany({})
      await targetDb.quranPage.createMany({ data: quranPages })
      console.log(`   ✅ ${quranPages.length} pages migrated`)
    } else {
      console.log('   ⏭️  No pages to migrate')
    }

    // 4. Migrate QuranLine in batches
    console.log('\n📦 Migrating QuranLine...')
    const quranLineCount = await sourceDb.quranLine.count()
    if (quranLineCount > 0) {
      await targetDb.quranLine.deleteMany({})
      let offset = 0
      let migrated = 0
      while (offset < quranLineCount) {
        const batch = await sourceDb.quranLine.findMany({
          skip: offset,
          take: BATCH_SIZE,
          orderBy: { id: 'asc' }
        })
        if (batch.length === 0) break
        await targetDb.quranLine.createMany({ data: batch })
        migrated += batch.length
        process.stdout.write(`   Progress: ${migrated}/${quranLineCount}\r`)
        offset += BATCH_SIZE
      }
      console.log(`   ✅ ${migrated} lines migrated          `)
    } else {
      console.log('   ⏭️  No lines to migrate')
    }

    // 5. Migrate Users (without groupId first)
    console.log('\n📦 Migrating Users...')
    const users = await sourceDb.user.findMany()
    if (users.length > 0) {
      await targetDb.user.deleteMany({})
      const usersWithoutGroup = users.map(({ groupId, ...userData }) => ({ ...userData, groupId: null }))
      await targetDb.user.createMany({ data: usersWithoutGroup })
      console.log(`   ✅ ${users.length} users migrated`)
    } else {
      console.log('   ⏭️  No users to migrate')
    }

    // 6. Migrate AuthToken
    console.log('\n📦 Migrating AuthToken...')
    const authTokens = await sourceDb.authToken.findMany()
    if (authTokens.length > 0) {
      await targetDb.authToken.deleteMany({})
      await targetDb.authToken.createMany({ data: authTokens })
      console.log(`   ✅ ${authTokens.length} tokens migrated`)
    } else {
      console.log('   ⏭️  No tokens to migrate')
    }

    // 7. Migrate Groups
    console.log('\n📦 Migrating Groups...')
    const groups = await sourceDb.group.findMany()
    if (groups.length > 0) {
      await targetDb.group.deleteMany({})
      await targetDb.group.createMany({ data: groups })
      console.log(`   ✅ ${groups.length} groups migrated`)
    } else {
      console.log('   ⏭️  No groups to migrate')
    }

    // 8. Update User groupId
    console.log('\n📦 Updating User groupId...')
    let updatedUsers = 0
    for (const user of users) {
      if (user.groupId) {
        await targetDb.user.update({
          where: { id: user.id },
          data: { groupId: user.groupId }
        })
        updatedUsers++
      }
    }
    console.log(`   ✅ ${updatedUsers} users updated with groupId`)

    // 9. Migrate Lessons
    console.log('\n📦 Migrating Lessons...')
    const lessons = await sourceDb.lesson.findMany()
    if (lessons.length > 0) {
      await targetDb.lesson.deleteMany({})
      await targetDb.lesson.createMany({ data: lessons })
      console.log(`   ✅ ${lessons.length} lessons migrated`)
    } else {
      console.log('   ⏭️  No lessons to migrate')
    }

    // 10. Migrate UserStatistics
    console.log('\n📦 Migrating UserStatistics...')
    const userStats = await sourceDb.userStatistics.findMany()
    if (userStats.length > 0) {
      await targetDb.userStatistics.deleteMany({})
      await targetDb.userStatistics.createMany({ data: userStats })
      console.log(`   ✅ ${userStats.length} statistics migrated`)
    } else {
      console.log('   ⏭️  No statistics to migrate')
    }

    // 11. Migrate Tasks
    console.log('\n📦 Migrating Tasks...')
    const tasks = await sourceDb.task.findMany()
    if (tasks.length > 0) {
      await targetDb.task.deleteMany({})
      await targetDb.task.createMany({ data: tasks })
      console.log(`   ✅ ${tasks.length} tasks migrated`)
    } else {
      console.log('   ⏭️  No tasks to migrate')
    }

    // 12. Migrate Submissions
    console.log('\n📦 Migrating Submissions...')
    const submissions = await sourceDb.submission.findMany()
    if (submissions.length > 0) {
      await targetDb.submission.deleteMany({})
      await targetDb.submission.createMany({ data: submissions })
      console.log(`   ✅ ${submissions.length} submissions migrated`)
    } else {
      console.log('   ⏭️  No submissions to migrate')
    }

    // 13. Migrate BotMessage
    console.log('\n📦 Migrating BotMessage...')
    const botMessages = await sourceDb.botMessage.findMany()
    if (botMessages.length > 0) {
      await targetDb.botMessage.deleteMany({})
      await targetDb.botMessage.createMany({ data: botMessages })
      console.log(`   ✅ ${botMessages.length} messages migrated`)
    } else {
      console.log('   ⏭️  No messages to migrate')
    }

    // 14. Migrate Parent-Child relations
    console.log('\n📦 Migrating Parent-Child relations...')
    const usersWithChildren = await sourceDb.user.findMany({
      where: { parentOf: { some: {} } },
      include: { parentOf: { select: { id: true } } }
    })
    let relationsCount = 0
    for (const parent of usersWithChildren) {
      if (parent.parentOf.length > 0) {
        await targetDb.user.update({
          where: { id: parent.id },
          data: {
            parentOf: {
              connect: parent.parentOf.map(child => ({ id: child.id }))
            }
          }
        })
        relationsCount += parent.parentOf.length
      }
    }
    console.log(`   ✅ ${relationsCount} parent-child relations migrated`)

    console.log('\n✅ Migration completed successfully!')

    // Print summary
    console.log('\n📊 Migration Summary:')
    console.log(`   - SystemSettings: ${systemSettings.length}`)
    console.log(`   - BotSessions: ${botSessions.length}`)
    console.log(`   - QuranPages: ${quranPages.length}`)
    console.log(`   - QuranLines: ${quranLineCount}`)
    console.log(`   - Users: ${users.length}`)
    console.log(`   - AuthTokens: ${authTokens.length}`)
    console.log(`   - Groups: ${groups.length}`)
    console.log(`   - Lessons: ${lessons.length}`)
    console.log(`   - UserStatistics: ${userStats.length}`)
    console.log(`   - Tasks: ${tasks.length}`)
    console.log(`   - Submissions: ${submissions.length}`)
    console.log(`   - BotMessages: ${botMessages.length}`)

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await sourceDb.$disconnect()
    await targetDb.$disconnect()
  }
}

migrateData()
