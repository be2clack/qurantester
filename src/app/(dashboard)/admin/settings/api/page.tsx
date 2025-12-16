'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Key,
  Save,
  Loader2,
  Check,
  X,
  Eye,
  EyeOff,
  Sparkles,
  Search,
  ExternalLink,
  Trash2,
} from 'lucide-react'

interface ApiKey {
  key: string
  status: 'configured' | 'not_configured'
  maskedValue?: string
}

interface ApiKeysData {
  QURANI_AI_QRC_KEY: ApiKey
  QURANI_AI_SEMANTIC_KEY: ApiKey
}

const API_KEY_INFO = {
  QURANI_AI_QRC_KEY: {
    name: 'QRC API Key',
    description: 'AI проверка чтения Корана (Quran Recitation Checking)',
    icon: Sparkles,
    color: 'bg-amber-100 text-amber-600',
    docsUrl: 'https://qurani.ai/en/docs/qrc',
  },
  QURANI_AI_SEMANTIC_KEY: {
    name: 'Semantic Search API Key',
    description: 'Семантический поиск по Корану',
    icon: Search,
    color: 'bg-blue-100 text-blue-600',
    docsUrl: 'https://qurani.ai/en/docs/semantic-search',
  },
}

export default function ApiSettingsPage() {
  const [keys, setKeys] = useState<ApiKeysData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Input states for each key
  const [qrcKeyInput, setQrcKeyInput] = useState('')
  const [semanticKeyInput, setSemanticKeyInput] = useState('')

  // Show/hide states
  const [showQrcKey, setShowQrcKey] = useState(false)
  const [showSemanticKey, setShowSemanticKey] = useState(false)

  useEffect(() => {
    fetchKeys()
  }, [])

  async function fetchKeys() {
    try {
      const res = await fetch('/api/settings/quran-api')
      if (res.ok) {
        const data = await res.json()
        setKeys(data)
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveKey(keyName: string, value: string) {
    if (!value.trim()) return

    setSaving(keyName)
    try {
      const res = await fetch('/api/settings/quran-api', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyName, value }),
      })

      if (res.ok) {
        await fetchKeys()
        // Clear input
        if (keyName === 'QURANI_AI_QRC_KEY') setQrcKeyInput('')
        if (keyName === 'QURANI_AI_SEMANTIC_KEY') setSemanticKeyInput('')
      }
    } catch (error) {
      console.error('Failed to save API key:', error)
    } finally {
      setSaving(null)
    }
  }

  async function handleDeleteKey(keyName: string) {
    if (!confirm('Удалить этот API ключ?')) return

    setDeleting(keyName)
    try {
      const res = await fetch(`/api/settings/quran-api?key=${keyName}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchKeys()
      }
    } catch (error) {
      console.error('Failed to delete API key:', error)
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Key className="h-6 w-6" />
            Настройки API
          </h1>
          <p className="text-muted-foreground">
            Управление ключами внешних API сервисов
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
              <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100">О Qurani.ai API</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Qurani.ai предоставляет AI-сервисы для работы с Кораном: проверка чтения,
                семантический поиск и многое другое. Для базовых функций Quran.com API ключ не требуется.
              </p>
              <a
                href="https://qurani.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
              >
                Получить API ключ
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <div className="grid gap-6">
        {Object.entries(API_KEY_INFO).map(([keyName, info]) => {
          const keyData = keys?.[keyName as keyof ApiKeysData]
          const isConfigured = keyData?.status === 'configured'
          const Icon = info.icon
          const inputValue = keyName === 'QURANI_AI_QRC_KEY' ? qrcKeyInput : semanticKeyInput
          const setInputValue = keyName === 'QURANI_AI_QRC_KEY' ? setQrcKeyInput : setSemanticKeyInput
          const showKey = keyName === 'QURANI_AI_QRC_KEY' ? showQrcKey : showSemanticKey
          const setShowKey = keyName === 'QURANI_AI_QRC_KEY' ? setShowQrcKey : setShowSemanticKey

          return (
            <Card key={keyName}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${info.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{info.name}</CardTitle>
                      <CardDescription>{info.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={isConfigured ? 'default' : 'secondary'} className="gap-1">
                    {isConfigured ? (
                      <>
                        <Check className="h-3 w-3" />
                        Настроен
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3" />
                        Не настроен
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isConfigured && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Текущий ключ</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {showKey ? keyData?.maskedValue : '••••••••••••••••'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteKey(keyName)}
                        disabled={deleting === keyName}
                      >
                        {deleting === keyName ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor={keyName}>
                    {isConfigured ? 'Обновить ключ' : 'Добавить ключ'}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={keyName}
                      type="password"
                      placeholder="sk-..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                    />
                    <Button
                      onClick={() => handleSaveKey(keyName, inputValue)}
                      disabled={!inputValue.trim() || saving === keyName}
                    >
                      {saving === keyName ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <a
                  href={info.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Документация
                  <ExternalLink className="h-3 w-3" />
                </a>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quran.com Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Quran.com API
          </CardTitle>
          <CardDescription>
            Основной API для получения текста Корана, переводов, тафсиров и аудио
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
              <Check className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                API ключ не требуется
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Базовые функции Quran.com API доступны без регистрации
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
