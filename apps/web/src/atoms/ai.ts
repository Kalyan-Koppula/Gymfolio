import { atom } from "jotai"
import { DEFAULT_OPENROUTER_MODEL, type AiProviderId } from "shared"

/** Settings-form drafts (not the encrypted key). Seeded from the AI config query. */
export const aiProviderDraftAtom = atom<AiProviderId>("openrouter")
export const aiModelSlugDraftAtom = atom(DEFAULT_OPENROUTER_MODEL)
export const aiEndpointDraftAtom = atom("")
