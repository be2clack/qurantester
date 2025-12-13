import { UserRole } from '@prisma/client'

export const ROLE_CONFIG = {
  [UserRole.ADMIN]: {
    label: 'Администратор',
    labelShort: 'Админ',
    description: 'Полный доступ к системе',
    color: 'bg-red-500',
    textColor: 'text-red-500',
    badgeVariant: 'destructive' as const,
    permissions: [
      'manage_users',
      'manage_groups',
      'manage_lessons',
      'manage_quran',
      'view_all_stats',
      'system_settings',
    ],
  },
  [UserRole.USTAZ]: {
    label: 'Устаз',
    labelShort: 'Устаз',
    description: 'Учитель, проверяет задания',
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    badgeVariant: 'default' as const,
    permissions: [
      'view_own_groups',
      'manage_group_students',
      'review_submissions',
      'create_tasks',
      'view_group_stats',
    ],
  },
  [UserRole.STUDENT]: {
    label: 'Студент',
    labelShort: 'Студент',
    description: 'Ученик, выполняет задания',
    color: 'bg-green-500',
    textColor: 'text-green-500',
    badgeVariant: 'secondary' as const,
    permissions: [
      'view_own_tasks',
      'submit_tasks',
      'view_own_progress',
      'view_quran',
    ],
  },
  [UserRole.PARENT]: {
    label: 'Родитель',
    labelShort: 'Родитель',
    description: 'Следит за успеваемостью детей',
    color: 'bg-purple-500',
    textColor: 'text-purple-500',
    badgeVariant: 'outline' as const,
    permissions: [
      'view_children_progress',
      'view_children_stats',
    ],
  },
  [UserRole.PENDING]: {
    label: 'Ожидание',
    labelShort: 'Ожидание',
    description: 'Ожидает подтверждения администратором',
    color: 'bg-gray-500',
    textColor: 'text-gray-500',
    badgeVariant: 'outline' as const,
    permissions: [],
  },
} as const

export type Permission = typeof ROLE_CONFIG[UserRole]['permissions'][number]

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  const config = ROLE_CONFIG[role]
  return (config.permissions as readonly string[]).includes(permission)
}

/**
 * Get role label in Russian
 */
export function getRoleLabel(role: UserRole): string {
  return ROLE_CONFIG[role].label
}

/**
 * Get role badge variant for shadcn/ui Badge component
 */
export function getRoleBadgeVariant(role: UserRole) {
  return ROLE_CONFIG[role].badgeVariant
}

/**
 * Get all roles as options for select
 */
export function getRoleOptions() {
  return Object.entries(ROLE_CONFIG).map(([value, config]) => ({
    value: value as UserRole,
    label: config.label,
    description: config.description,
  }))
}

/**
 * Dashboard redirect path by role
 */
export const ROLE_DASHBOARD_PATH: Record<UserRole, string> = {
  [UserRole.ADMIN]: '/admin',
  [UserRole.USTAZ]: '/ustaz',
  [UserRole.STUDENT]: '/student',
  [UserRole.PARENT]: '/parent',
  [UserRole.PENDING]: '/pending',
}
