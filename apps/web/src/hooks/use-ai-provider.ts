import { useCallback, useEffect } from "react"
import { useAtom } from "jotai"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { DEFAULT_OPENROUTER_MODEL, type AiProviderId } from "shared"
import { getAiConfig } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-client"
import { useSession } from "@/hooks/use-session"
import {
  aiEndpointDraftAtom,
  aiModelSlugDraftAtom,
  aiProviderDraftAtom,
} from "@/atoms/ai"
import type { AiProviderConfig } from "shared"

/**
 * BYOK AI config — server state via Query; settings form drafts via Jotai.
 * The API key itself never lives in the client store.
 */
export function useAiProvider() {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const [provider, setProvider] = useAtom(aiProviderDraftAtom)
  const [modelSlug, setModelSlug] = useAtom(aiModelSlugDraftAtom)
  const [endpointOverride, setEndpointOverride] = useAtom(aiEndpointDraftAtom)

  const query = useQuery({
    queryKey: queryKeys.aiConfig,
    queryFn: getAiConfig,
    enabled: Boolean(user),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  // Seed drafts from server when config loads / is invalidated (not on every focus).
  useEffect(() => {
    const cfg = query.data
    if (!cfg) return
    if (cfg.provider) setProvider(cfg.provider)
    if (cfg.modelSlug) setModelSlug(cfg.modelSlug)
    else if (cfg.provider === "openrouter") setModelSlug(DEFAULT_OPENROUTER_MODEL)
    setEndpointOverride(cfg.endpointOverride ?? "")
  }, [query.dataUpdatedAt, query.data, setProvider, setModelSlug, setEndpointOverride])

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.aiConfig })
  }, [queryClient])

  const setConfigured = useCallback(
    (v: boolean) => {
      queryClient.setQueryData(queryKeys.aiConfig, (prev: AiProviderConfig | undefined) =>
        prev ? { ...prev, configured: v } : prev,
      )
    },
    [queryClient],
  )

  return {
    configured: query.data?.configured ?? false,
    setConfigured,
    provider: provider as AiProviderId,
    setProvider: (p: AiProviderId) => setProvider(p),
    modelSlug,
    setModelSlug,
    endpointOverride,
    setEndpointOverride,
    refresh,
    loading: Boolean(user) && (query.isLoading || query.isPending),
  }
}
