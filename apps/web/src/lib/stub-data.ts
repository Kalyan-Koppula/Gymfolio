// Client-side training constants and heuristics (split presets, schedule helpers, day→muscle
// mapping). Legacy filename "stub-data" — this no longer holds fake user data; the exercise
// library, routines, and sessions all come from the API.

export type { Equipment, SplitType, SchedulePattern, Exercise, MuscleGroup } from "shared"
import type { Equipment, Exercise, MuscleGroup, RoutineExercise as SharedRoutineExercise } from "shared"

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
  lastPerformance?: { reps: number; weightKg: number; date: string }
}

export type RoutineDay = {
  id: string
  label: string
  exercises: RoutineExercise[]
}

export type SplitPreset = {
  id: import("shared").SplitType
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

export function splitPreset(id: import("shared").SplitType) {
  return SPLIT_PRESETS.find((p) => p.id === id)!
}

export const ROTATING_PATTERNS: Array<{ label: string; workDays: number; restDays: number }> = [
  { label: "1 on / 1 off", workDays: 1, restDays: 1 },
  { label: "2 on / 1 off", workDays: 2, restDays: 1 },
  { label: "3 on / 1 off", workDays: 3, restDays: 1 },
  { label: "6 on / 1 off", workDays: 6, restDays: 1 },
]

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function getCurrentDay(routine: { days: RoutineDay[] }, cycleStep: number): RoutineDay {
  return routine.days[cycleStep % routine.days.length]
}

export function describeSchedule(schedule: import("shared").SchedulePattern): string {
  return schedule.mode === "weekly"
    ? `${schedule.daysPerWeek} days/week · ${schedule.pinnedWeekdays.join("/")}`
    : `${schedule.workDays} on / ${schedule.restDays} off`
}

export function suggestNextWeight(re: RoutineExercise): number | null {
  if (re.targetWeightKg == null) return null
  if (!re.lastPerformance) return re.targetWeightKg
  const targetReps = parseInt(re.targetReps, 10) || 0
  const hitTarget = re.lastPerformance.reps >= targetReps
  return hitTarget ? Math.round((re.lastPerformance.weightKg + 2.5) * 10) / 10 : re.lastPerformance.weightKg
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
}

/** Muscle groups targeted by a day label (exact preset name or fuzzy: push, pull, upper, …). */
export function resolveDayMuscleFocus(dayLabel: string): MuscleGroup[] | null {
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
  const filtered =
    focus && focus.length > 0
      ? pool.filter((ex) => exerciseMatchesDayFocus(ex, focus) && hasUserEquipment(ex, availableEquipment))
      : pool.filter((ex) => hasUserEquipment(ex, availableEquipment))

  return filtered.slice(0, count).map((ex) => ({
    exerciseId: ex.id,
    targetSets: 3,
    targetReps: "8-12",
    targetWeightKg: ex.equipment.includes("bodyweight") && ex.equipment.length === 1 ? null : 20,
  }))
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
  { id: "anthropic", label: "Anthropic", models: ["claude-sonnet-5", "claude-opus-5"] },
  { id: "openai", label: "OpenAI", models: ["gpt-5.2", "gpt-5.2-mini"] },
  { id: "google", label: "Google", models: ["gemini-3-pro"] },
  { id: "local", label: "Local / Ollama-compatible", models: ["llama3.3", "qwen2.5"] },
] as const
