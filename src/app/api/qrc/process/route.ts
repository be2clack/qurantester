import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { processSubmissionWithQRC, isQRCConfigured } from '@/lib/qurani-ai'
import { z } from 'zod'

const processSchema = z.object({
  submissionId: z.string(),
})

/**
 * POST /api/qrc/process
 * Process a submission's audio through QRC API
 *
 * This endpoint is called after a voice message is received
 * to get AI verification of the recitation.
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.USTAZ)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const validation = processSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { submissionId } = validation.data

    // Check if QRC is configured
    if (!(await isQRCConfigured())) {
      return NextResponse.json(
        { error: 'QRC API not configured' },
        { status: 400 }
      )
    }

    // Get submission with task info
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        task: {
          include: {
            page: true,
            group: true,
          },
        },
      },
    })

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // Check if it's a voice submission
    if (submission.fileType !== 'voice') {
      return NextResponse.json(
        { error: 'Only voice submissions can be processed' },
        { status: 400 }
      )
    }

    if (!submission.fileId) {
      return NextResponse.json(
        { error: 'No audio file attached' },
        { status: 400 }
      )
    }

    // Process with QRC
    const result = await processSubmissionWithQRC(
      submission.fileId,
      submission.task?.page?.pageNumber
    )

    // Update submission with AI results
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        aiProvider: 'QURANI_AI',
        aiScore: result.score,
        aiTranscript: result.transcript,
        aiErrors: JSON.stringify(result.errors),
        aiProcessedAt: new Date(),
        aiRawResponse: JSON.stringify(result.rawResponse),
      },
    })

    return NextResponse.json({
      success: result.success,
      score: result.score,
      transcript: result.transcript,
      errors: result.errors,
      detectedAyahs: result.detectedAyahs,
      processingTime: result.processingTime,
    })
  } catch (error) {
    console.error('QRC processing error:', error)
    return NextResponse.json(
      { error: 'Processing failed', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/qrc/process
 * Check if QRC is configured
 */
export async function GET() {
  try {
    const configured = await isQRCConfigured()
    return NextResponse.json({ configured })
  } catch (error) {
    return NextResponse.json({ error: 'Check failed' }, { status: 500 })
  }
}
