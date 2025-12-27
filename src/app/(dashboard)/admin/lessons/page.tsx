'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen,
  BookMarked,
  Languages,
  Info,
  Layers,
  GraduationCap,
  ListOrdered,
  Repeat,
  Target,
  CheckCircle2,
} from 'lucide-react'

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

const STAGES_INFO = [
  {
    stage: 'STAGE_1_1',
    name: 'Этап 1.1',
    shortName: '1.1',
    icon: ListOrdered,
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
    description: 'Изучение строк 1-7 по одной',
    details: 'Студент учит первую половину страницы (строки 1-7) поочередно. Количество строк за раз зависит от уровня группы (1/3/7).',
  },
  {
    stage: 'STAGE_1_2',
    name: 'Этап 1.2',
    shortName: '1.2',
    icon: Repeat,
    color: 'bg-indigo-500',
    borderColor: 'border-indigo-500',
    description: 'Соединение строк 1-7 вместе',
    details: 'После изучения всех строк первой половины, студент соединяет их вместе 80 раз. Все 80 должны быть сданы.',
  },
  {
    stage: 'STAGE_2_1',
    name: 'Этап 2.1',
    shortName: '2.1',
    icon: ListOrdered,
    color: 'bg-violet-500',
    borderColor: 'border-violet-500',
    description: 'Изучение строк 8-15 по одной',
    details: 'Студент учит вторую половину страницы (строки 8-15) поочередно по той же схеме.',
  },
  {
    stage: 'STAGE_2_2',
    name: 'Этап 2.2',
    shortName: '2.2',
    icon: Repeat,
    color: 'bg-purple-500',
    borderColor: 'border-purple-500',
    description: 'Соединение строк 8-15 вместе',
    details: 'Соединение второй половины страницы 80 раз. Все повторения должны быть приняты.',
  },
  {
    stage: 'STAGE_3',
    name: 'Этап 3',
    shortName: '3',
    icon: Target,
    color: 'bg-green-500',
    borderColor: 'border-green-500',
    description: 'Соединение всей страницы',
    details: 'Финальный этап - соединение всей страницы (1-15) целиком 80 раз перед переходом к следующей странице.',
  },
]

// Уровни - только для типа урока "Заучивание" (MEMORIZATION)
const LEVELS_INFO = [
  { level: 'LEVEL_1', name: 'Уровень 1', lines: '1 строка', description: 'Начальный - сдаёт по 1 строке за раз', color: 'bg-emerald-100 text-emerald-800' },
  { level: 'LEVEL_2', name: 'Уровень 2', lines: '3 строки', description: 'Средний - сдаёт по 3 строки за раз', color: 'bg-blue-100 text-blue-800' },
  { level: 'LEVEL_3', name: 'Уровень 3', lines: '7 строк', description: 'Продвинутый - сдаёт по 7 строк за раз', color: 'bg-purple-100 text-purple-800' },
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

      {/* Stages System */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Система 5 этапов
          </CardTitle>
          <CardDescription>
            Каждая страница Корана проходится через 5 последовательных этапов
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {STAGES_INFO.map((stage, index) => {
              const Icon = stage.icon
              return (
                <div
                  key={stage.stage}
                  className={`relative p-4 rounded-lg border-2 ${stage.borderColor} bg-gradient-to-b from-background to-muted/30`}
                >
                  <div className={`absolute -top-3 left-3 ${stage.color} text-white text-xs font-bold px-2 py-0.5 rounded`}>
                    {stage.shortName}
                  </div>
                  <div className="pt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded ${stage.color}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-semibold text-sm">{stage.name}</span>
                    </div>
                    <p className="text-sm font-medium mb-1">{stage.description}</p>
                    <p className="text-xs text-muted-foreground">{stage.details}</p>
                  </div>
                  {index < STAGES_INFO.length - 1 && (
                    <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10">
                      →
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Levels Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Уровни групп
            <Badge variant="outline" className="ml-2">Только для Заучивания</Badge>
          </CardTitle>
          <CardDescription>
            Уровень определяет количество строк, которые студент сдаёт за один раз
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {LEVELS_INFO.map((level) => (
              <div key={level.level} className={`p-4 rounded-lg border-2 ${level.color}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-3xl font-bold">
                    {level.lines.split(' ')[0]}
                  </div>
                  <div>
                    <p className="font-bold">{level.name}</p>
                    <p className="text-sm">{level.lines} за раз</p>
                  </div>
                </div>
                <p className="text-sm opacity-80">{level.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>Правило сдачи:</strong> Студент должен сдать ВСЕ 80 соединений.
                Если есть ошибки, создается задание на пересдачу только неправильных ответов.
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Group naming convention */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Название группы</CardTitle>
          <CardDescription>
            Название группы генерируется автоматически на основе типа урока
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">Для Заучивания</p>
              <p className="text-2xl font-mono font-bold tracking-wider">ЗА-25-1-1</p>
              <div className="mt-2 text-sm text-muted-foreground space-y-1">
                <p><strong>ЗА</strong> — тип урока (Заучивание)</p>
                <p><strong>25</strong> — год создания (2025)</p>
                <p><strong>1</strong> — уровень группы (1/2/3)</p>
                <p><strong>1</strong> — порядковый номер группы</p>
              </div>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Для Повторения/Перевода</p>
              <p className="text-2xl font-mono font-bold tracking-wider">ПО-25-1</p>
              <div className="mt-2 text-sm text-muted-foreground space-y-1">
                <p><strong>ПО</strong> — тип урока (Повторение)</p>
                <p><strong>25</strong> — год создания (2025)</p>
                <p><strong>1</strong> — порядковый номер группы</p>
                <p className="text-xs text-muted-foreground/70 italic">Уровень не указывается — нет поэтапного изучения</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
