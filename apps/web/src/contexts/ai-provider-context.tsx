import * as React from "react"
import type { AiProviderId } from "shared"
import { getAiConfig } from "@/lib/api-client"

/**
 * Whether a BYOK AI provider is configured — loaded from the API so it reflects
 * server-side encrypted keys, not a localStorage lie. The API key itself never
 * lives in the client store.
 */
type AiProviderState = {
  configured: boolean
  setConfigured: (v: boolean) => void
  provider: AiProviderId
  setProvider: (p: AiProviderId) => void
  refresh: () => Promise<void>
  loading: boolean
}

const AiProviderContext = React.createContext<AiProviderState | null>(null)

export function AiProviderProvider({ children }: { children: React.ReactNode }) {
  const [configured, setConfigured] = React.useState(false)
  const [provider, setProvider] = React.useState<AiProviderId>("anthropic")
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    try {
      const cfg = await getAiConfig()
      setConfigured(cfg.configured)
      if (cfg.provider) setProvider(cfg.provider)
    } catch {
      // Unauthenticated screens (login) may hit this — leave defaults.
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const value = React.useMemo(
    () => ({ configured, setConfigured, provider, setProvider, refresh, loading }),
    [configured, provider, refresh, loading],
  )

  return <AiProviderContext.Provider value={value}>{children}</AiProviderContext.Provider>
}

export function useAiProvider() {
  const ctx = React.useContext(AiProviderContext)
  if (!ctx) throw new Error("useAiProvider must be used within AiProviderProvider")
  return ctx
}
