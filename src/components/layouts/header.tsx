'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { LogOut, User as UserIcon } from 'lucide-react'
import { getRoleLabel, getRoleBadgeVariant } from '@/lib/constants/roles'
import type { UserRole } from '@prisma/client'

interface HeaderProps {
  user: {
    firstName?: string | null
    lastName?: string | null
    phone: string
    role: UserRole
    currentPage?: number
    currentLine?: number
  }
  title: string
}

export function Header({ user, title }: HeaderProps) {
  const initials = getInitials(user.firstName, user.lastName)
  const displayName = user.firstName || user.phone

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>

        <div className="flex items-center gap-4">
          {user.role === 'STUDENT' && user.currentPage && user.currentLine && (
            <Badge variant="outline" className="hidden sm:flex">
              {user.currentPage}-{user.currentLine}
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.phone}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <Badge variant={getRoleBadgeVariant(user.role)} className="mr-2">
                  {getRoleLabel(user.role)}
                </Badge>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/api/auth/logout" className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Выйти</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.charAt(0)?.toUpperCase() || ''
  const last = lastName?.charAt(0)?.toUpperCase() || ''
  return first + last || 'U'
}
