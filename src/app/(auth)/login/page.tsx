'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, AlertCircle, BookOpen, Loader2, KeyRound } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const errorMessages: Record<string, string> = {
  missing_token: 'Ссылка для входа недействительна',
  invalid_token: 'Ссылка для входа истекла или недействительна',
  expired: 'Сессия истекла. Получите новую ссылку в боте.',
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка авторизации')
      }

      router.push(data.redirectUrl || '/admin')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка авторизации'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Система изучения Корана</CardTitle>
          <CardDescription>
            Выберите способ входа в систему
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {(urlError || error) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error || (urlError && errorMessages[urlError]) || 'Произошла ошибка при входе'}
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="telegram" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="telegram">
                <MessageSquare className="h-4 w-4 mr-2" />
                Telegram
              </TabsTrigger>
              <TabsTrigger value="password">
                <KeyRound className="h-4 w-4 mr-2" />
                Пароль
              </TabsTrigger>
            </TabsList>

            <TabsContent value="telegram" className="space-y-4 mt-4">
              <div className="text-sm text-muted-foreground space-y-3">
                <p className="font-medium text-foreground">Для входа через Telegram:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Откройте Telegram бота @QuranTesterBot</li>
                  <li>Нажмите кнопку «🌐 Веб»</li>
                  <li>Авторизация произойдёт автоматически</li>
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
            </TabsContent>

            <TabsContent value="password" className="mt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Номер телефона</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+7 777 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Введите пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Вход...
                    </>
                  ) : (
                    'Войти'
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Только для администраторов и устазов.
                  <br />
                  Пароль устанавливается через команду <code className="bg-muted px-1 rounded">/setpassword</code> в боте.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
