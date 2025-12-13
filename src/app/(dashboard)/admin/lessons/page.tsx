'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, BookMarked, Languages, Info } from 'lucide-react'

const LESSON_TYPES = [
  {
    id: 'MEMORIZATION',
    name: 'Заучивание',
    prefix: 'ЗА',
    icon: BookOpen,
    description: 'Заучивание новых страниц Корана. Студент учит строки по одной, затем половину страницы, затем всю страницу.',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  },
  {
    id: 'REVISION',
    name: 'Повторение',
    prefix: 'ПО',
    icon: BookMarked,
    description: 'Повторение уже выученных страниц для закрепления. Студент повторяет страницы в заданном порядке.',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  {
    id: 'TRANSLATION',
    name: 'Перевод',
    prefix: 'ПЕ',
    icon: Languages,
    description: 'Изучение перевода и тафсира аятов. Студент изучает значения и контекст.',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
]

export default function LessonsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Типы уроков
        </h1>
        <p className="text-muted-foreground">
          Три типа уроков для обучения Корану
        </p>
      </div>

      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Как это работает</p>
              <p>Тип урока выбирается при создании группы и определяет формат обучения. Все настройки (количество повторений, дни на этапы, форматы сдачи) настраиваются в каждой группе отдельно.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {LESSON_TYPES.map((type) => {
          const Icon = type.icon
          return (
            <Card key={type.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${type.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{type.name}</CardTitle>
                    <Badge variant="outline" className="mt-1 font-mono">
                      {type.prefix}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {type.description}
                </CardDescription>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Название группы</CardTitle>
          <CardDescription>
            Название группы генерируется автоматически на основе типа урока
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-2xl font-mono font-bold tracking-wider">ЗА-25-1-1</p>
              <div className="mt-2 text-sm text-muted-foreground space-y-1">
                <p><strong>ЗА</strong> — тип урока (Заучивание)</p>
                <p><strong>25</strong> — год создания (2025)</p>
                <p><strong>1</strong> — уровень группы (1/2/3)</p>
                <p><strong>1</strong> — порядковый номер группы</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Примеры: ЗА-25-1-1, ПО-25-2-3, ПЕ-25-3-1
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
