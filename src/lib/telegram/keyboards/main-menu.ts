import { InlineKeyboard, Keyboard } from 'grammy'
import { UserRole, LessonType, GroupLevel } from '@prisma/client'

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
  groupLevel?: GroupLevel
  currentPage: number
  currentLine: number
  currentStage: string
  hasActiveTask: boolean
  taskProgress?: { current: number; required: number; passed: number; pending: number }
}

/**
 * Get lines per task for a level
 */
export function getLinesForLevelName(level: GroupLevel): string {
  switch (level) {
    case GroupLevel.LEVEL_1:
      return '1 строка'
    case GroupLevel.LEVEL_2:
      return '3 строки'
    case GroupLevel.LEVEL_3:
      return '7 строк'
    default:
      return '1 строка'
  }
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
  // Sync status - show button if there are pending submissions
  hasPendingSubmissions?: boolean
}

/**
 * Group info for ustaz menu
 */
export interface UstazGroupInfo {
  id: string
  name: string
  gender?: string
  studentCount: number
}

/**
 * Full menu info for ustaz
 */
export interface UstazMenuInfo {
  groups: UstazGroupInfo[]
  totalStudents: number
  pendingMemorizationCount: number
  pendingRevisionCount: number
}

// Web App URL for Telegram Mini App
const WEB_APP_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/telegram`
  : 'https://qurantester.vercel.app/telegram'

// Quran Web App URL - redirects to student quran page
const QURAN_WEB_APP_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/telegram?redirect=/student/quran`
  : 'https://qurantester.vercel.app/telegram?redirect=/student/quran'

// Base URL for web app
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://qurantester.vercel.app'

// Build ustaz report URL for a specific group
function getUstazReportUrl(groupId: string): string {
  return `${BASE_URL}/telegram?redirect=/ustaz/groups/${groupId}/report`
}

// Parent reports URL - redirects to parent daily report
const PARENT_REPORTS_URL = `${BASE_URL}/telegram?redirect=/parent/report`

/**
 * Main menu keyboard based on user role
 * For students, optionally pass menu info to show dynamic task button and ustaz chat
 * For ustaz, optionally pass ustazMenuInfo for dynamic report links
 */
