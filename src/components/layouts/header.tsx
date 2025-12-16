'use client'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { BookOpen } from 'lucide-react'

interface HeaderProps {
  title: string
  progress?: {
    currentPage: number
    currentLine: number
    stageName: string
  }
}

export function Header({ title, progress }: HeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-base font-medium">{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Показываем прогресс если передан */}
      {progress && (
        <>
          <div className="ml-auto flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-emerald-600" />
            <span className="text-sm">
              Стр. <strong className="text-emerald-600">{progress.currentPage}</strong>
            </span>
            <span className="text-muted-foreground">:</span>
            <span className="text-sm">
              Строка <strong className="text-emerald-600">{progress.currentLine}</strong>
            </span>
            <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-xs">
              {progress.stageName}
            </Badge>
          </div>
        </>
      )}
    </header>
  )
}
