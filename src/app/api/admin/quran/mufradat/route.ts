import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET: Получить список слов с переводами
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const surah = searchParams.get('surah')
  const ayah = searchParams.get('ayah')

  // Build where clause
  const where: Record<string, unknown> = {}
  if (surah) where.surahNumber = parseInt(surah)
  if (ayah) where.ayahNumber = parseInt(ayah)

  // Get words
  const words = await prisma.wordTranslation.findMany({
    where,
    orderBy: [
      { surahNumber: 'asc' },
      { ayahNumber: 'asc' },
      { position: 'asc' },
    ],
    take: 200, // Limit for performance
  })

  // Get stats
  const stats = {
    total: await prisma.wordTranslation.count(),
    translated: await prisma.wordTranslation.count({
      where: { translationRu: { not: null } }
    }),
    verified: await prisma.wordTranslation.count({
      where: { isVerified: true }
    }),
    aiGenerated: await prisma.wordTranslation.count({
      where: { aiGenerated: true }
    }),
  }

  return NextResponse.json({ words, stats })
}
