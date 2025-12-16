'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BookOpen,
  Check,
  X,
  Loader2,
  Trophy,
  RefreshCw,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import confetti from 'canvas-confetti'

interface GameWord {
  id: string
  wordKey: string
  surahNumber: number
  ayahNumber: number
  textArabic: string
  translationEn: string | null
  correctAnswer: string
  options: string[]
}

interface GameResult {
  wordId: string
  wordKey: string
  correct: boolean
  selectedAnswer: string
  correctAnswer: string
}

export default function MufradatGamePage() {
  const searchParams = useSearchParams()
  const taskId = searchParams.get('taskId')
  const surah = searchParams.get('surah') || '1'

  const [loading, setLoading] = useState(true)
  const [words, setWords] = useState<GameWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [results, setResults] = useState<GameResult[]>([])
  const [gameFinished, setGameFinished] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [finalScore, setFinalScore] = useState<{
    score: number
    correctCount: number
    totalCount: number
    passed: boolean
    message: string
  } | null>(null)

  // Fetch words for the game
  const fetchWords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('surah', surah)
      params.set('count', '10')

      const res = await fetch(`/api/student/mufradat/words?${params}`)
      if (res.ok) {
        const data = await res.json()
        setWords(data.words || [])
      }
    } catch (error) {
      console.error('Error fetching words:', error)
    } finally {
      setLoading(false)
    }
  }, [surah])

  useEffect(() => {
    fetchWords()
  }, [fetchWords])

  const currentWord = words[currentIndex]
  const progress = words.length > 0 ? ((currentIndex + 1) / words.length) * 100 : 0
  const correctCount = results.filter((r) => r.correct).length

  // Handle option selection
  const handleSelectOption = (option: string) => {
    if (confirmed) return
    setSelectedOption(option)
  }

  // Confirm answer
  const handleConfirm = () => {
    if (!selectedOption || !currentWord) return

    const isCorrect = selectedOption === currentWord.correctAnswer

    // Add result
    const result: GameResult = {
      wordId: currentWord.id,
      wordKey: currentWord.wordKey,
      correct: isCorrect,
      selectedAnswer: selectedOption,
      correctAnswer: currentWord.correctAnswer,
    }
    setResults([...results, result])
    setConfirmed(true)

    // Confetti on correct answer
    if (isCorrect) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      })
    }
  }

  // Move to next word
  const handleNext = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setSelectedOption(null)
      setConfirmed(false)
    } else {
      // Game finished
      setGameFinished(true)
      submitResults()
    }
  }

  // Skip current word (counts as wrong)
  const handleSkip = () => {
    if (!currentWord) return

    const result: GameResult = {
      wordId: currentWord.id,
      wordKey: currentWord.wordKey,
      correct: false,
      selectedAnswer: '',
      correctAnswer: currentWord.correctAnswer,
    }
    setResults([...results, result])
    handleNext()
  }

  // Submit results to server
  const submitResults = async () => {
    setSubmitting(true)
    try {
      const finalResults = [...results]
      if (currentWord && !confirmed) {
        // Add last word if not confirmed
        finalResults.push({
          wordId: currentWord.id,
          wordKey: currentWord.wordKey,
          correct: false,
          selectedAnswer: '',
          correctAnswer: currentWord.correctAnswer,
        })
      }

      const res = await fetch('/api/student/mufradat/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          results: finalResults,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setFinalScore(data)

        // Big confetti if passed
        if (data.passed) {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.5 },
          })
        }
      }
    } catch (error) {
      console.error('Error submitting results:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Restart game
  const handleRestart = () => {
    setCurrentIndex(0)
    setSelectedOption(null)
    setConfirmed(false)
    setResults([])
    setGameFinished(false)
    setFinalScore(null)
    fetchWords()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Муфрадат - Угадай слово
          </h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 space-y-4">
              <p className="text-muted-foreground">
                Нет слов для игры. Попросите устаза импортировать слова.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Game finished screen
  if (gameFinished) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Результат игры
          </h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-6">
              {submitting ? (
                <div className="py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">Сохраняем результат...</p>
                </div>
              ) : finalScore ? (
                <>
                  <div
                    className={`text-6xl font-bold ${
                      finalScore.passed ? 'text-green-500' : 'text-orange-500'
                    }`}
                  >
                    {finalScore.score}%
                  </div>
                  <p className="text-xl">
                    {finalScore.correctCount} из {finalScore.totalCount} правильно
                  </p>
                  <Badge
                    variant={finalScore.passed ? 'default' : 'secondary'}
                    className="text-lg px-4 py-2"
                  >
                    {finalScore.passed ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Сдано!
                      </>
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Не сдано
                      </>
                    )}
                  </Badge>
                  <p className="text-muted-foreground">{finalScore.message}</p>
                  <Button onClick={handleRestart} size="lg" className="mt-4">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Играть снова
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">Ошибка при сохранении результата</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results breakdown */}
        {finalScore && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Детали</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      result.correct
                        ? 'bg-green-50 dark:bg-green-950/30'
                        : 'bg-red-50 dark:bg-red-950/30'
                    }`}
                  >
                    <span className="font-medium">
                      {result.correct ? (
                        <Check className="h-4 w-4 inline mr-2 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 inline mr-2 text-red-600" />
                      )}
                      {result.correctAnswer}
                    </span>
                    {!result.correct && result.selectedAnswer && (
                      <span className="text-sm text-muted-foreground">
                        Ваш ответ: {result.selectedAnswer}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Game screen
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" />
            Муфрадат - Угадай слово
          </h1>
          <p className="text-muted-foreground">Выберите правильный перевод</p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="text-lg px-3 py-1">
            <Check className="h-4 w-4 mr-1 text-green-500" />
            {correctCount}
          </Badge>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            Слово {currentIndex + 1} из {words.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Word card */}
      <Card className="border-2">
        <CardContent className="pt-8 pb-8">
          <div className="text-center space-y-4">
            {/* Arabic word */}
            <div className="font-arabic text-5xl md:text-6xl" dir="rtl">
              {currentWord?.textArabic}
            </div>

            {/* English hint */}
            {currentWord?.translationEn && (
              <p className="text-sm text-muted-foreground">
                English: {currentWord.translationEn}
              </p>
            )}

            {/* Verse reference */}
            <Badge variant="secondary">
              {currentWord?.surahNumber}:{currentWord?.ayahNumber}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3">
        {currentWord?.options.map((option, idx) => {
          const isSelected = selectedOption === option
          const isCorrect = option === currentWord.correctAnswer
          const showResult = confirmed

          let variant: 'outline' | 'default' | 'destructive' = 'outline'
          let className = ''

          if (showResult) {
            if (isCorrect) {
              variant = 'default'
              className = 'bg-green-500 hover:bg-green-500 border-green-500'
            } else if (isSelected && !isCorrect) {
              variant = 'destructive'
            }
          } else if (isSelected) {
            variant = 'default'
          }

          return (
            <Button
              key={idx}
              variant={variant}
              className={`h-auto py-4 text-base ${className}`}
              onClick={() => handleSelectOption(option)}
              disabled={confirmed}
            >
              {option}
              {showResult && isCorrect && <Check className="ml-2 h-4 w-4" />}
              {showResult && isSelected && !isCorrect && <X className="ml-2 h-4 w-4" />}
            </Button>
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        {!confirmed ? (
          <>
            <Button variant="outline" onClick={handleSkip} className="flex-1">
              Пропустить
            </Button>
            <Button onClick={handleConfirm} disabled={!selectedOption} className="flex-1">
              Проверить
            </Button>
          </>
        ) : (
          <Button onClick={handleNext} className="w-full" size="lg">
            {currentIndex < words.length - 1 ? (
              <>
                Далее
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Завершить
                <Trophy className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
