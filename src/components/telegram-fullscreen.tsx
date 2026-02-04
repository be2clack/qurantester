'use client'

import { useEffect } from 'react'

/**
 * Initializes Telegram WebApp: fullscreen, disable swipes.
 * Safe area CSS variables (--tg-safe-area-inset-*, --tg-content-safe-area-inset-*)
 * are set automatically by the official telegram-web-app.js SDK (Bot API 8.0+).
 * We combine them in globals.css via --tg-safe-top / --tg-safe-bottom.
 */
export function TelegramFullscreen() {
  useEffect(() => {
    const initTelegram = () => {
      const tg = window.Telegram?.WebApp
      if (!tg) return

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

    // Try immediately
    initTelegram()

    // Also try after a short delay (in case SDK loads late)
    const timer = setTimeout(initTelegram, 100)

    return () => clearTimeout(timer)
  }, [])

  return null
}