export function getMainMenuKeyboard(role: UserRole, menuInfo?: StudentMenuInfo, ustazMenuInfo?: UstazMenuInfo): InlineKeyboard {
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
      // Add report buttons per group
      if (ustazMenuInfo?.groups && ustazMenuInfo.groups.length > 0) {
        for (const group of ustazMenuInfo.groups) {
          keyboard.webApp(`📋 ${group.name}`, getUstazReportUrl(group.id)).row()
        }
      }
      keyboard.webApp('🌐 Веб', WEB_APP_URL)
      break

    case UserRole.STUDENT:
      // Show lesson types if available (new multi-group flow)
      if (menuInfo?.lessonTypes && menuInfo.lessonTypes.length > 0) {
        // Group lesson types by type
        for (const lesson of menuInfo.lessonTypes) {
          const typeName = getLessonTypeName(lesson.type)
          const stageShort = lesson.currentStage.replace('STAGE_', '').replace('_', '.')

          // Show task progress if has active task
          if (lesson.hasActiveTask && lesson.taskProgress) {
            const { passed, required, pending } = lesson.taskProgress
            const remaining = required - passed - pending

            let statusIcon: string
            if (passed >= required) {
              statusIcon = '✅' // Complete
            } else if (remaining === 0 && pending > 0) {
              statusIcon = '⏳' // Waiting review
            } else {
              statusIcon = '📝' // In progress
            }

            keyboard.text(
              `${statusIcon} ${typeName} (${stageShort}) ${passed}/${required}`,
              `lesson_type:${lesson.type}:${lesson.groupId}`
            ).row()
          } else {
            keyboard.text(
              `📖 ${typeName} (${stageShort})`,
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

      // Revision button - shows learned pages for review
      keyboard.text('🔄 Повторение', 'student:revision').row()

      // Translations (Mufradat) button - shows word translation game
      keyboard.text('📝 Переводы', 'student:mufradat').row()

      keyboard
        .text('📚 Мои группы', 'student:groups').row()
        .text('📈 Мой прогресс', 'student:progress')
        .text('📋 История', 'student:tasks').row()

      // Show sync status button if there are pending submissions
      if (menuInfo?.hasPendingSubmissions) {
        keyboard.text('🔄 Статус синхронизации', 'student:sync').row()
      }

      keyboard
        .webApp('📖 Коран', QURAN_WEB_APP_URL)
        .webApp('🌐 Веб', WEB_APP_URL)
      break

    case UserRole.PARENT:
      keyboard
        .text('👨‍👩‍👧‍👦 Успеваемость детей', 'parent:children').row()
        .text('📊 Статистика', 'parent:stats').row()
        .webApp('📋 Отчёт', PARENT_REPORTS_URL)
        .webApp('🌐 Веб', WEB_APP_URL)
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
export function getStudentTaskKeyboard(
  taskId: string,
  canSubmit: boolean = true,
  isLastSubmission: boolean = false
): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  // Show confirm button for the last submission (when requiredCount reached)
  if (isLastSubmission) {
    keyboard.text('✅ Подтвердить работу', `task:confirm:${taskId}`).row()
  }

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
export function getActiveTaskKeyboard(
  taskId: string,
  hasPendingSubmission: boolean = false,
  isTaskComplete: boolean = false,
  allSentWaitingReview: boolean = false,
  backCallback: string = 'student:menu',
  backLabel: string = '◀️ В меню'
): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  if (isTaskComplete) {
    // Task is complete - show button to advance to next stage
    keyboard.text('▶️ Перейти к следующему этапу', `task:advance:${taskId}`).row()
    keyboard.text(backLabel, backCallback)
  } else if (allSentWaitingReview) {
    // All submissions sent, waiting for ustaz review
    keyboard.text('🔄 Статус доставки', 'student:sync').row()
    keyboard.text(backLabel, backCallback)
  } else if (hasPendingSubmission) {
    keyboard.text('↩️ Отменить последнюю запись', `task:cancel_last:${taskId}`).row()
    keyboard.text(backLabel, backCallback)
  } else {
    keyboard.text(backLabel, backCallback)
  }

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
/**
 * Gender selection keyboard for registration
 */
export function getGenderSelectionKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('👨 Мужской', 'reg:gender:MALE').row()
    .text('🧕 Женский', 'reg:gender:FEMALE')
}

export function getRoleSelectionKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📚 Студент', 'reg:role:STUDENT').row()
    .text('👨‍🏫 Устаз', 'reg:role:USTAZ').row()
    .text('👨‍👩‍👧 Родитель', 'reg:role:PARENT')
}

/**
 * Group list keyboard for student registration
 */
export function getGroupListKeyboard(
  groups: Array<{
    id: string
    name: string
    lessonType: LessonType
    ustaz: { firstName: string | null; lastName: string | null } | null
    _count: { students: number }
  }>
): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  const lessonTypeNames: Record<LessonType, string> = {
    [LessonType.MEMORIZATION]: 'Хифз',
    [LessonType.REVISION]: 'Муража',
    [LessonType.TRANSLATION]: 'Перевод',
  }

  for (const group of groups) {
    const ustazName = group.ustaz
      ? [group.ustaz.firstName, group.ustaz.lastName].filter(Boolean).join(' ')
      : ''
    const typeName = lessonTypeNames[group.lessonType]
    const label = ustazName
      ? `${group.name} (${typeName}) - ${ustazName}`
      : `${group.name} (${typeName})`
    keyboard.text(label, `reg:group:${group.id}`).row()
  }

  keyboard.text('◀️ Назад', 'reg:back_to_role')

  return keyboard
}

/**
 * Group confirmation keyboard
 */
export function getGroupConfirmKeyboard(groupId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Подтвердить', `reg:confirm_group:${groupId}`).row()
    .text('◀️ Выбрать другую', 'reg:back_to_group_list')
}

/**
 * Back to role selection keyboard
 */
export function getBackToRoleKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('◀️ Назад к выбору роли', 'reg:back_to_role')
}

/**
 * Progress selection keyboard - page number pagination
 * Shows pages 1-604 in pages of 40 (8 rows x 5 buttons)
 */
export function getProgressPageKeyboard(currentOffset: number = 0): InlineKeyboard {
  const keyboard = new InlineKeyboard()
  const totalPages = 604
  const pageSize = 40

  // Generate page buttons
  const startPage = currentOffset + 1
  const endPage = Math.min(currentOffset + pageSize, totalPages)

  let row: number[] = []
  for (let page = startPage; page <= endPage; page++) {
    row.push(page)
    if (row.length === 5) {
      for (const p of row) {
        keyboard.text(String(p), `reg:progress_page:${p}`)
      }
      keyboard.row()
      row = []
    }
  }
  // Add remaining buttons
  if (row.length > 0) {
    for (const p of row) {
      keyboard.text(String(p), `reg:progress_page:${p}`)
    }
    keyboard.row()
  }

  // Navigation buttons
  const hasPrev = currentOffset > 0
  const hasNext = currentOffset + pageSize < totalPages

  if (hasPrev || hasNext) {
    if (hasPrev) {
      keyboard.text('⬅️ Пред.', `reg:progress_offset:${currentOffset - pageSize}`)
    }
    if (hasNext) {
      keyboard.text('След. ➡️', `reg:progress_offset:${currentOffset + pageSize}`)
    }
    keyboard.row()
  }

  keyboard.text('◀️ Назад к группе', 'reg:back_to_group_confirm')

  return keyboard
}

/**
 * Line selection keyboard (1-15)
 */
export function getProgressLineKeyboard(selectedPage: number): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  // 3 rows of 5 lines each
  for (let row = 0; row < 3; row++) {
    for (let col = 1; col <= 5; col++) {
      const line = row * 5 + col
      keyboard.text(String(line), `reg:progress_line:${selectedPage}:${line}`)
    }
    keyboard.row()
  }

  keyboard.text('◀️ Назад к странице', 'reg:back_to_progress_page')

  return keyboard
}

