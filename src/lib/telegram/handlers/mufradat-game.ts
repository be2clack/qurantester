import type { BotContext } from '../bot'
import { InlineKeyboard } from 'grammy'
import { prisma } from '@/lib/prisma'
import { TaskStatus, SubmissionStatus } from '@prisma/client'
import { getSurahsByPage } from '@/lib/constants/surahs'

interface GameWord {
  wordKey: string
  textArabic: string
  translationRu: string
  translationEn: string | null
  direction: 'ar_to_ru' | 'ru_to_ar'
  options: string[]
  correctIndex: number
}

interface GameResult {
  wordKey: string
  correct: boolean
  userAnswer: string
  correctAnswer: string
  direction: 'ar_to_ru' | 'ru_to_ar'
}

const WORDS_PER_GAME = 10
const DEFAULT_TIME_LIMIT = 180 // 3 minutes in seconds

/**
 * Get active game session from database
 */
async function getActiveSession(userId: string) {
  return prisma.mufradatGameSession.findFirst({
    where: { studentId: userId, isActive: true }
  })
}

/**
 * Create new game session in database
 */
async function createSession(
  userId: string,
  groupId: string,
  taskId: string | null,
  words: GameWord[],
  timeLimit: number,
  pageNumber?: number
) {
  // Deactivate any existing sessions
  await prisma.mufradatGameSession.updateMany({
    where: { studentId: userId, isActive: true },
    data: { isActive: false }
  })

  return prisma.mufradatGameSession.create({
    data: {
      studentId: userId,
      groupId,
      taskId,
      pageNumber,
      words: JSON.stringify(words),
      timeLimit,
      results: JSON.stringify([]),
      isActive: true
    }
  })
}

/**
 * Update game session
 */
async function updateSession(
  sessionId: string,
  data: { currentIndex?: number; correctCount?: number; results?: GameResult[] }
) {
  const updateData: Record<string, unknown> = {}
  if (data.currentIndex !== undefined) updateData.currentIndex = data.currentIndex
  if (data.correctCount !== undefined) updateData.correctCount = data.correctCount
  if (data.results !== undefined) updateData.results = JSON.stringify(data.results)

  return prisma.mufradatGameSession.update({
    where: { id: sessionId },
    data: updateData
  })
}

/**
 * Deactivate game session
 */
async function deactivateSession(sessionId: string) {
  return prisma.mufradatGameSession.update({
    where: { id: sessionId },
    data: { isActive: false }
  })
}

/**
 * Get words from database based on student's current page and line
 * Only returns words from pages that the student has already completed
 * (pages before current page, since current page is still being learned)
 */
async function getWordsForStudentProgress(
  pageNumber: number,
  lineNumber: number,
  count: number
): Promise<GameWord[]> {
  // Use pages before current page (already completed)
  // If on page 1, use at least page 1
  // If line >= 8 (second half of page), we can include current page too
  const maxPage = lineNumber >= 8 ? pageNumber : Math.max(1, pageNumber - 1)

  const surahs = getSurahsByPage(maxPage)

  if (surahs.length === 0) {
    surahs.push({
      number: 1,
      nameArabic: 'الفاتحة',
      nameEnglish: 'Al-Fatihah',
      nameRussian: 'Аль-Фатиха',
      meaningEnglish: 'The Opening',
      meaningRussian: 'Открывающая',
      versesCount: 7,
      startPage: 1,
      endPage: 1,
      revelationType: 'meccan' as const
    })
  }

  // Get surah numbers for all pages up to maxPage
  const allSurahNumbers: number[] = []
  for (let page = 1; page <= maxPage; page++) {
    const pageSurahs = getSurahsByPage(page)
    for (const surah of pageSurahs) {
      if (!allSurahNumbers.includes(surah.number)) {
        allSurahNumbers.push(surah.number)
      }
    }
  }

  const words = await prisma.wordTranslation.findMany({
    where: {
      surahNumber: { in: allSurahNumbers },
      OR: [
        { translationRu: { not: null } },
        { translationEn: { not: null } }
      ]
    },
    orderBy: [
      { surahNumber: 'desc' },
      { ayahNumber: 'desc' }
    ],
    take: count * 4
  })

  if (words.length < count) {
    const fallbackWords = await prisma.wordTranslation.findMany({
      where: {
        OR: [
          { translationRu: { not: null } },
          { translationEn: { not: null } }
        ]
      },
      orderBy: { id: 'desc' },
      take: count * 4
    })

    if (fallbackWords.length >= count) {
      return createGameFromExistingWords(fallbackWords, count)
    }

    return []
  }

  return createGameFromExistingWords(words, count)
}

