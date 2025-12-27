/**
 * Telegram WebApp types
 */
interface TelegramWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

interface TelegramMainButton {
  text: string
  color: string
  textColor: string
  isVisible: boolean
  isActive: boolean
  show: () => void
  hide: () => void
  enable: () => void
  disable: () => void
  showProgress?: (leaveActive: boolean) => void
  hideProgress?: () => void
  onClick: (callback: () => void) => void
  offClick: (callback: () => void) => void
}

interface TelegramBackButton {
  show: () => void
  hide: () => void
  onClick: (callback: () => void) => void
  offClick: (callback: () => void) => void
}

interface TelegramHapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void
}

interface TelegramThemeParams {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramWebAppUser
    auth_date?: number
    hash?: string
    query_id?: string
  }
  ready: () => void
  expand: () => void
  close: () => void
  requestFullscreen?: () => void
  exitFullscreen?: () => void
  isFullscreen?: boolean
  MainButton: TelegramMainButton
  BackButton?: TelegramBackButton
  HapticFeedback?: TelegramHapticFeedback
  themeParams: TelegramThemeParams
  colorScheme: 'light' | 'dark'
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp
  }
}
