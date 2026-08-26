import * as React from "react"
import { toast } from "sonner"
import { Camera, Check, Sparkles } from "lucide-react"
import { TopBar } from "@/components/nav/top-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { StickyActionBar } from "@/components/shared/sticky-action-bar"
import { SaveButton } from "@/components/shared/save-button"
import { AiDegradedAlert } from "@/components/shared/ai-degraded-alert"
import { useApiWrite } from "@/hooks/use-api-write"
import { useAiProvider } from "@/contexts/ai-provider-context"
import { getSettings, saveSettings, detectEquipment } from "@/lib/api-client"
import { EQUIPMENT_LABELS, type Equipment } from "@/lib/stub-data"
import type { UserSettings } from "shared"

const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[]

export function EquipmentProfile() {
  const { configured: aiConfigured } = useAiProvider()
  const [settings, setSettings] = React.useState<UserSettings | null>(null)
  const [selected, setSelected] = React.useState<Set<Equipment>>(new Set())
  // Provenance isn't persisted server-side — it only reflects what happened in this session,
  // defaulting to "manual" for whatever was already saved since there's no history of how it
  // originally got there.
  const [source, setSource] = React.useState<"ai_detected" | "manual">("manual")
  const { status, run } = useApiWrite<UserSettings>("Equipment profile saved")

  React.useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s)
        setSelected(new Set(s.equipment))
      })
      .catch(() => toast.error("Couldn't load your equipment profile"))
  }, [])

  function toggle(eq: Equipment) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(eq)) next.delete(eq)
      else next.add(eq)
      return next
    })
    setSource("manual")
  }

  async function runDetection() {
    try {
      const res = await detectEquipment()
      if (res.degraded || res.equipment.length === 0) {
        toast.message(res.reason ?? "AI unavailable — adjust manually")
        return
      }
      setSelected(new Set(res.equipment))
      setSource("ai_detected")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Detection failed")
    }
  }

  function handleSave() {
    if (!settings) return
    run(
      () =>
        saveSettings({
          hydrationGoalMl: settings.hydrationGoalMl,
          macroMode: settings.macroMode,
          bodyweightKg: settings.bodyweightKg,
          macroTargets: settings.macroTargets,
          equipment: Array.from(selected),
        }),
      setSettings,
    )
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
          {!settings ? (
            <div className="flex flex-wrap gap-2">
              {ALL_EQUIPMENT.map((eq) => (
                <Skeleton key={eq} className="h-10 w-24 rounded-full" />
              ))}
            </div>
          ) : (
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
          )}
        </div>

        <Badge variant="outline" className="text-xs">
          Source: {source === "ai_detected" ? "AI detected" : "Manual"}
        </Badge>
      </div>

      <StickyActionBar>
        <SaveButton status={status} onClick={handleSave} idleLabel="Save equipment profile" className="w-full" />
      </StickyActionBar>
    </div>
  )
}
