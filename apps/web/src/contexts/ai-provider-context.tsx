import * as React from "react"
import { DEFAULT_OPENROUTER_MODEL, type AiProviderId } from "shared"
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
  modelSlug: string
  setModelSlug: (s: string) => void
  endpointOverride: string
  setEndpointOverride: (s: string) => void
  refresh: () => Promise<void>
  loading: boolean
}

const AiProviderContext = React.createContext<AiProviderState | null>(null)

export function AiProviderProvider({ children }: { children: React.ReactNode }) {
  const [configured, setConfigured] = React.useState(false)
  const [provider, setProvider] = React.useState<AiProviderId>("openrouter")
  const [modelSlug, setModelSlug] = React.useState(DEFAULT_OPENROUTER_MODEL)
  const [endpointOverride, setEndpointOverride] = React.useState("")
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    try {
      const cfg = await getAiConfig()
      setConfigured(cfg.configured)
      if (cfg.provider) setProvider(cfg.provider)
      if (cfg.modelSlug) setModelSlug(cfg.modelSlug)
      else if (cfg.provider === "openrouter") setModelSlug(DEFAULT_OPENROUTER_MODEL)
      setEndpointOverride(cfg.endpointOverride ?? "")
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
    () => ({
      configured,
      setConfigured,
      provider,
      setProvider,
      modelSlug,
      setModelSlug,
      endpointOverride,
      setEndpointOverride,
      refresh,
      loading,
    }),
    [configured, provider, modelSlug, endpointOverride, refresh, loading],
  )

  return <AiProviderContext.Provider value={value}>{children}</AiProviderContext.Provider>
}

export function useAiProvider() {
  const ctx = React.useContext(AiProviderContext)
  if (!ctx) throw new Error("useAiProvider must be used within AiProviderProvider")
  return ctx
}