/**
 * Stage selection keyboard
 */
export function getProgressStageKeyboard(selectedPage: number, selectedLine: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('1.1', `reg:progress_stage:${selectedPage}:${selectedLine}:STAGE_1_1`)
    .text('1.2', `reg:progress_stage:${selectedPage}:${selectedLine}:STAGE_1_2`)
    .row()
    .text('2.1', `reg:progress_stage:${selectedPage}:${selectedLine}:STAGE_2_1`)
    .text('2.2', `reg:progress_stage:${selectedPage}:${selectedLine}:STAGE_2_2`)
    .row()
    .text('3', `reg:progress_stage:${selectedPage}:${selectedLine}:STAGE_3`)
    .row()
    .text('◀️ Назад к строке', `reg:back_to_progress_line:${selectedPage}`)
}

// ============== TRANSLATION KEYBOARDS ==============

/**
 * Keyboard for selecting a page to practice translations
 * Shows pages with completion percentages
 * @param learnedPages - pages the student has completed (up to current page - 1)
 * @param pageProgress - map of pageNumber to percentage completion today
 */
export function getTranslationPageSelectKeyboard(
  learnedPages: number[],
  currentOffset: number = 0,
  pageSize: number = 15,
  pageProgress: Map<number, number> = new Map()
): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  // Get slice of pages to show
  const pagesToShow = learnedPages.slice(currentOffset, currentOffset + pageSize)

  // Create rows of 5 buttons
  let row: { text: string; callback: string }[] = []
  for (const page of pagesToShow) {
    const percent = pageProgress.get(page) ?? 0
    // Show emoji based on completion: ✅ = 100%, partial shows %
    let text: string
    if (percent >= 100) {
      text = `✅${page}`
    } else if (percent > 0) {
      text = `${page}(${percent}%)`
    } else {
      text = String(page)
    }
    row.push({ text, callback: `translation:page:${page}` })
    if (row.length === 5) {
      for (const btn of row) {
        keyboard.text(btn.text, btn.callback)
      }
      keyboard.row()
      row = []
    }
  }
  // Add remaining buttons
  if (row.length > 0) {
    for (const btn of row) {
      keyboard.text(btn.text, btn.callback)
    }
    keyboard.row()
  }

  // Pagination
  const hasMore = learnedPages.length > currentOffset + pageSize
  const hasPrev = currentOffset > 0

  if (hasPrev || hasMore) {
    if (hasPrev) {
      keyboard.text('◀️', `translation:offset:${currentOffset - pageSize}`)
    }
    keyboard.text(`${Math.floor(currentOffset / pageSize) + 1}/${Math.ceil(learnedPages.length / pageSize)}`, 'noop')
    if (hasMore) {
      keyboard.text('▶️', `translation:offset:${currentOffset + pageSize}`)
    }
    keyboard.row()
  }

  // Stats button and back
  keyboard.text('📊 Статистика', 'translation:stats').row()
  keyboard.text('◀️ Назад', 'student:menu')

  return keyboard
}

