'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BarChart3,
  FolderKanban,
  GraduationCap,
  BookOpenCheck,
  BookOpen,
  Users,
  Settings,
  Clock,
} from 'lucide-react'

const navItems = [
  { title: 'Главная', href: '/admin', icon: LayoutDashboard },
  { title: 'Аналитика', href: '/admin/analytics', icon: BarChart3 },
  { title: 'Группы', href: '/admin/groups', icon: FolderKanban },
  { title: 'Студенты', href: '/admin/students', icon: GraduationCap },
  { title: 'Коран', href: '/admin/quran', icon: BookOpenCheck },
  { title: 'Уроки', href: '/admin/lessons', icon: BookOpen },
  { title: 'Пользователи', href: '/admin/users', icon: Users },
  { title: 'Настройки', href: '/admin/settings', icon: Settings },
  { title: 'Cron', href: '/admin/cron', icon: Clock },
]

export function AdminBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex items-center h-16 px-2 overflow-x-auto scrollbar-hide safe-area-inset-bottom">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center min-w-[64px] h-full gap-0.5 px-2 text-[10px] transition-colors shrink-0',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span className={cn('font-medium whitespace-nowrap', isActive && 'text-primary')}>
                {item.title}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