/**
 * Create game from existing DB words
 */
function createGameFromExistingWords(words: any[], count: number): GameWord[] {
  const validWords = words.filter(w => w.translationRu || w.translationEn)

  if (validWords.length < count) {
    return []
  }

  const shuffled = validWords.sort(() => Math.random() - 0.5)
  const gameWords: GameWord[] = []

  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    const word = shuffled[i]
    const translation = word.translationRu || word.translationEn

    if (!translation) continue

    const direction: 'ar_to_ru' | 'ru_to_ar' = i % 2 === 0 ? 'ar_to_ru' : 'ru_to_ar'

    const otherWords = shuffled.filter((_: any, idx: number) => idx !== i)
    const wrongOptions = otherWords
      .slice(0, 3)
      .map((w: any) => {
        const trans = w.translationRu || w.translationEn
        return direction === 'ar_to_ru' ? trans : w.textArabic
      })
      .filter((opt: string | null) => opt !== null)

    while (wrongOptions.length < 3 && otherWords.length > wrongOptions.length) {
      const idx = wrongOptions.length + 3
      if (idx < otherWords.length) {
        const w = otherWords[idx]
        const trans = w.translationRu || w.translationEn
        const opt = direction === 'ar_to_ru' ? trans : w.textArabic
        if (opt && !wrongOptions.includes(opt)) {
          wrongOptions.push(opt)
        }
      } else {
        break
      }
    }

    const correctAnswer = direction === 'ar_to_ru' ? translation : word.textArabic
    const allOptions = [correctAnswer, ...wrongOptions].sort(() => Math.random() - 0.5)
    const correctIndex = allOptions.indexOf(correctAnswer)

    gameWords.push({
      wordKey: word.wordKey,
      textArabic: word.textArabic,
      translationRu: word.translationRu || word.translationEn,
      translationEn: word.translationEn,
      direction,
      options: allOptions,
      correctIndex
    })
  }

  return gameWords
}

/**
 * Get words for a specific page only (for page-based translation practice)
 */
async function getWordsForSpecificPage(
  pageNumber: number,
  count: number
): Promise<GameWord[]> {
  // First try to get words by exact page number (if pageNumber is set)
  let words = await prisma.wordTranslation.findMany({
    where: {
      pageNumber: pageNumber,
      OR: [
        { translationRu: { not: null } },
        { translationEn: { not: null } }
      ]
    },
    orderBy: [
      { surahNumber: 'asc' },
      { ayahNumber: 'asc' },
      { position: 'asc' }
    ],
    take: count * 4
  })

  // If no words found with pageNumber, fallback to surah-based (legacy support)
  if (words.length < count) {
    const surahs = getSurahsByPage(pageNumber)

    if (surahs.length > 0) {
      const surahNumbers = surahs.map(s => s.number)

      words = await prisma.wordTranslation.findMany({
        where: {
          surahNumber: { in: surahNumbers },
          OR: [
            { translationRu: { not: null } },
            { translationEn: { not: null } }
          ]
        },
        orderBy: [
          { surahNumber: 'asc' },
          { ayahNumber: 'asc' },
          { position: 'asc' }
        ],
        take: count * 4
      })
    }
  }

  if (words.length < count) {
    // Not enough words for this page, try fallback
    const fallbackWords = await prisma.wordTranslation.findMany({
      where: {
        OR: [
          { translationRu: { not: null } },
          { translationEn: { not: null } }
        ]
      },
      orderBy: { id: 'desc' },
      take: count * 4
    })

    if (fallbackWords.length >= count) {
      return createGameFromExistingWords(fallbackWords, count)
    }

    return []
  }

  return createGameFromExistingWords(words, count)
}

