import * as React from "react"
import { useNavigate } from "react-router-dom"
import { Loader2, MoreVertical, Repeat, Sparkles } from "lucide-react"
import { TopBar } from "@/components/nav/top-bar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { StickyActionBar } from "@/components/shared/sticky-action-bar"
import { SaveButton } from "@/components/shared/save-button"
import { AiDegradedAlert } from "@/components/shared/ai-degraded-alert"
import { RoutineDaysEditor } from "@/components/shared/routine-days-editor"
import { useWriteStatus } from "@/hooks/use-write-status"
import { useAiProvider } from "@/contexts/ai-provider-context"
import {
  ACTIVE_ROUTINE,
  SPLIT_PRESETS,
  describeSchedule,
  splitPreset,
  type RoutineDay,
  type SplitType,
} from "@/lib/stub-data"

function cloneDays(): RoutineDay[] {
  return ACTIVE_ROUTINE.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }))
}

export function RoutineBuilder() {
  const navigate = useNavigate()
  const { configured: aiConfigured } = useAiProvider()
  const [days, setDays] = React.useState<RoutineDay[]>(cloneDays)
  const [activeDay, setActiveDay] = React.useState(days[0].id)
  const [aiDialogOpen, setAiDialogOpen] = React.useState(false)
  const [aiSplitType, setAiSplitType] = React.useState<SplitType | "ai_choice">(ACTIVE_ROUTINE.splitType)
  const [generating, setGenerating] = React.useState(false)
  const [genProgress, setGenProgress] = React.useState(0)
  const { status, run } = useWriteStatus("Routine saved as active")

  function runGeneration() {
    setGenerating(true)
    setGenProgress(8)
    // Ticks toward ~92% rather than jumping straight to 100 — a static bar (or one that
    // snaps to done) reads as fake; an eased climb reads as real work in progress.
    const tick = window.setInterval(() => {
      setGenProgress((p) => (p >= 92 ? p : p + (92 - p) * 0.25))
    }, 180)
    window.setTimeout(() => {
      window.clearInterval(tick)
      setGenProgress(100)
      window.setTimeout(() => {
        setDays(cloneDays())
        setGenerating(false)
        setAiDialogOpen(false)
      }, 200)
    }, 2200)
  }

  const genStage =
    genProgress < 35
      ? "Reading your equipment-filtered exercise pool…"
      : genProgress < 75
        ? "Drafting your split…"
        : "Validating every exercise against the library…"

  const activePreset = splitPreset(ACTIVE_ROUTINE.splitType)

  return (
    <div>
      <TopBar
        title="Routine builder"
        action={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon" className="size-9" aria-label="Routine actions" />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate("/train/routine/new")}>
                <Repeat className="size-4" /> Change split
              </DropdownMenuItem>
              {aiConfigured && (
                <DropdownMenuItem onClick={() => setAiDialogOpen(true)}>
                  <Sparkles className="size-4" /> Generate with AI
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {aiConfigured && (
        <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            {!generating ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-1.5">
                    <Sparkles className="size-4 text-primary" /> Generate a split
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label>Split type</Label>
                    <Select
                      value={aiSplitType}
                      onValueChange={(v) => setAiSplitType(v as SplitType | "ai_choice")}
                      items={Object.fromEntries([
                        ["ai_choice", "Let AI choose"],
                        ...SPLIT_PRESETS.filter((p) => p.id !== "custom").map((p) => [p.id, p.label]),
                      ])}
                    >
                      <SelectTrigger className="h-11 w-full text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ai_choice">Let AI choose</SelectItem>
                        {SPLIT_PRESETS.filter((p) => p.id !== "custom").map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Goal</Label>
                    <Select
                      defaultValue="muscle_gain"
                      items={{ fat_loss: "Fat loss", muscle_gain: "Muscle gain", general_fitness: "General fitness" }}
                    >
                      <SelectTrigger className="h-11 w-full text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fat_loss">Fat loss</SelectItem>
                        <SelectItem value="muscle_gain">Muscle gain</SelectItem>
                        <SelectItem value="general_fitness">General fitness</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Training days / week</Label>
                    <Select
                      defaultValue="4"
                      items={Object.fromEntries([2, 3, 4, 5, 6].map((n) => [String(n), `${n} days`]))}
                    >
                      <SelectTrigger className="h-11 w-full text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 3, 4, 5, 6].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} days
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Experience level</Label>
                    <Select
                      defaultValue="intermediate"
                      items={{ beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" }}
                    >
                      <SelectTrigger className="h-11 w-full text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button className="h-11 w-full text-base" onClick={runGeneration}>
                    Generate routine
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <Loader2 className="size-8 animate-spin text-primary" />
                <div className="w-full space-y-2">
                  <Progress value={genProgress} />
                  <p key={genStage} className="text-sm font-medium animate-in fade-in duration-200">
                    {genStage}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Constrained to your equipment-filtered exercise pool — every exercise shown is
                    guaranteed to exist in the library.
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      <div className="space-y-4 px-4 py-4 pb-28">
        {!aiConfigured && <AiDegradedAlert reason="no_key" />}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Active routine</p>
            <p className="font-heading text-lg font-semibold">{ACTIVE_ROUTINE.name}</p>
            <p className="text-xs text-muted-foreground">
              {activePreset.label} · {describeSchedule(ACTIVE_ROUTINE.schedule)}
            </p>
          </div>
          <Badge variant={ACTIVE_ROUTINE.createdVia === "ai" ? "default" : "secondary"}>
            {ACTIVE_ROUTINE.createdVia === "ai" ? "AI-generated" : "Manual"}
          </Badge>
        </div>

        <RoutineDaysEditor days={days} setDays={setDays} activeDay={activeDay} onActiveDayChange={setActiveDay} />
      </div>

      <StickyActionBar>
        <SaveButton status={status} onClick={() => run()} idleLabel="Save as active routine" className="w-full" />
      </StickyActionBar>
    </div>
  )
}
