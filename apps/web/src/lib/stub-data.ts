// Client-side training constants and heuristics (split presets, schedule helpers, day→muscle
// mapping). Legacy filename "stub-data" — this no longer holds fake user data; the exercise
// library, routines, and sessions all come from the API.

export type { Equipment, SplitType, SchedulePattern, Exercise, MuscleGroup, DayType } from "shared"
import type {
  Equipment,
  Exercise,
  MuscleGroup,
  DayType,
  RoutineDay as SharedRoutineDay,
  RoutineExercise as SharedRoutineExercise,
  SchedulePattern,
  SplitType,
} from "shared"
import { activeRoutineDays, normalizeRoutineExercises } from "shared"

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  bench: "Bench",
  "pull-up-bar": "Pull-up Bar",
  "cable-machine": "Cable Machine",
  kettlebell: "Kettlebell",
  "resistance-band": "Resistance Band",
  bodyweight: "Bodyweight",
  "squat-rack": "Squat Rack",
}

export type RoutineExercise = SharedRoutineExercise & {
  /** Client-only hint from last completed session — never persisted. */
  lastSets?: Array<{ setIndex: number; reps: number; weightKg: number }>
  lastPerformanceDate?: string
}

export type RoutineDay = Omit<SharedRoutineDay, "exercises"> & {
  exercises: RoutineExercise[]
}

export type SplitPreset = {
  id: SplitType
  label: string
  description: string
  recommendedDays: string
  dayLabels: string[]
}

export const SPLIT_PRESETS: SplitPreset[] = [
  {
    id: "full_body",
    label: "Full Body",
    description: "Every major muscle group, every session — efficient at lower weekly frequency.",
    recommendedDays: "2–3 days/week",
    dayLabels: ["Full Body A", "Full Body B", "Full Body C"],
  },
  {
    id: "upper_lower",
    label: "Upper / Lower",
    description: "Alternate upper-body and lower-body sessions for balanced frequency and recovery.",
    recommendedDays: "4 days/week",
    dayLabels: ["Upper A", "Lower A", "Upper B", "Lower B"],
  },
  {
    id: "push_pull_legs",
    label: "Push / Pull / Legs",
    description: "Grouped by movement pattern — pushing, pulling, and legs — scales from 3 to 6 days.",
    recommendedDays: "3–6 days/week",
    dayLabels: ["Push", "Pull", "Legs"],
  },
  {
    id: "bro_split",
    label: "Bro Split",
    description: "One muscle group per day for maximum per-session focus and volume.",
    recommendedDays: "5 days/week",
    dayLabels: ["Chest", "Back", "Shoulders", "Arms", "Legs"],
  },
  {
    id: "custom",
    label: "Custom",
    description: "Start from a blank slate and build your own days from scratch.",
    recommendedDays: "Any",
    dayLabels: [],
  },
]

export function splitPreset(id: SplitType) {
  return SPLIT_PRESETS.find((p) => p.id === id)!
}

export const ROTATING_PATTERNS: Array<{ label: string; workDays: number; restDays: number }> = [
  { label: "1 on / 1 off", workDays: 1, restDays: 1 },
  { label: "2 on / 1 off", workDays: 2, restDays: 1 },
  { label: "3 on / 1 off", workDays: 3, restDays: 1 },
  { label: "6 on / 1 off", workDays: 6, restDays: 1 },
]

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function scheduleSlotCount(schedule: SchedulePattern): number {
  return schedule.mode === "weekly" ? schedule.daysPerWeek : schedule.workDays + schedule.restDays
}

export function normalizeRoutineDay(
  d: Partial<RoutineDay> & { id: string; label: string },
  index: number,
): RoutineDay {
  const dayType: DayType = d.dayType ?? (d.label.toLowerCase().includes("rest") ? "rest" : "training")
  return {
    id: d.id,
    label: d.label,
    dayType,
    orderIndex: typeof d.orderIndex === "number" ? d.orderIndex : index,
    exercises: dayType === "rest" ? [] : (normalizeRoutineExercises(d.exercises ?? []) as RoutineExercise[]),
    archivedAt: d.archivedAt ?? null,
  }
}