/**
 * Start mufradat game for a student
 * @param pageNumber - if provided, game will use words from this specific page only
 */
export async function startMufradatGame(
  ctx: BotContext,
  user: any,
  groupId: string,
  pageNumber?: number // New parameter for specific page selection
): Promise<void> {
  const userId = user.id

  const studentGroup = await prisma.studentGroup.findFirst({
    where: { studentId: userId, groupId, isActive: true },
    include: { group: true }
  })

  if (!studentGroup) {
    try {
      await ctx.answerCallbackQuery({ text: 'Группа не найдена', show_alert: true })
    } catch {}
    return
  }

  // For page-based translation, we don't need a task - we use TranslationPageProgress
  const targetPage = pageNumber || studentGroup.currentPage

  // Create a dummy taskId for session tracking (we'll use page-based progress instead)
  let taskId: string | null = null

  // Only create task if not using specific page selection
  if (!pageNumber) {
    const existingTask = await prisma.task.findFirst({
      where: {
        studentId: userId,
        groupId,
        status: TaskStatus.IN_PROGRESS
      }
    })

    if (existingTask) {
      taskId = existingTask.id
    } else {
      let page = await prisma.quranPage.findUnique({
        where: { pageNumber: studentGroup.currentPage }
      })

      if (!page) {
        page = await prisma.quranPage.create({
          data: { pageNumber: studentGroup.currentPage, totalLines: 15 }
        })
      }

      const deadline = new Date()
      deadline.setDate(deadline.getDate() + 1)

      const task = await prisma.task.create({
        data: {
          groupId,
          studentId: userId,
          pageId: page.id,
          startLine: studentGroup.currentLine,
          endLine: Math.min(studentGroup.currentLine + 5, 15),
          stage: studentGroup.currentStage,
          status: TaskStatus.IN_PROGRESS,
          requiredCount: 1,
          deadline
        }
      })
      taskId = task.id
    }
  }

  try {
    const wordsCount = studentGroup.group.wordsPerDay || WORDS_PER_GAME
    const timeLimit = studentGroup.group.mufradatTimeLimit || DEFAULT_TIME_LIMIT

    // Get words - either from specific page or from progress-based
    const words = pageNumber
      ? await getWordsForSpecificPage(pageNumber, wordsCount)
      : await getWordsForStudentProgress(
          studentGroup.currentPage,
          studentGroup.currentLine,
          wordsCount
        )

    if (words.length === 0) {
      await ctx.editMessageText(
        '❌ Недостаточно слов для игры.\n\nАдмин должен импортировать слова для вашей страницы.',
        { reply_markup: new InlineKeyboard().text('◀️ Назад', 'student:mufradat') }
      )
      return
    }

    // Create session in database (taskId can be null for page-based games)
    await createSession(userId, groupId, taskId, words, timeLimit, targetPage)

    // Show first question
    await showGameQuestion(ctx, userId, targetPage)
  } catch (error) {
    console.error('Failed to start mufradat game:', error)
    await ctx.editMessageText(
      '❌ Ошибка при запуске игры.\n\nПопробуйте позже.',
      { reply_markup: new InlineKeyboard().text('◀️ Назад', 'student:mufradat') }
    )
  }
}

/**
 * Show current game question with timer
 */
