import { Sparkles } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"

/**
 * §3.15 / FR-9.4 — one consistent pattern for "AI degraded" across equipment detection
 * and routine generation, so the user learns it once. Never a dead end: always names
 * the manual fallback that's already available on the same screen.
 */
type DegradeReason = "no_key" | "timeout" | "rate_limit" | "invalid_key"

export function AiDegradedAlert({
  reason = "no_key",
  onUseManual,
}: {
  reason?: DegradeReason
  onUseManual?: () => void
}) {
  const REASON_COPY: Record<DegradeReason, { title: string; body: string }> = {
    no_key: {
      title: "No AI provider configured",
      body: "Photo detection and AI-generated routines need a provider key. Everything below works fine manually in the meantime.",
    },
    timeout: {
      title: "AI request timed out",
      body: "Your provider didn't respond in time. Try again, or keep going manually — nothing you've entered is lost.",
    },
    rate_limit: {
      title: "Provider rate limit hit",
      body: "Your AI provider is throttling requests right now. Try again shortly, or continue manually.",
    },
    invalid_key: {
      title: "AI provider key rejected",
      body: "Check the key in Settings → AI provider. You can keep working manually until it's fixed.",
    },
  }
  const copy = REASON_COPY[reason]

  return (
    <Alert className="border-warning/40 bg-warning/10">
      <Sparkles className="size-4 text-warning" />
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>{copy.body}</span>
        <div className="flex gap-2">
          {onUseManual && (
            <Button size="sm" variant="secondary" className="h-9" onClick={onUseManual}>
              Continue manually
            </Button>
          )}
          {reason === "no_key" && (
            <Button size="sm" variant="outline" className="h-9" render={<Link to="/settings/ai" />} nativeButton={false}>
              Configure provider
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}
