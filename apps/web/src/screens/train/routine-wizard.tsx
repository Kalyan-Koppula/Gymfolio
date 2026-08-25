import * as React from "react"
import { useNavigate } from "react-router-dom"
import { TopBar } from "@/components/nav/top-bar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { StickyActionBar } from "@/components/shared/sticky-action-bar"
import { SaveButton } from "@/components/shared/save-button"
import { RoutineDaysEditor } from "@/components/shared/routine-days-editor"
import { SplitPicker } from "@/components/routine/split-picker"
import { SchedulePicker } from "@/components/routine/schedule-picker"
import { useScheduleState } from "@/hooks/use-schedule-state"
import { useApiWrite } from "@/hooks/use-api-write"
import { getSettings, saveRoutine } from "@/lib/api-client"
import {
  SPLIT_PRESETS,
  autofillDayExercises,
  describeSchedule,
  type Equipment,
  type RoutineDay,
  type SplitType,
} from "@/lib/stub-data"

const STEPS = ["Choose a split", "Schedule", "Review & edit days"]

export function RoutineWizard() {
  const navigate = useNavigate()
  const [step, setStep] = React.useState(0)
  const [splitType, setSplitType] = React.useState<SplitType | null>(null)
  const [equipment, setEquipment] = React.useState<Equipment[]>([])

  const scheduleState = useScheduleState(4)
  const { schedule } = scheduleState

  const [days, setDays] = React.useState<RoutineDay[]>([])
  const [activeDay, setActiveDay] = React.useState("")
  const { status, run } = useApiWrite("Routine saved as active")

  React.useEffect(() => {
    getSettings()
      .then((s) => setEquipment(s.equipment))
      .catch(() => {})
  }, [])

  function seedDays() {
    if (!splitType) return
    const preset = SPLIT_PRESETS.find((p) => p.id === splitType)!
    const labels =
      preset.dayLabels.length > 0
        ? preset.dayLabels
        : Array.from({ length: scheduleState.scheduleMode === "weekly" ? scheduleState.daysPerWeek : schedule.mode === "rotating" ? schedule.workDays : 3 }, (_, i) => `Day ${i + 1}`)
    const seeded: RoutineDay[] = labels.map((label, i) => ({
      id: `wizard-day-${i + 1}`,
      label,
      exercises: autofillDayExercises(label, equipment),
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
    if (!splitType) return
    run(
      () =>
        saveRoutine({
          name: `${SPLIT_PRESETS.find((p) => p.id === splitType)?.label} — ${describeSchedule(schedule)}`,
          splitType,
          schedule,
          days: days.map(({ id, label, exercises }) => ({
            id,
            label,
            exercises: exercises.map(({ exerciseId, targetSets, targetReps, targetWeightKg }) => ({
              exerciseId,
              targetSets,
              targetReps,
              targetWeightKg,
            })),
          })),
        }),
      () => navigate("/train/routine"),
    )
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
            <SplitPicker value={splitType} onChange={setSplitType} />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-semibold">Schedule</h1>
            <SchedulePicker {...scheduleState} />
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
