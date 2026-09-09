import { Share, SquarePlus, X } from "lucide-react"
import { useAtom } from "jotai"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { pwaInstallDismissedAtAtom } from "@/atoms/ui"

const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

function isRunningInstalled(): boolean {
  if (typeof window === "undefined") return false
  if (window.matchMedia("(display-mode: standalone)").matches) return true
  // iOS Safari home-screen launch
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua)
  const chromeOrCriOS = /CriOS|FxiOS|EdgiOS|OPiOS|Chrome/.test(ua)
  return iOS && webkit && !chromeOrCriOS
}

/**
 * §3.15 — instructional "Add to Home Screen" card.
 * Never shown when already installed; after dismiss, snoozed for 30 days.
 * iPhone: must use Safari (Chrome/Firefox on iOS cannot install PWAs).
 */
export function PwaInstallCard() {
  const [dismissedAt, setDismissedAt] = useAtom(pwaInstallDismissedAtAtom)

  if (isRunningInstalled()) return null
  if (dismissedAt != null && Date.now() - dismissedAt < SNOOZE_MS) return null

  function dismiss() {
    setDismissedAt(Date.now())
  }

  const ios = typeof navigator !== "undefined" && isIosSafari()

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
            {ios ? (
              <>
                In <span className="font-medium text-foreground">Safari</span> (not Chrome), tap{" "}
                <Share className="inline size-3.5 -translate-y-0.5" aria-label="Share icon" /> then{" "}
                <span className="font-medium text-foreground">Add to Home Screen</span>. Opens
                full-screen; the app shell stays available offline.
              </>
            ) : (
              <>
                Tap <Share className="inline size-3.5 -translate-y-0.5" aria-label="Share icon" /> in
                the browser toolbar, then{" "}
                <span className="font-medium text-foreground">Add to Home Screen</span>. Opens
                full-screen; the app shell stays available offline (writes still need a connection).
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
