'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  BookOpen,
  LayoutDashboard,
  Settings,
  BarChart3,
  GraduationCap,
  ClipboardList,
  UserCheck,
  LogOut,
  BookOpenCheck,
  ChevronUp,
  User2,
  Clock,
  FolderKanban,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { UserRole } from '@prisma/client'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface AppSidebarProps {
  role: UserRole
  user?: {
    firstName?: string | null
    lastName?: string | null
    phone: string
  }
}

const navItemsByRole: Record<UserRole, NavItem[]> = {
  ADMIN: [
    { title: 'Главная', href: '/admin', icon: LayoutDashboard },
    { title: 'Аналитика', href: '/admin/analytics', icon: BarChart3 },
    { title: 'Группы', href: '/admin/groups', icon: FolderKanban },
    { title: 'Студенты', href: '/admin/students', icon: GraduationCap },
    { title: 'Коран', href: '/admin/quran', icon: BookOpenCheck },
    { title: 'Уроки', href: '/admin/lessons', icon: BookOpen },
    { title: 'Пользователи', href: '/admin/users', icon: Users },
    { title: 'Настройки', href: '/admin/settings', icon: Settings },
    { title: 'Cron задачи', href: '/admin/cron', icon: Clock },
  ],
  USTAZ: [
    { title: 'Главная', href: '/ustaz', icon: LayoutDashboard },
    { title: 'Мои группы', href: '/ustaz/groups', icon: GraduationCap },
    { title: 'Студенты', href: '/ustaz/students', icon: Users },
    { title: 'Проверка работ', href: '/ustaz/submissions', icon: ClipboardList },
    { title: 'Аналитика', href: '/ustaz/analytics', icon: BarChart3 },
  ],
  STUDENT: [
    { title: 'Главная', href: '/student', icon: LayoutDashboard },
    { title: 'Мои задания', href: '/student/tasks', icon: ClipboardList },
    { title: 'Прогресс', href: '/student/progress', icon: BarChart3 },
    { title: 'Коран', href: '/student/quran', icon: BookOpen },
  ],
  PARENT: [
    { title: 'Главная', href: '/parent', icon: LayoutDashboard },
    { title: 'Дети', href: '/parent/children', icon: UserCheck },
  ],
  PENDING: [],
}

const titlesByRole: Record<UserRole, { title: string; subtitle: string }> = {
  ADMIN: { title: 'QuranTester', subtitle: 'Администратор' },
  USTAZ: { title: 'QuranTester', subtitle: 'Устаз' },
  STUDENT: { title: 'QuranTester', subtitle: 'Студент' },
  PARENT: { title: 'QuranTester', subtitle: 'Родитель' },
  PENDING: { title: 'QuranTester', subtitle: 'Ожидание' },
}

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.charAt(0)?.toUpperCase() || ''
  const last = lastName?.charAt(0)?.toUpperCase() || ''
  return first + last || 'U'
}

export function AppSidebar({ role, user }: AppSidebarProps) {
  const pathname = usePathname()
  const items = navItemsByRole[role]
  const { title, subtitle } = titlesByRole[role]

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={`/${role.toLowerCase()}`}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <BookOpenCheck className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{title}</span>
                  <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Навигация</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href) && item.href !== `/${role.toLowerCase()}`)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10">
                      {user ? getInitials(user.firstName, user.lastName) : <User2 className="size-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user?.firstName || user?.lastName
                        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                        : 'Пользователь'}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.phone || ''}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="top"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <a href="/api/auth/logout" className="cursor-pointer">
                    <LogOut className="mr-2 size-4" />
                    Выйти
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
