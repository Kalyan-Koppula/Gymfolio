import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const RANGES = [
  { key: "7", label: "7D", days: 7 },
  { key: "30", label: "30D", days: 30 },
  { key: "90", label: "90D", days: 90 },
  { key: "365", label: "1Y", days: 365 },
  { key: "all", label: "All", days: Infinity },
] as const

export type RangeKey = (typeof RANGES)[number]["key"]

export function getRangeDays(key: string): number {
  return RANGES.find((r) => r.key === key)?.days ?? Infinity
}

/** Filter ascending or descending date-keyed rows to the selected lookback window. */
export function filterEntriesByRange<T extends { date: string }>(entries: T[], rangeKey: string): T[] {
  const days = getRangeDays(rangeKey)
  if (!Number.isFinite(days)) return entries
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return entries.filter((e) => e.date >= cutoffStr)
}

export function RangeSelector({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (key: string) => void
  className?: string
}) {
  return (
    <Tabs value={value} onValueChange={onChange} className={className}>
      <TabsList className="h-9">
        {RANGES.map((r) => (
          <TabsTrigger key={r.key} value={r.key} className="text-xs">
            {r.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