export function activeDays(days: RoutineDay[]): RoutineDay[] {
  return activeRoutineDays(days) as RoutineDay[]
}

/**
 * Save-shaped days: client-only fields dropped, dayType/orderIndex/archivedAt
 * guaranteed. Archived days are kept so an undo stays recoverable after a save.
 */
export function toSaveRoutineDays(days: RoutineDay[]): SharedRoutineDay[] {
  return days.map((d, i) => {
    const day = normalizeRoutineDay(d, i)
    return {
      id: day.id,
      label: day.label,
      dayType: day.dayType,
      orderIndex: day.orderIndex,
      archivedAt: day.archivedAt ?? null,
      exercises: day.exercises.map(({ exerciseId, targetSets, targetReps, orderIndex }, ei) => ({
        exerciseId,
        targetSets,
        targetReps,
        orderIndex: typeof orderIndex === "number" ? orderIndex : ei,
      })),
    }
  })
}

export function describeSchedule(schedule: SchedulePattern): string {
  return schedule.mode === "weekly"
    ? `${schedule.daysPerWeek} days/week · ${schedule.pinnedWeekdays.join("/")}`
    : `${schedule.workDays} on / ${schedule.restDays} off`
}

/**
 * Runtime weight suggestion: last logged weight for this set index + 2.5kg.
 * Extra sets beyond last session use the last available set's weight + 2.5kg.
 * No prior performance → null (blank field, don't guess).
 */
export function suggestedWeightKg(
  setIndex: number,
  priorSets: Array<{ setIndex: number; weightKg: number }> | undefined,
): number | null {
  if (!priorSets || priorSets.length === 0) return null
  const sorted = priorSets.slice().sort((a, b) => a.setIndex - b.setIndex)
  const exact = sorted.find((s) => s.setIndex === setIndex)
  const base = exact ?? sorted[sorted.length - 1]
  return Math.round((base.weightKg + 2.5) * 10) / 10
}

/** @deprecated use suggestedWeightKg — kept briefly for any leftover imports */
export function suggestNextWeight(re: RoutineExercise): number | null {
  return suggestedWeightKg(0, re.lastSets)
}

const SPLIT_DAY_MUSCLE_FOCUS: Record<string, MuscleGroup[]> = {
  "Full Body A": ["chest", "back", "legs"],
  "Full Body B": ["shoulders", "arms", "glutes"],
  "Full Body C": ["back", "legs", "core"],
  "Upper A": ["chest", "back", "shoulders", "arms"],
  "Lower A": ["legs", "glutes", "core"],
  "Upper B": ["chest", "back", "shoulders", "arms"],
  "Lower B": ["legs", "glutes", "core"],
  Push: ["chest", "shoulders", "arms"],
  Pull: ["back", "arms"],
  Legs: ["legs", "glutes"],
  Chest: ["chest"],
  Back: ["back"],
  Shoulders: ["shoulders"],
  Arms: ["arms"],
  Rest: [],
}

/** Muscle groups targeted by a day label (exact preset name or fuzzy: push, pull, upper, …). */
export function resolveDayMuscleFocus(dayLabel: string): MuscleGroup[] | null {
  if (dayLabel.toLowerCase().includes("rest")) return []
  if (SPLIT_DAY_MUSCLE_FOCUS[dayLabel]) return SPLIT_DAY_MUSCLE_FOCUS[dayLabel]
  const l = dayLabel.toLowerCase()
  if (l.includes("push")) return SPLIT_DAY_MUSCLE_FOCUS.Push
  if (l.includes("pull")) return SPLIT_DAY_MUSCLE_FOCUS.Pull
  if (l.includes("upper")) return SPLIT_DAY_MUSCLE_FOCUS["Upper A"]
  if (l.includes("lower")) return SPLIT_DAY_MUSCLE_FOCUS["Lower A"]
  if (l.includes("leg")) return SPLIT_DAY_MUSCLE_FOCUS.Legs
  if (l.includes("chest")) return ["chest"]
  if (l.includes("back")) return ["back"]
  if (l.includes("shoulder")) return ["shoulders"]
  if (l.includes("arm")) return ["arms"]
  if (l.includes("glute")) return ["glutes", "legs"]
  if (l.includes("core") || l.includes("abs")) return ["core"]
  if (l.includes("full")) return ["chest", "back", "shoulders", "legs", "arms", "glutes", "core"]
  return null
}

