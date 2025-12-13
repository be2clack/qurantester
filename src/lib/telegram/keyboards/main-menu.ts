import { InlineKeyboard, Keyboard } from 'grammy'
import { UserRole } from '@prisma/client'

/**
 * Contact request keyboard (one-time, resized)
 */
export function getContactKeyboard(): Keyboard {
  return new Keyboard()
    .requestContact('📱 Отправить номер телефона')
    .resized()
    .oneTime()
}

/**
 * Full menu info for student
 */
export interface StudentMenuInfo {
  hasActiveTask: boolean
  currentCount?: number
  requiredCount?: number
  groupName?: string
  ustazName?: string
  ustazUsername?: string
  ustazTelegramId?: number
  rankInGroup?: number
  totalInGroup?: number
  totalTasksCompleted?: number
}

/**
 * Main menu keyboard based on user role
 * For students, optionally pass menu info to show dynamic task button and ustaz chat
 */
export function getMainMenuKeyboard(role: UserRole, menuInfo?: StudentMenuInfo): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  switch (role) {
    case UserRole.ADMIN:
      keyboard
        .text('👥 Пользователи', 'admin:users').row()
        .text('📚 Группы', 'admin:groups').row()
        .text('📖 Уроки', 'admin:lessons').row()
        .text('📊 Статистика', 'admin:stats').row()
        .text('⚙️ Настройки', 'admin:settings').row()
        .text('🌐 Войти в веб', 'auth:web')
      break

    case UserRole.USTAZ:
      keyboard
        .text('📚 Мои группы', 'ustaz:groups').row()
        .text('📝 Проверить работы', 'ustaz:submissions').row()
        .text('👥 Мои студенты', 'ustaz:students').row()
        .text('📊 Статистика', 'ustaz:stats').row()
        .text('🌐 Войти в веб', 'auth:web')
      break

    case UserRole.STUDENT:
      // Dynamic task button based on task status
      if (menuInfo?.hasActiveTask && menuInfo.currentCount !== undefined && menuInfo.requiredCount !== undefined) {
        keyboard.text(`📤 Сдать задание (${menuInfo.currentCount}/${menuInfo.requiredCount})`, 'student:current_task').row()
      } else {
        keyboard.text('▶️ Начать задание', 'student:current_task').row()
      }

      // Chat with ustaz button (only when username available - tg://user URL causes privacy errors)
      if (menuInfo?.ustazUsername) {
        keyboard.url(`💬 Написать устазу`, `https://t.me/${menuInfo.ustazUsername}`).row()
      }

      keyboard
        .text('📚 Моя группа', 'student:group').row()
        .text('📈 Мой прогресс', 'student:progress')
        .text('📋 История', 'student:tasks').row()
        .text('📖 Коран', 'student:quran')
        .text('🌐 Веб', 'auth:web')
      break

    case UserRole.PARENT:
      keyboard
        .text('👨‍👩‍👧‍👦 Успеваемость детей', 'parent:children').row()
        .text('📊 Статистика', 'parent:stats').row()
        .text('🌐 Войти в веб', 'auth:web')
      break

    case UserRole.PENDING:
      keyboard
        .text('⏳ Ожидание подтверждения', 'pending:status').row()
        .text('ℹ️ Информация', 'pending:info')
      break
  }

  return keyboard
}

/**
 * Task menu for students - simplified
 */
export function getStudentTaskKeyboard(taskId: string, canSubmit: boolean = true): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  if (canSubmit) {
    keyboard.text('↩️ Отменить последнюю запись', `task:cancel_last:${taskId}`).row()
  }

  keyboard.text('◀️ В меню', 'student:menu')

  return keyboard
}

/**
 * Ustaz submission review keyboard
 */
export function getUstazSubmissionKeyboard(submissionId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('Сдал', `review:pass:${submissionId}`)
    .text('Не сдал', `review:fail:${submissionId}`).row()
    .text('Следующая работа', 'ustaz:next_submission').row()
    .text('Назад к списку', 'ustaz:submissions')
}

/**
 * Simple back button
 */
export function getBackKeyboard(callback: string, label: string = 'Назад'): InlineKeyboard {
  return new InlineKeyboard().text(label, callback)
}

/**
 * Confirmation keyboard
 */
export function getConfirmKeyboard(
  confirmCallback: string,
  cancelCallback: string = 'cancel'
): InlineKeyboard {
  return new InlineKeyboard()
    .text('Подтвердить', confirmCallback)
    .text('Отмена', cancelCallback)
}

/**
 * Pagination keyboard
 */
export function getPaginationKeyboard(
  baseCallback: string,
  currentPage: number,
  totalPages: number
): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  if (currentPage > 1) {
    keyboard.text('◀️ Назад', `${baseCallback}:page:${currentPage - 1}`)
  }

  keyboard.text(`${currentPage}/${totalPages}`, 'noop')

  if (currentPage < totalPages) {
    keyboard.text('Вперед ▶️', `${baseCallback}:page:${currentPage + 1}`)
  }

  return keyboard
}

/**
 * Cancel keyboard for operations
 */
export function getCancelKeyboard(callback: string = 'cancel'): InlineKeyboard {
  return new InlineKeyboard().text('Отмена', callback)
}

/**
 * Start stage keyboard for students
 */
export function getStartStageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('▶️ Начать изучать этап', 'student:start_stage').row()
    .text('📈 Мой прогресс', 'student:progress').row()
    .text('◀️ В меню', 'student:menu')
}

/**
 * Active task keyboard - simplified, just back to menu
 */
export function getActiveTaskKeyboard(taskId: string, hasPendingSubmission: boolean = false): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  if (hasPendingSubmission) {
    keyboard.text('↩️ Отменить последнюю запись', `task:cancel_last:${taskId}`).row()
  }

  keyboard.text('◀️ В меню', 'student:menu')

  return keyboard
}

/**
 * Quran page navigation
 */
export function getQuranNavigationKeyboard(
  pageNumber: number,
  totalPages: number = 602
): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  // First and previous buttons
  if (pageNumber > 1) {
    keyboard.text('⏮️', 'quran:page:1')
    keyboard.text('◀️', `quran:page:${pageNumber - 1}`)
  }

  // Current page
  keyboard.text(`📖 ${pageNumber}`, 'noop')

  // Next and last buttons
  if (pageNumber < totalPages) {
    keyboard.text('▶️', `quran:page:${pageNumber + 1}`)
    keyboard.text('⏭️', `quran:page:${totalPages}`)
  }

  keyboard.row()
  keyboard.text('Назад в меню', 'student:menu')

  return keyboard
}
