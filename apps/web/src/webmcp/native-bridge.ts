/**
 * Bridge for OS-level Android agents (AppFunctions) → in-page WebMCP tools.
 *
 * Native Kotlin evaluates JS that calls this helper; results return as JSON strings.
 * Also used by Capacitor plugin `GymfolioAgent`.
 */
import type { PluginListenerHandle } from "./native-types"

type InvokeRequest = {
  id: string
  name: string
  args?: Record<string, unknown>
}

type InvokeResponse = {
  id: string
  ok: boolean
  result?: unknown
  error?: string
}

const READY_EVENT = "gymfolio:webmcp-ready"
const INVOKE_EVENT = "gymfolio:webmcp-native-invoke"
const RESULT_EVENT = "gymfolio:webmcp-native-result"

let ready = false

export function isNativeBridgeReady() {
  return ready
}

/** Call after WebMCP catalog is registered. */
export function markWebMcpNativeReady() {
  ready = true
  window.dispatchEvent(new CustomEvent(READY_EVENT, { detail: { ready: true } }))
  // Android JavascriptInterface (AppFunctions bridge)
  try {
    const native = (window as Window & { GymfolioNative?: { onReady?: () => void } }).GymfolioNative
    native?.onReady?.()
  } catch {
    /* ignore */
  }
  void notifyCapacitorReady()
}

async function notifyCapacitorReady() {
  try {
    const { Capacitor, registerPlugin } = await import("./capacitor-shim")
    if (!Capacitor?.isNativePlatform?.()) return
    const Agent = registerPlugin<{ setReady: (o: { ready: boolean }) => Promise<void> }>("GymfolioAgent")
    await Agent.setReady({ ready: true })
  } catch {
    /* browser / no Capacitor */
  }
}

/**
 * Entry point for WebView.evaluateJavascript / Cap bridge.
 * Always returns a JSON string (never throws across the bridge).
 */
export async function nativeInvokeTool(name: string, argsJson = "{}"): Promise<string> {
  try {
    const api = window.__GYMFOLIO_WEBMCP__
    if (!api?.invoke) {
      return JSON.stringify({
        ok: false,
        error: "not_ready",
        message: "WebMCP not registered — open Gymfolio and sign in",
      })
    }
    let args: Record<string, unknown> = {}
    try {
      args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {}
    } catch {
      return JSON.stringify({ ok: false, error: "validation_error", message: "args must be JSON object" })
    }
    const result = await api.invoke(name, args)
    return JSON.stringify(result)
  } catch (err) {
    return JSON.stringify({
      ok: false,
      error: "unknown",
      message: err instanceof Error ? err.message : "invoke failed",
    })
  }
}

/** Listen for CustomEvent-based invokes (used by some WebView hosts). */
export function installNativeInvokeListener(): () => void {
  const onInvoke = (ev: Event) => {
    const detail = (ev as CustomEvent<InvokeRequest>).detail
    if (!detail?.id || !detail.name) return
    void nativeInvokeTool(detail.name, JSON.stringify(detail.args ?? {})).then((raw) => {
      let parsed: InvokeResponse
      try {
        const body = JSON.parse(raw) as Record<string, unknown>
        parsed = {
          id: detail.id,
          ok: body.ok !== false,
          result: body,
          error: typeof body.error === "string" ? body.error : undefined,
        }
      } catch {
        parsed = { id: detail.id, ok: false, error: "parse_error", result: raw }
      }
      window.dispatchEvent(new CustomEvent(RESULT_EVENT, { detail: parsed }))
    })
  }
  window.addEventListener(INVOKE_EVENT, onInvoke)
  return () => window.removeEventListener(INVOKE_EVENT, onInvoke)
}

// Attach for evaluateJavascript("gymfolioNativeInvoke('log_hydration','{\"amountMl\":250}')")
;(window as Window & { gymfolioNativeInvoke?: typeof nativeInvokeTool }).gymfolioNativeInvoke =
  nativeInvokeTool

export type { PluginListenerHandle }
