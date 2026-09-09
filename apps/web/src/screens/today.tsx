import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { CheckCircle2, ChevronRight, Droplets, Eye, Flame, ListChecks, Moon, Play, SkipForward } from "lucide-react"
import { TopBar } from "@/components/nav/top-bar"
import { OfflineBanner } from "@/components/shared/offline-banner"
import { EmptyState } from "@/components/shared/empty-state"
import { PwaInstallCard } from "@/components/shared/pwa-install-card"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getHydrationToday,
  getMacrosForDate,
  getSettings,
  getRoutine,
  getRecentWorkouts,
  getCycleStep,
  getWorkoutForDate,
  skipWorkout,
} from "@/lib/api-client"
import { useExercises } from "@/hooks/use-exercises"
import { useWorkoutSession } from "@/hooks/use-workout-session"
import type { UserSettings, Routine, WorkoutSessionSummary, WorkoutLog } from "shared"
import { activeDays, describeSchedule } from "@/lib/stub-data"

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export function Today() {
  const navigate = useNavigate()
  const { byId } = useExercises()
  const { refresh: refreshSession } = useWorkoutSession()
  const todayDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(
    new Date(),
  )

  const [hydrationMl, setHydrationMl] = React.useState<number | null>(null)
  const [proteinG, setProteinG] = React.useState<number | null>(null)
  const [settings, setSettings] = React.useState<UserSettings | null>(null)
  const [routine, setRoutine] = React.useState<Routine | null | undefined>(undefined)
  const [cycleStep, setCycleStep] = React.useState(0)
  const [lastSession, setLastSession] = React.useState<WorkoutSessionSummary | null | undefined>(undefined)
  const [skipping, setSkipping] = React.useState(false)
  const [planOpen, setPlanOpen] = React.useState(false)
  const [completedToday, setCompletedToday] = React.useState<WorkoutLog | null | undefined>(undefined)

  React.useEffect(() => {
    getHydrationToday()
      .then((res) => setHydrationMl(res.totalMl))
      .catch(() => toast.error("Couldn't load today's hydration"))
    getMacrosForDate()
      .then((res) => setProteinG(res.entry?.protein ?? 0))
      .catch(() => toast.error("Couldn't load today's macros"))
    getSettings()
      .then(setSettings)
      .catch(() => toast.error("Couldn't load your settings"))
    getWorkoutForDate(todayIso())
      .then((res) => setCompletedToday(res.completed))
      .catch(() => setCompletedToday(null))
    getRoutine()
      .then(async (res) => {
        setRoutine(res.routine)
        const slots = res.routine ? activeDays(res.routine.days).length : 0
        if (slots > 0) {
          const step = await getCycleStep(slots)
          setCycleStep(step.cycleStep)
        }
      })
      .catch(() => setRoutine(null))
    getRecentWorkouts(1)
      .then((res) => setLastSession(res.sessions[0] ?? null))
      .catch(() => setLastSession(null))
  }, [])

  const slots = routine ? activeDays(routine.days) : []
  const today = slots.length > 0 ? slots[cycleStep % slots.length] : null
  const dayPosition = slots.length > 0 ? (cycleStep % slots.length) + 1 : 0
  const isRestDay = today?.dayType === "rest"
  const doneForToday = completedToday != null

  async function skipToday() {
    if (!today || slots.length === 0) return
    setSkipping(true)
    try {
      await skipWorkout({ date: todayIso(), dayLabel: today.label, dayIndex: cycleStep % slots.length })
      const step = await getCycleStep(slots.length)
      setCycleStep(step.cycleStep)
      await refreshSession()
      const [recent] = (await getRecentWorkouts(1)).sessions
      setLastSession(recent ?? null)
      toast.success(isRestDay ? "Rest day logged — moved to the next day" : "Skipped — moved to the next day")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't skip today")
    } finally {
      setSkipping(false)
    }
  }

  return (
    <div>
      <TopBar title="Today" />
      <OfflineBanner />

      <div className="space-y-6 px-4 py-5 md:px-6 lg:px-8">
        <div>
          <p className="text-sm text-muted-foreground">{todayDate}</p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">{greeting()}</h2>
        </div>

        <PwaInstallCard />

        {/* Mobile: stacked. From tablet: workout + side metrics share a row. */}
        <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
        {routine === undefined || completedToday === undefined ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : routine && doneForToday ? (
          <Card className="overflow-hidden border-success/30 bg-success/5 py-0">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15">
                  <CheckCircle2 className="size-5 text-success" />
                </div>
                <div>
                  <Badge className="mb-1.5" variant="secondary">
                    {completedToday.dayLabel}
                  </Badge>
                  <p className="font-heading text-lg font-semibold">Workout complete — nice work</p>
                  <p className="text-sm text-muted-foreground">
                    You're done for today. Next session unlocks tomorrow.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {completedToday.setsCompleted}/{completedToday.setsPlanned} sets ·{" "}
                    {completedToday.completionPct}% complete
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="h-11 w-full"
                render={<Link to={`/progress/session/${completedToday.id}`} />}
                nativeButton={false}
              >
                Review / edit today's sets
              </Button>
            </CardContent>
          </Card>
        ) : routine && today ? (
          <Card className="overflow-hidden border-primary/25 py-0">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Badge className="mb-1.5" variant={isRestDay ? "secondary" : "default"}>
                    {today.label}
                  </Badge>
                  {isRestDay ? (
                    <>
                      <p className="font-heading text-lg font-semibold">Rest day</p>
                      <p className="text-sm text-muted-foreground">
                        Nothing scheduled — recovery is part of the split.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-heading text-lg font-semibold">{today.exercises.length} exercises planned</p>
                      <p className="text-sm text-muted-foreground">
                        {today.exercises.reduce((n, e) => n + e.targetSets, 0)} total sets · ~50 min
                      </p>
                    </>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Day {dayPosition} of {slots.length} · {describeSchedule(routine.schedule)}
                  </p>
                </div>
              </div>
              {!isRestDay && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setPlanOpen((o) => !o)}
                    className="flex w-full items-center justify-between rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/50"
                  >
                    <span className="flex items-center gap-2">
                      <Eye className="size-4 text-muted-foreground" />
                      {planOpen ? "Hide today's plan" : "Preview today's plan"}
                    </span>
                    <ChevronRight
                      className={`size-4 text-muted-foreground transition-transform ${planOpen ? "rotate-90" : ""}`}
                    />
                  </button>
                  {planOpen ? (
                    <ul className="space-y-2 rounded-lg border border-border bg-card px-3 py-2">
                      {today.exercises
                        .slice()
                        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
                        .map((re) => {
                          const name = byId(re.exerciseId)?.name ?? "Exercise"
                          return (
                            <li
                              key={re.exerciseId}
                              className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0"
                            >
                              <span className="min-w-0 font-medium">{name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {re.targetSets} × {re.targetReps}
                              </span>
                            </li>
                          )
                        })}
                    </ul>
                  ) : (
                    <div className="flex -space-x-2">
                      {today.exercises.slice(0, 5).map((re) => (
                        <div
                          key={re.exerciseId}
                          className="flex size-9 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground"
                          title={byId(re.exerciseId)?.name}
                        >
                          {byId(re.exerciseId)?.name.slice(0, 2) ?? "?"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {isRestDay ? (
                <Button
                  variant="outline"
                  className="h-12 w-full text-base"
                  onClick={skipToday}
                  disabled={skipping}
                >
                  <Moon className="size-4" /> {skipping ? "Advancing…" : "Mark rest day done"}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    className="h-12 flex-1 text-base"
                    render={<Link to="/train/workout" />}
                    nativeButton={false}
                  >
                    <Play className="size-4" /> Start workout
                  </Button>
                  <Button variant="outline" className="h-12 px-4 text-sm" onClick={skipToday} disabled={skipping}>
                    <SkipForward className="size-4" /> {skipping ? "Skipping…" : "Skip today"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={ListChecks}
            title="No active routine yet"
            description="Build one manually, or let AI propose a split from your equipment — either way, editable before you save it."
            actionLabel="Build a routine"
            onAction={() => navigate("/train/routine/new")}
          />
        )}
        </div>

        <div className="min-w-0 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <Link to="/log">
            <Card className="h-full py-3.5 transition-colors hover:bg-muted/40">
              <CardContent className="space-y-2 px-3.5">
                {hydrationMl == null || settings == null ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Droplets className="size-4 text-primary" />
                      <span className="text-xs text-muted-foreground">
                        {Math.round((hydrationMl / settings.hydrationGoalMl) * 100)}%
                      </span>
                    </div>
                    <p className="text-sm font-medium">Hydration</p>
                    <Progress value={(hydrationMl / settings.hydrationGoalMl) * 100} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {(hydrationMl / 1000).toFixed(2)}L / {(settings.hydrationGoalMl / 1000).toFixed(1)}L
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
          <Link to="/log">
            <Card className="h-full py-3.5 transition-colors hover:bg-muted/40">
              <CardContent className="space-y-2 px-3.5">
                {proteinG == null || settings == null ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Flame className="size-4 text-primary" />
                      <span className="text-xs text-muted-foreground">
                        {Math.round((proteinG / settings.macroTargets.protein) * 100)}%
                      </span>
                    </div>
                    <p className="text-sm font-medium">Protein</p>
                    <Progress value={(proteinG / settings.macroTargets.protein) * 100} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {proteinG}g / {settings.macroTargets.protein}g
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Last session</h3>
            <Link to="/progress/adherence" className="flex items-center text-xs text-muted-foreground hover:text-foreground">
              View history <ChevronRight className="size-3.5" />
            </Link>
          </div>
          {lastSession === undefined ? (
            <Skeleton className="h-16 w-full rounded-xl" />
          ) : lastSession ? (
            <Card className="py-3">
              <CardContent className="flex items-center justify-between px-3.5">
                <div>
                  <p className="text-sm font-medium">{lastSession.dayLabel}</p>
                  <p className="text-xs text-muted-foreground">{lastSession.date}</p>
                </div>
                <Badge
                  variant={
                    lastSession.status === "skipped"
                      ? "outline"
                      : lastSession.completionPct === 100
                        ? "default"
                        : "secondary"
                  }
                >
                  {lastSession.status === "skipped" ? "Skipped" : `${lastSession.completionPct}% complete`}
                </Badge>
              </CardContent>
            </Card>
          ) : (
            <Card className="py-3">
              <CardContent className="px-3.5 text-sm text-muted-foreground">
                No completed workouts yet — finish one to see it here.
              </CardContent>
            </Card>
          )}
        </div>
        </div>
        </div>
      </div>
    </div>
  )
}
