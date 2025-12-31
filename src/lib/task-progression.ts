import { StageNumber, GroupLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// ============ ASYNC FUNCTIONS (Database-backed - preferred) ============

/**
 * Get line count from database (source of truth)
 * Falls back to standard values if page not in DB
 */
export async function getPageLineCountFromDB(pageNumber: number): Promise<number> {
  const page = await prisma.quranPage.findUnique({
    where: { pageNumber },
    select: { totalLines: true }
  })

  if (page) {
    return page.totalLines
  }

  // Fallback: standard Medina Mushaf values
  if (pageNumber === 1) return 7  // Fatiha - 7 lines
  if (pageNumber === 2) return 6  // Second page - 6 lines
  return 15  // All other pages - 15 lines
}

/**
 * Get stage order based on actual page line count from database
 */
export async function getStageOrderFromDB(pageNumber: number): Promise<StageNumber[]> {
  const lineCount = await getPageLineCountFromDB(pageNumber)
  return lineCount > 7 ? STAGE_ORDER : SIMPLE_STAGE_ORDER
}

/**
 * Get next stage based on database line count
 */
export async function getNextStageFromDB(currentStage: StageNumber, pageNumber: number): Promise<StageNumber | null> {
  const stages = await getStageOrderFromDB(pageNumber)
  const currentIndex = stages.indexOf(currentStage)

  if (currentIndex === -1 || currentIndex >= stages.length - 1) {
    return null // No next stage, move to next page
  }

  return stages[currentIndex + 1]
}

/**
 * Get line range for a stage based on database line count
 */
export async function getStageLineRangeFromDB(
  stage: StageNumber,
  pageNumber: number
): Promise<{ startLine: number; endLine: number }> {
  const lineCount = await getPageLineCountFromDB(pageNumber)

  // For simple pages (<=7 lines)
  if (lineCount <= 7) {
    return { startLine: 1, endLine: lineCount }
  }

  // For regular pages (15 lines)
  switch (stage) {
    case 'STAGE_1_1':
    case 'STAGE_1_2':
      return { startLine: 1, endLine: 7 }
    case 'STAGE_2_1':
    case 'STAGE_2_2':
      return { startLine: 8, endLine: lineCount }
    case 'STAGE_3':
      return { startLine: 1, endLine: lineCount }
    default:
      return { startLine: 1, endLine: lineCount }
  }
}

// ============ SYNC FUNCTIONS (Fallback with correct standard values) ============

// Standard Medina Mushaf line counts (used as fallback)
// Page 1 (Fatiha): 7 lines
// Page 2: 6 lines
// All other pages: 15 lines
const PAGE_LINE_COUNTS: Record<number, number> = {
  1: 7,   // Fatiha - 7 lines
  2: 6,   // Second page - 6 lines
}

export function getPageLineCount(pageNumber: number): number {
  return PAGE_LINE_COUNTS[pageNumber] || 15
}

// Get lines per batch based on group level
// NOTE: This is a base value. For Level 2 and 3, actual batching is more nuanced:
// - Level 2: Stage 1.1 uses 3+4 (not 3+3+1), Stage 2.1 uses 4+4 (not 3+3+2)
// - Level 3: Stage 1.1 and 2.1 are done all at once (7 and 8 lines respectively)
export function getLinesPerBatch(level: GroupLevel): number {
  switch (level) {
    case 'LEVEL_1': return 1   // 1 line at a time
    case 'LEVEL_2': return 3   // Base: 3 lines (but actual batching is smart: 3+4 or 4+4)
    case 'LEVEL_3': return 7   // Base: 7 lines (but actually does whole stage at once)
    default: return 1
  }
}

// Stage progression order
const STAGE_ORDER: StageNumber[] = [
  'STAGE_1_1',  // Lines 1-7 individually
  'STAGE_1_2',  // Lines 1-7 together (80x)
  'STAGE_2_1',  // Lines 8-15 individually
  'STAGE_2_2',  // Lines 8-15 together (80x)
  'STAGE_3',    // Full page (80x)
]

// For pages with <= 7 lines, simplified stages
const SIMPLE_STAGE_ORDER: StageNumber[] = [
  'STAGE_1_1',  // All lines individually
  'STAGE_3',    // Full page (80x)
]

export function getStageOrder(pageNumber: number): StageNumber[] {
  const lineCount = getPageLineCount(pageNumber)
  return lineCount > 7 ? STAGE_ORDER : SIMPLE_STAGE_ORDER
}

export function getNextStage(currentStage: StageNumber, pageNumber: number): StageNumber | null {
  const stages = getStageOrder(pageNumber)
  const currentIndex = stages.indexOf(currentStage)

  if (currentIndex === -1 || currentIndex >= stages.length - 1) {
    return null // No next stage, move to next page
  }

  return stages[currentIndex + 1]
}

// Get line range for a stage
export function getStageLineRange(stage: StageNumber, pageNumber: number): { startLine: number; endLine: number } {
  const lineCount = getPageLineCount(pageNumber)

  // For simple pages (<=7 lines)
  if (lineCount <= 7) {
    return { startLine: 1, endLine: lineCount }
  }

  // For regular pages (15 lines)
  switch (stage) {
    case 'STAGE_1_1':
    case 'STAGE_1_2':
      return { startLine: 1, endLine: 7 }
    case 'STAGE_2_1':
    case 'STAGE_2_2':
      return { startLine: 8, endLine: lineCount }
    case 'STAGE_3':
      return { startLine: 1, endLine: lineCount }
    default:
      return { startLine: 1, endLine: lineCount }
  }
}

// Check if stage is a "learning" stage (individual lines) vs "review" stage (multiple lines together)
export function isLearningStage(stage: StageNumber): boolean {
  return stage === 'STAGE_1_1' || stage === 'STAGE_2_1'
}

// Get stage display name in Russian
export function getStageName(stage: StageNumber): string {
  const names: Record<StageNumber, string> = {
    STAGE_1_1: 'Этап 1.1 - Изучение строк 1-7',
    STAGE_1_2: 'Этап 1.2 - Соединение строк 1-7',
    STAGE_2_1: 'Этап 2.1 - Изучение строк 8-15',
    STAGE_2_2: 'Этап 2.2 - Соединение строк 8-15',
    STAGE_3: 'Этап 3 - Вся страница',
  }
  return names[stage] || stage
}

// Calculate deadline based on stage and level (in hours)
export function calculateDeadline(
  stage: StageNumber,
  level: GroupLevel,
  stageHours: { stage1: number; stage2: number; stage3: number }
): Date {
  let hours = stageHours.stage1

  if (stage === 'STAGE_1_2' || stage === 'STAGE_2_1' || stage === 'STAGE_2_2') {
    hours = stageHours.stage2
  } else if (stage === 'STAGE_3') {
    hours = stageHours.stage3
  }

  const deadline = new Date()
  deadline.setTime(deadline.getTime() + hours * 60 * 60 * 1000)
  return deadline
}

// Check if task should progress to next stage
export interface TaskProgressResult {
  shouldProgress: boolean
  nextStage: StageNumber | null
  nextPage: number | null
  remainingCount: number // For resubmission tasks
}

export function checkTaskProgress(
  passedCount: number,
  failedCount: number,
  requiredCount: number,
  currentStage: StageNumber,
  currentPage: number
): TaskProgressResult {
  const totalSubmitted = passedCount + failedCount

  // Not enough submissions yet
  if (totalSubmitted < requiredCount) {
    return {
      shouldProgress: false,
      nextStage: null,
      nextPage: null,
      remainingCount: requiredCount - totalSubmitted,
    }
  }

  // All passed - can progress
  if (passedCount >= requiredCount && failedCount === 0) {
    const nextStage = getNextStage(currentStage, currentPage)

    if (nextStage) {
      return {
        shouldProgress: true,
        nextStage,
        nextPage: currentPage,
        remainingCount: 0,
      }
    } else {
      // Move to next page
      const nextPage = currentPage < 602 ? currentPage + 1 : null
      return {
        shouldProgress: true,
        nextStage: nextPage ? getStageOrder(nextPage)[0] : null,
        nextPage,
        remainingCount: 0,
      }
    }
  }

  // Has failures - need to resubmit failed ones
  return {
    shouldProgress: false,
    nextStage: null,
    nextPage: null,
    remainingCount: failedCount, // Must redo the failed submissions
  }
}

// Get the current line to learn based on stage and progress
export function getCurrentLearningLine(
  stage: StageNumber,
  currentLine: number,
  level: GroupLevel,
  pageNumber: number
): { startLine: number; endLine: number } {
  if (!isLearningStage(stage)) {
    // Review stages - return full range
    return getStageLineRange(stage, pageNumber)
  }

  const linesPerBatch = getLinesPerBatch(level)
  const { startLine, endLine: maxLine } = getStageLineRange(stage, pageNumber)

  // Calculate current batch
  const batchStartLine = currentLine
  const batchEndLine = Math.min(batchStartLine + linesPerBatch - 1, maxLine)

  return { startLine: batchStartLine, endLine: batchEndLine }
}