async function showGameQuestion(ctx: BotContext, userId: string, pageNumber?: number): Promise<void> {
  const session = await getActiveSession(userId)
  if (!session) return

  const words: GameWord[] = JSON.parse(session.words)
  const startTime = new Date(session.startTime).getTime()
  const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
  const remainingSeconds = session.timeLimit - elapsedSeconds

  if (remainingSeconds <= 0) {
    await finishGame(ctx, { id: userId }, session, true)
    return
  }

  const word = words[session.currentIndex]
  const questionNum = session.currentIndex + 1
  const total = words.length

  const progressPercent = Math.round((session.currentIndex / total) * 100)
  const filled = Math.round(progressPercent / 10)
  const progressBar = '▓'.repeat(filled) + '░'.repeat(10 - filled)

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`
  const timeEmoji = remainingSeconds <= 30 ? '🔴' : remainingSeconds <= 60 ? '🟡' : '🟢'

  // Use pageNumber from session if available
  const displayPage = session.pageNumber || pageNumber
  const pageStr = displayPage ? ` (стр. ${displayPage})` : ''

  let question: string
  if (word.direction === 'ar_to_ru') {
    question = `🎮 <b>Муфрадат</b>${pageStr} — ${questionNum}/${total}\n\n`
    question += `${progressBar} ${progressPercent}%\n`
    question += `${timeEmoji} Осталось: <b>${timeStr}</b>\n\n`
    question += `📝 Переведите на русский:\n\n`
    question += `<b style="font-size: 32px;">${word.textArabic}</b>`
  } else {
    question = `🎮 <b>Муфрадат</b>${pageStr} — ${questionNum}/${total}\n\n`
    question += `${progressBar} ${progressPercent}%\n`
    question += `${timeEmoji} Осталось: <b>${timeStr}</b>\n\n`
    question += `📝 Выберите арабское слово:\n\n`
    question += `🇷🇺 <b>${word.translationRu}</b>`
  }

  const keyboard = new InlineKeyboard()
  word.options.forEach((option, index) => {
    keyboard.text(option, `mufradat:answer:${index}`).row()
  })
  keyboard.text('❌ Выйти из игры', 'mufradat:quit')

  try {
    await ctx.editMessageText(question, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  } catch {
    await ctx.reply(question, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  }
}

/**
 * Handle game answer
 */
export async function handleMufradatAnswer(
  ctx: BotContext,
  user: any,
  answerIndex: number
): Promise<void> {
  const userId = user.id
  const session = await getActiveSession(userId)

  if (!session) {
    try {
      await ctx.answerCallbackQuery({ text: 'Игра не найдена. Начните заново.', show_alert: true })
    } catch {}
    return
  }

  const words: GameWord[] = JSON.parse(session.words)
  const results: GameResult[] = JSON.parse(session.results || '[]')

  const startTime = new Date(session.startTime).getTime()
  const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)

  if (elapsedSeconds >= session.timeLimit) {
    try {
      await ctx.answerCallbackQuery({ text: '⏱️ Время вышло!', show_alert: true })
    } catch {}
    await finishGame(ctx, user, session, true)
    return
  }

  const word = words[session.currentIndex]
  const isCorrect = answerIndex === word.correctIndex
  const userAnswer = word.options[answerIndex]
  const correctAnswer = word.options[word.correctIndex]

  results.push({
    wordKey: word.wordKey,
    correct: isCorrect,
    userAnswer,
    correctAnswer,
    direction: word.direction
  })

  const newCorrectCount = session.correctCount + (isCorrect ? 1 : 0)
  const newIndex = session.currentIndex + 1

  // Update session in database
  await updateSession(session.id, {
    currentIndex: newIndex,
    correctCount: newCorrectCount,
    results
  })

  if (isCorrect) {
    try {
      await ctx.answerCallbackQuery({ text: '✅ Правильно!', show_alert: false })
    } catch {}
  } else {
    try {
      await ctx.answerCallbackQuery({
        text: `❌ Неправильно! Правильный ответ: ${correctAnswer}`,
        show_alert: true
      })
    } catch {}
  }

  if (newIndex >= words.length) {
    // Reload session with updated data
    const updatedSession = await getActiveSession(userId)
    if (updatedSession) {
      await finishGame(ctx, user, updatedSession, false)
    }
  } else {
    await showGameQuestion(ctx, userId)
  }
}

/**
 * Finish game and save results
 */
async function finishGame(
  ctx: BotContext,
  user: any,
  session: any,
  timeExpired: boolean = false
): Promise<void> {
  const userId = user.id
  const words: GameWord[] = JSON.parse(session.words)
  const results: GameResult[] = JSON.parse(session.results || '[]')

  const startTime = new Date(session.startTime).getTime()
  const totalTime = Math.round((Date.now() - startTime) / 1000)
  const score = Math.round((session.correctCount / words.length) * 100)

  const group = await prisma.group.findUnique({
    where: { id: session.groupId }
  })
  const passThreshold = group?.wordsPassThreshold || 8
  const passed = !timeExpired && session.correctCount >= passThreshold

  // Deactivate session
  await deactivateSession(session.id)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Check if this is a page-based translation game
  const isPageBasedGame = !!session.pageNumber

  try {
    if (isPageBasedGame) {
      // For page-based translation: save to TranslationPageProgress
      await prisma.translationPageProgress.upsert({
        where: {
          studentId_groupId_pageNumber_date: {
            studentId: userId,
            groupId: session.groupId,
            pageNumber: session.pageNumber,
            date: today
          }
        },
        create: {
          studentId: userId,
          groupId: session.groupId,
          pageNumber: session.pageNumber,
          date: today,
          wordsTotal: words.length,
          wordsCorrect: session.correctCount,
          wordsWrong: words.length - session.correctCount,
          attempts: 1,
          bestScore: score,
          lastPlayedAt: new Date()
        },
        update: {
          wordsCorrect: { increment: session.correctCount },
          wordsWrong: { increment: words.length - session.correctCount },
          attempts: { increment: 1 },
          bestScore: score, // Update if this score is better - handled in query
          lastPlayedAt: new Date()
        }
      })

      // Check if current score is better than stored and update bestScore
      const currentProgress = await prisma.translationPageProgress.findUnique({
        where: {
          studentId_groupId_pageNumber_date: {
            studentId: userId,
            groupId: session.groupId,
            pageNumber: session.pageNumber,
            date: today
          }
        }
      })
      if (currentProgress && score > currentProgress.bestScore) {
        await prisma.translationPageProgress.update({
          where: { id: currentProgress.id },
          data: { bestScore: score }
        })
      }

      // Notify ustaz about translation result (fire-and-forget)
      notifyUstazTranslation(
        userId,
        session.groupId,
        session.pageNumber,
        score,
        passed,
        currentProgress?.attempts || 1,
        words.length,
        session.correctCount,
        user.firstName
      ).catch((err) => console.error('[Translation] Ustaz notify error:', err))
    } else {
      // For legacy task-based flow
      if (session.taskId) {
        await prisma.submission.create({
          data: {
            taskId: session.taskId,
            studentId: userId,
            submissionType: 'MUFRADAT_GAME',
            gameScore: score,
            gameCorrect: session.correctCount,
            gameTotal: words.length,
            gameData: JSON.stringify({
              results,
              totalTime,
              timeExpired,
              timeLimit: session.timeLimit
            }),
            status: passed ? SubmissionStatus.PASSED : SubmissionStatus.PENDING,
            feedback: timeExpired
              ? `Муфрадат: ${session.correctCount}/${words.length} (⏱️ время вышло)`
              : `Муфрадат: ${session.correctCount}/${words.length} (${score}%)`,
            reviewedAt: passed ? new Date() : null
          }
        })
      }

      await prisma.mufradatSubmission.upsert({
        where: {
          studentId_date: {
            studentId: userId,
            date: today
          }
        },
        create: {
          studentId: userId,
          date: today,
          wordsTotal: words.length,
          wordsCorrect: session.correctCount,
          wordsMistakes: words.length - session.correctCount,
          passed,
          details: JSON.stringify(results)
        },
        update: {
          wordsTotal: words.length,
          wordsCorrect: session.correctCount,
          wordsMistakes: words.length - session.correctCount,
          passed,
          details: JSON.stringify(results)
        }
      })

      if (passed && session.taskId) {
        await prisma.task.update({
          where: { id: session.taskId },
          data: {
            status: TaskStatus.PASSED,
            currentCount: 1
          }
        })

        const studentGroup = await prisma.studentGroup.findFirst({
          where: { studentId: userId, groupId: session.groupId }
        })

        if (studentGroup) {
          let newLine = studentGroup.currentLine + 1
          let newPage = studentGroup.currentPage

          if (newLine > 15) {
            newLine = 1
            newPage++
          }

          await prisma.studentGroup.update({
            where: { id: studentGroup.id },
            data: {
              currentLine: newLine,
              currentPage: newPage
            }
          })

          await prisma.user.update({
            where: { id: userId },
            data: {
              currentLine: newLine,
              currentPage: newPage
            }
          })
        }

        await prisma.userStatistics.upsert({
          where: { userId },
          create: { userId, totalTasksCompleted: 1 },
          update: { totalTasksCompleted: { increment: 1 } }
        })
      }
    }
  } catch (error) {
    console.error('Failed to save game results:', error)
  }

  const emoji = passed ? '🎉' : timeExpired ? '⏱️' : '📊'
  const statusText = passed
    ? isPageBasedGame ? 'Отлично! Страница изучена!' : 'Отлично! Задание выполнено!'
    : timeExpired
      ? 'Время вышло!'
      : 'Попробуйте ещё раз'

  let message = `${emoji} <b>Результат игры</b>`
  if (isPageBasedGame) {
    message += ` (стр. ${session.pageNumber})`
  }
  message += `\n\n`
  message += `✅ Правильно: <b>${session.correctCount}/${words.length}</b>\n`
  message += `📊 Результат: <b>${score}%</b>\n`
  message += `⏱ Время: <b>${Math.floor(totalTime / 60)}:${(totalTime % 60).toString().padStart(2, '0')}</b>`

  if (timeExpired) {
    message += ` <i>(лимит: ${Math.floor(session.timeLimit / 60)}:${(session.timeLimit % 60).toString().padStart(2, '0')})</i>`
  }
  message += `\n\n`

  if (passed) {
    message += `🏆 <b>${statusText}</b>\n`
    message += `Минимум для прохождения: ${passThreshold}/${words.length} слов`
  } else if (timeExpired) {
    message += `⚠️ <b>${statusText}</b>\n`
    message += `Нужно было ответить за ${Math.floor(session.timeLimit / 60)} мин. ${session.timeLimit % 60} сек.`
  } else {
    message += `⚠️ <b>${statusText}</b>\n`
    message += `Для прохождения нужно ${passThreshold}/${words.length} правильных ответов`
  }

  const keyboard = new InlineKeyboard()
  if (!passed) {
    // For page-based games, return to the same page; for legacy, return to general mufradat
    const playAgainCallback = isPageBasedGame
      ? `translation:page:${session.pageNumber}`
      : `mufradat:start:${session.groupId}`
    keyboard.text('🔄 Играть снова', playAgainCallback).row()
  }
  // For page-based games, return to page selection; for legacy, return to main menu
  const backCallback = isPageBasedGame ? 'student:mufradat' : 'student:menu'
  keyboard.text('◀️ В меню', backCallback)

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  } catch {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  }
}

/**
 * Handle quit game
 */
export async function handleMufradatQuit(ctx: BotContext, user: any): Promise<void> {
  const session = await getActiveSession(user.id)
  const isPageBasedGame = session?.pageNumber != null

  if (session) {
    await deactivateSession(session.id)
  }

  // For page-based games, return to page selection; for legacy, return to main menu
  const backCallback = isPageBasedGame ? 'student:mufradat' : 'student:menu'

  await ctx.editMessageText(
    '🚪 Вы вышли из игры.\n\nРезультат не сохранён.',
    { reply_markup: new InlineKeyboard().text('◀️ В меню', backCallback) }
  )
}

/**
 * Show mufradat game menu (entry point)
 */
export async function showMufradatGameMenu(
  ctx: BotContext,
  user: any,
  studentGroup: any
): Promise<void> {
  const group = studentGroup.group
  const wordsCount = group.wordsPerDay || WORDS_PER_GAME
  const passThreshold = group.wordsPassThreshold || 8
  const timeLimit = group.mufradatTimeLimit || DEFAULT_TIME_LIMIT
  const timeLimitMinutes = Math.floor(timeLimit / 60)
  const timeLimitSeconds = timeLimit % 60

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todaySubmission = await prisma.mufradatSubmission.findUnique({
    where: {
      studentId_date: {
        studentId: user.id,
        date: today
      }
    }
  })

  const surahs = getSurahsByPage(studentGroup.currentPage)
  const surahNames = surahs.map(s => s.nameRussian).join(', ')

  let message = `🎮 <b>Муфрадат (Перевод)</b>\n\n`
  message += `📚 Группа: <b>${group.name}</b>\n`
  message += `📖 Страница: <b>${studentGroup.currentPage}</b>\n`
  if (surahNames) {
    message += `📜 Сура: <b>${surahNames}</b>\n`
  }
  message += `\n`

  if (todaySubmission) {
    const statusEmoji = todaySubmission.passed ? '✅' : '❌'
    message += `📅 <b>Сегодня:</b> ${statusEmoji} ${todaySubmission.wordsCorrect}/${todaySubmission.wordsTotal}\n\n`
  }

  message += `Игра «Угадай слово»:\n`
  message += `• ${wordsCount} вопросов\n`
  message += `• ⏱️ Время: ${timeLimitMinutes > 0 ? `${timeLimitMinutes} мин.` : ''} ${timeLimitSeconds > 0 ? `${timeLimitSeconds} сек.` : ''}\n`
  message += `• Направление чередуется (🇸🇦→🇷🇺 и 🇷🇺→🇸🇦)\n`
  message += `• Для прохождения нужно ${passThreshold}/${wordsCount} правильных\n\n`
  message += `Готовы начать?`

  const keyboard = new InlineKeyboard()
    .text('▶️ Начать игру', `mufradat:start:${group.id}`).row()
    .text('📊 Статистика', `mufradat:stats:${group.id}`).row()
    .text('◀️ В меню', 'student:menu')

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  } catch {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  }
}

/**
 * Show mufradat statistics
 */
export async function showMufradatStats(
  ctx: BotContext,
  user: any,
  groupId: string
): Promise<void> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const [weekStats, monthStats] = await Promise.all([
    prisma.mufradatSubmission.findMany({
      where: {
        studentId: user.id,
        date: { gte: sevenDaysAgo }
      },
      orderBy: { date: 'desc' }
    }),
    prisma.mufradatSubmission.findMany({
      where: {
        studentId: user.id,
        date: { gte: thirtyDaysAgo }
      },
      orderBy: { date: 'desc' }
    })
  ])

  const weekPassed = weekStats.filter(s => s.passed).length
  const weekTotal = weekStats.length
  const weekWordsCorrect = weekStats.reduce((sum, s) => sum + s.wordsCorrect, 0)
  const weekWordsTotal = weekStats.reduce((sum, s) => sum + s.wordsTotal, 0)

  const monthPassed = monthStats.filter(s => s.passed).length
  const monthTotal = monthStats.length
  const monthWordsCorrect = monthStats.reduce((sum, s) => sum + s.wordsCorrect, 0)
  const monthWordsTotal = monthStats.reduce((sum, s) => sum + s.wordsTotal, 0)

  let message = `📊 <b>Статистика Муфрадат</b>\n\n`

  message += `📅 <b>За неделю:</b>\n`
  if (weekTotal > 0) {
    const weekPercent = Math.round((weekWordsCorrect / weekWordsTotal) * 100)
    message += `   Дней сдано: ${weekPassed}/${weekTotal}\n`
    message += `   Слов: ${weekWordsCorrect}/${weekWordsTotal} (${weekPercent}%)\n`
  } else {
    message += `   Нет данных\n`
  }

  message += `\n`

  message += `📆 <b>За месяц:</b>\n`
  if (monthTotal > 0) {
    const monthPercent = Math.round((monthWordsCorrect / monthWordsTotal) * 100)
    message += `   Дней сдано: ${monthPassed}/${monthTotal}\n`
    message += `   Слов: ${monthWordsCorrect}/${monthWordsTotal} (${monthPercent}%)\n`
  } else {
    message += `   Нет данных\n`
  }

  message += `\n`

  message += `<b>Последние 7 дней:</b>\n`
  const today = new Date()
  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)

    const daySubmission = weekStats.find(s => {
      const subDate = new Date(s.date)
      return subDate.toDateString() === date.toDateString()
    })

    const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    if (daySubmission) {
      const emoji = daySubmission.passed ? '✅' : '❌'
      message += `${dateStr}: ${emoji} ${daySubmission.wordsCorrect}/${daySubmission.wordsTotal}\n`
    } else {
      message += `${dateStr}: ⬜ не сдано\n`
    }
  }

  const keyboard = new InlineKeyboard()
    .text('🎮 Играть', `mufradat:start:${groupId}`).row()
    .text('◀️ Назад', `lesson:${groupId}`)

  try {
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  } catch {
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    })
  }
}

/**
 * Notify ustaz about mufradat game submission for review
 */
async function notifyUstazAboutMufradatGame(
  student: any,
  session: any,
  submission: any,
  score: number,
  timeExpired: boolean = false
): Promise<void> {
  try {
    const group = await prisma.group.findUnique({
      where: { id: session.groupId },
      include: { ustaz: true }
    })

    if (!group?.ustaz?.telegramId) return

    const task = await prisma.task.findUnique({
      where: { id: session.taskId },
      include: { page: true }
    })

    if (!task) return

    const { bot } = await import('../bot')
    const { InlineKeyboard } = await import('grammy')

    const ustazChatId = Number(group.ustaz.telegramId)
    const studentName = student.firstName?.trim() || 'Студент'
    const groupName = group.name
    const words: GameWord[] = JSON.parse(session.words)

    let caption = `📥 <b>Муфрадат - требует проверки</b>\n\n`
    caption += `📚 <b>${groupName}</b>\n`
    caption += `👤 ${studentName}\n`
    caption += `📖 Стр. ${task.page?.pageNumber || 1}\n\n`
    caption += `🎮 <b>Результат игры:</b>\n`
    caption += `   ✅ Правильно: ${session.correctCount}/${words.length}\n`
    caption += `   📊 Балл: <b>${score}%</b>\n\n`

    if (timeExpired) {
      caption += `⏱️ Время вышло (лимит: ${Math.floor(session.timeLimit / 60)}:${(session.timeLimit % 60).toString().padStart(2, '0')})`
    } else {
      const passThreshold = group.wordsPassThreshold || 8
      caption += `⚠️ Не набран минимум (${passThreshold} слов)`
    }

    const reviewKeyboard = new InlineKeyboard()
      .text('✅ Засчитать', `review:pass:${submission.id}`)
      .text('❌ Не сдал', `review:fail:${submission.id}`)

    if (student.telegramUsername) {
      reviewKeyboard.row().url(`💬 Написать студенту`, `https://t.me/${student.telegramUsername}`)
    }

    await bot.api.sendMessage(ustazChatId, caption, {
      parse_mode: 'HTML',
      reply_markup: reviewKeyboard
    })

    await prisma.submission.update({
      where: { id: submission.id },
      data: { sentToUstazAt: new Date() }
    })
  } catch (error) {
    console.error('Failed to notify ustaz about mufradat game:', error)
  }
}

