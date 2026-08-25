import * as React from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ChevronRight, Droplet, Moon, Scale, Star, UtensilsCrossed } from "lucide-react"
import { TopBar } from "@/components/nav/top-bar"
import { OfflineBanner } from "@/components/shared/offline-banner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { SaveButton } from "@/components/shared/save-button"
import { useApiWrite } from "@/hooks/use-api-write"
import { cn } from "@/lib/utils"
import {
  getBodyMetrics,
  createBodyMetricEntry,
  getHydrationToday,
  createHydrationEntry,
  getSleepHistory,
  createSleepEntry,
  getMacrosForDate,
  upsertMacros,
  getSettings,
} from "@/lib/api-client"
import type { BodyMetricEntry, SleepEntry, UserSettings } from "shared"

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function LogHub() {
  return (
    <div>
      <TopBar title="Log" />
      <OfflineBanner />
      <div className="px-4 py-5">
        <Tabs defaultValue="weight">
          <TabsList size="lg" className="w-full">
            <TabsTrigger value="weight" className="h-full flex-col gap-0.5 text-xs">
              <Scale className="size-4" /> Weight
            </TabsTrigger>
            <TabsTrigger value="hydration" className="h-full flex-col gap-0.5 text-xs">
              <Droplet className="size-4" /> Hydration
            </TabsTrigger>
            <TabsTrigger value="sleep" className="h-full flex-col gap-0.5 text-xs">
              <Moon className="size-4" /> Sleep
            </TabsTrigger>
            <TabsTrigger value="macros" className="h-full flex-col gap-0.5 text-xs">
              <UtensilsCrossed className="size-4" /> Macros
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weight" className="mt-5">
            <WeightTab />
          </TabsContent>
          <TabsContent value="hydration" className="mt-5">
            <HydrationTab />
          </TabsContent>
          <TabsContent value="sleep" className="mt-5">
            <SleepTab />
          </TabsContent>
          <TabsContent value="macros" className="mt-5">
            <MacrosTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function WeightTab() {
  const [weight, setWeight] = React.useState("")
  const [history, setHistory] = React.useState<BodyMetricEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const { status, run } = useApiWrite<{ entry: BodyMetricEntry }>("Weight entry saved")

  React.useEffect(() => {
    getBodyMetrics()
      .then((res) => setHistory(res.entries))
      .catch(() => toast.error("Couldn't load weight history"))
      .finally(() => setLoading(false))
  }, [])

  function handleSave() {
    const weightKg = Number(weight)
    if (!weightKg) return
    run(
      () => createBodyMetricEntry({ date: todayIso(), weightKg }),
      (res) => {
        setHistory((prev) => [res.entry, ...prev])
        setWeight("")
      },
    )
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-3">
          <Label htmlFor="weight-input">Today's weight (kg)</Label>
          <div className="flex gap-2">
            <Input
              id="weight-input"
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0.0"
              className="h-11 flex-1 text-base"
            />
            <SaveButton status={status} onClick={handleSave} />
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent entries</h3>
          <Link to="/progress/metrics" className="flex items-center text-xs text-muted-foreground hover:text-foreground">
            View trend <ChevronRight className="size-3.5" />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-1.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries yet — log your first weigh-in above.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            {history.slice(0, 5).map((e, i) => (
              <div
                key={e.id}
                className={`flex items-center justify-between px-4 py-2.5 text-sm ${i > 0 ? "border-t border-border" : ""}`}
              >
                <span className="text-muted-foreground">{e.date}</span>
                <span className="font-medium">{e.weightKg} kg</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function HydrationTab() {
  const [totalMl, setTotalMl] = React.useState(0)
  const [goalMl, setGoalMl] = React.useState(3000)
  const [loading, setLoading] = React.useState(true)
  const [custom, setCustom] = React.useState("")
  const { run } = useApiWrite<unknown>("Hydration logged")
  const pct = Math.min(100, (totalMl / goalMl) * 100)

  React.useEffect(() => {
    getHydrationToday()
      .then((res) => setTotalMl(res.totalMl))
      .catch(() => toast.error("Couldn't load today's hydration"))
      .finally(() => setLoading(false))
    getSettings()
      .then((s) => setGoalMl(s.hydrationGoalMl))
      .catch(() => {})
  }, [])

  function quickAdd(ml: number) {
    run(
      () => createHydrationEntry({ date: todayIso(), amountMl: ml }),
      () => setTotalMl((t) => t + ml),
    )
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <span key={totalMl} className="font-heading text-2xl font-semibold animate-in zoom-in-90 duration-200 ease-out">
                {(totalMl / 1000).toFixed(2)}L
              </span>
            )}
            <span className="text-sm text-muted-foreground">of {(goalMl / 1000).toFixed(1)}L goal</span>
          </div>
          <Progress value={pct} className="h-2.5" />
        </CardContent>
      </Card>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Quick add</p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            className="h-14 text-base font-semibold transition-transform duration-150 active:scale-95"
            onClick={() => quickAdd(250)}
          >
            + 250 ml
          </Button>
          <Button
            variant="secondary"
            className="h-14 text-base font-semibold transition-transform duration-150 active:scale-95"
            onClick={() => quickAdd(500)}
          >
            + 500 ml
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Custom amount (ml)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="h-11 flex-1 text-base"
        />
        <Button
          variant="outline"
          className="h-11"
          onClick={() => {
            const ml = Number(custom)
            if (ml > 0) {
              quickAdd(ml)
              setCustom("")
            }
          }}
        >
          Add
        </Button>
      </div>
    </div>
  )
}

function SleepTab() {
  const { status, run } = useApiWrite<{ entry: SleepEntry }>("Sleep entry saved")
  const [quality, setQuality] = React.useState<1 | 2 | 3 | 4 | 5>(4)
  const [startTime, setStartTime] = React.useState("22:45")
  const [endTime, setEndTime] = React.useState("06:30")
  const [recent, setRecent] = React.useState<SleepEntry[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    getSleepHistory()
      .then((res) => setRecent(res.entries.slice(0, 7).reverse()))
      .catch(() => toast.error("Couldn't load sleep history"))
      .finally(() => setLoading(false))
  }, [])

  function handleSave() {
    run(
      () => createSleepEntry({ date: todayIso(), startTime, endTime, quality }),
      (res) => setRecent((prev) => [...prev.slice(-6), res.entry]),
    )
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sleep-start">Bedtime</Label>
              <Input
                id="sleep-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sleep-end">Wake time</Label>
              <Input
                id="sleep-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-11 text-base"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Sleep quality</Label>
            <div className="flex gap-1">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onClick={() => setQuality(n)}
                  className="flex size-11 items-center justify-center transition-transform duration-150 active:scale-90"
                >
                  <Star
                    key={n <= quality ? `filled-${n}-${quality}` : `empty-${n}`}
                    className={cn(
                      "size-6 transition-colors duration-150",
                      n === quality && "animate-in zoom-in-50 duration-200 ease-out",
                    )}
                    fill={n <= quality ? "var(--primary)" : "none"}
                    color={n <= quality ? "var(--primary)" : "var(--muted-foreground)"}
                  />
                </button>
              ))}
            </div>
          </div>
          <SaveButton status={status} onClick={handleSave} className="w-full" />
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Last 7 nights</h3>
        {loading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No nights logged yet.</p>
        ) : (
          <div className="flex items-end gap-2 rounded-xl border border-border p-4">
            {recent.map((n) => (
              <div key={n.id} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-24 w-full items-end rounded-md bg-muted">
                  <div
                    className="w-full rounded-md bg-primary"
                    style={{ height: `${Math.min(100, (n.hours / 9) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{n.hours}h</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MacrosTab() {
  const { status, run } = useApiWrite<unknown>("Macros saved")
  const [values, setValues] = React.useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [settings, setSettings] = React.useState<UserSettings | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    getMacrosForDate()
      .then((res) => {
        if (res.entry) setValues(res.entry)
      })
      .catch(() => toast.error("Couldn't load today's macros"))
      .finally(() => setLoading(false))
    getSettings()
      .then(setSettings)
      .catch(() => {})
  }, [])

  function handleSave() {
    run(() => upsertMacros({ date: todayIso(), ...values }))
  }

  const macroFields = settings
    ? ([
        { key: "calories", label: "Calories", unit: "kcal", target: settings.macroTargets.calories },
        { key: "protein", label: "Protein", unit: "g", target: settings.macroTargets.protein },
        { key: "carbs", label: "Carbs", unit: "g", target: settings.macroTargets.carbs },
        { key: "fat", label: "Fat", unit: "g", target: settings.macroTargets.fat },
      ] as const)
    : []

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4">
          {loading || !settings ? (
            <div className="space-y-4">
              {(["calories", "protein", "carbs", "fat"] as const).map((key) => (
                <Skeleton key={key} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            macroFields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor={f.key} className="text-sm">
                    {f.label}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {values[f.key]} / {f.target} {f.unit}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={Math.min(100, (values[f.key] / f.target) * 100)} className="h-1.5 flex-1" />
                  <Input
                    id={f.key}
                    type="number"
                    value={values[f.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))}
                    className="h-9 w-20 text-right text-sm"
                  />
                </div>
              </div>
            ))
          )}
          <SaveButton status={status} onClick={handleSave} className="w-full" />
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Numeric daily totals only — no per-meal or per-dish logging.
      </p>
    </div>
  )
}
