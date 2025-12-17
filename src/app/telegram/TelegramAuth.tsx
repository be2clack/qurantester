'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') // Custom redirect path (e.g., /student/quran)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')

  const getInitData = useCallback((): { initData: string | null; isOfficial: boolean } => {
    if (typeof window === 'undefined') return { initData: null, isOfficial: false }

    const tg = window.Telegram?.WebApp
    if (!tg) return { initData: null, isOfficial: false }

    // Tell Telegram we're ready
    tg.ready()
    tg.expand()

    // Priority 1: Official initData (can be hash-validated)
    if (tg.initData && tg.initData.length > 0) {
      console.log('[TG Auth] Using official initData, length:', tg.initData.length)
      return { initData: tg.initData, isOfficial: true }
    }

    // Priority 2: Build from initDataUnsafe (cannot be hash-validated, JSON is re-serialized)
    if (tg.initDataUnsafe?.user) {
      console.log('[TG Auth] Building initData from initDataUnsafe (hash validation will be skipped)')
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
    try {
      setStatus('loading')
      setError(null)

      // First, check if already authenticated
      try {
        const meResponse = await fetch('/api/auth/me')
        if (meResponse.ok) {
          const user = await meResponse.json()
          if (user?.id) {
            // Already authenticated, redirect to custom path or dashboard
            if (redirectTo) {
              router.push(redirectTo)
            } else {
              const dashboardPath = user.role === 'ADMIN' ? '/admin'
                : user.role === 'USTAZ' ? '/ustaz'
                : user.role === 'PARENT' ? '/parent'
                : '/student'
              router.push(dashboardPath)
            }
            return
          }
        }
      } catch {
        // Not authenticated, continue with Telegram auth
      }

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
      const { initData, isOfficial } = getInitData()

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
          isOfficialInitData: isOfficial, // Tell server if hash validation should be attempted
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

        // Redirect after short delay - use custom redirect or default dashboard
        setTimeout(() => {
          router.push(redirectTo || data.redirectUrl || '/student')
        }, 1500)
      } else {
        throw new Error(data.error || 'Неизвестная ошибка')
      }
    } catch (err: any) {
      console.error('[Telegram Auth] Error:', err)
      setStatus('error')
      setError(err.message || 'Ошибка авторизации')
    }
  }, [getInitData, router, userName, redirectTo])

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
