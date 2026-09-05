import { DEFAULT_OPENROUTER_MODEL, type AiProviderId } from "shared"
import { CustomEndpointProvider } from "./custom-endpoint.ts"
import { OpenRouterProvider } from "./openrouter.ts"
import { AiDegradedError, type AIProvider } from "./types.ts"

export type ProviderConfigRow = {
  provider: string
  modelSlug: string | null
  endpointOverride: string | null
}

export function createAIProvider(apiKey: string, row: ProviderConfigRow): AIProvider {
  const provider = row.provider as AiProviderId
  const model = (row.modelSlug?.trim() || DEFAULT_OPENROUTER_MODEL)

  if (provider === "openrouter") {
    return new OpenRouterProvider(apiKey, model)
  }

  if (provider === "local") {
    const endpoint = row.endpointOverride?.trim()
    if (!endpoint) {
      throw new AiDegradedError("Local provider requires an endpoint URL")
    }
    return new CustomEndpointProvider(apiKey, model, endpoint)
  }

  throw new AiDegradedError(`Unknown AI provider: ${row.provider}`)
}
