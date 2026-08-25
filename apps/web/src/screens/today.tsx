import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { ChevronRight, Droplets, Flame, ListChecks, Play } from "lucide-react"
import { TopBar } from "@/components/nav/top-bar"
import { OfflineBanner } from "@/components/shared/offline-banner"
import { EmptyState } from "@/components/shared/empty-state"
import { PwaInstallCard } from "@/components/shared/pwa-install-card"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { getHydrationToday, getMacrosForDate } from "@/lib/api-client"
import {
  ACTIVE_ROUTINE,
  HYDRATION_GOAL_ML,
  MACRO_TARGETS,
  RECENT_SESSIONS,
  currentCycleStep,
  describeSchedule,
  exerciseById,
  getCurrentDay,
} from "@/lib/stub-data"

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export function Today() {
  const navigate = useNavigate()
  const hasActiveRoutine = ACTIVE_ROUTINE.days.length > 0
  const cycleStep = currentCycleStep()
  const today = getCurrentDay(ACTIVE_ROUTINE, cycleStep)
  const dayPosition = (cycleStep % ACTIVE_ROUTINE.days.length) + 1
  const lastSession = RECENT_SESSIONS[0]
  const todayDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(
    new Date(),
  )

  const [hydrationMl, setHydrationMl] = React.useState<number | null>(null)
  const [proteinG, setProteinG] = React.useState<number | null>(null)

  React.useEffect(() => {
    getHydrationToday()
      .then((res) => setHydrationMl(res.totalMl))
      .catch(() => toast.error("Couldn't load today's hydration"))
    getMacrosForDate()
      .then((res) => setProteinG(res.entry?.protein ?? 0))
      .catch(() => toast.error("Couldn't load today's macros"))
  }, [])

  return (
    <div>
      <TopBar title="Today" />
      <OfflineBanner />

      <div className="space-y-6 px-4 py-5">
        <div>
          <p className="text-sm text-muted-foreground">{todayDate}</p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">{greeting()}</h2>
        </div>

        <PwaInstallCard />

        {hasActiveRoutine ? (
          <Card className="overflow-hidden border-primary/25 py-0">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Badge className="mb-1.5">{today.label}</Badge>
                  <p className="font-heading text-lg font-semibold">{today.exercises.length} exercises planned</p>
                  <p className="text-sm text-muted-foreground">
                    {today.exercises.reduce((n, e) => n + e.targetSets, 0)} total sets · ~50 min
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Day {dayPosition} of {ACTIVE_ROUTINE.days.length} · {describeSchedule(ACTIVE_ROUTINE.schedule)}
                  </p>
                </div>
              </div>
              <div className="flex -space-x-2">
                {today.exercises.slice(0, 5).map((re) => (
                  <div
                    key={re.exerciseId}
                    className="flex size-9 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium text-muted-foreground"
                    title={exerciseById(re.exerciseId)?.name}
                  >
                    {exerciseById(re.exerciseId)?.name.slice(0, 2)}
                  </div>
                ))}
              </div>
              <Button className="h-12 w-full text-base" render={<Link to="/train/workout" />} nativeButton={false}>
                <Play className="size-4" /> Start workout
              </Button>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={ListChecks}
            title="No active routine yet"
            description="Build one manually, or let AI propose a split from your equipment — either way, editable before you save it."
            actionLabel="Build a routine"
            onAction={() => navigate("/train/routine")}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link to="/log">
            <Card className="h-full py-3.5 transition-colors hover:bg-muted/40">
              <CardContent className="space-y-2 px-3.5">
                {hydrationMl == null ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Droplets className="size-4 text-primary" />
                      <span className="text-xs text-muted-foreground">
                        {Math.round((hydrationMl / HYDRATION_GOAL_ML) * 100)}%
                      </span>
                    </div>
                    <p className="text-sm font-medium">Hydration</p>
                    <Progress value={(hydrationMl / HYDRATION_GOAL_ML) * 100} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {(hydrationMl / 1000).toFixed(2)}L / {(HYDRATION_GOAL_ML / 1000).toFixed(1)}L
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
          <Link to="/log">
            <Card className="h-full py-3.5 transition-colors hover:bg-muted/40">
              <CardContent className="space-y-2 px-3.5">
                {proteinG == null ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Flame className="size-4 text-primary" />
                      <span className="text-xs text-muted-foreground">
                        {Math.round((proteinG / MACRO_TARGETS.protein) * 100)}%
                      </span>
                    </div>
                    <p className="text-sm font-medium">Protein</p>
                    <Progress value={(proteinG / MACRO_TARGETS.protein) * 100} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {proteinG}g / {MACRO_TARGETS.protein}g
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
          <Card className="py-3">
            <CardContent className="flex items-center justify-between px-3.5">
              <div>
                <p className="text-sm font-medium">{lastSession.dayLabel}</p>
                <p className="text-xs text-muted-foreground">{lastSession.date}</p>
              </div>
              <Badge variant={lastSession.completionPct === 100 ? "default" : "secondary"}>
                {lastSession.completionPct}% complete
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
