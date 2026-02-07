import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { Bot, InlineKeyboard } from 'grammy'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles: UserRole[] = [UserRole.PARENT, UserRole.ADMIN]
    if (!allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const requests = await prisma.parentLinkRequest.findMany({
      where: { parentId: currentUser.id },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const items = requests.map(r => ({
      id: r.id,
      studentId: r.student.id,
      studentName: [r.student.firstName, r.student.lastName].filter(Boolean).join(' ') || 'Студент',
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      respondedAt: r.respondedAt?.toISOString() || null,
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Get link requests error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowedRoles: UserRole[] = [UserRole.PARENT, UserRole.ADMIN]
    if (!allowedRoles.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { studentId } = body

    if (!studentId || typeof studentId !== 'string') {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 })
    }

    // Verify student exists and is a STUDENT
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, firstName: true, lastName: true, role: true, telegramId: true }
    })

    if (!student || student.role !== UserRole.STUDENT) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    // Check if already linked
    const existingLink = await prisma.user.findFirst({
      where: {
        id: currentUser.id,
        parentOf: { some: { id: studentId } }
      }
    })

    if (existingLink) {
      return NextResponse.json({ error: 'Already linked to this student' }, { status: 409 })
    }

    // Check for existing pending request
    const existingRequest = await prisma.parentLinkRequest.findUnique({
      where: {
        parentId_studentId: {
          parentId: currentUser.id,
          studentId: studentId,
        }
      }
    })

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        return NextResponse.json({ error: 'Request already pending' }, { status: 409 })
      }
      // If rejected, allow re-request by updating the existing record
      if (existingRequest.status === 'REJECTED') {
        const updated = await prisma.parentLinkRequest.update({
          where: { id: existingRequest.id },
          data: { status: 'PENDING', respondedAt: null }
        })

        // Send Telegram notification
        await notifyStudentViaTelegram(student, currentUser)

        return NextResponse.json({ id: updated.id, status: 'PENDING' })
      }
    }

    // Create new request
    const linkRequest = await prisma.parentLinkRequest.create({
      data: {
        parentId: currentUser.id,
        studentId: studentId,
      }
    })

    // Send Telegram notification to student
    await notifyStudentViaTelegram(student, currentUser, linkRequest.id)

    return NextResponse.json({ id: linkRequest.id, status: 'PENDING' })
  } catch (error) {
    console.error('Create link request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function notifyStudentViaTelegram(
  student: { telegramId: bigint | null; firstName: string | null },
  parent: { firstName: string | null; lastName: string | null },
  requestId?: string
) {
  if (!student.telegramId) return

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  try {
    const bot = new Bot(botToken)
    const parentName = [parent.firstName, parent.lastName].filter(Boolean).join(' ') || 'Родитель'

    // If we have requestId, get it; otherwise look it up
    let reqId = requestId
    if (!reqId) {
      // Find the latest pending request
      const req = await prisma.parentLinkRequest.findFirst({
        where: { studentId: student.telegramId ? undefined : undefined },
        orderBy: { createdAt: 'desc' }
      })
      reqId = req?.id
    }

    if (!reqId) return

    const keyboard = new InlineKeyboard()
      .text('Принять', `link_request:accept:${reqId}`)
      .text('Отклонить', `link_request:reject:${reqId}`)

    await bot.api.sendMessage(
      Number(student.telegramId),
      `<b>👨‍👩‍👧 Запрос на привязку</b>\n\n` +
      `Родитель <b>${parentName}</b> хочет привязать вас как своего ребёнка.\n\n` +
      `Если вы подтвердите, родитель сможет видеть ваш прогресс в изучении Корана.`,
      {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      }
    )
  } catch (error) {
    console.error('Failed to send Telegram notification to student:', error)
  }
}
