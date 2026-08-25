import * as React from "react"
import { ROTATING_PATTERNS, WEEKDAYS, defaultWeekdaysFor, type SchedulePattern } from "@/lib/stub-data"

/** All the state behind the Schedule step (weekly vs. rotating, pinned weekdays, rotation
 * presets/custom), resolved down to a single SchedulePattern — extracted so the Routine Wizard
 * and Onboarding's workout-setup steps share one implementation instead of two copies. */
export function useScheduleState(initialDaysPerWeek = 4) {
  const [scheduleMode, setScheduleMode] = React.useState<"weekly" | "rotating">("weekly")
  const [daysPerWeek, setDaysPerWeekState] = React.useState(initialDaysPerWeek)
  const [pinnedWeekdays, setPinnedWeekdays] = React.useState<string[]>(() => defaultWeekdaysFor(initialDaysPerWeek))
  const [rotatingPattern, setRotatingPattern] = React.useState(ROTATING_PATTERNS[2]) // "3 on / 1 off"
  const [customWorkDays, setCustomWorkDays] = React.useState(3)
  const [customRestDays, setCustomRestDays] = React.useState(1)
  const [useCustomRotation, setUseCustomRotation] = React.useState(false)

  function setDaysPerWeek(v: number) {
    setDaysPerWeekState(v)
    setPinnedWeekdays(defaultWeekdaysFor(v))
  }

  function toggleWeekday(day: string) {
    setPinnedWeekdays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)),
    )
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
