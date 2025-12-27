import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQRCApiKey } from '@/lib/qurani-ai'

/**
 * GET /api/qrc/get-key
 * Get QRC API key for client-side WebSocket connection
 *
 * Note: In production, you might want to add additional security measures
 * like rate limiting or requiring authentication
 */
export async function GET(req: NextRequest) {
  try {
    // Get API key from settings
    const apiKey = await getQRCApiKey()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'QRC API key not configured', apiKey: null },
        { status: 200 }
      )
    }

    return NextResponse.json({
      apiKey,
    })
  } catch (error) {
    console.error('Failed to get QRC API key:', error)
    return NextResponse.json(
      { error: 'Failed to get API key', apiKey: null },
      { status: 500 }
    )
  }
}