export function describeDayFocus(dayLabel: string): string {
  const focus = resolveDayMuscleFocus(dayLabel)
  if (focus && focus.length === 0) return "Rest day"
  if (!focus?.length) return "All muscle groups"
  return focus.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(" · ")
}

function hasUserEquipment(exercise: Exercise, availableEquipment: Equipment[]) {
  if (availableEquipment.length === 0) return true
  return exercise.equipment.some((e) => availableEquipment.includes(e))
}

export function exerciseMatchesDayFocus(exercise: Exercise, focus: MuscleGroup[]) {
  return exercise.muscleGroups.some((m) => focus.includes(m))
}

function focusOverlap(a: MuscleGroup[] | null, b: MuscleGroup[] | null): number {
  if (!a?.length || !b?.length) return 0
  return a.filter((m) => b.includes(m)).length
}

/** Split-aware exercise lists for routine day pickers. */
export function filterExercisesForDay(
  pool: Exercise[],
  dayLabel: string,
  opts?: { equipment?: Equipment[]; excludeIds?: Iterable<string> },
) {
  const exclude = new Set(opts?.excludeIds)
  const equipment = opts?.equipment ?? []
  const available = pool.filter((ex) => !exclude.has(ex.id) && hasUserEquipment(ex, equipment))
  const focus = resolveDayMuscleFocus(dayLabel)
  if (!focus?.length) return { recommended: available, all: available }
  const recommended = available.filter((ex) => exerciseMatchesDayFocus(ex, focus))
  return { recommended, all: available }
}

/** Seeds a day from an exercise pool (API-loaded) matching muscle focus + equipment. */
export function autofillDayExercises(
  dayLabel: string,
  availableEquipment: Equipment[],
  pool: Exercise[],
  count = 4,
): RoutineExercise[] {
  const focus = resolveDayMuscleFocus(dayLabel)
  if (focus && focus.length === 0) return []
  const filtered =
    focus && focus.length > 0
      ? pool.filter((ex) => exerciseMatchesDayFocus(ex, focus) && hasUserEquipment(ex, availableEquipment))
      : pool.filter((ex) => hasUserEquipment(ex, availableEquipment))

  return filtered.slice(0, count).map((ex, i) => {
    const loadBearing = ex.equipment.some((e) =>
      ["barbell", "dumbbell", "kettlebell", "cable-machine", "squat-rack", "bench"].includes(e),
    )
    return {
      exerciseId: ex.id,
      targetSets: 3,
      targetReps: "8-12",
      orderIndex: i,
      trackWeight: loadBearing,
    }
  })
}

/**
 * Build an initial day list for a split + schedule.
 * When the schedule needs more slots than the preset, repeats the training cycle and
 * inserts Rest between cycles as a starting point — fully editable afterward.
 */
