'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
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
  BookOpenCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface SidebarProps {
  items: NavItem[]
  title: string
  subtitle?: string
}

export function Sidebar({ items, title, subtitle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-4 py-4">
        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <Separator />

      <div className="p-4">
        <form action="/api/auth/logout" method="GET">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            type="submit"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Выйти
          </Button>
        </form>
      </div>
    </div>
  )
}

// Admin navigation
export const adminNavItems: NavItem[] = [
  { title: 'Главная', href: '/admin', icon: LayoutDashboard },
  { title: 'Пользователи', href: '/admin/users', icon: Users },
  { title: 'Студенты', href: '/admin/students', icon: UserCheck },
  { title: 'Группы', href: '/admin/groups', icon: GraduationCap },
  { title: 'Уроки', href: '/admin/lessons', icon: BookOpen },
  { title: 'Коран', href: '/admin/quran', icon: BookOpenCheck },
  { title: 'Аналитика', href: '/admin/analytics', icon: BarChart3 },
  { title: 'Настройки', href: '/admin/settings', icon: Settings },
]

// Ustaz navigation
export const ustazNavItems: NavItem[] = [
  { title: 'Главная', href: '/ustaz', icon: LayoutDashboard },
  { title: 'Мои группы', href: '/ustaz/groups', icon: GraduationCap },
  { title: 'Студенты', href: '/ustaz/students', icon: Users },
  { title: 'Проверка работ', href: '/ustaz/submissions', icon: ClipboardList },
  { title: 'Аналитика', href: '/ustaz/analytics', icon: BarChart3 },
]

// Student navigation
export const studentNavItems: NavItem[] = [
  { title: 'Главная', href: '/student', icon: LayoutDashboard },
  { title: 'Мои задания', href: '/student/tasks', icon: ClipboardList },
  { title: 'Прогресс', href: '/student/progress', icon: BarChart3 },
  { title: 'Коран', href: '/student/quran', icon: BookOpen },
]

// Parent navigation
export const parentNavItems: NavItem[] = [
  { title: 'Главная', href: '/parent', icon: LayoutDashboard },
  { title: 'Дети', href: '/parent/children', icon: UserCheck },
]
