import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowUpDown,
  Check,
  LayoutGrid,
  PersonStanding,
  Repeat,
  Shuffle,
  Wrench,
  CalendarDays,
} from "lucide-react"
import { TopBar } from "@/components/nav/top-bar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { StickyActionBar } from "@/components/shared/sticky-action-bar"
import { SaveButton } from "@/components/shared/save-button"
import { NumberStepper } from "@/components/shared/number-stepper"
import { RoutineDaysEditor } from "@/components/shared/routine-days-editor"
import { useWriteStatus } from "@/hooks/use-write-status"
import {
  EQUIPMENT_PROFILE,
  ROTATING_PATTERNS,
  SPLIT_PRESETS,
  WEEKDAYS,
  autofillDayExercises,
  defaultWeekdaysFor,
  describeSchedule,
  type RoutineDay,
  type SchedulePattern,
  type SplitType,
} from "@/lib/stub-data"

const SPLIT_ICONS: Record<SplitType, typeof PersonStanding> = {
  full_body: PersonStanding,
  upper_lower: ArrowUpDown,
  push_pull_legs: Shuffle,
  bro_split: LayoutGrid,
  custom: Wrench,
}

const STEPS = ["Choose a split", "Schedule", "Review & edit days"]

export function RoutineWizard() {
  const navigate = useNavigate()
  const [step, setStep] = React.useState(0)
  const [splitType, setSplitType] = React.useState<SplitType | null>(null)

  const [scheduleMode, setScheduleMode] = React.useState<"weekly" | "rotating">("weekly")
  const [daysPerWeek, setDaysPerWeek] = React.useState(4)
  const [pinnedWeekdays, setPinnedWeekdays] = React.useState<string[]>(() => defaultWeekdaysFor(4))
  const [rotatingPattern, setRotatingPattern] = React.useState(ROTATING_PATTERNS[2]) // "3 on / 1 off"
  const [customWorkDays, setCustomWorkDays] = React.useState(3)
  const [customRestDays, setCustomRestDays] = React.useState(1)
  const [useCustomRotation, setUseCustomRotation] = React.useState(false)

  const [days, setDays] = React.useState<RoutineDay[]>([])
  const [activeDay, setActiveDay] = React.useState("")
  const { status, run } = useWriteStatus("Routine saved as active")

  const schedule: SchedulePattern =
    scheduleMode === "weekly"
      ? { mode: "weekly", daysPerWeek, pinnedWeekdays }
      : useCustomRotation
        ? { mode: "rotating", workDays: customWorkDays, restDays: customRestDays }
        : { mode: "rotating", workDays: rotatingPattern.workDays, restDays: rotatingPattern.restDays }

  function toggleWeekday(day: string) {
    setPinnedWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b))))
  }

  function seedDays() {
    if (!splitType) return
    const preset = SPLIT_PRESETS.find((p) => p.id === splitType)!
    const labels =
      preset.dayLabels.length > 0
        ? preset.dayLabels
        : Array.from({ length: scheduleMode === "weekly" ? daysPerWeek : schedule.mode === "rotating" ? schedule.workDays : 3 }, (_, i) => `Day ${i + 1}`)
    const seeded: RoutineDay[] = labels.map((label, i) => ({
      id: `wizard-day-${i + 1}`,
      label,
      exercises: autofillDayExercises(label, EQUIPMENT_PROFILE.tags),
    }))
    setDays(seeded)
    setActiveDay(seeded[0]?.id ?? "")
  }

  function next() {
    if (step === 1) seedDays()
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function back() {
    if (step === 0) navigate("/train/routine")
    else setStep((s) => s - 1)
  }

  function handleSave() {
    run(() => navigate("/train/routine"))
  }

  return (
    <div>
      <TopBar title="New routine" />
      <div className="mx-auto max-w-md px-4 py-4 pb-28">
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </p>
          <Progress value={((step + 1) / STEPS.length) * 100} />
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <h1 className="font-heading text-xl font-semibold">Choose a split</h1>
            <p className="text-sm text-muted-foreground">
              Sets the starting day structure — fully editable afterward.
            </p>
            <div className="space-y-2.5">
              {SPLIT_PRESETS.map((preset) => {
                const Icon = SPLIT_ICONS[preset.id]
                const selected = splitType === preset.id
                return (
                  <button
                    key={preset.id}
                    onClick={() => setSplitType(preset.id)}
                    className="flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-150 active:scale-[0.99]"
                    style={{ borderColor: selected ? "var(--primary)" : "var(--border)", backgroundColor: selected ? "var(--accent)" : "transparent" }}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{preset.label}</p>
                        {selected && <Check className="size-4 shrink-0 text-primary" />}
                      </div>
                      <p className="text-sm text-muted-foreground">{preset.description}</p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">{preset.recommendedDays}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-semibold">Schedule</h1>
            <div className="flex gap-2">
              <Button
                variant={scheduleMode === "weekly" ? "default" : "outline"}
                size="sm"
                className="h-9 flex-1"
                onClick={() => setScheduleMode("weekly")}
              >
                <CalendarDays className="size-3.5" /> Weekly
              </Button>
              <Button
                variant={scheduleMode === "rotating" ? "default" : "outline"}
                size="sm"
                className="h-9 flex-1"
                onClick={() => setScheduleMode("rotating")}
              >
                <Repeat className="size-3.5" /> Rotating cycle
              </Button>
            </div>

            {scheduleMode === "weekly" ? (
              <Card>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Days per week</Label>
                    <NumberStepper
                      value={daysPerWeek}
                      onChange={(v) => {
                        setDaysPerWeek(v)
                        setPinnedWeekdays(defaultWeekdaysFor(v))
                      }}
                      min={1}
                      size="compact"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Pinned weekdays
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map((d) => {
                        const active = pinnedWeekdays.includes(d)
                        return (
                          <button
                            key={d}
                            onClick={() => toggleWeekday(d)}
                            className="h-9 rounded-full border px-3 text-sm font-medium transition-all duration-150 active:scale-95"
                            style={{
                              borderColor: active ? "var(--primary)" : "var(--border)",
                              backgroundColor: active ? "var(--primary)" : "transparent",
                              color: active ? "var(--primary-foreground)" : "var(--foreground)",
                            }}
                          >
                            {d}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Rotates independently of the calendar — e.g. "3 on / 1 off" repeats every 4th
                    day regardless of weekday.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {ROTATING_PATTERNS.map((p) => {
                      const selected = !useCustomRotation && rotatingPattern.label === p.label
                      return (
                        <button
                          key={p.label}
                          onClick={() => {
                            setRotatingPattern(p)
                            setUseCustomRotation(false)
                          }}
                          className="h-11 rounded-lg border text-sm font-medium transition-all duration-150 active:scale-95"
                          style={{
                            borderColor: selected ? "var(--primary)" : "var(--border)",
                            backgroundColor: selected ? "var(--primary)" : "transparent",
                            color: selected ? "var(--primary-foreground)" : "var(--foreground)",
                          }}
                        >
                          {p.label}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setUseCustomRotation(true)}
                      className="h-11 rounded-lg border text-sm font-medium transition-all duration-150 active:scale-95"
                      style={{
                        borderColor: useCustomRotation ? "var(--primary)" : "var(--border)",
                        backgroundColor: useCustomRotation ? "var(--primary)" : "transparent",
                        color: useCustomRotation ? "var(--primary-foreground)" : "var(--foreground)",
                      }}
                    >
                      Custom
                    </button>
                  </div>
                  {useCustomRotation && (
                    <div className="flex items-center justify-around rounded-lg bg-muted/40 p-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">Work days</span>
                        <NumberStepper value={customWorkDays} onChange={setCustomWorkDays} min={1} size="compact" />
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs text-muted-foreground">Rest days</span>
                        <NumberStepper value={customRestDays} onChange={setCustomRestDays} min={1} size="compact" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h1 className="font-heading text-xl font-semibold">Review & edit days</h1>
              <p className="text-sm text-muted-foreground">
                {splitType && SPLIT_PRESETS.find((p) => p.id === splitType)?.label} · {describeSchedule(schedule)}
              </p>
            </div>
            <RoutineDaysEditor days={days} setDays={setDays} activeDay={activeDay} onActiveDayChange={setActiveDay} />
          </div>
        )}
      </div>

      <StickyActionBar>
        <div className="flex gap-2">
          <Button variant="ghost" className="h-12" onClick={back}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button className="h-12 flex-1 text-base" onClick={next} disabled={step === 0 && !splitType}>
              Continue
            </Button>
          ) : (
            <SaveButton status={status} onClick={handleSave} idleLabel="Save as active routine" className="h-12 flex-1 text-base" />
          )}
        </div>
      </StickyActionBar>
    </div>
  )
}
