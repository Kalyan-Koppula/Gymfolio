import * as React from "react"
import { useNavigate } from "react-router-dom"
import { AlertCircle, Camera, Check, Dumbbell, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AiDegradedAlert } from "@/components/shared/ai-degraded-alert"
import { RoutineDaysEditor } from "@/components/shared/routine-days-editor"
import { SplitPicker } from "@/components/routine/split-picker"
import { SchedulePicker } from "@/components/routine/schedule-picker"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { useApiWrite } from "@/hooks/use-api-write"
import { useScheduleState } from "@/hooks/use-schedule-state"
import { useAiProvider } from "@/contexts/ai-provider-context"
import { useSession } from "@/contexts/session-context"
import {
  EQUIPMENT_LABELS,
  SPLIT_PRESETS,
  autofillDayExercises,
  describeSchedule,
  type Equipment,
  type RoutineDay,
  type SplitType,
} from "@/lib/stub-data"
import { register, saveSettings, saveRoutine, detectEquipment, ApiError } from "@/lib/api-client"
import { fetchExercises } from "@/hooks/use-exercises"

const STEPS = ["Account", "Hydration goal", "Macro target", "Equipment", "Split", "Schedule", "Review & edit days"]
const [ACCOUNT, HYDRATION, MACRO, EQUIPMENT, SPLIT, SCHEDULE, REVIEW] = [0, 1, 2, 3, 4, 5, 6]
const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[]

