import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const from = parseInt(searchParams.get('from') || '1')
    const to = parseInt(searchParams.get('to') || '602')

    const where: any = {
      pageNumber: {
        gte: from,
        lte: to,
      }
    }

    const [pages, total] = await Promise.all([
      prisma.quranPage.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { pageNumber: 'asc' },
        include: {
          lines: {
            orderBy: { lineNumber: 'asc' },
            select: {
              id: true,
              lineNumber: true,
              textArabic: true,
              textTajweed: true,
            }
          }
        }
      }),
      prisma.quranPage.count({ where })
    ])

    return NextResponse.json({
      items: pages,
      total,
      page,
      limit,
      hasMore: page * limit < total
    })
  } catch (error) {
    console.error('Get quran pages error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
