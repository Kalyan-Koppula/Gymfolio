import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider as ModeProvider } from 'next-themes'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AppearanceProvider } from '@/contexts/appearance-provider'
import { AiProviderProvider } from '@/contexts/ai-provider-context'
import { SessionProvider } from '@/contexts/session-context'
import { AppLockProvider } from '@/contexts/app-lock-context'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider>
        <AppLockProvider>
          <AppearanceProvider>
            <AiProviderProvider>
              <TooltipProvider>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
                <Toaster position="top-center" />
              </TooltipProvider>
            </AiProviderProvider>
          </AppearanceProvider>
        </AppLockProvider>
      </SessionProvider>
    </ModeProvider>
  </StrictMode>,
)