// ============== REVISION KEYBOARDS ==============

/**
 * Keyboard for selecting a page to review
 * Shows pages in rows of 5 buttons each
 * @param markedPages - pages already marked today (will show with checkmark)
 */
export function getRevisionPageSelectKeyboard(
  learnedPages: number[],
  currentOffset: number = 0,
  pageSize: number = 15,
  markedPages: number[] = []
): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  // Get slice of pages to show
  const pagesToShow = learnedPages.slice(currentOffset, currentOffset + pageSize)

  // Create rows of 5 buttons
  let row: { text: string; callback: string }[] = []
  for (const page of pagesToShow) {
    const isMarked = markedPages.includes(page)
    const text = isMarked ? `✅${page}` : String(page)
    row.push({ text, callback: `revision:page:${page}` })
    if (row.length === 5) {
      for (const btn of row) {
        keyboard.text(btn.text, btn.callback)
      }
      keyboard.row()
      row = []
    }
  }
  // Add remaining buttons
  if (row.length > 0) {
    for (const btn of row) {
      keyboard.text(btn.text, btn.callback)
    }
    keyboard.row()
  }

  // Pagination
  const hasMore = learnedPages.length > currentOffset + pageSize
  const hasPrev = currentOffset > 0

  if (hasPrev || hasMore) {
    if (hasPrev) {
      keyboard.text('◀️', `revision:offset:${currentOffset - pageSize}`)
    }
    keyboard.text(`${Math.floor(currentOffset / pageSize) + 1}/${Math.ceil(learnedPages.length / pageSize)}`, 'noop')
    if (hasMore) {
      keyboard.text('▶️', `revision:offset:${currentOffset + pageSize}`)
    }
    keyboard.row()
  }

  keyboard.text('◀️ Назад', 'student:menu')

  return keyboard
}

/**
 * Keyboard for revision submission mode
 */
export function getRevisionSubmitKeyboard(pageNumber: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('↩️ Выбрать другую страницу', 'student:revision').row()
    .text('◀️ В меню', 'student:menu')
}

/**
 * Keyboard for ustaz to review revision submissions
 */
export function getRevisionReviewKeyboard(revisionId: string, studentUsername?: string): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text('✅ Сдал', `revision_review:pass:${revisionId}`)
    .text('❌ Не сдал', `revision_review:fail:${revisionId}`)

  // Add chat button if student has username
  if (studentUsername) {
    keyboard.row().url(`💬 Написать студенту`, `https://t.me/${studentUsername}`)
  }

  return keyboard
}

// ============== MEMORIZATION STAGE UI ==============

/**
 * Stage progress info for display
 */
export interface StageProgressInfo {
  stage: string  // STAGE_1_1, STAGE_1_2, etc
  totalLines: number
  completedLines: number
  hasActiveTask: boolean
  isCurrentStage: boolean
  status: 'completed' | 'in_progress' | 'pending' | 'locked'
}

/**
 * Line progress info for display
 */
export interface LineProgressInfo {
  lineNumber: number
  status: 'not_started' | 'in_progress' | 'pending' | 'completed' | 'failed'
  passedCount: number
  requiredCount: number
  isActive: boolean  // Can be clicked
}

/**
 * Get stage display name (short)
 */
export function getStageShortName(stage: string): string {
  const names: Record<string, string> = {
    STAGE_1_1: 'Заучивание (1.1)',
    STAGE_1_2: 'Соединение (1.2)',
    STAGE_2_1: 'Заучивание (2.1)',
    STAGE_2_2: 'Соединение (2.2)',
    STAGE_3: 'Повторение (3)',
  }
  return names[stage] || stage
}

/**
 * Get status icon for stage
 */
export function getStageStatusIcon(status: string): string {
  switch (status) {
    case 'completed': return '✅'
    case 'in_progress': return '📝'
    case 'pending': return '⏳'
    case 'locked': return '🔒'
    default: return '📖'
  }
}

/**
 * Get status icon for line
 */