export function Onboarding() {
  const navigate = useNavigate()
  const { configured: aiConfigured } = useAiProvider()
  const online = useOnlineStatus()
  // Reached two ways: a fresh instance's very first visitor (no session yet — they create the
  // owner account here) or a family member who just accepted an invite via /join (already has
  // a session by the time they land here) — the latter skips straight to personalization so
  // the account-creation step isn't shown twice.
  const { user, loading: sessionLoading, setUser } = useSession()
  const [step, setStep] = React.useState(0)
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [accountStatus, setAccountStatus] = React.useState<"idle" | "saving" | "error">("idle")
  const [accountError, setAccountError] = React.useState("")

  const [hydrationGoal, setHydrationGoal] = React.useState(3000)

  const [macroMode, setMacroMode] = React.useState<"computed" | "manual">("computed")
  const [bodyweight, setBodyweight] = React.useState(78)
  const [manualCalories, setManualCalories] = React.useState(2400)
  const [manualProtein, setManualProtein] = React.useState(180)
  const [manualCarbs, setManualCarbs] = React.useState(240)
  const [manualFat, setManualFat] = React.useState(70)

  const [detectState, setDetectState] = React.useState<"idle" | "detecting" | "done">("idle")
  const [selectedEquipment, setSelectedEquipment] = React.useState<Set<Equipment>>(new Set())

  const [splitType, setSplitType] = React.useState<SplitType | null>(null)
  const scheduleState = useScheduleState(4)
  const { schedule } = scheduleState
  const [days, setDays] = React.useState<RoutineDay[]>([])
  const [activeDay, setActiveDay] = React.useState("")

  const { status: finishStatus, run: runFinish } = useApiWrite("You're all set!")
  const { status: skipStatus, run: runSkip } = useApiWrite("Settings saved")

  // A standard bodyweight-based estimate (2.0g/kg protein, 0.8g/kg fat, 30kcal/kg total,
  // carbs fill the remainder) — computed transparently from what was just entered, not a
  // fixed stub every user would otherwise see regardless of their answer.
  const computedProtein = Math.round(bodyweight * 2.0)
  const computedFat = Math.round(bodyweight * 0.8)
  const computedCalories = Math.round(bodyweight * 30)
  const computedCarbs = Math.max(0, Math.round((computedCalories - computedProtein * 4 - computedFat * 9) / 4))

  const macroTargets =
    macroMode === "computed"
      ? { calories: computedCalories, protein: computedProtein, carbs: computedCarbs, fat: computedFat }
      : { calories: manualCalories, protein: manualProtein, carbs: manualCarbs, fat: manualFat }

  // useLayoutEffect (not useEffect) so this resolves before paint — otherwise a family member
  // arriving via /join would see a one-frame flash of the account-creation step.
  React.useLayoutEffect(() => {
    if (!sessionLoading && user) setStep((s) => (s === ACCOUNT ? HYDRATION : s))
  }, [sessionLoading, user])

  async function createAccount() {
    if (!online) {
      setAccountStatus("error")
      setAccountError("You're offline — check your connection and try again.")
      return
    }
    setAccountStatus("saving")
    try {
      const { user } = await register({ username, password })
      setUser(user)
      setAccountStatus("idle")
      setStep(HYDRATION)
    } catch (err) {
      setAccountStatus("error")
      setAccountError(err instanceof ApiError ? err.message : "Couldn't create your account — try again.")
    }
  }

  async function seedDays() {
    if (!splitType) return
    const preset = SPLIT_PRESETS.find((p) => p.id === splitType)!
    const labels =
      preset.dayLabels.length > 0
        ? preset.dayLabels
        : Array.from(
            { length: scheduleState.scheduleMode === "weekly" ? scheduleState.daysPerWeek : schedule.mode === "rotating" ? schedule.workDays : 3 },
            (_, i) => `Day ${i + 1}`,
          )
    const equipment = Array.from(selectedEquipment)
    const pool = await fetchExercises()
    const seeded: RoutineDay[] = labels.map((label, i) => ({
      id: `onboarding-day-${i + 1}`,
      label,
      exercises: autofillDayExercises(label, equipment, pool),
    }))
    setDays(seeded)
    setActiveDay(seeded[0]?.id ?? "")
  }

  function finishWithRoutine() {
    if (!splitType) return
    runFinish(async () => {
      await saveSettings({ hydrationGoalMl: hydrationGoal, macroMode, bodyweightKg: bodyweight, macroTargets, equipment: Array.from(selectedEquipment), completeOnboarding: true })
      await saveRoutine({
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
      })
    }, () => navigate("/today"))
  }

  function skipWorkoutSetup() {
    runSkip(
      () =>
        saveSettings({
          hydrationGoalMl: hydrationGoal,
          macroMode,
          bodyweightKg: bodyweight,
          macroTargets,
          equipment: Array.from(selectedEquipment),
          completeOnboarding: true,
        }),
      () => navigate("/today"),
    )
  }

  async function next() {
    if (step === ACCOUNT) {
      void createAccount()
      return
    }
    if (step === SCHEDULE) {
      await seedDays()
      setStep(REVIEW)
      return
    }
    if (step === REVIEW) {
      finishWithRoutine()
      return
    }
    setStep((s) => s + 1)
  }

  async function runDetection() {
    setDetectState("detecting")
    try {
      const res = await detectEquipment()
      if (res.degraded || res.equipment.length === 0) {
        setSelectedEquipment(new Set<Equipment>(["barbell", "dumbbell", "bench", "squat-rack"]))
      } else {
        setSelectedEquipment(new Set(res.equipment))
      }
      setDetectState("done")
    } catch {
      setDetectState("idle")
    }
  }

  function toggleEquipment(eq: Equipment) {
    setSelectedEquipment((prev) => {
      const next = new Set(prev)
      if (next.has(eq)) next.delete(eq)
      else next.add(eq)
      return next
    })
  }

  // Avoids a flash of the account-creation step for someone who arrived with a session already
  // (via /join) before the effect above has a chance to bump past it.
  if (sessionLoading) return null

  const isSaving = accountStatus === "saving" || finishStatus === "saving"

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col px-6 py-8" style={{ paddingTop: "var(--safe-top)" }}>
      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Dumbbell className="size-4" />
          <span>
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </span>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} />
      </div>

      <div key={step} className="flex-1 space-y-5 animate-in fade-in slide-in-from-right-3 duration-200 ease-out">
        {step === ACCOUNT && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-semibold">Create the family admin account</h1>
            <p className="text-sm text-muted-foreground">
              You're the first person here, so this account becomes the admin — you'll be able to
              invite family members once you're set up.
            </p>
            {accountStatus === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Couldn't create your account</AlertTitle>
                <AlertDescription>{accountError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ob-username">Username</Label>
              <Input
                id="ob-username"
                className="h-11 text-base"
                placeholder="kalyan"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-password">Password</Label>
              <Input
                id="ob-password"
                type="password"
                className="h-11 text-base"
                placeholder="At least 12 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === HYDRATION && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-semibold">Set a daily hydration goal</h1>
            <p className="text-sm text-muted-foreground">You can change this anytime in Log → Hydration.</p>
            <div className="grid grid-cols-3 gap-2">
              {[2000, 2500, 3000, 3500, 4000].map((ml) => (
                <button
                  key={ml}
                  onClick={() => setHydrationGoal(ml)}
                  className="h-11 rounded-lg border text-sm font-medium transition-all duration-150 active:scale-95"
                  style={{
                    borderColor: hydrationGoal === ml ? "var(--primary)" : "var(--border)",
                    backgroundColor: hydrationGoal === ml ? "var(--primary)" : "transparent",
                    color: hydrationGoal === ml ? "var(--primary-foreground)" : "var(--foreground)",
                  }}
                >
                  {(ml / 1000).toFixed(1)} L
                </button>
              ))}
              <Input
                type="number"
                value={hydrationGoal}
                onChange={(e) => setHydrationGoal(Number(e.target.value))}
                className="h-11 text-center text-base"
              />
            </div>
          </div>
        )}

        {step === MACRO && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-semibold">Set a daily protein/macro target</h1>
            <div className="flex gap-2">
              <Button
                variant={macroMode === "computed" ? "default" : "outline"}
                size="sm"
                className="h-9 flex-1"
                onClick={() => setMacroMode("computed")}
              >
                Compute from bodyweight
              </Button>
              <Button
                variant={macroMode === "manual" ? "default" : "outline"}
                size="sm"
                className="h-9 flex-1"
                onClick={() => setMacroMode("manual")}
              >
                Set manually
              </Button>
            </div>
            {macroMode === "computed" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bw">Bodyweight (kg)</Label>
                  <Input
                    id="bw"
                    type="number"
                    value={bodyweight}
                    onChange={(e) => setBodyweight(Number(e.target.value))}
                    className="h-11 text-base"
                  />
                </div>
                <Card className="bg-muted/40 py-3">
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <p>
                      Calories: <span className="font-semibold">{computedCalories}/day</span>
                    </p>
                    <p>
                      Protein: <span className="font-semibold">{computedProtein}g/day</span>
                    </p>
                    <p>
                      Carbs: <span className="font-semibold">{computedCarbs}g/day</span>
                    </p>
                    <p>
                      Fat: <span className="font-semibold">{computedFat}g/day</span>
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Calories</Label>
                  <Input
                    type="number"
                    className="h-11 text-base"
                    value={manualCalories}
                    onChange={(e) => setManualCalories(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Protein (g)</Label>
                  <Input
                    type="number"
                    className="h-11 text-base"
                    value={manualProtein}
                    onChange={(e) => setManualProtein(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Carbs (g)</Label>
                  <Input
                    type="number"
                    className="h-11 text-base"
                    value={manualCarbs}
                    onChange={(e) => setManualCarbs(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fat (g)</Label>
                  <Input
                    type="number"
                    className="h-11 text-base"
                    value={manualFat}
                    onChange={(e) => setManualFat(Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {step === EQUIPMENT && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-semibold">What equipment do you have?</h1>
            <p className="text-sm text-muted-foreground">
              This filters the exercise library and routine builder to what you can actually use.
            </p>

            {!aiConfigured && (
              <AiDegradedAlert reason="no_key" />
            )}

            {aiConfigured && detectState !== "done" && (
              <Card className="border-dashed py-6">
                <CardContent className="flex flex-col items-center gap-3 text-center">
                  {detectState === "detecting" ? (
                    <>
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <p className="text-sm font-medium">Analyzing your photo…</p>
                      <p className="text-xs text-muted-foreground">Detecting equipment against a fixed taxonomy</p>
                    </>
                  ) : (
                    <>
                      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                        <Camera className="size-6 text-primary" />
                      </div>
                      <p className="text-sm font-medium">Upload a photo of your gym/home setup</p>
                      <Button onClick={runDetection} className="h-11 px-5 text-base">
                        <Camera className="size-4" /> Take or upload photo
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {detectState === "done" && (
              <div className="flex items-center gap-2 rounded-lg bg-success/15 px-3 py-2 text-sm text-success">
                <Sparkles className="size-4" />
                Detected 4 items — review and adjust below.
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {aiConfigured ? "Confirm or adjust" : "Select manually"}
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_EQUIPMENT.map((eq) => {
                  const active = selectedEquipment.has(eq)
                  return (
                    <button
                      key={eq}
                      onClick={() => toggleEquipment(eq)}
                      className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-all duration-150 active:scale-95"
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
          </div>
        )}

        {step === SPLIT && (
          <div className="space-y-3">
            <h1 className="font-heading text-xl font-semibold">Choose a starting split</h1>
            <p className="text-sm text-muted-foreground">
              Sets the day structure your routine starts from — fully editable afterward, and you
              can change it anytime from Train → Routine Builder.
            </p>
            <SplitPicker value={splitType} onChange={setSplitType} />
          </div>
        )}

        {step === SCHEDULE && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-semibold">Schedule</h1>
            <SchedulePicker {...scheduleState} />
          </div>
        )}

        {step === REVIEW && (
          <div className="space-y-4">
            <div>
              <h1 className="font-heading text-xl font-semibold">Review & edit days</h1>
              <p className="text-sm text-muted-foreground">
                {splitType && SPLIT_PRESETS.find((p) => p.id === splitType)?.label} · {describeSchedule(schedule)}
              </p>
            </div>
            <RoutineDaysEditor
              days={days}
              setDays={setDays}
              activeDay={activeDay}
              onActiveDayChange={setActiveDay}
              equipment={Array.from(selectedEquipment)}
            />
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        {step > ACCOUNT && (
          <Button variant="ghost" className="h-11" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        <Button className="h-11 flex-1 text-base" onClick={next} disabled={isSaving || (step === SPLIT && !splitType)}>
          {accountStatus === "saving" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Creating account…
            </>
          ) : finishStatus === "saving" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : step === REVIEW ? (
            "Finish setup"
          ) : (
            "Continue"
          )}
        </Button>
      </div>
      {step >= SPLIT && (
        <button
          onClick={skipWorkoutSetup}
          disabled={skipStatus === "saving"}
          className="mt-3 text-center text-xs text-muted-foreground underline disabled:opacity-50"
        >
          {skipStatus === "saving" ? "Saving…" : "Skip workout setup for now — I'll build a routine later"}
        </button>
      )}
    </div>
  )
}
