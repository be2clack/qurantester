import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { syncPageFromAPI, syncPagesFromAPI } from '@/lib/quran-pages'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { startPage, endPage, pageNumber } = body

    // Sync single page
    if (pageNumber) {
      const totalLines = await syncPageFromAPI(pageNumber)
      return NextResponse.json({
        success: true,
        message: `Page ${pageNumber} synced`,
        page: { pageNumber, totalLines }
      })
    }

    // Sync range of pages
    if (startPage && endPage) {
      await syncPagesFromAPI(startPage, endPage)

      // Get updated pages
      const pages = await prisma.quranPage.findMany({
        where: {
          pageNumber: { gte: startPage, lte: endPage }
        },
        orderBy: { pageNumber: 'asc' }
      })

      return NextResponse.json({
        success: true,
        message: `Synced pages ${startPage} to ${endPage}`,
        pages: pages.map(p => ({ pageNumber: p.pageNumber, totalLines: p.totalLines }))
      })
    }

    return NextResponse.json(
      { error: 'Provide pageNumber or startPage/endPage' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Sync pages error:', error)
    return NextResponse.json(
      { error: 'Failed to sync pages' },
      { status: 500 }
    )
  }
}

// GET - show current page line counts
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = searchParams.get('page')

    if (page) {
      const pageData = await prisma.quranPage.findUnique({
        where: { pageNumber: parseInt(page) }
      })
      return NextResponse.json(pageData || { error: 'Page not found' })
    }

    // Return all pages with non-standard line counts
    const pages = await prisma.quranPage.findMany({
      where: {
        OR: [
          { totalLines: { not: 15 } },
          { pageNumber: { lte: 10 } } // Always show first 10 pages
        ]
      },
      orderBy: { pageNumber: 'asc' }
    })

    return NextResponse.json({
      pages: pages.map(p => ({ pageNumber: p.pageNumber, totalLines: p.totalLines })),
      total: pages.length
    })
  } catch (error) {
    console.error('Get pages error:', error)
    return NextResponse.json(
      { error: 'Failed to get pages' },
      { status: 500 }
    )
  }
}
