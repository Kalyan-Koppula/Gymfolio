import * as React from "react"
import { toast } from "sonner"
import { useSimulator } from "@/contexts/simulator-provider"

export type WriteStatus = "idle" | "saving" | "success" | "failed"

/**
 * §1.9 — every write-capable control in the app routes through this: a visible
 * "saving…" state, a specific failure state that never clears the input, and a
 * retry that re-submits the same payload rather than asking the user to re-enter it.
 */
export function useWriteStatus(successMessage = "Saved") {
  const { simulateWrite } = useSimulator()
  const [status, setStatus] = React.useState<WriteStatus>("idle")
  const lastAction = React.useRef<(() => void) | null>(null)

  const run = React.useCallback(
    async (onSuccess?: () => void) => {
      lastAction.current = () => run(onSuccess)
      setStatus("saving")
      const result = await simulateWrite()
      if (result.ok) {
        setStatus("success")
        toast.success(successMessage)
        onSuccess?.()
        window.setTimeout(() => setStatus("idle"), 1500)
      } else {
        setStatus("failed")
        toast.error("Couldn't save — check your connection", {
          action: { label: "Retry", onClick: () => lastAction.current?.() },
        })
      }
    },
    [simulateWrite, successMessage],
  )

  return { status, run }
}
