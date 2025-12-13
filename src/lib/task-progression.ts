import { StageNumber, GroupLevel } from '@prisma/client'

// Page line counts
const PAGE_LINE_COUNTS: Record<number, number> = {
  1: 5,   // First page has 5 lines
  2: 6,   // Second page has 6 lines
}

export function getPageLineCount(pageNumber: number): number {
  return PAGE_LINE_COUNTS[pageNumber] || 15
}

// Get lines per batch based on group level
export function getLinesPerBatch(level: GroupLevel): number {
  switch (level) {
    case 'LEVEL_1': return 1   // 1 line at a time
    case 'LEVEL_2': return 3   // 3 lines at a time
    case 'LEVEL_3': return 7   // 7 lines at a time
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
      return { startLine: 8, endLine: 15 }
    case 'STAGE_3':
      return { startLine: 1, endLine: 15 }
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
    STAGE_1_2: 'Этап 1.2 - Повторение строк 1-7',
    STAGE_2_1: 'Этап 2.1 - Изучение строк 8-15',
    STAGE_2_2: 'Этап 2.2 - Повторение строк 8-15',
    STAGE_3: 'Этап 3 - Вся страница',
  }
  return names[stage] || stage
}

// Calculate deadline based on stage and level
export function calculateDeadline(
  stage: StageNumber,
  level: GroupLevel,
  stageDays: { stage1: number; stage2: number; stage3: number }
): Date {
  let days = stageDays.stage1
  
  if (stage === 'STAGE_1_2' || stage === 'STAGE_2_1' || stage === 'STAGE_2_2') {
    days = stageDays.stage2
  } else if (stage === 'STAGE_3') {
    days = stageDays.stage3
  }
  
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + days)
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
