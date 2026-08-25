import { WifiOff } from "lucide-react"
import { useSimulator } from "@/contexts/simulator-provider"

/**
 * §1.9 / §3.15 — slim, low-noise connectivity indicator. Shown only on screens that
 * require a live write (logging a set, saving an entry) — never a blocking modal,
 * never shown on read-only screens like the exercise library.
 */
export function OfflineBanner() {
  const { online } = useSimulator()
  if (online) return null
  return (
    <div
      role="status"
      className="flex items-center gap-2 bg-warning px-4 py-2 text-sm font-medium text-warning-foreground animate-in slide-in-from-top-2 fade-in duration-300 ease-out"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      <span>You're offline — changes here won't save until you're back online.</span>
    </div>
  )
}
