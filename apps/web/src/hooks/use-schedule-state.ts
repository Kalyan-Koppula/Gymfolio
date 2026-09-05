import * as React from "react"
import { ROTATING_PATTERNS, WEEKDAYS, defaultWeekdaysFor, type SchedulePattern } from "@/lib/stub-data"

/** All the state behind the Schedule step (weekly vs. rotating, pinned weekdays, rotation
 * presets/custom), resolved down to a single SchedulePattern — extracted so the Routine Wizard
 * and Onboarding's workout-setup steps share one implementation instead of two copies. */
export function useScheduleState(initialDaysPerWeek = 4) {
  const [scheduleMode, setScheduleMode] = React.useState<"weekly" | "rotating">("weekly")
  // Day count is derived from pinnedWeekdays — never a separate counter that can drift.
  const [pinnedWeekdays, setPinnedWeekdays] = React.useState<string[]>(() =>
    defaultWeekdaysFor(initialDaysPerWeek),
  )
  const [rotatingPattern, setRotatingPattern] = React.useState(ROTATING_PATTERNS[2]) // "3 on / 1 off"
  const [customWorkDays, setCustomWorkDays] = React.useState(3)
  const [customRestDays, setCustomRestDays] = React.useState(1)
  const [useCustomRotation, setUseCustomRotation] = React.useState(false)

  const daysPerWeek = pinnedWeekdays.length

  function setDaysPerWeek(v: number) {
    setPinnedWeekdays(defaultWeekdaysFor(v))
  }

  function toggleWeekday(day: string) {
    setPinnedWeekdays((prev) => {
      if (prev.includes(day)) {
        // Keep at least one pinned day so daysPerWeek never collapses to 0.
        if (prev.length <= 1) return prev
        return prev.filter((d) => d !== day)
      }
      return [...prev, day].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b))
    })
  }

  const schedule: SchedulePattern =
    scheduleMode === "weekly"
      ? { mode: "weekly", daysPerWeek, pinnedWeekdays }
      : useCustomRotation
        ? { mode: "rotating", workDays: customWorkDays, restDays: customRestDays }
        : { mode: "rotating", workDays: rotatingPattern.workDays, restDays: rotatingPattern.restDays }

  return {
    schedule,
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
  }
}

export type ScheduleState = ReturnType<typeof useScheduleState>
