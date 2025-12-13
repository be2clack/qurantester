import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

const API_KEYS = {
  QURANI_AI_QRC_KEY: 'Qurani.ai QRC API Key (AI проверка чтения)',
  QURANI_AI_SEMANTIC_KEY: 'Qurani.ai Semantic Search API Key',
} as const

type ApiKeyType = keyof typeof API_KEYS

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const settings = await prisma.systemSettings.findMany({
      where: {
        key: { in: Object.keys(API_KEYS) },
      },
    })

    // Build response as object with status
    const response: Record<string, {
      key: string
      status: 'configured' | 'not_configured'
      maskedValue: string | null
    }> = {}

    Object.keys(API_KEYS).forEach((key) => {
      const setting = settings.find(s => s.key === key)
      response[key] = {
        key,
        status: setting?.value ? 'configured' : 'not_configured',
        maskedValue: setting?.value
          ? `${setting.value.substring(0, 8)}...${setting.value.slice(-4)}`
          : null,
      }
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('Get API settings error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

const updateSchema = z.object({
  key: z.enum(['QURANI_AI_QRC_KEY', 'QURANI_AI_SEMANTIC_KEY'] as const),
  value: z.string().min(1),
})

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const validation = updateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { key, value } = validation.data

    await prisma.systemSettings.upsert({
      where: { key },
      update: {
        value,
        description: API_KEYS[key as ApiKeyType],
      },
      create: {
        key,
        value,
        description: API_KEYS[key as ApiKeyType],
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update API settings error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')

    if (!key || !Object.keys(API_KEYS).includes(key)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
    }

    await prisma.systemSettings.delete({
      where: { key },
    }).catch(() => {
      // Ignore if not found
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete API settings error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
