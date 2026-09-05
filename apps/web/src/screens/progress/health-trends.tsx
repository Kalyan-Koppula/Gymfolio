import * as React from "react"
import { toast } from "sonner"
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, XAxis, YAxis } from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { RangeSelector, filterEntriesByRange } from "@/components/shared/range-selector"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { getHydrationHistory, getMacrosHistory, getSettings, getSleepHistory } from "@/lib/api-client"
import type { HydrationDailyTotal, MacroEntry, SleepEntry, UserSettings } from "shared"
import { Droplets, Moon, Utensils } from "lucide-react"

const hydrationConfig = {
  totalMl: { label: "Hydration (ml)", color: "var(--chart-1)" },
  goalMl: { label: "Goal", color: "var(--chart-3)" },
} satisfies ChartConfig

const sleepConfig = {
  hours: { label: "Hours", color: "var(--chart-2)" },
} satisfies ChartConfig

const macrosConfig = {
  calories: { label: "Calories", color: "var(--chart-1)" },
  protein: { label: "Protein", color: "var(--chart-2)" },
  carbs: { label: "Carbs", color: "var(--chart-3)" },
  fat: { label: "Fat", color: "var(--chart-4)" },
  calTarget: { label: "Cal target", color: "var(--muted-foreground)" },
} satisfies ChartConfig

function qualityColor(q: number) {
  if (q >= 4) return "var(--chart-2)"
  if (q >= 3) return "var(--chart-1)"
  if (q >= 2) return "var(--chart-3)"
  return "var(--chart-5)"
}

export function HealthTrends() {
  const [range, setRange] = React.useState("30")
  const [settings, setSettings] = React.useState<UserSettings | null>(null)
  const [hydration, setHydration] = React.useState<HydrationDailyTotal[] | null>(null)
  const [sleep, setSleep] = React.useState<SleepEntry[] | null>(null)
  const [macros, setMacros] = React.useState<MacroEntry[] | null>(null)

  React.useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => toast.error("Couldn't load settings"))
    getHydrationHistory()
      .then((res) => setHydration([...res.days].reverse()))
      .catch(() => {
        toast.error("Couldn't load hydration history")
        setHydration([])
      })
    getSleepHistory()
      .then((res) => setSleep([...res.entries].reverse()))
      .catch(() => {
        toast.error("Couldn't load sleep history")
        setSleep([])
      })
    getMacrosHistory()
      .then((res) => setMacros([...res.entries].reverse()))
      .catch(() => {
        toast.error("Couldn't load macro history")
        setMacros([])
      })
  }, [])

  const goalMl = settings?.hydrationGoalMl ?? 3000
  const targets = settings?.macroTargets

  const hydrationSlice = hydration ? filterEntriesByRange(hydration, range) : []
  const sleepSlice = sleep ? filterEntriesByRange(sleep, range) : []
  const macrosSlice = macros ? filterEntriesByRange(macros, range) : []

  const hydrationChart = hydrationSlice.map((d) => ({ ...d, goalMl }))
  const latestHydration = hydrationSlice[hydrationSlice.length - 1]?.totalMl ?? null
  const avgSleep =
    sleepSlice.length > 0
      ? Math.round((sleepSlice.reduce((n, s) => n + s.hours, 0) / sleepSlice.length) * 10) / 10
      : null

  return (
    <div className="space-y-8 px-4 py-4">
      <div className="flex justify-end">
        <RangeSelector value={range} onChange={setRange} />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Hydration</h2>
          <p className="text-xs text-muted-foreground">Daily totals vs your goal ({goalMl} ml).</p>
        </div>
        {hydration == null ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : hydrationSlice.length === 0 ? (
          <EmptyState icon={Droplets} title="No hydration logs" description="Log water from the Log tab." />
        ) : (
          <>
            <p className="font-heading text-2xl font-semibold tracking-tight">
              {latestHydration != null ? `${latestHydration} ml` : "—"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">latest day</span>
            </p>
            <Card>
              <CardContent>
                <ChartContainer config={hydrationConfig} className="h-44 w-full">
                  <ComposedChart data={hydrationChart} margin={{ left: -12, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(v: string) => v.slice(5)}
                      minTickGap={28}
                    />
                    <YAxis tickLine={false} axisLine={false} width={40} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="totalMl" fill="var(--color-totalMl)" radius={3} />
                    <Line
                      dataKey="goalMl"
                      type="monotone"
                      stroke="var(--color-goalMl)"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={false}
                    />
                  </ComposedChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Sleep</h2>
          <p className="text-xs text-muted-foreground">Duration with quality as bar color (1–5).</p>
        </div>
        {sleep == null ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : sleepSlice.length === 0 ? (
          <EmptyState icon={Moon} title="No sleep logs" description="Log sleep from the Log tab." />
        ) : (
          <>
            <p className="font-heading text-2xl font-semibold tracking-tight">
              {avgSleep != null ? `${avgSleep} h` : "—"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">avg this range</span>
            </p>
            <Card>
              <CardContent>
                <ChartContainer config={sleepConfig} className="h-44 w-full">
                  <BarChart data={sleepSlice} margin={{ left: -12, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(v: string) => v.slice(5)}
                      minTickGap={28}
                    />
                    <YAxis tickLine={false} axisLine={false} width={32} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, _name, _item, _index, raw) => {
                            const entry = raw as unknown as SleepEntry
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-foreground">{value} h</span>
                                <span className="text-muted-foreground">Quality {entry.quality}/5</span>
                              </div>
                            )
                          }}
                        />
                      }
                    />
                    <Bar dataKey="hours" radius={3}>
                      {sleepSlice.map((s) => (
                        <Cell key={s.id} fill={qualityColor(s.quality)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Macros</h2>
          <p className="text-xs text-muted-foreground">
            Daily intake
            {targets ? ` vs targets (${targets.calories} kcal)` : ""}.
          </p>
        </div>
        {macros == null ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : macrosSlice.length === 0 ? (
          <EmptyState icon={Utensils} title="No macro logs" description="Log macros from the Log tab." />
        ) : (
          <Card>
            <CardContent>
              <ChartContainer config={macrosConfig} className="h-52 w-full">
                <LineChart
                  data={macrosSlice.map((m) => ({
                    ...m,
                    calTarget: targets?.calories ?? undefined,
                  }))}
                  margin={{ left: -12, right: 8, top: 8 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(v: string) => v.slice(5)}
                    minTickGap={28}
                  />
                  <YAxis tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line dataKey="calories" type="monotone" stroke="var(--color-calories)" strokeWidth={2} dot={false} />
                  <Line dataKey="protein" type="monotone" stroke="var(--color-protein)" strokeWidth={2} dot={false} />
                  <Line dataKey="carbs" type="monotone" stroke="var(--color-carbs)" strokeWidth={2} dot={false} />
                  <Line dataKey="fat" type="monotone" stroke="var(--color-fat)" strokeWidth={2} dot={false} />
                  {targets && (
                    <Line
                      dataKey="calTarget"
                      type="monotone"
                      stroke="var(--color-calTarget)"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      dot={false}
                    />
                  )}
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
