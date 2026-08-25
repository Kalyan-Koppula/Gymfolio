import * as React from "react"

/**
 * Whether a BYOK AI provider is actually configured — set for real by the
 * Settings → AI provider screen when a connection test succeeds, read by every screen with
 * an AI-assisted path (Onboarding's equipment step, Equipment Profile, Routine Builder) so
 * they can degrade to their manual equivalent when it isn't. Persisted like the appearance
 * preference so it survives a reload; the API key itself is never persisted here — an
 * actual secret has no business sitting in localStorage, configured or not.
 */
export type AiProviderId = "anthropic" | "openai" | "google" | "local"

type AiProviderState = {
  configured: boolean
  setConfigured: (v: boolean) => void
  provider: AiProviderId
  setProvider: (p: AiProviderId) => void
}

const AiProviderContext = React.createContext<AiProviderState | null>(null)

const STORAGE_KEY = "fitness-tracker:ai-provider"

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { configured: boolean; provider: AiProviderId }
  } catch {
    return null
  }
}

export function AiProviderProvider({ children }: { children: React.ReactNode }) {
  const stored = readStored()
  const [configured, setConfigured] = React.useState(stored?.configured ?? false)
  const [provider, setProvider] = React.useState<AiProviderId>(stored?.provider ?? "anthropic")

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ configured, provider }))
  }, [configured, provider])

  const value = React.useMemo(
    () => ({ configured, setConfigured, provider, setProvider }),
    [configured, provider],
  )

  return <AiProviderContext.Provider value={value}>{children}</AiProviderContext.Provider>
}

export function useAiProvider() {
  const ctx = React.useContext(AiProviderContext)
  if (!ctx) throw new Error("useAiProvider must be used within AiProviderProvider")
  return ctx
}
