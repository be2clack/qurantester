'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  BookOpen,
} from 'lucide-react'

const navItems = [
  { title: 'Главная', href: '/student', icon: LayoutDashboard },
  { title: 'Задания', href: '/student/tasks', icon: ClipboardList },
  { title: 'Коран', href: '/student/quran', icon: BookOpen },
  { title: 'Прогресс', href: '/student/progress', icon: BarChart3 },
]

export function StudentBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex items-center justify-around h-16 px-2 safe-area-inset-bottom">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/student' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-1 text-xs transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span className={cn('font-medium', isActive && 'text-primary')}>
                {item.title}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
