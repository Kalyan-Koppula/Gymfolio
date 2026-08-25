import * as React from "react"
import { toast } from "sonner"
import { useSimulator } from "@/contexts/simulator-provider"
import type { WriteStatus } from "@/hooks/use-write-status"

/**
 * Same {status, run} shape as useWriteStatus (so SaveButton needs no changes), but backed
 * by a real request instead of the simulator's fake timer — used only by the screens this
 * Foundation pass makes real (Login, Onboarding's account step, the Log hub tabs, Body
 * Metrics Trend). Every other screen keeps using useWriteStatus/simulateWrite untouched.
 *
 * Still honors the prototype simulator's offline toggle: flipping "Network connection"
 * off short-circuits to the same failed state a real dead zone would produce, so that
 * design-review control keeps working against the real backend, not just the mock.
 */
export function useApiWrite<T>(successMessage = "Saved") {
  const { online } = useSimulator()
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