export function getLineStatusIcon(status: string): string {
  switch (status) {
    case 'completed': return '✅'
    case 'in_progress': return '📝'
    case 'pending': return '⏳'
    case 'failed': return '❌'
    case 'not_started': return '○'
    default: return '○'
  }
}

/**
 * Keyboard for showing memorization stages for a page
 */
export function getMemorizationStagesKeyboard(
  groupId: string,
  pageNumber: number,
  surahName: string,
  stages: StageProgressInfo[],
  currentStageName: string,
  hasMultipleGroups: boolean = false
): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  for (const stage of stages) {
    const icon = getStageStatusIcon(stage.status)
    const name = getStageShortName(stage.stage)

    // Show progress for learning stages (1.1, 2.1)
    let label: string
    const isLearningStage = stage.stage === 'STAGE_1_1' || stage.stage === 'STAGE_2_1'

    if (isLearningStage && stage.totalLines > 0) {
      label = `${icon} ${name} (${stage.completedLines}/${stage.totalLines})`
    } else if (stage.status === 'completed') {
      label = `${icon} ${name}`
    } else if (stage.status === 'pending') {
      label = `${icon} ${name} ⏳`
    } else if (stage.status === 'locked') {
      label = `🔒 ${name}`
    } else {
      label = `${icon} ${name}`
    }

    // Locked stages are not clickable
    if (stage.status === 'locked') {
      keyboard.text(label, 'noop').row()
    } else {
      keyboard.text(label, `mem_stage:${groupId}:${pageNumber}:${stage.stage}`).row()
    }
  }

  // Back button - to groups if multiple, otherwise to menu
  if (hasMultipleGroups) {
    keyboard.text('◀️ К группам', 'student:groups')
  } else {
    keyboard.text('◀️ В меню', 'student:menu')
  }

  return keyboard
}

/**
 * Keyboard for showing lines within a learning stage (1.1 or 2.1)
 */
export function getMemorizationLinesKeyboard(
  groupId: string,
  pageNumber: number,
  stage: string,
  lines: LineProgressInfo[]
): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  // Show lines in rows of 4
  let row: LineProgressInfo[] = []
  for (const line of lines) {
    row.push(line)
    if (row.length === 4) {
      for (const l of row) {
        const icon = getLineStatusIcon(l.status)
        const label = `${icon} ${l.lineNumber}`
        if (l.isActive) {
          keyboard.text(label, `mem_line:${groupId}:${pageNumber}:${stage}:${l.lineNumber}`)
        } else {
          keyboard.text(label, 'noop')
        }
      }
      keyboard.row()
      row = []
    }
  }
  // Add remaining buttons
  if (row.length > 0) {
    for (const l of row) {
      const icon = getLineStatusIcon(l.status)
      const label = `${icon} ${l.lineNumber}`
      if (l.isActive) {
        keyboard.text(label, `mem_line:${groupId}:${pageNumber}:${stage}:${l.lineNumber}`)
      } else {
        keyboard.text(label, 'noop')
      }
    }
    keyboard.row()
  }

  keyboard.text('◀️ К этапам', `mem_stages:${groupId}:${pageNumber}`)

  return keyboard
}

/**
 * Keyboard for connection/full page stages (1.2, 2.2, 3)
 * These stages don't have individual lines - just start submission
 */
export function getMemorizationConnectionKeyboard(
  groupId: string,
  pageNumber: number,
  stage: string,
  passedCount: number,
  requiredCount: number,
  pendingCount: number,
  status: 'not_started' | 'in_progress' | 'pending' | 'completed'
): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  if (status === 'pending') {
    keyboard.text('⏳ Ожидает проверку устаза', 'noop').row()
  } else if (status === 'completed') {
    keyboard.text('✅ Этап завершён', 'noop').row()
    keyboard.text('▶️ Следующий этап', `mem_next_stage:${groupId}:${pageNumber}:${stage}`).row()
  } else {
    const remaining = requiredCount - passedCount - pendingCount
    if (remaining > 0) {
      keyboard.text(`▶️ Начать сдачу (${passedCount}/${requiredCount})`, `mem_start:${groupId}:${pageNumber}:${stage}`).row()
    } else if (pendingCount > 0) {
      keyboard.text('⏳ Все отправлено, ждите проверку', 'noop').row()
    }
  }

  keyboard.text('◀️ К этапам', `mem_stages:${groupId}:${pageNumber}`)

  return keyboard
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
