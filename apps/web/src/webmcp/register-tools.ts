import { toast } from "sonner"
import { getModelContext, isWebMcpSupported } from "./feature-detect"
import { buildToolCatalog } from "./handlers/catalog"
import type { ToolContext } from "./helpers"
import { markWebMcpNativeReady } from "./native-bridge"
import type { WebMcpToolDefinition } from "./types"

type Registered = {
  name: string
  unregister?: () => void
  execute: WebMcpToolDefinition["execute"]
}

/**
 * Register the Gymfolio tool catalog with the browser WebMCP API (when present)
 * and always expose a local invoke shim for DevTools testing.
 */
export function registerGymfolioWebMcp(getCtx: () => ToolContext): () => void {
  const catalog = buildToolCatalog(getCtx)
  const registered: Registered[] = []
  const byName = new Map<string, WebMcpToolDefinition>()

  for (const tool of catalog) {
    byName.set(tool.name, tool)
  }

  const invoke = async (name: string, args: Record<string, unknown> = {}) => {
    const tool = byName.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)
    const result = await tool.execute(args)
    const text = result.content[0]?.text ?? ""
    try {
      const parsed = JSON.parse(text) as { ok?: boolean; error?: string; data?: unknown; message?: string }
      if (parsed.ok === true && !tool.annotations?.readOnlyHint) {
        toast.success(`Agent: ${name.replace(/_/g, " ")}`)
      }
      return parsed
    } catch {
      return result
    }
  }

  const publishDebug = () => {
    window.__GYMFOLIO_WEBMCP__ = {
      supported: isWebMcpSupported(),
      enabled: getCtx().enabled,
      tools: catalog.map((t) => t.name),
      invoke,
    }
  }

  publishDebug()
  markWebMcpNativeReady()

  const modelContext = getModelContext()
  if (modelContext?.registerTool && getCtx().enabled) {
    for (const tool of catalog) {
      try {
        const maybe = modelContext.registerTool({
          ...tool,
          execute: async (args) => {
            const result = await invoke(tool.name, args ?? {})
            // Browser agents expect WebMcpToolResult shape
            if (result && typeof result === "object" && "content" in (result as object)) {
              return result as Awaited<ReturnType<WebMcpToolDefinition["execute"]>>
            }
            return {
              content: [{ type: "text", text: JSON.stringify(result) }],
            }
          },
        })
        const unregister =
          maybe && typeof maybe === "object" && "unregister" in maybe
            ? (maybe as { unregister?: () => void }).unregister
            : undefined
        registered.push({ name: tool.name, unregister, execute: tool.execute })
      } catch (err) {
        console.warn(`[webmcp] failed to register ${tool.name}`, err)
      }
    }
  }

  return () => {
    for (const r of registered) {
      try {
        r.unregister?.()
      } catch {
        /* ignore */
      }
    }
    registered.length = 0
    if (window.__GYMFOLIO_WEBMCP__) {
      window.__GYMFOLIO_WEBMCP__ = {
        supported: isWebMcpSupported(),
        enabled: false,
        tools: [],
        invoke: async () => {
          throw new Error("WebMCP unregistered")
        },
      }
    }
  }
}