/**
 * Notify ustaz about page-based translation test result
 */
async function notifyUstazTranslation(
  studentId: string,
  groupId: string,
  pageNumber: number,
  score: number,
  passed: boolean,
  attempts: number,
  wordsTotal: number,
  wordsCorrect: number,
  studentFirstName?: string | null
): Promise<void> {
  try {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { ustaz: true }
    })

    if (!group?.ustaz?.telegramId) return

    const { bot } = await import('../bot')

    const ustazChatId = Number(group.ustaz.telegramId)
    const studentName = studentFirstName?.trim() || 'Студент'
    const passThreshold = group.wordsPassThreshold || 8

    const emoji = passed ? '✅' : '❌'
    const statusText = passed ? 'Сдал' : 'Не сдал'

    let message = `📝 <b>Перевод ${statusText}</b>\n\n`
    message += `📚 <b>${group.name}</b>\n`
    message += `👤 ${studentName}\n`
    message += `📖 Стр. ${pageNumber}\n\n`
    message += `${emoji} Результат: <b>${wordsCorrect}/${wordsTotal}</b> (${score}%)\n`
    message += `🎯 Порог: ${passThreshold}/${wordsTotal}\n`
    message += `🔄 Попытка: ${attempts}`

    await bot.api.sendMessage(ustazChatId, message, {
      parse_mode: 'HTML',
    })
  } catch (error) {
    console.error('[Translation] Failed to notify ustaz:', error)
  }
}
