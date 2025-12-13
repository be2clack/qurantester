import type {
  User,
  Group,
  Lesson,
  Task,
  Submission,
  QuranPage,
  QuranLine,
  UserStatistics,
  AuthToken,
  UserRole,
  TaskStatus,
  StageNumber,
  LessonType,
  SubmissionStatus
} from '@prisma/client'

// Re-export Prisma types
export type {
  User,
  Group,
  Lesson,
  Task,
  Submission,
  QuranPage,
  QuranLine,
  UserStatistics,
  AuthToken,
  UserRole,
  TaskStatus,
  StageNumber,
  LessonType,
  SubmissionStatus
}

// Extended types with relations
export type UserWithRelations = User & {
  ustazGroups?: Group[]
  studentGroup?: Group | null
  tasks?: Task[]
  submissions?: Submission[]
  parentOf?: User[]
  childOf?: User[]
  statistics?: UserStatistics | null
}

export type GroupWithRelations = Group & {
  ustaz: User
  students: User[]
  lessons: Lesson[]
  _count?: {
    students: number
    lessons: number
  }
}

export type LessonWithRelations = Lesson & {
  group: Group
  tasks: Task[]
  _count?: {
    tasks: number
  }
}

export type TaskWithRelations = Task & {
  lesson: Lesson
  student: User
  page: QuranPage
  submissions: Submission[]
  _count?: {
    submissions: number
  }
}

export type SubmissionWithRelations = Submission & {
  task: Task
  student: User
}

export type QuranPageWithLines = QuranPage & {
  lines: QuranLine[]
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// Session types
export interface UserSession {
  id: string
  phone: string
  role: UserRole
  firstName?: string | null
  lastName?: string | null
  telegramId?: bigint | null
  currentPage: number
  currentLine: number
  currentStage: StageNumber
}

// Stats types
export interface UserProgressStats {
  totalPages: number
  completedPages: number
  progressPercent: string
  currentPosition: string
}

export interface TaskStats {
  total: number
  completed: number
  pending: number
  failed: number
  completionRate: string
}

export interface ComparisonStats {
  thisWeek: number
  lastWeek: number
  thisMonth: number
  lastMonth: number
  weeklyTrend: number
  monthlyTrend: number
}

export interface RankingStats {
  globalRank: number | null
  groupRank: number | null
  totalStudents: number
}

// Form types
export interface CreateUserInput {
  phone: string
  firstName?: string
  lastName?: string
  role: UserRole
  groupId?: string
}

export interface UpdateUserInput {
  firstName?: string
  lastName?: string
  role?: UserRole
  groupId?: string | null
  isActive?: boolean
}

export interface CreateGroupInput {
  name: string
  description?: string
  ustazId: string
}

export interface CreateLessonInput {
  name: string
  type: LessonType
  groupId: string
  repetitionCount?: number
  stage1Days?: number
  stage2Days?: number
  stage3Days?: number
  showText?: boolean
  showImage?: boolean
  showAudio?: boolean
  allowVoice?: boolean
  allowVideoNote?: boolean
}

export interface CreateTaskInput {
  lessonId: string
  studentId: string
  pageNumber: number
  startLine: number
  endLine: number
  stage: StageNumber
  deadline?: Date
}

export interface ReviewSubmissionInput {
  status: 'PASSED' | 'FAILED'
}
