import * as React from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { TopBar } from "@/components/nav/top-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { getAdherenceHistory, getRecentWorkouts } from "@/lib/api-client"
import type { AdherenceWeek, WorkoutSessionSummary } from "shared"

const chartConfig = {
  completionPct: { label: "Adherence", color: "var(--chart-1)" },
  noData: { label: "No data", color: "var(--muted)" },
} satisfies ChartConfig

export function AdherenceHistory() {
  const navigate = useNavigate()
  const [history, setHistory] = React.useState<AdherenceWeek[] | null>(null)
  const [sessions, setSessions] = React.useState<WorkoutSessionSummary[] | null>(null)

  React.useEffect(() => {
    getAdherenceHistory(12)
      .then((res) => setHistory(res.history))
      .catch(() => {
        toast.error("Couldn't load adherence history")
        setHistory([])
      })
    getRecentWorkouts(20)
      .then((res) => setSessions(res.sessions))
      .catch(() => {
        toast.error("Couldn't load sessions")
        setSessions([])
      })
  }, [])

  // Weeks with nothing scheduled yet are no-data, not 0% — averaging them in would read as
  // missed training the user never actually planned.
  const resolved = history?.filter((w) => w.completionPct != null) ?? []
  const avg =
    resolved.length > 0
      ? Math.round(resolved.reduce((n, w) => n + (w.completionPct ?? 0), 0) / resolved.length)
      : null

  // Stacked behind the real bar so a no-data week still occupies its column as a muted block
  // rather than vanishing into an unexplained gap.
  const chartData = history?.map((w) => ({ ...w, noData: w.completionPct == null ? 100 : 0 })) ?? []
  const totalSkipped = history?.reduce((n, w) => n + w.sessionsSkipped, 0) ?? 0

  return (
    <div>
      <TopBar title="Adherence & history" back />
      <div className="space-y-5 px-4 py-4 md:px-6 lg:px-8">
        <div>
          {history == null ? (
            <Skeleton className="h-9 w-24" />
          ) : avg == null ? (
            <p className="font-heading text-3xl font-semibold tracking-tight text-muted-foreground">No data</p>
          ) : (
            <p className="font-heading text-3xl font-semibold tracking-tight">{avg}%</p>
          )}
          <p className="text-sm text-muted-foreground">
            {avg == null
              ? "Finish or skip a session and adherence starts tracking"
              : `Average adherence — last 12 weeks · ${totalSkipped} skipped`}
          </p>
        </div>

        <Card>
          <CardContent>
            {history == null ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ChartContainer config={chartConfig} className="h-48 w-full">
                <BarChart data={chartData} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="weekLabel" tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, _item, _index, raw) => {
                          if (name === "noData") return null
                          const week = raw as unknown as AdherenceWeek
                          return (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-foreground">
                                {value == null ? "No sessions this week" : `${value}% adherence`}
                              </span>
                              <span className="text-muted-foreground">
                                {week.sessionsCompleted} completed · {week.sessionsSkipped} skipped
                              </span>
                            </div>
                          )
                        }}
                      />
                    }
                  />
                  <Bar dataKey="noData" stackId="week" fill="var(--color-noData)" radius={4} tooltipType="none" />
                  <Bar dataKey="completionPct" stackId="week" fill="var(--color-completionPct)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Skipped sessions count against adherence. Muted columns are weeks with nothing logged.
            </p>
          </CardContent>
        </Card>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Sessions</h3>
          <div className="overflow-hidden rounded-xl border border-border">
            {sessions == null ? (
              <div className="p-4">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No sessions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Sets</TableHead>
                    <TableHead className="text-right">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/progress/session/${s.id}`)}
                    >
                      <TableCell className="font-medium">{s.dayLabel}</TableCell>
                      <TableCell className="text-muted-foreground">{s.date}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.status === "skipped" ? "—" : `${s.sets}/${s.setsPlanned}`}
                      </TableCell>
                      <TableCell className="text-right">
                        {s.status === "skipped" ? (
                          <Badge variant="outline">Skipped</Badge>
                        ) : (
                          <Badge
                            variant={
                              s.completionPct >= 90 ? "default" : s.completionPct >= 75 ? "secondary" : "destructive"
                            }
                          >
                            {s.completionPct}%
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
