import * as React from "react"
import { toast } from "sonner"
import { useOnlineStatus } from "@/hooks/use-online-status"
import type { WriteStatus } from "@/hooks/use-write-status"

/**
 * Same {status, run} shape as useWriteStatus (so SaveButton needs no changes), backed by a
 * real fetch request. Used by the screens with a real API behind them (Login, Onboarding's
 * account step, the Log hub tabs, Body Metrics Trend); every other screen still uses
 * useWriteStatus until its backend exists.
 */
export function useApiWrite<T>(successMessage = "Saved") {
  const online = useOnlineStatus()
  const [status, setStatus] = React.useState<WriteStatus>("idle")
  const lastAction = React.useRef<(() => void) | null>(null)

  const run = React.useCallback(
    async (request: () => Promise<T>, onSuccess?: (data: T) => void) => {
      lastAction.current = () => run(request, onSuccess)
      setStatus("saving")

      if (!online) {
        setStatus("failed")
        toast.error("You're offline — check your connection", {
          action: { label: "Retry", onClick: () => lastAction.current?.() },
        })
        return
      }

      try {
        const data = await request()
        setStatus("success")
        toast.success(successMessage)
        onSuccess?.(data)
        window.setTimeout(() => setStatus("idle"), 1500)
      } catch (err) {
        setStatus("failed")
        const message = err instanceof Error ? err.message : "Couldn't save"
        toast.error(message, {
          action: { label: "Retry", onClick: () => lastAction.current?.() },
        })
      }
    },
    [online, successMessage],
  )

  return { status, run }
}
