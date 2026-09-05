import * as React from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { ListChecks, Loader2, MoreVertical, Repeat, RotateCcw, Sparkles } from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { StickyActionBar } from "@/components/shared/sticky-action-bar"
import { SaveButton } from "@/components/shared/save-button"
import { AiDegradedAlert } from "@/components/shared/ai-degraded-alert"
import { EmptyState } from "@/components/shared/empty-state"
import { RoutineDaysEditor } from "@/components/shared/routine-days-editor"
import { SplitPicker } from "@/components/routine/split-picker"
import { useApiWrite } from "@/hooks/use-api-write"
import { useAiProvider } from "@/contexts/ai-provider-context"
import { getRoutine, getSettings, saveRoutine, generateRoutineAi } from "@/lib/api-client"
import { fetchExercises } from "@/hooks/use-exercises"
import {
  SPLIT_PRESETS,
  activeDays,
  applySplitInPlace,
  autofillDayExercises,
  describeSchedule,
  normalizeRoutineDay,
  splitPreset,
  toSaveRoutineDays,
  type Equipment,
  type RoutineDay,
  type SplitType,
} from "@/lib/stub-data"
import type { Routine } from "shared"

export function RoutineBuilder() {
  const navigate = useNavigate()
  const { configured: aiConfigured } = useAiProvider()

  // undefined = still loading, null = confirmed no routine exists yet
  const [routine, setRoutine] = React.useState<Routine | null | undefined>(undefined)
  const [equipment, setEquipment] = React.useState<Equipment[]>([])
  const [days, setDays] = React.useState<RoutineDay[]>([])
  const [activeDay, setActiveDay] = React.useState("")
  // Provenance isn't persisted — defaults to "manual" for whatever was loaded, switches to
  // "ai" only for a generation that happened in this session.
  const [createdVia, setCreatedVia] = React.useState<"ai" | "manual">("manual")

  const [splitDialogOpen, setSplitDialogOpen] = React.useState(false)
  const [pendingSplit, setPendingSplit] = React.useState<SplitType | null>(null)
  const [aiDialogOpen, setAiDialogOpen] = React.useState(false)
  const [aiSplitType, setAiSplitType] = React.useState<SplitType | "ai_choice">("ai_choice")
  const [generating, setGenerating] = React.useState(false)
  const [genProgress, setGenProgress] = React.useState(0)
  const { status, run } = useApiWrite<{ routine: Routine }>("Routine saved as active")

  React.useEffect(() => {
    getRoutine()
      .then((res) => {
        setRoutine(res.routine)
        if (res.routine) {
          // Archived days stay in state so they're saved back (and stay undo-able).
          setDays(res.routine.days)
          setActiveDay(activeDays(res.routine.days)[0]?.id ?? "")
        }
      })
      .catch(() => {
        setRoutine(null)
        toast.error("Couldn't load your routine")
      })
    getSettings()
      .then((s) => setEquipment(s.equipment))
      .catch(() => {})
  }, [])

  async function runGeneration() {
    setGenerating(true)
    setGenProgress(8)
    const tick = window.setInterval(() => {
      setGenProgress((p) => (p >= 92 ? p : p + (92 - p) * 0.25))
    }, 180)

    try {
      const splitType = aiSplitType === "ai_choice" ? "upper_lower" : aiSplitType
      const preset = SPLIT_PRESETS.find((p) => p.id === splitType)!
      const pool = await fetchExercises()
      const ai = await generateRoutineAi({
        splitType,
        equipment,
        dayLabels: preset.dayLabels,
      })

      window.clearInterval(tick)
      setGenProgress(100)

      let generated: RoutineDay[]
      if (ai.degraded || !ai.days) {
        toast.message(ai.reason ?? "AI unavailable — using equipment-based fill")
        generated = preset.dayLabels.map((label, i) =>
          normalizeRoutineDay(
            { id: `generated-day-${i + 1}`, label, exercises: autofillDayExercises(label, equipment, pool) },
            i,
          ),
        )
      } else {
        generated = ai.days.map((d, i) =>
          normalizeRoutineDay(
            {
              id: `generated-day-${i + 1}`,
              label: d.label,
              exercises: d.exerciseIds.map((exerciseId) => ({
                exerciseId,
                targetSets: 3,
                targetReps: "8-12",
              })),
            },
            i,
          ),
        )
      }

      setDays(generated)
      setActiveDay(generated[0]?.id ?? "")
      setCreatedVia("ai")
      setRoutine((prev) => ({
        name: `${preset.label} — AI-generated`,
        splitType,
        schedule: prev?.schedule ?? { mode: "rotating", workDays: 4, restDays: 1 },
        days: generated,
        updatedAt: Date.now(),
      }))
    } catch {
      window.clearInterval(tick)
      toast.error("Couldn't generate a routine")
    } finally {
      setGenerating(false)
      setAiDialogOpen(false)
    }
  }

  const genStage =
    genProgress < 35
      ? "Reading your equipment-filtered exercise pool…"
      : genProgress < 75
        ? "Drafting your split…"
        : "Validating every exercise against the library…"

  function openSplitDialog() {
    setPendingSplit(routine?.splitType ?? null)
    setSplitDialogOpen(true)
  }

  /**
   * Re-labels the existing days in place and carries exercises across by muscle-focus overlap,
   * so switching split doesn't throw away work the way rebuilding from the wizard does.
   */
  function confirmSplitChange() {
    if (!routine || !pendingSplit) return
    const next = applySplitInPlace(days, pendingSplit, routine.schedule)
    setDays(next)
    const preset = splitPreset(pendingSplit)
    setRoutine({ ...routine, splitType: pendingSplit, name: `${preset.label} — ${describeSchedule(routine.schedule)}`, days: next })
    setSplitDialogOpen(false)
    toast.success(`Switched to ${preset.label} — save to keep it`)
  }

  function handleSave() {
    if (!routine) return
    run(
      () =>
        saveRoutine({
          name: routine.name,
          splitType: routine.splitType,
          schedule: routine.schedule,
          days: toSaveRoutineDays(days),
        }),
      (res) => setRoutine(res.routine),
    )
  }

  const activePreset = routine ? splitPreset(routine.splitType) : null

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
              <DropdownMenuItem onClick={openSplitDialog} disabled={routine == null}>
                <Repeat className="size-4" /> Change split
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/train/routine/new")}>
                <RotateCcw className="size-4" /> Rebuild routine from scratch
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

      <Dialog open={splitDialogOpen} onOpenChange={setSplitDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Repeat className="size-4 text-primary" /> Change split
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Days are re-labelled in place and exercises carry over where the muscle focus still
            matches. Days that no longer fit are archived, not deleted.
          </p>
          <div className="py-1">
            <SplitPicker value={pendingSplit} onChange={setPendingSplit} />
          </div>
          <DialogFooter>
            <Button variant="ghost" className="h-11" onClick={() => setSplitDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="h-11 text-base"
              onClick={confirmSplitChange}
              disabled={!pendingSplit || pendingSplit === routine?.splitType}
            >
              Apply split
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

        {routine === undefined ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : routine === null ? (
          <EmptyState
            icon={ListChecks}
            title="No active routine yet"
            description="Build one manually, or let AI propose a split from your equipment — either way, editable before you save it."
            actionLabel="Build a routine"
            onAction={() => navigate("/train/routine/new")}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Active routine</p>
                <p className="font-heading text-lg font-semibold">{routine.name}</p>
                <p className="text-xs text-muted-foreground">
                  {activePreset?.label} · {describeSchedule(routine.schedule)}
                </p>
              </div>
              <Badge variant={createdVia === "ai" ? "default" : "secondary"}>
                {createdVia === "ai" ? "AI-generated" : "Manual"}
              </Badge>
            </div>

            <RoutineDaysEditor
              days={days}
              setDays={setDays}
              activeDay={activeDay}
              onActiveDayChange={setActiveDay}
              equipment={equipment}
              allowDayMutations={routine.schedule.mode === "weekly"}
            />
          </>
        )}
      </div>

      {routine != null && (
        <StickyActionBar>
          <SaveButton status={status} onClick={handleSave} idleLabel="Save as active routine" className="w-full" />
        </StickyActionBar>
      )}
    </div>
  )
}
