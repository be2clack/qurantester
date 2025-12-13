export const QURAN_TOTAL_PAGES = 602

/**
 * Get the number of lines for a specific page
 * Page 1: 5 lines (Fatiha)
 * Page 2: 6 lines
 * All other pages: 15 lines (standard Medina Mushaf)
 */
export function getLinesPerPage(pageNumber: number): number {
  if (pageNumber === 1) return 5
  if (pageNumber === 2) return 6
  return 15
}

/**
 * Get total lines in the entire Quran
 */
export function getTotalLines(): number {
  // Page 1: 5 + Page 2: 6 + Pages 3-602: 600 * 15 = 9011 lines
  return 5 + 6 + (600 * 15)
}

/**
 * Calculate which page and line a global line number falls on
 */
export function getPositionFromGlobalLine(globalLine: number): { page: number; line: number } {
  if (globalLine <= 5) {
    return { page: 1, line: globalLine }
  }

  if (globalLine <= 11) {
    return { page: 2, line: globalLine - 5 }
  }

  const remainingLines = globalLine - 11
  const page = Math.floor(remainingLines / 15) + 3
  const line = (remainingLines % 15) || 15

  return { page, line: line === 0 ? 15 : line }
}

/**
 * Calculate global line number from page and line
 */
export function getGlobalLineNumber(page: number, line: number): number {
  if (page === 1) return line
  if (page === 2) return 5 + line
  return 11 + ((page - 3) * 15) + line
}

// Stage definitions
export const STAGES = {
  STAGE_1_1: {
    name: 'Изучение 1-7',
    nameRu: 'Этап 1.1: Изучение строк 1-7',
    description: 'Изучение строк 1-7 по одной',
    defaultDays: 1,
  },
  STAGE_1_2: {
    name: 'Повторение 1-7',
    nameRu: 'Этап 1.2: Повторение строк 1-7',
    description: 'Повторение строк 1-7 вместе (80 раз)',
    defaultDays: 2,
  },
  STAGE_2_1: {
    name: 'Изучение 8-15',
    nameRu: 'Этап 2.1: Изучение строк 8-15',
    description: 'Изучение строк 8-15 по одной',
    defaultDays: 1,
  },
  STAGE_2_2: {
    name: 'Повторение 8-15',
    nameRu: 'Этап 2.2: Повторение строк 8-15',
    description: 'Повторение строк 8-15 вместе (80 раз)',
    defaultDays: 2,
  },
  STAGE_3: {
    name: 'Вся страница',
    nameRu: 'Этап 3: Вся страница',
    description: 'Повторение всей страницы целиком (80 раз)',
    defaultDays: 2,
  },
} as const

// Lesson types
export const LESSON_TYPES = {
  MEMORIZATION: {
    name: 'Заучивание',
    description: 'Заучивание новых страниц Корана',
    icon: 'BookOpen',
  },
  REVISION: {
    name: 'Повторение',
    description: 'Повторение выученных страниц',
    icon: 'RotateCcw',
  },
  TRANSLATION: {
    name: 'Перевод',
    description: 'Изучение перевода и значений',
    icon: 'Languages',
  },
} as const

// Default settings
export const DEFAULT_SETTINGS = {
  repetitionCount: 80,
  stage1Days: 1,
  stage2Days: 2,
  stage3Days: 2,
} as const
