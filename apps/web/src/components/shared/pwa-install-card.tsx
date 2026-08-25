import * as React from "react"
import { Share, SquarePlus, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

/**
 * §3.15 — iOS Safari has no native install prompt API, so this is a custom
 * "Add to Home Screen" instructional card. Shown once, dismissible, not nagging.
 */
export function PwaInstallCard() {
  const [dismissed, setDismissed] = React.useState(false)
  if (dismissed) return null
  return (
    <Card className="relative border-primary/30 bg-primary/5 py-4">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dismiss install prompt"
        className="absolute top-2 right-2 size-8"
        onClick={() => setDismissed(true)}
      >
        <X className="size-4" />
      </Button>
      <CardContent className="flex items-start gap-3 pr-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <SquarePlus className="size-5 text-primary" />
        </div>
        <div className="space-y-1.5 text-sm">
          <p className="font-medium">Install this app for gym use</p>
          <p className="text-muted-foreground">
            Tap <Share className="inline size-3.5 -translate-y-0.5" aria-label="Share icon" /> in
            Safari's toolbar, then <span className="font-medium text-foreground">Add to Home Screen</span>.
            It'll open full-screen and cache the exercise library for offline browsing.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
