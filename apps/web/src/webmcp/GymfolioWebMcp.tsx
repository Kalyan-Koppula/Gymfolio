import * as React from "react"
import { useAtomValue } from "jotai"
import { webMcpEnabledAtom } from "@/atoms/webmcp"
import { useAppLock } from "@/contexts/app-lock-context"
import { useSession } from "@/hooks/use-session"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { installNativeInvokeListener } from "./native-bridge"
import { registerGymfolioWebMcp } from "./register-tools"
import type { ToolContext } from "./helpers"

/**
 * Registers Gymfolio WebMCP tools while the authenticated shell is mounted.
 * Renders nothing. Local testing: `window.__GYMFOLIO_WEBMCP__.invoke("get_session")`.
 */
export function GymfolioWebMcp() {
  const { user } = useSession()
  const { locked } = useAppLock()
  const online = useOnlineStatus()
  const enabled = useAtomValue(webMcpEnabledAtom)

  const ctxRef = React.useRef<ToolContext>({
    authenticated: Boolean(user),
    locked,
    online,
    enabled,
  })
  ctxRef.current = {
    authenticated: Boolean(user),
    locked,
    online,
    enabled,
  }

  React.useEffect(() => installNativeInvokeListener(), [])

  React.useEffect(() => {
    if (!enabled) {
      window.__GYMFOLIO_WEBMCP__ = {
        supported: Boolean(document.modelContext?.registerTool),
        enabled: false,
        tools: [],
        invoke: async () => ({ ok: false, error: "disabled", message: "WebMCP disabled in Settings" }),
      }
      return
    }
    return registerGymfolioWebMcp(() => ctxRef.current)
  }, [enabled, user?.id])

  return null
}
