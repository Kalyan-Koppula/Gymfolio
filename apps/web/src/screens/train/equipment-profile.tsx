import * as React from "react"
import { Camera, Check, Sparkles } from "lucide-react"
import { TopBar } from "@/components/nav/top-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StickyActionBar } from "@/components/shared/sticky-action-bar"
import { SaveButton } from "@/components/shared/save-button"
import { AiDegradedAlert } from "@/components/shared/ai-degraded-alert"
import { useWriteStatus } from "@/hooks/use-write-status"
import { useAiProvider } from "@/contexts/ai-provider-context"
import { EQUIPMENT_LABELS, EQUIPMENT_PROFILE, type Equipment } from "@/lib/stub-data"

const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[]

export function EquipmentProfile() {
  const { configured: aiConfigured } = useAiProvider()
  const [selected, setSelected] = React.useState<Set<Equipment>>(new Set(EQUIPMENT_PROFILE.tags))
  const [source, setSource] = React.useState(EQUIPMENT_PROFILE.source)
  const { status, run } = useWriteStatus("Equipment profile saved")

  function toggle(eq: Equipment) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(eq)) next.delete(eq)
      else next.add(eq)
      return next
    })
    setSource("manual")
  }

  function runDetection() {
    setSelected(new Set(["barbell", "dumbbell", "bench", "pull-up-bar", "cable-machine", "squat-rack"]))
    setSource("ai_detected")
  }

  return (
    <div>
      <TopBar title="Equipment profile" />
      <div className="space-y-5 px-4 py-4 pb-24">
        <p className="text-sm text-muted-foreground">
          This filters the exercise library and routine builder down to what you can actually use.
        </p>

        {!aiConfigured && <AiDegradedAlert reason="no_key" />}

        {aiConfigured && (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Camera className="size-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Re-scan your equipment</p>
                <p className="text-xs text-muted-foreground">Upload a new photo to re-run detection</p>
              </div>
              <Button variant="outline" size="sm" className="h-9" onClick={runDetection}>
                Upload
              </Button>
            </CardContent>
          </Card>
        )}

        {source === "ai_detected" && (
          <div className="flex items-center gap-2 rounded-lg bg-success/15 px-3 py-2 text-sm text-success">
            <Sparkles className="size-4" /> AI-detected — review and adjust below.
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Available equipment
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_EQUIPMENT.map((eq) => {
              const active = selected.has(eq)
              return (
                <button
                  key={eq}
                  onClick={() => toggle(eq)}
                  className="flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-all duration-150 active:scale-95"
                  style={{
                    borderColor: active ? "var(--primary)" : "var(--border)",
                    backgroundColor: active ? "var(--primary)" : "transparent",
                    color: active ? "var(--primary-foreground)" : "var(--foreground)",
                  }}
                >
                  {active && <Check className="size-3.5" />}
                  {EQUIPMENT_LABELS[eq]}
                </button>
              )
            })}
          </div>
        </div>

        <Badge variant="outline" className="text-xs">
          Source: {source === "ai_detected" ? "AI detected" : "Manual"}
        </Badge>
      </div>

      <StickyActionBar>
        <SaveButton status={status} onClick={() => run()} idleLabel="Save equipment profile" className="w-full" />
      </StickyActionBar>
    </div>
  )
}
