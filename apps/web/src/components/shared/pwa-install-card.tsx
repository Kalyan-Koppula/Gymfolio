import { Share, SquarePlus, X } from "lucide-react"
import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "gymfolio:pwa-install-dismissed-at"
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

function isRunningInstalled(): boolean {
  if (typeof window === "undefined") return false
  if (window.matchMedia("(display-mode: standalone)").matches) return true
  // iOS Safari home-screen launch
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}

function isSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const dismissedAt = Number(raw)
    if (!Number.isFinite(dismissedAt)) return false
    return Date.now() - dismissedAt < SNOOZE_MS
  } catch {
    return false
  }
}

/**
 * §3.15 — instructional "Add to Home Screen" card.
 * Never shown when already installed; after dismiss, snoozed for 30 days.
 */
export function PwaInstallCard() {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    if (isRunningInstalled()) {
      setVisible(false)
      return
    }
    setVisible(!isSnoozed())
  }, [])

  if (!visible) return null

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()))
    } catch {
      // ignore quota / private mode
    }
    setVisible(false)
  }

  return (
    <Card className="relative border-primary/30 bg-primary/5 py-4">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dismiss install prompt"
        className="absolute top-2 right-2 size-8"
        onClick={dismiss}
      >
        <X className="size-4" />
      </Button>
      <CardContent className="flex items-start gap-3 pr-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <SquarePlus className="size-5 text-primary" />
        </div>
        <div className="space-y-1.5 text-sm">
          <p className="font-medium">Install Gymfolio for gym use</p>
          <p className="text-muted-foreground">
            Tap <Share className="inline size-3.5 -translate-y-0.5" aria-label="Share icon" /> in
            Safari's toolbar, then <span className="font-medium text-foreground">Add to Home Screen</span>.
            It opens full-screen; the service worker caches the app shell and exercise library for
            offline browsing (writes still need a connection).
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
