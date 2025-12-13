import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, StageNumber } from '@prisma/client'
import { z } from 'zod'

const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  groupId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  currentPage: z.number().min(1).max(602).optional(),
  currentLine: z.number().min(1).max(15).optional(),
  currentStage: z.nativeEnum(StageNumber).optional(),
  parentIds: z.array(z.string()).optional(), // IDs родителей для студента
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Users can view their own profile, admins can view anyone
    if (currentUser.id !== id && currentUser.role !== UserRole.ADMIN) {
      // Ustaz can view their students
      if (currentUser.role === UserRole.USTAZ) {
        const student = await prisma.user.findFirst({
          where: {
            id,
            studentGroup: { ustazId: currentUser.id }
          }
        })
        if (!student) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        studentGroup: {
          select: { id: true, name: true, ustazId: true }
        },
        childOf: {
          select: { id: true, firstName: true, lastName: true, phone: true }
        },
        parentOf: {
          select: { id: true, firstName: true, lastName: true, phone: true, currentPage: true, currentLine: true, currentStage: true }
        },
        ustazGroups: {
          select: { id: true, name: true, _count: { select: { students: true } } }
        },
        statistics: true,
        _count: {
          select: { tasks: true, submissions: true }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...user,
      telegramId: user.telegramId?.toString() || null,
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const validation = updateUserSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { parentIds, ...data } = validation.data

    // If changing role to non-student, remove from group
    if (data.role && data.role !== UserRole.STUDENT) {
      data.groupId = null
    }

    // Build update data with parent connection
    const updateData: any = { ...data }
    if (parentIds !== undefined) {
      updateData.childOf = {
        set: parentIds.map(parentId => ({ id: parentId }))
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        studentGroup: {
          select: { id: true, name: true }
        },
        childOf: {
          select: { id: true, firstName: true, lastName: true, phone: true }
        }
      }
    })

    // If role changed from PENDING to active role, notify user via Telegram
    if (existing.role === UserRole.PENDING && data.role && data.role !== UserRole.PENDING) {
      await notifyUserRoleApproved(user)
    }

    return NextResponse.json({
      ...user,
      telegramId: user.telegramId?.toString() || null,
    })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Cannot delete yourself
    if (currentUser.id === id) {
      return NextResponse.json(
        { error: 'Cannot delete yourself' },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Soft delete by deactivating
    await prisma.user.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * Notify user via Telegram that their role has been approved
 */
async function notifyUserRoleApproved(user: any): Promise<void> {
  if (!user.telegramId) return

  try {
    const { bot } = await import('@/lib/telegram/bot')
    const { getMainMenuKeyboard } = await import('@/lib/telegram/keyboards/main-menu')
    const { STAGES } = await import('@/lib/constants/quran')

    const chatId = Number(user.telegramId)
    const name = user.firstName || 'пользователь'

    let message = `✅ <b>Ваш аккаунт одобрен!</b>\n\n`
    message += `<b>Ассаляму алейкум, ${name}!</b>\n\n`

    if (user.role === UserRole.STUDENT) {
      const stageName = STAGES[user.currentStage as keyof typeof STAGES]?.nameRu || user.currentStage
      message += `📖 <b>Главное меню</b>\n\n`
      message += `📍 Текущий прогресс: <b>стр. ${user.currentPage}, строка ${user.currentLine}</b>\n`
      message += `📊 Этап: <b>${stageName}</b>\n\n`
      message += `Выберите действие:`
    } else if (user.role === UserRole.USTAZ) {
      message += `👨‍🏫 <b>Панель устаза</b>\n\n`
      message += `Выберите действие:`
    } else if (user.role === UserRole.PARENT) {
      message += `👨‍👩‍👧 <b>Панель родителя</b>\n\n`
      message += `Выберите действие:`
    } else if (user.role === UserRole.ADMIN) {
      message += `👑 <b>Панель администратора</b>\n\n`
      message += `Выберите действие:`
    }

    await bot.api.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: getMainMenuKeyboard(user.role)
    })
  } catch (error) {
    console.error('Failed to notify user about role approval:', error)
  }
}
