import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

const updatePageSchema = z.object({
  surahNumber: z.number().min(1).max(114).optional(),
  juzNumber: z.number().min(1).max(30).optional(),
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
      include: {
        lines: {
          orderBy: { lineNumber: 'asc' },
          select: {
            id: true,
            lineNumber: true,
            textArabic: true,
            textTajweed: true,
            translation: true,
          }
        }
      }
    })

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    return NextResponse.json(page)
  } catch (error) {
    console.error('Get quran page error:', error)
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
    const validation = updatePageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const page = await prisma.quranPage.update({
      where: { pageNumber },
      data: validation.data,
    })

    return NextResponse.json(page)
  } catch (error) {
    console.error('Update quran page error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
