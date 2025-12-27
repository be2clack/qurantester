'use client'

import { Suspense } from 'react'
import Script from 'next/script'
import QRCCheckApp from './QRCCheckApp'

export default function QRCCheckPage() {
  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
        id="telegram-web-app-script"
      />

      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Загрузка...</p>
            </div>
          </div>
        }
      >
        <QRCCheckApp />
      </Suspense>
    </>
  )
}
