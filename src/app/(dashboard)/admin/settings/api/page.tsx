'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Bot,
} from 'lucide-react'

interface ApiKey {
  key: string
  status: 'configured' | 'not_configured'
  maskedValue?: string
}

interface ApiKeysData {
  QURANI_AI_QRC_KEY: ApiKey
  QURANI_AI_SEMANTIC_KEY: ApiKey
  OPENAI_API_KEY: ApiKey
  OPENAI_MODEL: ApiKey
}

const OPENAI_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Быстрый и недорогой' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Продвинутый мультимодальный' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Быстрый GPT-4' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Экономичный' },
]

export default function ApiSettingsPage() {
  const [keys, setKeys] = useState<ApiKeysData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Input states
  const [qrcKeyInput, setQrcKeyInput] = useState('')
  const [semanticKeyInput, setSemanticKeyInput] = useState('')
  const [openaiKeyInput, setOpenaiKeyInput] = useState('')
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini')

  // Show/hide states
  const [showQrcKey, setShowQrcKey] = useState(false)
  const [showSemanticKey, setShowSemanticKey] = useState(false)
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)

  useEffect(() => {
    fetchKeys()
  }, [])

  async function fetchKeys() {
    try {
      const res = await fetch('/api/settings/quran-api')
      if (res.ok) {
        const data = await res.json()
        setKeys(data)
        // Set current model if configured
        if (data.OPENAI_MODEL?.maskedValue) {
          setOpenaiModel(data.OPENAI_MODEL.maskedValue)
        }
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
        if (keyName === 'OPENAI_API_KEY') setOpenaiKeyInput('')
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

  const openaiConfigured = keys?.OPENAI_API_KEY?.status === 'configured'

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

      {/* OpenAI Section */}
      <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">OpenAI API</CardTitle>
                <CardDescription>
                  Перевод муфрадата (пословный перевод) с помощью ChatGPT
                </CardDescription>
              </div>
            </div>
            <Badge variant={openaiConfigured ? 'default' : 'secondary'} className="gap-1">
              {openaiConfigured ? (
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
          {/* Current key display */}
          {openaiConfigured && (
            <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-black/20 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Текущий ключ</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {showOpenaiKey ? keys?.OPENAI_API_KEY?.maskedValue : '••••••••••••••••'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                >
                  {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteKey('OPENAI_API_KEY')}
                  disabled={deleting === 'OPENAI_API_KEY'}
                >
                  {deleting === 'OPENAI_API_KEY' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* API Key input */}
          <div className="space-y-2">
            <Label htmlFor="openai-key">
              {openaiConfigured ? 'Обновить API ключ' : 'API ключ'}
            </Label>
            <div className="flex gap-2">
              <Input
                id="openai-key"
                type="password"
                placeholder="sk-..."
                value={openaiKeyInput}
                onChange={(e) => setOpenaiKeyInput(e.target.value)}
              />
              <Button
                onClick={() => handleSaveKey('OPENAI_API_KEY', openaiKeyInput)}
                disabled={!openaiKeyInput.trim() || saving === 'OPENAI_API_KEY'}
              >
                {saving === 'OPENAI_API_KEY' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Model selection */}
          <div className="space-y-2">
            <Label>Модель</Label>
            <div className="flex gap-2">
              <Select value={openaiModel} onValueChange={setOpenaiModel}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPENAI_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span>{model.name}</span>
                        <span className="text-xs text-muted-foreground">{model.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => handleSaveKey('OPENAI_MODEL', openaiModel)}
                disabled={saving === 'OPENAI_MODEL'}
                variant="outline"
              >
                {saving === 'OPENAI_MODEL' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
            {keys?.OPENAI_MODEL?.status === 'configured' && (
              <p className="text-xs text-muted-foreground">
                Текущая модель: <span className="font-mono">{keys.OPENAI_MODEL.maskedValue}</span>
              </p>
            )}
          </div>

          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline"
          >
            Получить API ключ на OpenAI
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>

      {/* Qurani.ai Info Card */}
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
                семантический поиск и многое другое.
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

      {/* Qurani.ai Keys */}
      <div className="grid gap-6">
        {/* QRC Key */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">QRC API Key</CardTitle>
                  <CardDescription>AI проверка чтения Корана</CardDescription>
                </div>
              </div>
              <Badge variant={keys?.QURANI_AI_QRC_KEY?.status === 'configured' ? 'default' : 'secondary'} className="gap-1">
                {keys?.QURANI_AI_QRC_KEY?.status === 'configured' ? (
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
            {keys?.QURANI_AI_QRC_KEY?.status === 'configured' && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Текущий ключ</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {showQrcKey ? keys?.QURANI_AI_QRC_KEY?.maskedValue : '••••••••••••••••'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setShowQrcKey(!showQrcKey)}>
                    {showQrcKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteKey('QURANI_AI_QRC_KEY')}
                    disabled={deleting === 'QURANI_AI_QRC_KEY'}
                  >
                    {deleting === 'QURANI_AI_QRC_KEY' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="qrc-key">
                {keys?.QURANI_AI_QRC_KEY?.status === 'configured' ? 'Обновить ключ' : 'Добавить ключ'}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="qrc-key"
                  type="password"
                  placeholder="sk-..."
                  value={qrcKeyInput}
                  onChange={(e) => setQrcKeyInput(e.target.value)}
                />
                <Button
                  onClick={() => handleSaveKey('QURANI_AI_QRC_KEY', qrcKeyInput)}
                  disabled={!qrcKeyInput.trim() || saving === 'QURANI_AI_QRC_KEY'}
                >
                  {saving === 'QURANI_AI_QRC_KEY' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <a
              href="https://qurani.ai/en/docs/qrc"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Документация
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {/* Semantic Search Key */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Semantic Search API Key</CardTitle>
                  <CardDescription>Семантический поиск по Корану</CardDescription>
                </div>
              </div>
              <Badge variant={keys?.QURANI_AI_SEMANTIC_KEY?.status === 'configured' ? 'default' : 'secondary'} className="gap-1">
                {keys?.QURANI_AI_SEMANTIC_KEY?.status === 'configured' ? (
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
            {keys?.QURANI_AI_SEMANTIC_KEY?.status === 'configured' && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Текущий ключ</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {showSemanticKey ? keys?.QURANI_AI_SEMANTIC_KEY?.maskedValue : '••••••••••••••••'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setShowSemanticKey(!showSemanticKey)}>
                    {showSemanticKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteKey('QURANI_AI_SEMANTIC_KEY')}
                    disabled={deleting === 'QURANI_AI_SEMANTIC_KEY'}
                  >
                    {deleting === 'QURANI_AI_SEMANTIC_KEY' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="semantic-key">
                {keys?.QURANI_AI_SEMANTIC_KEY?.status === 'configured' ? 'Обновить ключ' : 'Добавить ключ'}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="semantic-key"
                  type="password"
                  placeholder="sk-..."
                  value={semanticKeyInput}
                  onChange={(e) => setSemanticKeyInput(e.target.value)}
                />
                <Button
                  onClick={() => handleSaveKey('QURANI_AI_SEMANTIC_KEY', semanticKeyInput)}
                  disabled={!semanticKeyInput.trim() || saving === 'QURANI_AI_SEMANTIC_KEY'}
                >
                  {saving === 'QURANI_AI_SEMANTIC_KEY' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <a
              href="https://qurani.ai/en/docs/semantic-search"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Документация
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
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
