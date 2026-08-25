import * as React from "react"
import { toast } from "sonner"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { TopBar } from "@/components/nav/top-bar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { getBodyMetrics } from "@/lib/api-client"
import type { BodyMetricEntry } from "shared"
import { LineChart as LineChartIcon } from "lucide-react"

const RANGES = [
  { key: "7", label: "7D", days: 7 },
  { key: "30", label: "30D", days: 30 },
  { key: "90", label: "90D", days: 90 },
  { key: "all", label: "All", days: Infinity },
]

const chartConfig = {
  weightKg: { label: "Weight", color: "var(--chart-1)" },
  rollingAvg: { label: "7-day avg", color: "var(--chart-3)" },
} satisfies ChartConfig

function withRollingAverage(data: BodyMetricEntry[]) {
  return data.map((d, i) => {
    const window = data.slice(Math.max(0, i - 6), i + 1)
    const avg = window.reduce((sum, w) => sum + w.weightKg, 0) / window.length
    return { ...d, rollingAvg: Math.round(avg * 10) / 10 }
  })
}

export function BodyMetricsTrend() {
  const [range, setRange] = React.useState("90")
  const [showAvg, setShowAvg] = React.useState(true)
  const [history, setHistory] = React.useState<BodyMetricEntry[] | null>(null)

  React.useEffect(() => {
    getBodyMetrics()
      // API returns newest-first; the chart wants ascending order.
      .then((res) => setHistory([...res.entries].reverse()))
      .catch(() => {
        toast.error("Couldn't load weight history")
        setHistory([])
      })
  }, [])

  const loading = history === null
  const days = RANGES.find((r) => r.key === range)!.days
  const sliced = loading ? [] : days === Infinity ? history : history.slice(-days)
  const data = withRollingAverage(sliced)

  const latest = sliced.length > 0 ? sliced[sliced.length - 1].weightKg : null
  const first = sliced[0]?.weightKg ?? latest
  const delta = latest != null && first != null ? Math.round((latest - first) * 10) / 10 : null

  return (
    <div>
      <TopBar title="Body metrics" />
      <div className="space-y-5 px-4 py-4">
        <div className="flex items-end justify-between">
          <div>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <p className="font-heading text-3xl font-semibold tracking-tight">{latest != null ? `${latest} kg` : "—"}</p>
            )}
            {delta != null && (
              <p className={`text-sm font-medium ${delta <= 0 ? "text-success" : "text-muted-foreground"}`}>
                {delta > 0 ? "+" : ""}
                {delta} kg over this range
              </p>
            )}
          </div>
          <Tabs value={range} onValueChange={setRange}>
            <TabsList className="h-9">
              {RANGES.map((r) => (
                <TabsTrigger key={r.key} value={r.key} className="text-xs">
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <Skeleton className="h-56 w-full rounded-xl" />
        ) : sliced.length === 0 ? (
          <EmptyState
            icon={LineChartIcon}
            title="No weight entries yet"
            description="Log your first weigh-in from the Log tab to start seeing a trend here."
          />
        ) : (
          <Card>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-56 w-full">
                <LineChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(v: string) => v.slice(5)}
                    minTickGap={32}
                  />
                  <YAxis tickLine={false} axisLine={false} width={36} domain={["dataMin - 1", "dataMax + 1"]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    dataKey="weightKg"
                    type="monotone"
                    stroke="var(--color-weightKg)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  {showAvg && (
                    <Line
                      dataKey="rollingAvg"
                      type="monotone"
                      stroke="var(--color-rollingAvg)"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={false}
                      connectNulls
                    />
                  )}
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <Label htmlFor="rolling-avg" className="text-sm">
            Show 7-day rolling average
          </Label>
          <Switch id="rolling-avg" checked={showAvg} onCheckedChange={setShowAvg} />
        </div>

        <p className="text-xs text-muted-foreground">
          Missing days don't break the line — gaps are bridged rather than shown as broken segments (FR-1
          acceptance criterion).
        </p>
      </div>
    </div>
  )
}
