'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'

// Telegram WebApp types are declared globally in src/types/telegram.d.ts

type AuthStatus = 'loading' | 'authenticating' | 'success' | 'error' | 'not_in_telegram'

export default function TelegramAuth() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const authAttemptedRef = useRef(false)
  const redirectingRef = useRef(false)

  const getInitData = useCallback((): { initData: string | null; isOfficial: boolean } => {
    if (typeof window === 'undefined') return { initData: null, isOfficial: false }

    const tg = window.Telegram?.WebApp
    if (!tg) return { initData: null, isOfficial: false }

    tg.ready()
    tg.expand()
    // Request fullscreen mode for better UX
    if (tg.requestFullscreen) {
      try {
        tg.requestFullscreen()
      } catch (e) {
        // Fullscreen may not be supported in older clients
      }
    }

    if (tg.initData && tg.initData.length > 0) {
      return { initData: tg.initData, isOfficial: true }
    }

    if (tg.initDataUnsafe?.user) {
      const params = new URLSearchParams()
      params.append('user', JSON.stringify(tg.initDataUnsafe.user))
      if (tg.initDataUnsafe.query_id) {
        params.append('query_id', tg.initDataUnsafe.query_id.toString())
      }
      if (tg.initDataUnsafe.auth_date) {
        params.append('auth_date', tg.initDataUnsafe.auth_date.toString())
      }
      if (tg.initDataUnsafe.hash) {
        params.append('hash', tg.initDataUnsafe.hash)
      }
      return { initData: params.toString(), isOfficial: false }
    }

    return { initData: null, isOfficial: false }
  }, [])

  const authenticate = useCallback(async () => {
    // Prevent multiple auth attempts
    if (authAttemptedRef.current || redirectingRef.current) return
    authAttemptedRef.current = true

    try {
      setStatus('loading')
      setError(null)

      // Check if already authenticated
      try {
        const meResponse = await fetch('/api/auth/me')
        if (meResponse.ok) {
          const user = await meResponse.json()
          if (user?.id) {
            redirectingRef.current = true
            setStatus('success')
            setUserName(user.firstName || '')
            const dashboardPath = user.role === 'ADMIN' ? '/admin'
              : user.role === 'USTAZ' ? '/ustaz'
              : user.role === 'PARENT' ? '/parent'
              : '/student'
            // Use window.location for full page reload
            setTimeout(() => {
              window.location.href = redirectTo || dashboardPath
            }, 500)
            return
          }
        }
      } catch {
        // Not authenticated, continue
      }

      // Wait for Telegram SDK
      let retries = 30
      while (retries > 0 && !window.Telegram?.WebApp) {
        await new Promise(resolve => setTimeout(resolve, 100))
        retries--
      }

      if (!window.Telegram?.WebApp) {
        setStatus('not_in_telegram')
        return
      }

      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user
      if (tgUser) {
        setUserName(tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : ''))
      }

      const { initData, isOfficial } = getInitData()
      const userId = tgUser?.id

      if (!initData && !userId) {
        setStatus('not_in_telegram')
        setError('Откройте приложение через Telegram бота')
        return
      }

      setStatus('authenticating')

      const response = await fetch('/api/telegram/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          isOfficialInitData: isOfficial,
          telegramId: !initData ? userId?.toString() : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка авторизации')
      }

      if (data.success) {
        setStatus('success')
        if (data.user?.firstName) {
          setUserName(data.user.firstName)
        }

        // Use window.location for full page reload to ensure cookie is applied
        redirectingRef.current = true
        setTimeout(() => {
          window.location.href = redirectTo || data.redirectUrl || '/student'
        }, 1000)
      } else {
        throw new Error(data.error || 'Неизвестная ошибка')
      }
    } catch (err: unknown) {
      console.error('[Telegram Auth] Error:', err)
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Ошибка авторизации')
      authAttemptedRef.current = false // Allow retry
    }
  }, [getInitData, redirectTo])

  const handleRetry = useCallback(() => {
    authAttemptedRef.current = false
    redirectingRef.current = false
    authenticate()
  }, [authenticate])

  useEffect(() => {
    const timer = setTimeout(authenticate, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-[350px]">
          <CardContent className="pt-6">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-lg font-medium">Загрузка...</p>
              <p className="text-sm text-muted-foreground mt-2">
                Подключение к Telegram
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'authenticating') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-[350px]">
          <CardContent className="pt-6">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-lg font-medium">Авторизация...</p>
              {userName && (
                <p className="text-sm text-muted-foreground mt-2">
                  Привет, {userName}!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-[350px]">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">Успешно!</p>
              <p className="text-sm text-muted-foreground mt-2">
                Добро пожаловать{userName ? `, ${userName}` : ''}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Перенаправляем...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'not_in_telegram') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              Telegram Web App
            </CardTitle>
            <CardDescription>
              Эта страница предназначена для открытия через Telegram
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Чтобы войти в веб-приложение:
            </p>
            <ol className="text-sm space-y-2 mb-4 list-decimal list-inside">
              <li>Откройте нашего бота в Telegram</li>
              <li>Нажмите кнопку «🌐 Веб» в меню</li>
              <li>Приложение откроется автоматически</li>
            </ol>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open('https://t.me/QuranTesterBot', '_blank')}
            >
              Открыть бота в Telegram
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Ошибка авторизации
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {error || 'Произошла ошибка при авторизации'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleRetry}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Повторить
            </Button>
            <Button
              variant="default"
              className="flex-1"
              onClick={() => {
                if (window.Telegram?.WebApp) {
                  window.Telegram.WebApp.close()
                } else {
                  window.close()
                }
              }}
            >
              Закрыть
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
