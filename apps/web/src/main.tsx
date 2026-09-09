import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider as ModeProvider } from 'next-themes'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AppProviders } from '@/providers/app-providers'
import { AppearanceBootstrap } from '@/hooks/use-appearance'
import { AppLockProvider } from '@/contexts/app-lock-context'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <ModeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <AppearanceBootstrap />
        <AppLockProvider>
          <TooltipProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
            <Toaster position="top-center" />
          </TooltipProvider>
        </AppLockProvider>
      </ModeProvider>
    </AppProviders>
  </StrictMode>,
)
