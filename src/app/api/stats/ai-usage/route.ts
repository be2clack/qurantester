import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { getAIUsageStats } from '@/lib/ai-usage'

/**
 * GET /api/stats/ai-usage
 * Get AI usage statistics
 *
 * Query params:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 */
export async function GET(req: NextRequest) {
  try {
    // Check if user is admin
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse date range from query params
    const searchParams = req.nextUrl.searchParams
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    const endDate = endDateParam ? new Date(endDateParam) : new Date()
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

    // Get stats
    const stats = await getAIUsageStats(startDate, endDate)

    return NextResponse.json({
      success: true,
      data: stats,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    })
  } catch (error) {
    console.error('Get AI usage stats error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
