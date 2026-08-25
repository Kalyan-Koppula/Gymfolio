import { CalendarDays, Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { NumberStepper } from "@/components/shared/number-stepper"
import { ROTATING_PATTERNS, WEEKDAYS } from "@/lib/stub-data"
import type { ScheduleState } from "@/hooks/use-schedule-state"

/** Presentational half of useScheduleState — shared by the Routine Wizard and Onboarding. */
export function SchedulePicker(state: ScheduleState) {
  const {
    scheduleMode,
    setScheduleMode,
    daysPerWeek,
    setDaysPerWeek,
    pinnedWeekdays,
    toggleWeekday,
    rotatingPattern,
    setRotatingPattern,
    customWorkDays,
    setCustomWorkDays,
    customRestDays,
    setCustomRestDays,
    useCustomRotation,
    setUseCustomRotation,
  } = state

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={scheduleMode === "weekly" ? "default" : "outline"}
          size="sm"
          className="h-9 flex-1"
          onClick={() => setScheduleMode("weekly")}
        >
          <CalendarDays className="size-3.5" /> Weekly
        </Button>
        <Button
          variant={scheduleMode === "rotating" ? "default" : "outline"}
          size="sm"
          className="h-9 flex-1"
          onClick={() => setScheduleMode("rotating")}
        >
          <Repeat className="size-3.5" /> Rotating cycle
        </Button>
      </div>

      {scheduleMode === "weekly" ? (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Days per week</Label>
              <NumberStepper value={daysPerWeek} onChange={setDaysPerWeek} min={1} size="compact" />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Pinned weekdays
              </p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => {
                  const active = pinnedWeekdays.includes(d)
                  return (
                    <button
                      key={d}
                      onClick={() => toggleWeekday(d)}
                      className="h-9 rounded-full border px-3 text-sm font-medium transition-all duration-150 active:scale-95"
                      style={{
                        borderColor: active ? "var(--primary)" : "var(--border)",
                        backgroundColor: active ? "var(--primary)" : "transparent",
                        color: active ? "var(--primary-foreground)" : "var(--foreground)",
                      }}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Rotates independently of the calendar — e.g. "3 on / 1 off" repeats every 4th day
              regardless of weekday.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ROTATING_PATTERNS.map((p) => {
                const selected = !useCustomRotation && rotatingPattern.label === p.label
                return (
                  <button
                    key={p.label}
                    onClick={() => {
                      setRotatingPattern(p)
                      setUseCustomRotation(false)
                    }}
                    className="h-11 rounded-lg border text-sm font-medium transition-all duration-150 active:scale-95"
                    style={{
                      borderColor: selected ? "var(--primary)" : "var(--border)",
                      backgroundColor: selected ? "var(--primary)" : "transparent",
                      color: selected ? "var(--primary-foreground)" : "var(--foreground)",
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}
              <button
                onClick={() => setUseCustomRotation(true)}
                className="h-11 rounded-lg border text-sm font-medium transition-all duration-150 active:scale-95"
                style={{
                  borderColor: useCustomRotation ? "var(--primary)" : "var(--border)",
                  backgroundColor: useCustomRotation ? "var(--primary)" : "transparent",
                  color: useCustomRotation ? "var(--primary-foreground)" : "var(--foreground)",
                }}
              >
                Custom
              </button>
            </div>
            {useCustomRotation && (
              <div className="flex items-center justify-around rounded-lg bg-muted/40 p-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">Work days</span>
                  <NumberStepper value={customWorkDays} onChange={setCustomWorkDays} min={1} size="compact" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">Rest days</span>
                  <NumberStepper value={customRestDays} onChange={setCustomRestDays} min={1} size="compact" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
