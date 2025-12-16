import type { BotContext } from '../bot'
import { InlineKeyboard } from 'grammy'
import { prisma } from '@/lib/prisma'
import { TaskStatus, SubmissionStatus } from '@prisma/client'
import OpenAI from 'openai'

// Game state stored in memory (per user)
interface GameState {
  groupId: string
  taskId: string
  words: GameWord[]
  currentIndex: number
  correctCount: number
  startTime: number
  results: GameResult[]
}

interface GameWord {
  wordKey: string
  textArabic: string
  translationRu: string
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

// Simple in-memory game state store
const gameStates = new Map<string, GameState>()

const WORDS_PER_GAME = 10
const PASS_THRESHOLD = 80

/**
 * Get OpenAI client
 */
async function getOpenAIClient(): Promise<{ client: OpenAI; model: string } | null> {
  try {
    const settings = await prisma.systemSettings.findMany({
      where: { key: { in: ['OPENAI_API_KEY', 'OPENAI_MODEL'] } }
    })
    const apiKey = settings.find(s => s.key === 'OPENAI_API_KEY')?.value || process.env.OPENAI_API_KEY
    const model = settings.find(s => s.key === 'OPENAI_MODEL')?.value || 'gpt-4o-mini'

    if (!apiKey) return null
    return { client: new OpenAI({ apiKey }), model }
  } catch {
    return null
  }
}

/**
 * Generate game words using ChatGPT based on student's progress
 */
async function generateGameWords(
  pageNumber: number,
  startLine: number,
  endLine: number,
  count: number
): Promise<GameWord[]> {
  const openai = await getOpenAIClient()
  if (!openai) {
    throw new Error('OpenAI not configured')
  }

  // First, try to get existing words from DB for this page range
  const existingWords = await prisma.wordTranslation.findMany({
    where: {
      surahNumber: { gte: 1 }, // Get words we have
      translationRu: { not: null }
    },
    take: 100,
    orderBy: { id: 'desc' }
  })

  // If we have enough words, use them
  if (existingWords.length >= count * 2) {
    return createGameFromExistingWords(existingWords, count)
  }

  // Otherwise, ask ChatGPT to generate Quran vocabulary for practice
  const prompt = `Сгенерируй ${count * 2} часто встречающихся слов из Корана для изучения.
Для каждого слова дай:
- Арабский текст (без харакатов для простоты)
- Русский перевод (краткий, 1-2 слова)

Включи базовые слова как: الله، رب، يوم، قال، أرض، سماء، نار، جنة، صلاة، كتاب и подобные.

Ответ в JSON формате:
{
  "words": [
    {"arabic": "الله", "russian": "Аллах"},
    {"arabic": "رب", "russian": "Господь"}
  ]
}
`

  const response = await openai.client.chat.completions.create({
    model: openai.model,
    messages: [
      { role: 'system', content: 'Ты помощник для изучения арабского языка Корана.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: 'json_object' }
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from ChatGPT')

  const parsed = JSON.parse(content)
  const rawWords = parsed.words || []

  // Create game words with alternating directions
  const gameWords: GameWord[] = []
  const shuffledWords = rawWords.sort(() => Math.random() - 0.5)

  for (let i = 0; i < Math.min(count, shuffledWords.length); i++) {
    const word = shuffledWords[i]
    const direction: 'ar_to_ru' | 'ru_to_ar' = i % 2 === 0 ? 'ar_to_ru' : 'ru_to_ar'

    // Get 3 wrong options
    const otherWords = shuffledWords.filter((_: any, idx: number) => idx !== i)
    const wrongOptions = otherWords
      .slice(0, 3)
      .map((w: any) => direction === 'ar_to_ru' ? w.russian : w.arabic)

    const correctAnswer = direction === 'ar_to_ru' ? word.russian : word.arabic
    const allOptions = [correctAnswer, ...wrongOptions].sort(() => Math.random() - 0.5)
    const correctIndex = allOptions.indexOf(correctAnswer)

    gameWords.push({
      wordKey: `gen:${i}`,
      textArabic: word.arabic,
      translationRu: word.russian,
      direction,
      options: allOptions,
      correctIndex
    })
  }

  return gameWords
}

/**
 * Create game from existing DB words
 */
function createGameFromExistingWords(words: any[], count: number): GameWord[] {
  const shuffled = words.filter(w => w.translationRu).sort(() => Math.random() - 0.5)
  const gameWords: GameWord[] = []

  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    const word = shuffled[i]
    const direction: 'ar_to_ru' | 'ru_to_ar' = i % 2 === 0 ? 'ar_to_ru' : 'ru_to_ar'

    // Get wrong options
    const otherWords = shuffled.filter((_: any, idx: number) => idx !== i)
    const wrongOptions = otherWords
      .slice(0, 3)
      .map((w: any) => direction === 'ar_to_ru' ? w.translationRu : w.textArabic)

    const correctAnswer = direction === 'ar_to_ru' ? word.translationRu : word.textArabic
    const allOptions = [correctAnswer, ...wrongOptions].sort(() => Math.random() - 0.5)
    const correctIndex = allOptions.indexOf(correctAnswer)

    gameWords.push({
      wordKey: word.wordKey,
      textArabic: word.textArabic,
      translationRu: word.translationRu,
      direction,
      options: allOptions,
      correctIndex
    })
  }

  return gameWords
}

/**
 * Start mufradat game for a student
 */
export async function startMufradatGame(
  ctx: BotContext,
  user: any,
  groupId: string,
  taskId?: string
): Promise<void> {
  const userId = user.id

  // Get student's progress for this group
  const studentGroup = await prisma.studentGroup.findFirst({
    where: { studentId: userId, groupId, isActive: true },
    include: { group: true }
  })

  if (!studentGroup) {
    await ctx.answerCallbackQuery({ text: 'Группа не найдена', show_alert: true })
    return
  }

  // Create task if not exists
  let actualTaskId = taskId
  if (!actualTaskId) {
    // Check for existing task
    const existingTask = await prisma.task.findFirst({
      where: {
        studentId: userId,
        groupId,
        status: TaskStatus.IN_PROGRESS
      }
    })

    if (existingTask) {
      actualTaskId = existingTask.id
    } else {
      // Create new task for mufradat game
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
      actualTaskId = task.id
    }
  }

  try {
    // Generate game words
    const words = await generateGameWords(
      studentGroup.currentPage,
      studentGroup.currentLine,
      Math.min(studentGroup.currentLine + 5, 15),
      WORDS_PER_GAME
    )

    if (words.length === 0) {
      await ctx.editMessageText(
        '❌ Не удалось сгенерировать слова для игры.\n\nПопробуйте позже или обратитесь к устазу.',
        { reply_markup: new InlineKeyboard().text('◀️ Назад', 'student:menu') }
      )
      return
    }

    // Store game state
    const gameState: GameState = {
      groupId,
      taskId: actualTaskId!,
      words,
      currentIndex: 0,
      correctCount: 0,
      startTime: Date.now(),
      results: []
    }
    gameStates.set(userId, gameState)

    // Show first question
    await showGameQuestion(ctx, userId)
  } catch (error) {
    console.error('Failed to start mufradat game:', error)
    await ctx.editMessageText(
      '❌ Ошибка при запуске игры.\n\nУбедитесь, что настроен OpenAI API ключ.',
      { reply_markup: new InlineKeyboard().text('◀️ Назад', 'student:menu') }
    )
  }
}

/**
 * Show current game question
 */
async function showGameQuestion(ctx: BotContext, userId: string): Promise<void> {
  const state = gameStates.get(userId)
  if (!state) return

  const word = state.words[state.currentIndex]
  const questionNum = state.currentIndex + 1
  const total = state.words.length

  // Progress bar
  const progressPercent = Math.round((state.currentIndex / total) * 100)
  const filled = Math.round(progressPercent / 10)
  const progressBar = '▓'.repeat(filled) + '░'.repeat(10 - filled)

  // Build question based on direction
  let question: string
  if (word.direction === 'ar_to_ru') {
    question = `🎮 <b>Муфрадат</b> — ${questionNum}/${total}\n\n`
    question += `${progressBar} ${progressPercent}%\n\n`
    question += `📝 Переведите на русский:\n\n`
    question += `<b style="font-size: 32px;">${word.textArabic}</b>`
  } else {
    question = `🎮 <b>Муфрадат</b> — ${questionNum}/${total}\n\n`
    question += `${progressBar} ${progressPercent}%\n\n`
    question += `📝 Выберите арабское слово:\n\n`
    question += `🇷🇺 <b>${word.translationRu}</b>`
  }

  // Build keyboard with options
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
  const state = gameStates.get(userId)

  if (!state) {
    await ctx.answerCallbackQuery({ text: 'Игра не найдена. Начните заново.', show_alert: true })
    return
  }

  const word = state.words[state.currentIndex]
  const isCorrect = answerIndex === word.correctIndex
  const userAnswer = word.options[answerIndex]
  const correctAnswer = word.options[word.correctIndex]

  // Record result
  state.results.push({
    wordKey: word.wordKey,
    correct: isCorrect,
    userAnswer,
    correctAnswer,
    direction: word.direction
  })

  if (isCorrect) {
    state.correctCount++
    await ctx.answerCallbackQuery({ text: '✅ Правильно!', show_alert: false })
  } else {
    await ctx.answerCallbackQuery({
      text: `❌ Неправильно! Правильный ответ: ${correctAnswer}`,
      show_alert: true
    })
  }

  // Move to next question or finish
  state.currentIndex++

  if (state.currentIndex >= state.words.length) {
    // Game finished
    await finishGame(ctx, user)
  } else {
    // Show next question
    await showGameQuestion(ctx, userId)
  }
}

/**
 * Finish game and save results
 */
async function finishGame(ctx: BotContext, user: any): Promise<void> {
  const userId = user.id
  const state = gameStates.get(userId)

  if (!state) return

  const totalTime = Math.round((Date.now() - state.startTime) / 1000)
  const score = Math.round((state.correctCount / state.words.length) * 100)
  const passed = score >= PASS_THRESHOLD

  // Save submission
  try {
    const submission = await prisma.submission.create({
      data: {
        taskId: state.taskId,
        studentId: userId,
        submissionType: 'MUFRADAT_GAME',
        gameScore: score,
        gameCorrect: state.correctCount,
        gameTotal: state.words.length,
        gameData: JSON.stringify({ results: state.results, totalTime }),
        status: passed ? SubmissionStatus.PASSED : SubmissionStatus.PENDING,
        feedback: `Муфрадат: ${state.correctCount}/${state.words.length} (${score}%)`,
        reviewedAt: passed ? new Date() : null
      }
    })

    // If passed, update task
    if (passed) {
      await prisma.task.update({
        where: { id: state.taskId },
        data: {
          status: TaskStatus.PASSED,
          currentCount: 1
        }
      })

      // Update student progress
      const studentGroup = await prisma.studentGroup.findFirst({
        where: { studentId: userId, groupId: state.groupId }
      })

      if (studentGroup) {
        // Simple progression: move to next line or page
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

        // Update user's global progress too
        await prisma.user.update({
          where: { id: userId },
          data: {
            currentLine: newLine,
            currentPage: newPage
          }
        })
      }

      // Update statistics
      await prisma.userStatistics.upsert({
        where: { userId },
        create: { userId, totalTasksCompleted: 1 },
        update: { totalTasksCompleted: { increment: 1 } }
      })
    }
  } catch (error) {
    console.error('Failed to save game results:', error)
  }

  // Clear game state
  gameStates.delete(userId)

  // Show results
  const emoji = passed ? '🎉' : '📊'
  const statusText = passed ? 'Отлично! Задание выполнено!' : 'Попробуйте ещё раз'

  let message = `${emoji} <b>Результат игры</b>\n\n`
  message += `✅ Правильно: <b>${state.correctCount}/${state.words.length}</b>\n`
  message += `📊 Результат: <b>${score}%</b>\n`
  message += `⏱ Время: <b>${Math.floor(totalTime / 60)}:${(totalTime % 60).toString().padStart(2, '0')}</b>\n\n`

  if (passed) {
    message += `🏆 <b>${statusText}</b>\n`
    message += `Минимум для прохождения: ${PASS_THRESHOLD}%`
  } else {
    message += `⚠️ <b>${statusText}</b>\n`
    message += `Для прохождения нужно набрать минимум ${PASS_THRESHOLD}%`
  }

  const keyboard = new InlineKeyboard()
  if (!passed) {
    keyboard.text('🔄 Играть снова', `mufradat:start:${state.groupId}`).row()
  }
  keyboard.text('◀️ В меню', 'student:menu')

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
  gameStates.delete(user.id)

  await ctx.editMessageText(
    '🚪 Вы вышли из игры.\n\nРезультат не сохранён.',
    { reply_markup: new InlineKeyboard().text('◀️ В меню', 'student:menu') }
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

  let message = `🎮 <b>Муфрадат (Перевод)</b>\n\n`
  message += `📚 Группа: <b>${group.name}</b>\n`
  message += `📖 Страница: <b>${studentGroup.currentPage}</b>\n\n`
  message += `Игра «Угадай слово»:\n`
  message += `• ${WORDS_PER_GAME} вопросов\n`
  message += `• Направление чередуется (🇸🇦→🇷🇺 и 🇷🇺→🇸🇦)\n`
  message += `• Для прохождения нужно ${PASS_THRESHOLD}%\n\n`
  message += `Готовы начать?`

  const keyboard = new InlineKeyboard()
    .text('▶️ Начать игру', `mufradat:start:${group.id}`).row()
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
