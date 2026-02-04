'use client'

import { useEffect } from 'react'

/**
 * Apply Telegram WebApp safe area insets as CSS custom properties
 * so layouts can add proper padding to avoid Telegram's UI overlay
 */
function applySafeAreaInsets() {
  const tg = window.Telegram?.WebApp
  if (!tg) return

  const root = document.documentElement

  // safeAreaInset = device safe area (notch, status bar)
  const sa = (tg as any).safeAreaInset
  // contentSafeAreaInset = Telegram UI controls (header buttons)
  const csa = (tg as any).contentSafeAreaInset

  const saTop = sa?.top || 0
  const csaTop = csa?.top || 0

  root.style.setProperty('--tg-safe-top', `${saTop + csaTop}px`)
  root.style.setProperty('--tg-safe-bottom', `${(sa?.bottom || 0) + (csa?.bottom || 0)}px`)
}

/**
 * Component that initializes Telegram WebApp and handles safe area insets.
 * Should be included in all dashboard layouts.
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

      // Apply safe area insets immediately
      applySafeAreaInsets()

      // Listen for safe area changes (e.g. entering/exiting fullscreen)
      if ('onEvent' in tg) {
        const on = (tg as any).onEvent.bind(tg)
        on('safeAreaChanged', applySafeAreaInsets)
        on('contentSafeAreaChanged', applySafeAreaInsets)
        on('fullscreenChanged', applySafeAreaInsets)
      }
    }

    // Try immediately
    initTelegram()

    // Also try after a short delay (in case SDK loads late)
    const timer = setTimeout(initTelegram, 100)

    return () => {
      clearTimeout(timer)
      const tg = window.Telegram?.WebApp
      if (tg && 'offEvent' in tg) {
        const off = (tg as any).offEvent.bind(tg)
        off('safeAreaChanged', applySafeAreaInsets)
        off('contentSafeAreaChanged', applySafeAreaInsets)
        off('fullscreenChanged', applySafeAreaInsets)
      }
    }
  }, [])

  return null
}
