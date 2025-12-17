import { InlineKeyboard, Keyboard } from 'grammy'
import { UserRole, LessonType } from '@prisma/client'

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
 * Lesson type info for student menu
 */
export interface LessonTypeInfo {
  type: LessonType
  groupId: string
  groupName: string
  currentPage: number
  currentLine: number
  currentStage: string
  hasActiveTask: boolean
  taskProgress?: { current: number; required: number }
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
  // New: lesson types available to student
  lessonTypes?: LessonTypeInfo[]
}

// Web App URL for Telegram Mini App
const WEB_APP_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/telegram`
  : 'https://qurantester.vercel.app/telegram'

// Quran Web App URL - redirects to student quran page
const QURAN_WEB_APP_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/telegram?redirect=/student/quran`
  : 'https://qurantester.vercel.app/telegram?redirect=/student/quran'

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
        .webApp('🌐 Веб-панель', WEB_APP_URL)
      break

    case UserRole.USTAZ:
      keyboard
        .text('📚 Мои группы', 'ustaz:groups').row()
        .text('📝 Проверить работы', 'ustaz:submissions').row()
        .text('👥 Мои студенты', 'ustaz:students').row()
        .text('📊 Статистика', 'ustaz:stats').row()
        .webApp('🌐 Веб-панель', WEB_APP_URL)
      break

    case UserRole.STUDENT:
      // Show lesson types if available (new multi-group flow)
      if (menuInfo?.lessonTypes && menuInfo.lessonTypes.length > 0) {
        // Group lesson types by type
        for (const lesson of menuInfo.lessonTypes) {
          const typeName = getLessonTypeName(lesson.type)
          const stageShort = lesson.currentStage.replace('STAGE_', '').replace('_', '.')
          const progress = `${stageShort}`

          // Show task progress if has active task
          if (lesson.hasActiveTask && lesson.taskProgress) {
            keyboard.text(
              `📖 ${typeName} (${progress}) [${lesson.taskProgress.current}/${lesson.taskProgress.required}]`,
              `lesson_type:${lesson.type}:${lesson.groupId}`
            ).row()
          } else {
            keyboard.text(
              `📖 ${typeName} (${progress})`,
              `lesson_type:${lesson.type}:${lesson.groupId}`
            ).row()
          }
        }
      } else {
        // Fallback to old single-task flow
        if (menuInfo?.hasActiveTask && menuInfo.currentCount !== undefined && menuInfo.requiredCount !== undefined) {
          keyboard.text(`📤 Сдать задание (${menuInfo.currentCount}/${menuInfo.requiredCount})`, 'student:current_task').row()
        } else {
          keyboard.text('▶️ Начать задание', 'student:current_task').row()
        }
      }

      // Chat with ustaz button (only when username available - tg://user URL causes privacy errors)
      if (menuInfo?.ustazUsername) {
        keyboard.url(`💬 Написать устазу`, `https://t.me/${menuInfo.ustazUsername}`).row()
      }

      keyboard
        .text('📚 Мои группы', 'student:groups').row()
        .text('📈 Мой прогресс', 'student:progress')
        .text('📋 История', 'student:tasks').row()
        .webApp('📖 Коран', QURAN_WEB_APP_URL)
        .webApp('🌐 Веб', WEB_APP_URL)
      break

    case UserRole.PARENT:
      keyboard
        .text('👨‍👩‍👧‍👦 Успеваемость детей', 'parent:children').row()
        .text('📊 Статистика', 'parent:stats').row()
        .webApp('🌐 Веб-панель', WEB_APP_URL)
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

// ============== REGISTRATION KEYBOARDS ==============

/**
 * Role selection keyboard for registration
 */
export function getRoleSelectionKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📚 Студент', 'reg:role:STUDENT').row()
    .text('👨‍🏫 Устаз', 'reg:role:USTAZ').row()
    .text('👨‍👩‍👧 Родитель', 'reg:role:PARENT')
}

/**
 * Ustaz list keyboard for student registration
 */
export function getUstazListKeyboard(
  ustazList: Array<{
    id: string
    firstName: string | null
    lastName: string | null
    phone: string
    _count: { ustazGroups: number }
  }>
): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  for (const ustaz of ustazList) {
    const name = [ustaz.firstName, ustaz.lastName].filter(Boolean).join(' ') || 'Устаз'
    const groupCount = ustaz._count.ustazGroups
    keyboard.text(`${name} (${groupCount} групп)`, `reg:ustaz:${ustaz.id}`).row()
  }

  keyboard.text('◀️ Назад', 'reg:back_to_role')

  return keyboard
}

/**
 * Ustaz confirmation keyboard
 */
export function getUstazConfirmKeyboard(ustazId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Подтвердить', `reg:confirm_ustaz:${ustazId}`).row()
    .text('◀️ Выбрать другого', 'reg:back_to_ustaz_list')
}

/**
 * Back to role selection keyboard
 */
export function getBackToRoleKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('◀️ Назад к выбору роли', 'reg:back_to_role')
}

// ============== HELPER FUNCTIONS ==============

/**
 * Get human-readable lesson type name
 */
export function getLessonTypeName(type: LessonType): string {
  switch (type) {
    case LessonType.MEMORIZATION:
      return 'Заучивание'
    case LessonType.REVISION:
      return 'Повторение'
    case LessonType.TRANSLATION:
      return 'Перевод'
    default:
      return type
  }
}

/**
 * Get lesson type icon
 */
export function getLessonTypeIcon(type: LessonType): string {
  switch (type) {
    case LessonType.MEMORIZATION:
      return '📖'
    case LessonType.REVISION:
      return '🔄'
    case LessonType.TRANSLATION:
      return '📝'
    default:
      return '📚'
  }
}
