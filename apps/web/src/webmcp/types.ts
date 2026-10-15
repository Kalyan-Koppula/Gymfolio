/**
 * Minimal typings for the experimental WebMCP imperative API.
 * @see https://developer.chrome.com/docs/ai/webmcp/imperative-api
 */

export type WebMcpToolAnnotations = {
  readOnlyHint?: boolean
  consequentialHint?: boolean
  untrustedContentHint?: boolean
}

export type WebMcpToolResult = {
  content: Array<{ type: "text"; text: string }>
}

export type WebMcpToolDefinition = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: WebMcpToolAnnotations
  execute: (args: Record<string, unknown>) => Promise<WebMcpToolResult>
}

export type ModelContext = {
  registerTool: (tool: WebMcpToolDefinition) => void | Promise<void> | { unregister?: () => void }
  getTools?: () => Promise<Array<{ name: string; description: string }>>
  executeTool?: (name: string, args?: Record<string, unknown>) => Promise<unknown>
}

declare global {
  interface Document {
    modelContext?: ModelContext
  }

  interface Window {
    /** Dev-only local registry for testing without Chrome WebMCP. */
    __GYMFOLIO_WEBMCP__?: {
      supported: boolean
      enabled: boolean
      tools: string[]
      invoke: (name: string, args?: Record<string, unknown>) => Promise<unknown>
    }
    /** Android WebView bridge — AppFunctions → WebMCP. */
    gymfolioNativeInvoke?: (name: string, argsJson?: string) => Promise<string>
    GymfolioNative?: {
      onReady?: () => void
      onResult?: (id: string, json: string) => void
      onError?: (id: string, message: string) => void
    }
  }
}

export {}
