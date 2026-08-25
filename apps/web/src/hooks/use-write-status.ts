import * as React from "react"
import { toast } from "sonner"
import { useOnlineStatus } from "@/hooks/use-online-status"

export type WriteStatus = "idle" | "saving" | "success" | "failed"

/**
 * §1.9 — every write-capable control in the app routes through this: a visible
 * "saving…" state, a specific failure state that never clears the input, and a
 * retry that re-submits the same payload rather than asking the user to re-enter it.
 *
 * For screens whose backend hasn't been built yet (Routine builder/wizard, Active Workout,
 * Equipment Profile, Account sessions) — real connectivity still gates whether a write can
 * succeed; the short delay stands in for the network round trip those endpoints will make
 * once they exist. Screens with a real API (Log hub, auth) use `useApiWrite` instead.
 */
export function useWriteStatus(successMessage = "Saved") {
  const online = useOnlineStatus()
  const [status, setStatus] = React.useState<WriteStatus>("idle")
  const lastAction = React.useRef<(() => void) | null>(null)

  const run = React.useCallback(
    async (onSuccess?: () => void) => {
      lastAction.current = () => run(onSuccess)
      setStatus("saving")
      await new Promise((resolve) => setTimeout(resolve, 650 + Math.random() * 350))

      if (!online) {
        setStatus("failed")
        toast.error("Couldn't save — check your connection", {
          action: { label: "Retry", onClick: () => lastAction.current?.() },
        })
        return
      }

      setStatus("success")
      toast.success(successMessage)
      onSuccess?.()
      window.setTimeout(() => setStatus("idle"), 1500)
    },
    [online, successMessage],
  )

  return { status, run }
}
