import { ApiError } from "@/lib/api-client"
import type { WebMcpToolResult } from "./types"

export type ToolErrorCode =
  | "not_authenticated"
  | "app_locked"
  | "offline"
  | "validation_error"
  | "disabled"
  | "api_error"
  | "unknown"

export class WebMcpToolError extends Error {
  code: ToolErrorCode
  details?: unknown

  constructor(code: ToolErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = "WebMcpToolError"
    this.code = code
    this.details = details
  }
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function jsonResult(data: unknown): WebMcpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  }
}

export function errorResult(err: unknown): WebMcpToolResult {
  if (err instanceof WebMcpToolError) {
    return jsonResult({
      ok: false,
      error: err.code,
      message: err.message,
      details: err.details ?? null,
    })
  }
  if (err instanceof ApiError) {
    return jsonResult({
      ok: false,
      error: "api_error",
      message: err.message,
      status: err.status,
    })
  }
  return jsonResult({
    ok: false,
    error: "unknown",
    message: err instanceof Error ? err.message : "Tool failed",
  })
}

export type ToolContext = {
  authenticated: boolean
  locked: boolean
  online: boolean
  enabled: boolean
}

export function assertRunnable(ctx: ToolContext) {
  if (!ctx.enabled) throw new WebMcpToolError("disabled", "AI agents (WebMCP) are turned off in Settings")
  if (!ctx.online) throw new WebMcpToolError("offline", "Device is offline")
  if (!ctx.authenticated) {
    throw new WebMcpToolError("not_authenticated", "Sign in to use this tool", { loginUrl: "/login" })
  }
  if (ctx.locked) throw new WebMcpToolError("app_locked", "Unlock the app to continue")
}
