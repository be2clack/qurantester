/**
 * AI Usage Logging and Analytics
 *
 * Tracks usage of AI services (OpenAI Whisper, Qurani.ai QRC)
 * and calculates estimated costs.
 */

import { prisma } from '@/lib/prisma'
import { AIProvider } from '@prisma/client'

// Pricing per provider (USD)
const PRICING = {
  // OpenAI Whisper: $0.006 per minute of audio
  WHISPER_PER_MINUTE: 0.006,

  // OpenAI GPT-4o-mini: $0.15 per 1M input tokens, $0.60 per 1M output tokens
  GPT4O_MINI_INPUT_PER_1M: 0.15,
  GPT4O_MINI_OUTPUT_PER_1M: 0.60,

  // Qurani.ai QRC: Free tier or subscription-based (set to 0, can be configured)
  QURANI_AI_PER_REQUEST: 0,
}

export interface LogAIUsageParams {
  provider: AIProvider
  operation: string  // 'transcribe', 'translate', 'pre-check'
  inputTokens?: number
  outputTokens?: number
  audioDuration?: number  // in seconds
  userId?: string
  groupId?: string
  submissionId?: string
  success?: boolean
  errorMessage?: string
}

/**
 * Calculate estimated cost based on usage
 */
export function calculateCost(params: {
  provider: AIProvider
  operation: string
  inputTokens?: number
  outputTokens?: number
  audioDuration?: number  // in seconds
}): number {
  const { provider, operation, inputTokens, outputTokens, audioDuration } = params

  switch (provider) {
    case 'WHISPER':
      // Whisper: cost based on audio duration
      if (audioDuration) {
        const minutes = audioDuration / 60
        return minutes * PRICING.WHISPER_PER_MINUTE
      }
      // If no duration provided, estimate based on tokens
      if (inputTokens) {
        // Rough estimate: 150 words per minute, ~1.3 tokens per word
        const estimatedMinutes = (inputTokens / 1.3) / 150
        return estimatedMinutes * PRICING.WHISPER_PER_MINUTE
      }
      return 0

    case 'QURANI_AI':
      // Qurani.ai: subscription or free tier
      return PRICING.QURANI_AI_PER_REQUEST

    case 'NONE':
    default:
      return 0
  }
}

/**
 * Calculate cost for GPT translation
 */
export function calculateGPTCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * PRICING.GPT4O_MINI_INPUT_PER_1M
  const outputCost = (outputTokens / 1_000_000) * PRICING.GPT4O_MINI_OUTPUT_PER_1M
  return inputCost + outputCost
}

/**
 * Log AI usage to database
 */
export async function logAIUsage(params: LogAIUsageParams): Promise<void> {
  try {
    const estimatedCost = calculateCost({
      provider: params.provider,
      operation: params.operation,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      audioDuration: params.audioDuration,
    })

    await prisma.aIUsageLog.create({
      data: {
        provider: params.provider,
        operation: params.operation,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        audioDuration: params.audioDuration,
        estimatedCost,
        userId: params.userId,
        groupId: params.groupId,
        submissionId: params.submissionId,
        success: params.success ?? true,
        errorMessage: params.errorMessage,
      },
    })
  } catch (error) {
    console.error('[AI Usage] Failed to log usage:', error)
    // Don't throw - logging failure shouldn't break the main flow
  }
}

/**
 * Log GPT translation usage
 */
export async function logGPTUsage(params: {
  inputTokens: number
  outputTokens: number
  operation?: string
  userId?: string
  success?: boolean
  errorMessage?: string
}): Promise<void> {
  try {
    const estimatedCost = calculateGPTCost(params.inputTokens, params.outputTokens)

    await prisma.aIUsageLog.create({
      data: {
        provider: 'WHISPER',  // Using WHISPER as proxy for OpenAI
        operation: params.operation || 'translate',
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        estimatedCost,
        userId: params.userId,
        success: params.success ?? true,
        errorMessage: params.errorMessage,
      },
    })
  } catch (error) {
    console.error('[AI Usage] Failed to log GPT usage:', error)
  }
}

export interface AIUsageStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalCost: number
  totalAudioMinutes: number
  byProvider: {
    provider: AIProvider
    requests: number
    cost: number
    successRate: number
  }[]
  dailyStats: {
    date: string
    requests: number
    cost: number
  }[]
}

/**
 * Get AI usage statistics for a date range
 */
export async function getAIUsageStats(
  startDate: Date,
  endDate: Date
): Promise<AIUsageStats> {
  // Get all logs in the date range
  const logs = await prisma.aIUsageLog.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  const totalRequests = logs.length
  const successfulRequests = logs.filter(l => l.success).length
  const failedRequests = logs.filter(l => !l.success).length
  const totalCost = logs.reduce((sum, l) => sum + l.estimatedCost, 0)
  const totalAudioMinutes = logs.reduce((sum, l) => sum + (l.audioDuration || 0), 0) / 60

  // Group by provider
  const providerMap = new Map<AIProvider, { requests: number; cost: number; successful: number }>()

  for (const log of logs) {
    const existing = providerMap.get(log.provider) || { requests: 0, cost: 0, successful: 0 }
    existing.requests++
    existing.cost += log.estimatedCost
    if (log.success) existing.successful++
    providerMap.set(log.provider, existing)
  }

  const byProvider = Array.from(providerMap.entries()).map(([provider, stats]) => ({
    provider,
    requests: stats.requests,
    cost: stats.cost,
    successRate: stats.requests > 0 ? (stats.successful / stats.requests) * 100 : 0,
  }))

  // Group by day
  const dailyMap = new Map<string, { requests: number; cost: number }>()

  for (const log of logs) {
    const dateKey = log.createdAt.toISOString().split('T')[0]
    const existing = dailyMap.get(dateKey) || { requests: 0, cost: 0 }
    existing.requests++
    existing.cost += log.estimatedCost
    dailyMap.set(dateKey, existing)
  }

  const dailyStats = Array.from(dailyMap.entries()).map(([date, stats]) => ({
    date,
    requests: stats.requests,
    cost: stats.cost,
  }))

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    totalCost,
    totalAudioMinutes,
    byProvider,
    dailyStats,
  }
}
