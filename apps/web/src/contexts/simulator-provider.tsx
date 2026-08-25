import * as React from "react"

// Drives the "what-if" states called out across the design brief (§1.9, FR-9.4, §3.15)
// so a reviewer can see offline / AI-degraded / quota-pending states without a real backend.
type SimulatorState = {
  online: boolean
  setOnline: (v: boolean) => void
  aiConfigured: boolean
  setAiConfigured: (v: boolean) => void
  youtubeQuotaNearCap: boolean
  setYoutubeQuotaNearCap: (v: boolean) => void
  hasActiveRoutine: boolean
  setHasActiveRoutine: (v: boolean) => void
  simulateWrite: <T>(succeed?: () => T) => Promise<{ ok: true; data?: T } | { ok: false }>
  sheetOpen: boolean
  setSheetOpen: (v: boolean) => void
  /** Which day of the active routine's rotation is "today" — see `getCurrentDay` in stub-data.ts. */
  cycleStep: number
  advanceCycleStep: () => void
}

const SimulatorContext = React.createContext<SimulatorState | null>(null)

export function SimulatorProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = React.useState(true)
  const [aiConfigured, setAiConfigured] = React.useState(true)
  const [youtubeQuotaNearCap, setYoutubeQuotaNearCap] = React.useState(false)
  const [hasActiveRoutine, setHasActiveRoutine] = React.useState(true)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [cycleStep, setCycleStep] = React.useState(0)
  const advanceCycleStep = React.useCallback(() => setCycleStep((s) => s + 1), [])

  const simulateWrite = React.useCallback(
    async <T,>(succeed?: () => T) => {
      await new Promise((r) => setTimeout(r, 650 + Math.random() * 350))
      if (!online) return { ok: false as const }
      return { ok: true as const, data: succeed?.() }
    },
    [online],
  )

  const value = React.useMemo(
    () => ({
      online,
      setOnline,
      aiConfigured,
      setAiConfigured,
      youtubeQuotaNearCap,
      setYoutubeQuotaNearCap,
      hasActiveRoutine,
      setHasActiveRoutine,
      simulateWrite,
      sheetOpen,
      setSheetOpen,
      cycleStep,
      advanceCycleStep,
    }),
    [online, aiConfigured, youtubeQuotaNearCap, hasActiveRoutine, simulateWrite, sheetOpen, cycleStep, advanceCycleStep],
  )

  return <SimulatorContext.Provider value={value}>{children}</SimulatorContext.Provider>
}

export function useSimulator() {
  const ctx = React.useContext(SimulatorContext)
  if (!ctx) throw new Error("useSimulator must be used within SimulatorProvider")
  return ctx
}