export function buildDaysForSplit(
  splitType: SplitType,
  schedule: SchedulePattern,
  equipment: Equipment[],
  pool: Exercise[],
  idPrefix = "day",
): RoutineDay[] {
  const preset = splitPreset(splitType)
  const target = scheduleSlotCount(schedule)
  const trainingLabels =
    preset.dayLabels.length > 0
      ? preset.dayLabels
      : Array.from({ length: Math.max(1, target) }, (_, i) => `Day ${i + 1}`)

  const slots: Array<{ label: string; dayType: DayType }> = []
  let ti = 0
  while (slots.length < target) {
    if (ti > 0 && ti % trainingLabels.length === 0 && slots.length < target) {
      slots.push({ label: "Rest", dayType: "rest" })
      if (slots.length >= target) break
    }
    slots.push({
      label: trainingLabels[ti % trainingLabels.length],
      dayType: "training",
    })
    ti++
  }

  return slots.map((s, i) =>
    normalizeRoutineDay(
      {
        id: `${idPrefix}-${i + 1}`,
        label: s.label,
        dayType: s.dayType,
        orderIndex: i,
        exercises:
          s.dayType === "rest" ? [] : autofillDayExercises(s.label, equipment, pool),
      },
      i,
    ),
  )
}

/**
 * In-place split change: map new labels, keep exercises with overlapping muscle focus,
 * archive days that no longer fit, add empty days for new slots.
 */
export function applySplitInPlace(
  existing: RoutineDay[],
  newSplitType: SplitType,
  schedule: SchedulePattern,
): RoutineDay[] {
  const active = activeDays(existing)
  const archivedKeep = existing.filter((d) => d.archivedAt != null)
  const target = Math.max(scheduleSlotCount(schedule), active.length, 1)
  // Labels only (no autofill) — carried-over exercises come from the days being replaced.
  const preset = splitPreset(newSplitType)
  const trainingLabels = preset.dayLabels.length > 0 ? preset.dayLabels : ["Day 1"]
  const newSlots: Array<{ label: string; dayType: DayType }> = []
  let ti = 0
  while (newSlots.length < target) {
    if (ti > 0 && ti % trainingLabels.length === 0 && newSlots.length < target) {
      newSlots.push({ label: "Rest", dayType: "rest" })
      if (newSlots.length >= target) break
    }
    newSlots.push({ label: trainingLabels[ti % trainingLabels.length], dayType: "training" })
    ti++
  }

  const usedOld = new Set<string>()
  const now = Date.now()
  const next: RoutineDay[] = newSlots.map((slot, i) => {
    const newFocus = resolveDayMuscleFocus(slot.label)
    let best: RoutineDay | null = null
    let bestScore = 0
    for (const old of active) {
      if (usedOld.has(old.id)) continue
      const score = focusOverlap(resolveDayMuscleFocus(old.label), newFocus)
      if (score > bestScore) {
        bestScore = score
        best = old
      }
    }
    if (best && bestScore > 0) {
      usedOld.add(best.id)
      // Exercises carry over wholesale: without the exercise pool here we can't tell which
      // still match the new focus, and silently dropping the user's work is the worse failure.
      return normalizeRoutineDay(
        {
          id: best.id,
          label: slot.label,
          dayType: slot.dayType,
          orderIndex: i,
          exercises: slot.dayType === "rest" ? [] : best.exercises,
        },
        i,
      )
    }
    return normalizeRoutineDay(
      {
        id: crypto.randomUUID(),
        label: slot.label,
        dayType: slot.dayType,
        orderIndex: i,
        exercises: [],
      },
      i,
    )
  })

  const newlyArchived = active
    .filter((d) => !usedOld.has(d.id) && !next.some((n) => n.id === d.id))
    .map((d) => ({ ...d, archivedAt: now }))

  return [...next, ...newlyArchived, ...archivedKeep]
}

export function defaultWeekdaysFor(daysPerWeek: number): string[] {
  if (daysPerWeek >= 7) return WEEKDAYS
  const picked = new Set<string>()
  for (let i = 0; i < daysPerWeek; i++) {
    picked.add(WEEKDAYS[Math.round((i * 7) / daysPerWeek) % 7])
  }
  return WEEKDAYS.filter((d) => picked.has(d))
}

export const AI_PROVIDERS = [
  { id: "openrouter" as const, label: "OpenRouter", models: ["openrouter/free"] },
  { id: "local" as const, label: "Local / OpenAI-compatible", models: ["llama3.3", "qwen2.5"] },
]
