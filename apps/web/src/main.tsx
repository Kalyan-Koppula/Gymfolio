import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider as ModeProvider } from 'next-themes'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AppearanceProvider } from '@/contexts/appearance-provider'
import { SimulatorProvider } from '@/contexts/simulator-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AppearanceProvider>
        <SimulatorProvider>
          <TooltipProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
            <Toaster position="top-center" />
          </TooltipProvider>
        </SimulatorProvider>
      </AppearanceProvider>
    </ModeProvider>
  </StrictMode>,
)
