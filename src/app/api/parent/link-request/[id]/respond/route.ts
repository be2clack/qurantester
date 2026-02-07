import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { Bot } from 'grammy'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const body = await req.json()
    const { action } = body

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "accept" or "reject"' }, { status: 400 })
    }

    // Find the request
    const linkRequest = await prisma.parentLinkRequest.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, firstName: true, lastName: true, telegramId: true }
        },
        student: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    })

    if (!linkRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Check that current user is the student (or admin)
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== linkRequest.studentId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (linkRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request already processed' }, { status: 409 })
    }

    const childName = [linkRequest.student.firstName, linkRequest.student.lastName].filter(Boolean).join(' ') || 'Ребёнок'

    if (action === 'accept') {
      // Accept: update status + create parent-child link in transaction
      await prisma.$transaction([
        prisma.parentLinkRequest.update({
          where: { id },
          data: { status: 'ACCEPTED', respondedAt: new Date() }
        }),
        prisma.user.update({
          where: { id: linkRequest.parentId },
          data: {
            parentOf: { connect: { id: linkRequest.studentId } }
          }
        })
      ])

      // Notify parent via Telegram
      await notifyParentViaTelegram(
        linkRequest.parent.telegramId,
        `<b>Привязка подтверждена!</b>\n\n${childName} подтвердил(а) привязку. Теперь вы можете отслеживать успеваемость.`
      )

      return NextResponse.json({ status: 'ACCEPTED' })
    } else {
      // Reject
      await prisma.parentLinkRequest.update({
        where: { id },
        data: { status: 'REJECTED', respondedAt: new Date() }
      })

      // Notify parent via Telegram
      await notifyParentViaTelegram(
        linkRequest.parent.telegramId,
        `<b>Запрос отклонён</b>\n\n${childName} отклонил(а) запрос на привязку.`
      )

      return NextResponse.json({ status: 'REJECTED' })
    }
  } catch (error) {
    console.error('Respond to link request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function notifyParentViaTelegram(telegramId: bigint | null, message: string) {
  if (!telegramId) return

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  try {
    const bot = new Bot(botToken)
    await bot.api.sendMessage(Number(telegramId), message, { parse_mode: 'HTML' })
  } catch (error) {
    console.error('Failed to notify parent via Telegram:', error)
  }
}
