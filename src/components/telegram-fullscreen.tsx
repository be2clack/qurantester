'use client'

import { useEffect } from 'react'

/**
 * Component that requests fullscreen mode for Telegram WebApp
 * Should be included in all dashboard layouts
 */
export function TelegramFullscreen() {
  useEffect(() => {
    const initTelegram = () => {
      const tg = window.Telegram?.WebApp
      if (tg) {
        tg.ready()
        tg.expand()

        // Request fullscreen mode for better UX
        if (tg.requestFullscreen && !tg.isFullscreen) {
          try {
            tg.requestFullscreen()
          } catch (e) {
            // Fullscreen may not be supported in older clients
          }
        }

        // Disable vertical swipes to prevent accidental closing
        if ('disableVerticalSwipes' in tg) {
          try {
            (tg as unknown as { disableVerticalSwipes: () => void }).disableVerticalSwipes()
          } catch (e) {
            // May not be supported
          }
        }
      }
    }

    // Try immediately
    initTelegram()

    // Also try after a short delay (in case SDK loads late)
    const timer = setTimeout(initTelegram, 100)

    return () => clearTimeout(timer)
  }, [])

  return null
}
