import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { StageNumber, MushafType } from '@prisma/client'
import { getQRCApiKey } from '@/lib/qurani-ai'
import { getPageVerses, getMedinaLines, MedinaLine, getTajweedText } from '@/lib/quran-api'
import { InlineKeyboard } from 'grammy'

/**
 * GET /api/qrc/pre-check
 * Get QRC pre-check info for a student position
 *
 * Query params:
 * - groupId: string
 * - telegramId: string (for authentication)
 * - page: number
 * - startLine: number
 * - endLine: number
 * - stage: StageNumber
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const groupId = searchParams.get('groupId')
    const telegramId = searchParams.get('telegramId')
    const page = searchParams.get('page')
    const startLine = searchParams.get('startLine')
    const endLine = searchParams.get('endLine')
    const stage = searchParams.get('stage')

    if (!groupId || !telegramId || !page || !startLine || !endLine || !stage) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Find user by telegram ID
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get group with QRC settings
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        qrcPreCheckEnabled: true,
        qrcPreCheckProvider: true,
        qrcHafzLevel: true,
        qrcTajweedLevel: true,
        qrcPassThreshold: true,
        aiProvider: true,
        mushafType: true,
        showTranslation: true,
        translationId: true,
        showText: true,
        showImage: true,
        showAudio: true,
        showTafsir: true,
        tafsirId: true,
        reciterId: true,
      }
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    if (!group.qrcPreCheckEnabled) {
      return NextResponse.json(
        { error: 'QRC pre-check is not enabled for this group' },
        { status: 400 }
      )
    }

    // Check if student has passed pre-check for this position
    const existingPreCheck = await prisma.qRCPreCheck.findUnique({
      where: {
        studentId_groupId_pageNumber_startLine_endLine_stage: {
          studentId: user.id,
          groupId,
          pageNumber: parseInt(page),
          startLine: parseInt(startLine),
          endLine: parseInt(endLine),
          stage: stage as StageNumber,
        }
      }
    })

    // Get Quran content with word-level data for the lines
    let lines: MedinaLine[] = []
    const requestedStartLine = parseInt(startLine)
    const requestedEndLine = parseInt(endLine)
    const linesCount = requestedEndLine - requestedStartLine + 1

    // Tajweed map: verse_key -> tajweed HTML
    let tajweedMap: Record<string, string> = {}

    try {
      // Fetch Medina lines and Tajweed in parallel
      const [response, tajweedData] = await Promise.all([
        getPageVerses(parseInt(page)),
        getTajweedText(parseInt(page))
      ])

      const allLines = getMedinaLines(response.verses)
      console.log('[QRC] Medina API lines:', allLines.map(l => l.lineNumber))

      // Build tajweed map
      if (tajweedData?.verses) {
        for (const verse of tajweedData.verses) {
          tajweedMap[verse.verse_key] = verse.text_uthmani_tajweed
        }
      }
      console.log('[QRC] Tajweed loaded for', Object.keys(tajweedMap).length, 'verses')

      // Try to get requested lines first
      lines = allLines.filter(l =>
        l.lineNumber >= requestedStartLine && l.lineNumber <= requestedEndLine
      )

      // If no lines found (e.g. page 1 line 1 doesn't exist), get first available lines
      if (lines.length === 0 && allLines.length > 0) {
        console.log('[QRC] Requested lines not found, taking first', linesCount, 'available lines')
        lines = allLines.slice(0, linesCount)
      }

      console.log('[QRC] Returning', lines.length, 'lines')
    } catch (error) {
      console.error('Failed to fetch quran content:', error)
    }

    // Fallback: if still no lines, create placeholder with error message
    if (lines.length === 0) {
      console.log('[QRC] No lines found, returning error placeholder')
      lines = [{
        lineNumber: requestedStartLine,
        textArabic: 'Ошибка загрузки текста. Попробуйте позже.',
        words: [],
        verseKeys: []
      }]
    }

    // Get API key availability based on provider (don't expose the actual key)
    let apiKeyConfigured = false
    if (group.qrcPreCheckProvider === 'QURANI_AI') {
      apiKeyConfigured = !!(await getQRCApiKey())
    } else if (group.qrcPreCheckProvider === 'WHISPER') {
      // Check OpenAI API key for Whisper
      const openaiKey = await prisma.systemSettings.findUnique({
        where: { key: 'OPENAI_API_KEY' }
      })
      apiKeyConfigured = !!openaiKey?.value
    }

    return NextResponse.json({
      groupId: group.id,
      groupName: group.name,
      pageNumber: parseInt(page),
      startLine: parseInt(startLine),
      endLine: parseInt(endLine),
      stage,
      lines: lines.map(l => {
        // Combine tajweed from all verses in this line
        const tajweedParts = (l.verseKeys || [])
          .map(key => tajweedMap[key])
          .filter(Boolean)
        const textTajweed = tajweedParts.length > 0 ? tajweedParts.join(' ') : undefined

        return {
          lineNumber: l.lineNumber,
          textArabic: l.textArabic,
          textTajweed, // HTML with tajweed coloring
          verseKeys: l.verseKeys,
          // Include word-level data for inline error highlighting
          words: l.words?.map(w => ({
            id: w.id,
            position: w.position,
            text: w.text_uthmani,
            charType: w.char_type_name, // "word" or "end"
          })) || [],
        }
      }),
      qrcSettings: {
        provider: group.qrcPreCheckProvider,
        hafzLevel: group.qrcHafzLevel,
        tajweedLevel: group.qrcTajweedLevel,
        passThreshold: group.qrcPassThreshold,
      },
      apiKeyConfigured,
      existingPreCheck: existingPreCheck ? {
        passed: existingPreCheck.passed,
        score: existingPreCheck.score,
        createdAt: existingPreCheck.createdAt,
      } : null,
    })
  } catch (error) {
    console.error('QRC pre-check GET error:', error)
    return NextResponse.json(
      { error: 'Failed to get pre-check info' },
      { status: 500 }
    )
  }
}

const postSchema = z.object({
  groupId: z.string(),
  telegramId: z.string(),
  pageNumber: z.number(),
  startLine: z.number(),
  endLine: z.number(),
  stage: z.enum(['STAGE_1_1', 'STAGE_1_2', 'STAGE_2_1', 'STAGE_2_2', 'STAGE_3']),
  taskId: z.string().optional(),
  msgId: z.number().optional(),  // Original Telegram message ID to delete
  // Results
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  transcript: z.string().optional(),
  errors: z.string().optional(), // JSON string
  rawResponse: z.string().optional(), // JSON string
})

/**
 * POST /api/qrc/pre-check
 * Save QRC pre-check result
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validation = postSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Find user by telegram ID
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(data.telegramId) }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get group settings
    const group = await prisma.group.findUnique({
      where: { id: data.groupId },
      select: {
        qrcHafzLevel: true,
        qrcTajweedLevel: true,
        qrcPassThreshold: true,
      }
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // Check if passed based on threshold
    const actuallyPassed = data.score >= group.qrcPassThreshold

    // Upsert pre-check result
    const preCheck = await prisma.qRCPreCheck.upsert({
      where: {
        studentId_groupId_pageNumber_startLine_endLine_stage: {
          studentId: user.id,
          groupId: data.groupId,
          pageNumber: data.pageNumber,
          startLine: data.startLine,
          endLine: data.endLine,
          stage: data.stage as StageNumber,
        }
      },
      create: {
        studentId: user.id,
        groupId: data.groupId,
        taskId: data.taskId,
        pageNumber: data.pageNumber,
        startLine: data.startLine,
        endLine: data.endLine,
        stage: data.stage as StageNumber,
        passed: actuallyPassed,
        score: data.score,
        transcript: data.transcript,
        errors: data.errors,
        rawResponse: data.rawResponse,
        hafzLevel: group.qrcHafzLevel,
        tajweedLevel: group.qrcTajweedLevel,
      },
      update: {
        taskId: data.taskId,
        passed: actuallyPassed,
        score: data.score,
        transcript: data.transcript,
        errors: data.errors,
        rawResponse: data.rawResponse,
      }
    })

    // If passed, update Telegram: delete old message and send new one
    if (actuallyPassed && user.telegramId) {
      try {
        const { bot } = await import('@/lib/telegram/bot')
        const chatId = Number(user.telegramId)

        // Delete the old message with "Пройти AI проверку" button
        if (data.msgId && data.msgId > 0) {
          try {
            await bot.api.deleteMessage(chatId, data.msgId)
            console.log(`[QRC] Deleted old message ${data.msgId}`)
          } catch (deleteError) {
            console.warn(`[QRC] Could not delete message ${data.msgId}:`, deleteError)
            // Continue even if delete fails
          }
        }

        // Send new message with success and updated keyboard
        const message = `✅ <b>AI проверка пройдена!</b>\n\n` +
          `📊 Результат: <b>${data.score}%</b>\n` +
          `📍 Страница ${data.pageNumber}, строки ${data.startLine}-${data.endLine}\n\n` +
          `Теперь вы можете начать изучение.`

        const keyboard = new InlineKeyboard()
          .text('▶️ Начать изучать', `start_group_task:${data.groupId}`)
          .row()
          .text('◀️ В меню', 'student:menu')

        await bot.api.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        })

        console.log(`[QRC] Sent success notification to user ${user.telegramId}`)
      } catch (notifyError) {
        console.error('[QRC] Failed to send Telegram notification:', notifyError)
        // Don't fail the request if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      preCheckId: preCheck.id,
      passed: actuallyPassed,
      score: data.score,
      threshold: group.qrcPassThreshold,
    })
  } catch (error) {
    console.error('QRC pre-check POST error:', error)
    return NextResponse.json(
      { error: 'Failed to save pre-check result' },
      { status: 500 }
    )
  }
}
