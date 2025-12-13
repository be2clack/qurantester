import Link from 'next/link'
import { MessageSquare, AlertCircle, BookOpen } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

const errorMessages: Record<string, string> = {
  missing_token: 'Ссылка для входа недействительна',
  invalid_token: 'Ссылка для входа истекла или недействительна',
  expired: 'Сессия истекла. Получите новую ссылку в боте.',
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const error = params?.error

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Система изучения Корана</CardTitle>
          <CardDescription>
            Войдите через Telegram бота для доступа к системе
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {errorMessages[error] || 'Произошла ошибка при входе'}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-3">
              <p className="font-medium text-foreground">Для входа в систему:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Откройте Telegram бота @QuranTesterBot</li>
                <li>Нажмите кнопку &quot;Войти в веб&quot;</li>
                <li>Перейдите по полученной ссылке</li>
              </ol>
            </div>

            <Button asChild className="w-full" size="lg">
              <Link
                href="https://t.me/QuranTesterBot"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageSquare className="mr-2 h-5 w-5" />
                Открыть Telegram бота
              </Link>
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Если у вас нет доступа, обратитесь к администратору
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
