import type { ModelContext } from "./types"

export function getModelContext(): ModelContext | null {
  if (typeof document === "undefined") return null
  return document.modelContext ?? null
}

export function isWebMcpSupported(): boolean {
  return Boolean(getModelContext()?.registerTool)
}
