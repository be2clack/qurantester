# QuranTester

Система для изучения и заучивания Корана с поддержкой Telegram-бота и веб-панели управления.

## Возможности

### Типы уроков
- **Заучивание (Memorization)** - заучивание наизусть с поэтапной проверкой
- **Повторение (Revision)** - повторение выученных страниц
- **Перевод (Translation)** - изучение перевода слов (муфрадат)

### Роли пользователей
- **Админ** - полный контроль системы
- **Устаз** - преподаватель, проверяет задания студентов
- **Студент** - изучает Коран, сдает задания
- **Родитель** - просматривает прогресс своих детей

### Telegram-бот
- Регистрация с выбором пола, роли, группы и начального прогресса
- Сдача заданий голосовыми сообщениями и видео-кружочками
- Игра "Муфрадат" для изучения слов
- Повторение страниц с отметками
- Уведомления о проверке заданий

### Веб-панель
- Админ-панель для управления группами, студентами, устазами
- Просмотр и прослушивание Мусхафа
- AI-верификация заданий (OpenAI)
- Аналитика и статистика

## Технологии

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (Prisma Accelerate)
- **Bot**: Grammy (Telegram Bot Framework)
- **AI**: OpenAI API (Whisper для транскрипции, GPT для верификации)
- **Deploy**: Vercel

## Установка

### Требования
- Node.js 18+
- PostgreSQL (или Prisma Accelerate)

### Шаги

1. Клонировать репозиторий:
```bash
git clone https://github.com/YOUR_USERNAME/qurantester.git
cd qurantester
```

2. Установить зависимости:
```bash
npm install
```

3. Создать `.env` файл:
```env
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Telegram Bot
TELEGRAM_BOT_TOKEN="your_bot_token"
TELEGRAM_BOT_USERNAME="YourBotUsername"

# OpenAI
OPENAI_API_KEY="sk-..."

# App
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NEXTAUTH_SECRET="your_secret"
```

4. Применить миграции базы данных:
```bash
npm run db:push
```

5. Запустить сервер разработки:
```bash
npm run dev
```

6. Настроить Telegram Webhook:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/api/telegram/webhook"
```

## Структура проекта

```
src/
├── app/                          # Next.js App Router
│   ├── (dashboard)/              # Панели управления
│   │   ├── admin/                # Админ-панель
│   │   ├── ustaz/                # Панель устаза
│   │   ├── student/              # Панель студента
│   │   └── parent/               # Панель родителя
│   ├── api/                      # API эндпоинты
│   │   ├── admin/                # Админские API
│   │   ├── groups/               # Управление группами
│   │   ├── lessons/              # Уроки
│   │   ├── submissions/          # Сдачи заданий
│   │   ├── tasks/                # Задания
│   │   ├── telegram/             # Telegram webhook
│   │   └── users/                # Пользователи
│   ├── login/                    # Страница входа
│   └── telegram/                 # Telegram Mini App
├── components/                   # React компоненты
│   ├── ui/                       # shadcn/ui компоненты
│   └── ...                       # Кастомные компоненты
├── lib/                          # Библиотеки и утилиты
│   ├── telegram/                 # Telegram бот
│   │   ├── bot.ts                # Инициализация бота
│   │   ├── handlers/             # Обработчики сообщений
│   │   ├── keyboards/            # Клавиатуры
│   │   └── utils/                # Утилиты
│   ├── auth.ts                   # Авторизация
│   ├── prisma.ts                 # Prisma клиент
│   ├── openai.ts                 # OpenAI интеграция
│   └── quran-api.ts              # API для Корана
└── prisma/
    └── schema.prisma             # Схема базы данных
```

## Модели данных

### User
Пользователь системы (админ, устаз, студент, родитель)

### Group
Группа с настройками урока (тип, уровень, параметры)

### StudentGroup
Связь студента с группой + прогресс (страница, строка, этап)

### Task
Задание для студента (заучивание строк)

### Submission
Сданное задание (голос/видео + транскрипция + оценка)

### MufradatWord
Слова для изучения (арабский, перевод, контекст)

## API эндпоинты

### Группы
- `GET /api/groups` - список групп
- `POST /api/groups` - создать группу
- `GET /api/groups/[id]` - детали группы
- `PATCH /api/groups/[id]` - обновить группу
- `POST /api/groups/[id]/students` - добавить студента

### Пользователи
- `GET /api/users` - список пользователей
- `PATCH /api/users/[id]` - обновить пользователя

### Задания
- `GET /api/tasks` - активные задания
- `POST /api/submissions` - сдать задание
- `PATCH /api/submissions/[id]/review` - проверить задание

## Этапы заучивания

1. **1.1** - Чтение с листа
2. **1.2** - Проверка чтения
3. **2.1** - Заучивание наизусть
4. **2.2** - Проверка заучивания
5. **3** - Закрепление

После успешного прохождения всех этапов для строки/группы строк, студент переходит к следующему заданию.

## Скрипты

```bash
npm run dev          # Запуск dev-сервера
npm run build        # Сборка для продакшена
npm run start        # Запуск продакшен сервера
npm run db:push      # Применить изменения схемы
npm run db:studio    # Открыть Prisma Studio
npm run db:seed      # Заполнить тестовыми данными
```

## Деплой

Проект готов к деплою на Vercel:

1. Подключить репозиторий к Vercel
2. Добавить переменные окружения
3. Настроить Telegram Webhook на домен Vercel

## Лицензия

MIT
