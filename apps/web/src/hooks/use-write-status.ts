import * as React from "react"
import { toast } from "sonner"
import { useOnlineStatus } from "@/hooks/use-online-status"

export type WriteStatus = "idle" | "saving" | "success" | "failed"

/**
 * Legacy fake-write helper kept for any remaining prototype surfaces. Prefer
 * `useApiWrite` for anything that hits the Worker — Active Workout, Account,
 * Equipment, and Routine screens all use the real path now.
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
