import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

const updateLineSchema = z.object({
  lineId: z.string().optional(),
  lineNumber: z.number().min(1).max(15).optional(),
  textArabic: z.string().nullable().optional(),
  textTajweed: z.string().nullable().optional(),
  translation: z.string().optional(),
  audioFileId: z.string().nullable().optional(),
  imageFileId: z.string().nullable().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageNumber: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { pageNumber: pageNumberStr } = await params
    const pageNumber = parseInt(pageNumberStr)

    if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > 602) {
      return NextResponse.json({ error: 'Invalid page number' }, { status: 400 })
    }

    const page = await prisma.quranPage.findUnique({
      where: { pageNumber },
      select: { id: true }
    })

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    const lines = await prisma.quranLine.findMany({
      where: { pageId: page.id },
      orderBy: { lineNumber: 'asc' },
    })

    return NextResponse.json(lines)
  } catch (error) {
    console.error('Get quran lines error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageNumber: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { pageNumber: pageNumberStr } = await params
    const pageNumber = parseInt(pageNumberStr)

    if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > 602) {
      return NextResponse.json({ error: 'Invalid page number' }, { status: 400 })
    }

    const body = await req.json()
    const validation = updateLineSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const page = await prisma.quranPage.findUnique({
      where: { pageNumber },
      select: { id: true }
    })

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    const { lineId, lineNumber, ...updateData } = validation.data

    let line
    if (lineId) {
      // Update by line ID
      line = await prisma.quranLine.update({
        where: { id: lineId },
        data: updateData,
      })
    } else if (lineNumber) {
      // Update by page + line number
      line = await prisma.quranLine.update({
        where: {
          pageId_lineNumber: {
            pageId: page.id,
            lineNumber,
          }
        },
        data: updateData,
      })
    } else {
      return NextResponse.json({ error: 'lineId or lineNumber required' }, { status: 400 })
    }

    return NextResponse.json(line)
  } catch (error) {
    console.error('Update quran line error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
