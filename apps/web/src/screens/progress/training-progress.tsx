import * as React from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { ChevronRight, Dumbbell, LineChart as LineChartIcon, Search } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/shared/empty-state"
import { RangeSelector, getRangeDays } from "@/components/shared/range-selector"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { useExercises } from "@/hooks/use-exercises"
import { getExerciseProgress, getMuscleVolume } from "@/lib/api-client"
import type { ExerciseProgressPoint, MuscleVolumeEntry } from "shared"

type MetricKey = "topSetWeightKg" | "estimated1RmKg" | "totalVolumeKg"

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "topSetWeightKg", label: "Top-set weight" },
  { key: "estimated1RmKg", label: "Est. 1RM" },
  { key: "totalVolumeKg", label: "Total volume" },
]

const exerciseChartConfig = {
  topSetWeightKg: { label: "Top set (kg)", color: "var(--chart-1)" },
  estimated1RmKg: { label: "Est. 1RM (kg)", color: "var(--chart-2)" },
  totalVolumeKg: { label: "Volume (kg)", color: "var(--chart-3)" },
} satisfies ChartConfig

const muscleChartConfig = {
  sets: { label: "Sets", color: "var(--chart-1)" },
} satisfies ChartConfig

export function TrainingProgress() {
  const { exercises, loading: exercisesLoading } = useExercises()
  const [query, setQuery] = React.useState("")
  const [exerciseId, setExerciseId] = React.useState<string | null>(null)
  const [metric, setMetric] = React.useState<MetricKey>("topSetWeightKg")
  const [points, setPoints] = React.useState<ExerciseProgressPoint[] | null>(null)
  const [muscleRange, setMuscleRange] = React.useState("30")
  const [volumes, setVolumes] = React.useState<MuscleVolumeEntry[] | null>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = exercises ?? []
    if (!q) return list.slice(0, 12)
    return list.filter((ex) => ex.name.toLowerCase().includes(q)).slice(0, 20)
  }, [exercises, query])

  const selected = exercises?.find((e) => e.id === exerciseId) ?? null

  React.useEffect(() => {
    if (!exerciseId) {
      setPoints(null)
      return
    }
    setPoints(null)
    getExerciseProgress(exerciseId)
      .then((res) => setPoints(res.points))
      .catch(() => {
        toast.error("Couldn't load exercise progress")
        setPoints([])
      })
  }, [exerciseId])

  React.useEffect(() => {
    setVolumes(null)
    const days = getRangeDays(muscleRange)
    getMuscleVolume(Number.isFinite(days) ? days : "all")
      .then((res) => setVolumes(res.volumes))
      .catch(() => {
        toast.error("Couldn't load muscle volume")
        setVolumes([])
      })
  }, [muscleRange])

  const latest = points && points.length > 0 ? points[points.length - 1][metric] : null

  return (
    <div className="space-y-8 px-4 py-4">
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Exercise progress</h2>
          <p className="text-xs text-muted-foreground">Pick an exercise to chart strength over sessions.</p>
        </div>

        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises…"
            className="h-11 pl-9 text-base"
          />
        </div>

        {exercisesLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-1">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No matching exercises.</p>
            ) : (
              filtered.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => {
                    setExerciseId(ex.id)
                    setQuery(ex.name)
                  }}
                  className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    exerciseId === ex.id ? "bg-muted font-medium" : "hover:bg-muted/60"
                  }`}
                >
                  {ex.name}
                </button>
              ))
            )}
          </div>
        )}

        {selected && (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-heading text-2xl font-semibold tracking-tight">
                  {latest != null ? `${latest}${metric === "totalVolumeKg" ? " kg·reps" : " kg"}` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">{selected.name}</p>
              </div>
              <Tabs value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
                <TabsList className="h-auto flex-wrap justify-end gap-1 bg-transparent p-0">
                  {METRICS.map((m) => (
                    <TabsTrigger key={m.key} value={m.key} className="h-8 text-xs data-active:bg-muted">
                      {m.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {points == null ? (
              <Skeleton className="h-48 w-full rounded-xl" />
            ) : points.length === 0 ? (
              <EmptyState
                icon={Dumbbell}
                title="No logged sets yet"
                description="Complete a workout that includes this exercise to see progress."
              />
            ) : (
              <Card>
                <CardContent>
                  <ChartContainer config={exerciseChartConfig} className="h-48 w-full">
                    <LineChart data={points} margin={{ left: -20, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(v: string) => v.slice(5)}
                        minTickGap={32}
                      />
                      <YAxis tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        dataKey={metric}
                        type="monotone"
                        stroke={`var(--color-${metric})`}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!selected && !exercisesLoading && (
          <EmptyState
            icon={LineChartIcon}
            title="Choose an exercise"
            description="Search above to chart top-set weight, estimated 1RM, or session volume."
          />
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Muscle-group volume</h2>
            <p className="text-xs text-muted-foreground">Sets counted toward every tagged muscle group.</p>
          </div>
          <RangeSelector value={muscleRange} onChange={setMuscleRange} />
        </div>

        {volumes == null ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : volumes.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="No volume yet"
            description="Finish workouts in this range to see sets by muscle group."
          />
        ) : (
          <>
            <Card>
              <CardContent>
                <ChartContainer config={muscleChartConfig} className="h-48 w-full">
                  <BarChart data={volumes} margin={{ left: -8, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="muscleGroup"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(v: string) => v.slice(0, 3)}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="sets" fill="var(--color-sets)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Muscle</th>
                    <th className="px-4 py-2.5 text-right font-medium">Sets</th>
                  </tr>
                </thead>
                <tbody>
                  {volumes.map((v) => (
                    <tr key={v.muscleGroup} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 capitalize">{v.muscleGroup}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{v.sets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <Link
        to="/progress/adherence"
        className="flex items-center justify-between rounded-xl border border-border px-4 py-3.5 text-sm font-medium transition-colors hover:bg-muted/50"
      >
        Adherence & history
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    </div>
  )
}
