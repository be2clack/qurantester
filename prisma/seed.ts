import { PrismaClient, UserRole, StageNumber } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Get the number of lines for a specific page
 */
function getLinesCount(pageNumber: number): number {
  if (pageNumber === 1) return 5
  if (pageNumber === 2) return 6
  return 15
}

async function main() {
  console.log('Starting database seed...')
  console.log('========================')

  // 1. Create 602 Quran pages with lines using batch operations
  console.log('\n1. Creating Quran pages and lines...')

  // Check existing pages
  const existingPages = await prisma.quranPage.findMany({
    select: { pageNumber: true }
  })
  const existingPageNumbers = new Set(existingPages.map(p => p.pageNumber))

  // Find missing pages
  const missingPageData = []
  for (let pageNum = 1; pageNum <= 602; pageNum++) {
    if (!existingPageNumbers.has(pageNum)) {
      missingPageData.push({
        pageNumber: pageNum,
        totalLines: getLinesCount(pageNum),
      })
    }
  }

  if (missingPageData.length > 0) {
    console.log(`   Found ${missingPageData.length} missing pages. Creating...`)

    // Batch insert missing pages
    await prisma.quranPage.createMany({
      data: missingPageData,
      skipDuplicates: true,
    })

    // Get all pages that need lines
    const pagesNeedingLines = await prisma.quranPage.findMany({
      where: {
        pageNumber: { in: missingPageData.map(p => p.pageNumber) }
      },
      orderBy: { pageNumber: 'asc' }
    })

    // Prepare line data for missing pages
    console.log('   Preparing line data...')
    const lineData = []
    for (const page of pagesNeedingLines) {
      for (let lineNum = 1; lineNum <= page.totalLines; lineNum++) {
        lineData.push({
          pageId: page.id,
          lineNumber: lineNum,
        })
      }
    }

    // Batch insert lines in chunks
    if (lineData.length > 0) {
      console.log(`   Inserting ${lineData.length} lines in batches...`)
      const chunkSize = 1000
      for (let i = 0; i < lineData.length; i += chunkSize) {
        const chunk = lineData.slice(i, i + chunkSize)
        await prisma.quranLine.createMany({
          data: chunk,
          skipDuplicates: true,
        })
        console.log(`   Progress: ${Math.min(i + chunkSize, lineData.length)}/${lineData.length} lines`)
      }
    }

    console.log(`   Created ${missingPageData.length} pages with lines`)
  } else {
    console.log('   All 602 pages already exist')
  }

  // 2. Create default admin
  console.log('\n2. Creating default admin...')

  const adminPhone = process.env.DEFAULT_ADMIN_PHONE || '+18094544055'

  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {
      role: UserRole.ADMIN,
      isActive: true,
    },
    create: {
      phone: adminPhone,
      firstName: 'Admin',
      role: UserRole.ADMIN,
      isActive: true,
      currentPage: 1,
      currentLine: 1,
      currentStage: StageNumber.STAGE_1_1,
    }
  })

  // Create statistics for admin
  await prisma.userStatistics.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id }
  })

  console.log(`   Admin created: ${adminPhone}`)

  // 3. Create system settings
  console.log('\n3. Creating system settings...')

  const defaultSettings = [
    { key: 'default_repetition_count', value: '80', description: 'Количество повторений по умолчанию' },
    { key: 'default_min_pass_count', value: '70', description: 'Минимальное количество для прохождения' },
    { key: 'stage1_days', value: '1', description: 'Дней на этап 1 (по строке)' },
    { key: 'stage2_days', value: '2', description: 'Дней на этап 2 (половина страницы)' },
    { key: 'stage3_days', value: '2', description: 'Дней на этап 3 (вся страница)' },
    { key: 'bot_welcome_message', value: 'Ассаляму алейкум! Добро пожаловать в систему изучения Корана.', description: 'Приветственное сообщение бота' },
    { key: 'bot_registration_message', value: 'Для начала работы отправьте свой номер телефона, нажав кнопку ниже.', description: 'Сообщение при регистрации' },
    { key: 'allow_voice_messages', value: 'true', description: 'Разрешить голосовые сообщения' },
    { key: 'allow_video_notes', value: 'true', description: 'Разрешить видео-кружочки' },
    { key: 'admin_contact_telegram', value: '@QuranTesterAdmin', description: 'Telegram админа для связи' },
    { key: 'admin_contact_phone', value: '+18094544055', description: 'Телефон админа для связи' },
    { key: 'support_message', value: 'Если вас нет в системе, обратитесь к вашему устазу или администратору.', description: 'Сообщение для новых пользователей' },
  ]

  for (const setting of defaultSettings) {
    await prisma.systemSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description },
      create: setting
    })
  }

  console.log(`   ${defaultSettings.length} settings created`)

  // Summary
  const finalPageCount = await prisma.quranPage.count()
  const finalLineCount = await prisma.quranLine.count()

  console.log('\n========================')
  console.log('Seed completed successfully!')
  console.log('========================')
  console.log(`- Quran pages: ${finalPageCount}`)
  console.log(`- Quran lines: ${finalLineCount}`)
  console.log(`- Admin user: ${adminPhone}`)
  console.log(`- System settings: ${defaultSettings.length}`)
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
