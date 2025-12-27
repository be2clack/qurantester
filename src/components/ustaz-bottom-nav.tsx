'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Users,
  FolderKanban,
  BookOpen,
  ClipboardCheck,
  BarChart3,
} from 'lucide-react'

const navItems = [
  { title: 'Группы', href: '/ustaz/groups', icon: FolderKanban },
  { title: 'Студенты', href: '/ustaz/students', icon: Users },
  { title: 'Коран', href: '/ustaz/quran', icon: BookOpen },
  { title: 'Проверка', href: '/ustaz/submissions', icon: ClipboardCheck },
  { title: 'Аналитика', href: '/ustaz/analytics', icon: BarChart3 },
]

export function UstazBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex items-center justify-around h-16 px-1 safe-area-inset-bottom">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/ustaz' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-[10px] transition-colors',
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
