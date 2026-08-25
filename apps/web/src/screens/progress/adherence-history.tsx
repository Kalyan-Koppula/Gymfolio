import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { TopBar } from "@/components/nav/top-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { ADHERENCE_HISTORY, RECENT_SESSIONS } from "@/lib/stub-data"

const chartConfig = {
  completionPct: { label: "Completion", color: "var(--chart-1)" },
} satisfies ChartConfig

export function AdherenceHistory() {
  const avg = Math.round(
    ADHERENCE_HISTORY.reduce((n, w) => n + w.completionPct, 0) / ADHERENCE_HISTORY.length,
  )

  return (
    <div>
      <TopBar title="Adherence & history" />
      <div className="space-y-5 px-4 py-4">
        <div>
          <p className="font-heading text-3xl font-semibold tracking-tight">{avg}%</p>
          <p className="text-sm text-muted-foreground">Average completion — last 12 weeks</p>
        </div>

        <Card>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-48 w-full">
              <BarChart data={ADHERENCE_HISTORY} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="weekLabel" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="completionPct" fill="var(--color-completionPct)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Sessions</h3>
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Sets</TableHead>
                  <TableHead className="text-right">Completion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RECENT_SESSIONS.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.dayLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{s.date}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.sets}/{s.setsPlanned}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={s.completionPct >= 90 ? "default" : s.completionPct >= 75 ? "secondary" : "destructive"}>
                        {s.completionPct}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
