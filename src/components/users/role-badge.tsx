import { Badge } from '@/components/ui/badge'
import { getRoleLabel, getRoleBadgeVariant, ROLE_CONFIG } from '@/lib/constants/roles'
import { UserRole } from '@prisma/client'
import { cn } from '@/lib/utils'

interface RoleBadgeProps {
  role: UserRole
  className?: string
  showIcon?: boolean
}

export function RoleBadge({ role, className, showIcon = false }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role]

  return (
    <Badge
      variant={getRoleBadgeVariant(role)}
      className={cn(className)}
    >
      {showIcon && (
        <span className={cn('mr-1 h-2 w-2 rounded-full', config.color)} />
      )}
      {getRoleLabel(role)}
    </Badge>
  )
}
