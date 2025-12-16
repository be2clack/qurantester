'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'

// Telegram WebApp types
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string
        initDataUnsafe: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
          }
          auth_date?: number
          hash?: string
          query_id?: string
        }
        ready: () => void
        expand: () => void
        close: () => void
        MainButton: {
          text: string
          color: string
          textColor: string
          isVisible: boolean
          isActive: boolean
          show: () => void
          hide: () => void
          enable: () => void
          disable: () => void
          onClick: (callback: () => void) => void
          offClick: (callback: () => void) => void
        }
        themeParams: {
          bg_color?: string
          text_color?: string
          hint_color?: string
          link_color?: string
          button_color?: string
          button_text_color?: string
        }
        colorScheme: 'light' | 'dark'
      }
    }
  }
}

type AuthStatus = 'loading' | 'authenticating' | 'success' | 'error' | 'not_in_telegram'

export default function TelegramAuth() {
  const router = useRouter()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')

  const getInitData = useCallback((): string | null => {
    if (typeof window === 'undefined') return null

    const tg = window.Telegram?.WebApp
    if (!tg) return null

    // Tell Telegram we're ready
    tg.ready()
    tg.expand()

    // Priority 1: Official initData
    if (tg.initData && tg.initData.length > 0) {
      return tg.initData
    }

    // Priority 2: Build from initDataUnsafe (fallback)
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
      return params.toString()
    }

    return null
  }, [])

  const authenticate = useCallback(async () => {
    try {
      setStatus('loading')
      setError(null)

      // Wait for Telegram SDK to load
      let retries = 30 // 3 seconds
      while (retries > 0 && !window.Telegram?.WebApp) {
        await new Promise(resolve => setTimeout(resolve, 100))
        retries--
      }

      // Check if we're in Telegram
      if (!window.Telegram?.WebApp) {
        setStatus('not_in_telegram')
        return
      }

      // Get user name for display
      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user
      if (tgUser) {
        setUserName(tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : ''))
      }

      // Get initData
      const initData = getInitData()

      // Fallback: Try to auth with just userId
      const userId = tgUser?.id

      if (!initData && !userId) {
        setStatus('not_in_telegram')
        setError('Откройте приложение через Telegram бота')
        return
      }

      setStatus('authenticating')

      // Send to API
      const response = await fetch('/api/telegram/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          telegramId: !initData ? userId?.toString() : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка авторизации')
      }

      if (data.success) {
        setStatus('success')
        setUserName(data.user?.firstName || userName)

        // Redirect after short delay
        setTimeout(() => {
          router.push(data.redirectUrl || '/student')
        }, 1500)
      } else {
        throw new Error(data.error || 'Неизвестная ошибка')
      }
    } catch (err: any) {
      console.error('[Telegram Auth] Error:', err)
      setStatus('error')
      setError(err.message || 'Ошибка авторизации')
    }
  }, [getInitData, router, userName])

  useEffect(() => {
    // Small delay to let Telegram SDK initialize
    const timer = setTimeout(authenticate, 300)
    return () => clearTimeout(timer)
  }, [authenticate])

  // Render based on status
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
                Добро пожаловать, {userName}
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
              onClick={authenticate}
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
