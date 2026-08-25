// Fixture data for the modules that don't have a backend yet — exercise library, equipment
// profile, routines, and adherence history (see fitness-tracker-architecture.md §12 for the
// build order). Weight, hydration, sleep, and macro logging have moved to the real API in
// src/lib/api-client.ts; the shapes here still mirror PRD §10 / architecture §2 so wiring
// each remaining module up later is a data-source swap, not a redesign.

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "bench"
  | "pull-up-bar"
  | "cable-machine"
  | "kettlebell"
  | "resistance-band"
  | "bodyweight"
  | "squat-rack"

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

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "legs"
  | "arms"
  | "core"
  | "glutes"

export type Exercise = {
  id: string
  name: string
  muscleGroups: MuscleGroup[]
  equipment: Equipment[]
  difficulty: "beginner" | "intermediate" | "advanced"
  instructions: string
  hasGif: boolean
  youtubeStatus: "not_fetched" | "pending" | "ready"
  youtube?: { title: string; channel: string; views: string }
}

const names: Array<[string, MuscleGroup[], Equipment[], Exercise["difficulty"]]> = [
  ["Barbell Back Squat", ["legs", "glutes"], ["barbell", "squat-rack"], "intermediate"],
  ["Flat Barbell Bench Press", ["chest", "arms"], ["barbell", "bench"], "intermediate"],
  ["Conventional Deadlift", ["back", "legs", "glutes"], ["barbell"], "advanced"],
  ["Dumbbell Shoulder Press", ["shoulders", "arms"], ["dumbbell", "bench"], "beginner"],
  ["Pull-Up", ["back", "arms"], ["pull-up-bar", "bodyweight"], "intermediate"],
  ["Dumbbell Row", ["back", "arms"], ["dumbbell", "bench"], "beginner"],
  ["Kettlebell Swing", ["glutes", "back", "core"], ["kettlebell"], "beginner"],
  ["Cable Tricep Pushdown", ["arms"], ["cable-machine"], "beginner"],
  ["Walking Lunge", ["legs", "glutes"], ["dumbbell", "bodyweight"], "beginner"],
  ["Plank", ["core"], ["bodyweight"], "beginner"],
  ["Incline Dumbbell Press", ["chest", "shoulders"], ["dumbbell", "bench"], "intermediate"],
  ["Lat Pulldown", ["back", "arms"], ["cable-machine"], "beginner"],
  ["Romanian Deadlift", ["glutes", "legs"], ["barbell"], "intermediate"],
  ["Face Pull", ["shoulders", "back"], ["cable-machine", "resistance-band"], "beginner"],
  ["Goblet Squat", ["legs", "glutes"], ["kettlebell", "dumbbell"], "beginner"],
  ["Push-Up", ["chest", "arms", "core"], ["bodyweight"], "beginner"],
  ["Barbell Overhead Press", ["shoulders", "arms"], ["barbell", "squat-rack"], "intermediate"],
  ["Seated Cable Row", ["back"], ["cable-machine"], "beginner"],
  ["Dumbbell Bicep Curl", ["arms"], ["dumbbell"], "beginner"],
  ["Hanging Leg Raise", ["core"], ["pull-up-bar", "bodyweight"], "advanced"],
  ["Hip Thrust", ["glutes"], ["barbell", "bench"], "intermediate"],
  ["Band Pull-Apart", ["shoulders", "back"], ["resistance-band"], "beginner"],
  ["Bulgarian Split Squat", ["legs", "glutes"], ["dumbbell", "bench"], "advanced"],
  ["Farmer's Carry", ["core", "back"], ["kettlebell", "dumbbell"], "beginner"],
]

export const EXERCISES: Exercise[] = names.map(([name, muscleGroups, equipment, difficulty], i) => ({
  id: `ex-${i + 1}`,
  name,
  muscleGroups,
  equipment,
  difficulty,
  instructions:
    "Brace your core, control the eccentric, and drive through a full range of motion. Keep the target muscle group under tension throughout — stop 1–2 reps short of failure on working sets.",
  hasGif: i % 7 !== 6,
  youtubeStatus: i < 6 ? "ready" : i < 10 ? "pending" : "not_fetched",
  youtube:
    i < 6
      ? {
          title: `${name} — Perfect Form Tutorial`,
          channel: "Jeff Nippard",
          views: `${(1.2 + i * 0.3).toFixed(1)}M views`,
        }
      : undefined,
}))

export type RoutineExercise = {
  exerciseId: string
  targetSets: number
  targetReps: string
  targetWeightKg: number | null
  /** Stands in for a real session-history read — no WorkoutLog table exists yet. */
  lastPerformance?: { reps: number; weightKg: number; date: string }
}

export type RoutineDay = {
  id: string
  label: string
  exercises: RoutineExercise[]
}

export type SplitType = "full_body" | "upper_lower" | "push_pull_legs" | "bro_split" | "custom"

export type SplitPreset = {
  id: SplitType
  label: string
  description: string
  recommendedDays: string
  dayLabels: string[]
}

// Full Body / Upper-Lower / PPL are the near-universal first-class presets across the
// trackers surveyed (Hevy, Strong, Jefit, Boostcamp); Bro split is a recognized fourth
// named archetype; Custom is the standard blank-slate fallback every app supports.
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

/**
 * Real trackers typically model schedule as a rotating day-list (work N days, rest M,
 * repeat — independent of the calendar) rather than hard-binding to specific weekdays;
 * calendar pinning is layered on top as a convenience, not the source of truth. Both are
 * supported here since the split/schedule flow lets a user pick either.
 */
export type SchedulePattern =
  | { mode: "weekly"; daysPerWeek: number; pinnedWeekdays: string[] }
  | { mode: "rotating"; workDays: number; restDays: number }

export const ROTATING_PATTERNS: Array<{ label: string; workDays: number; restDays: number }> = [
  { label: "1 on / 1 off", workDays: 1, restDays: 1 },
  { label: "2 on / 1 off", workDays: 2, restDays: 1 },
  { label: "3 on / 1 off", workDays: 3, restDays: 1 },
  { label: "6 on / 1 off", workDays: 6, restDays: 1 },
]

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export const ACTIVE_ROUTINE = {
  id: "routine-1",
  name: "Upper/Lower Split — Muscle Gain",
  createdVia: "ai" as const,
  splitType: "upper_lower" as SplitType,
  schedule: { mode: "rotating", workDays: 4, restDays: 1 } as SchedulePattern,
  days: [
    {
      id: "day-1",
      label: "Upper A",
      exercises: [
        {
          exerciseId: "ex-2",
          targetSets: 4,
          targetReps: "6-8",
          targetWeightKg: 70,
          lastPerformance: { reps: 8, weightKg: 70, date: "2026-08-11" },
        },
        {
          exerciseId: "ex-6",
          targetSets: 4,
          targetReps: "8-10",
          targetWeightKg: 24,
          lastPerformance: { reps: 10, weightKg: 24, date: "2026-08-11" },
        },
        {
          exerciseId: "ex-4",
          targetSets: 3,
          targetReps: "10-12",
          targetWeightKg: 18,
          lastPerformance: { reps: 9, weightKg: 18, date: "2026-08-11" },
        },
        {
          exerciseId: "ex-18",
          targetSets: 3,
          targetReps: "12-15",
          targetWeightKg: 40,
          lastPerformance: { reps: 15, weightKg: 40, date: "2026-08-11" },
        },
        { exerciseId: "ex-19", targetSets: 3, targetReps: "12", targetWeightKg: 14 },
      ],
    },
    {
      id: "day-2",
      label: "Lower A",
      exercises: [
        {
          exerciseId: "ex-1",
          targetSets: 4,
          targetReps: "5-6",
          targetWeightKg: 90,
          lastPerformance: { reps: 6, weightKg: 90, date: "2026-08-16" },
        },
        {
          exerciseId: "ex-13",
          targetSets: 3,
          targetReps: "8-10",
          targetWeightKg: 60,
          lastPerformance: { reps: 8, weightKg: 60, date: "2026-08-16" },
        },
        { exerciseId: "ex-9", targetSets: 3, targetReps: "10/leg", targetWeightKg: 16 },
        { exerciseId: "ex-10", targetSets: 3, targetReps: "45s", targetWeightKg: null },
      ],
    },
    {
      id: "day-3",
      label: "Upper B",
      exercises: [
        { exerciseId: "ex-5", targetSets: 4, targetReps: "6-8", targetWeightKg: null },
        {
          exerciseId: "ex-11",
          targetSets: 3,
          targetReps: "8-10",
          targetWeightKg: 26,
          lastPerformance: { reps: 10, weightKg: 26, date: "2026-08-14" },
        },
        {
          exerciseId: "ex-17",
          targetSets: 3,
          targetReps: "8-10",
          targetWeightKg: 45,
          lastPerformance: { reps: 7, weightKg: 45, date: "2026-08-14" },
        },
        {
          exerciseId: "ex-8",
          targetSets: 3,
          targetReps: "10-12",
          targetWeightKg: 25,
          lastPerformance: { reps: 12, weightKg: 25, date: "2026-08-14" },
        },
      ],
    },
    {
      id: "day-4",
      label: "Lower B",
      exercises: [
        {
          exerciseId: "ex-3",
          targetSets: 3,
          targetReps: "5",
          targetWeightKg: 110,
          lastPerformance: { reps: 5, weightKg: 110, date: "2026-08-13" },
        },
        {
          exerciseId: "ex-21",
          targetSets: 3,
          targetReps: "8-10",
          targetWeightKg: 70,
          lastPerformance: { reps: 9, weightKg: 70, date: "2026-08-13" },
        },
        {
          exerciseId: "ex-23",
          targetSets: 3,
          targetReps: "8/leg",
          targetWeightKg: 12,
          lastPerformance: { reps: 6, weightKg: 12, date: "2026-08-13" },
        },
        { exerciseId: "ex-20", targetSets: 3, targetReps: "10", targetWeightKg: null },
      ],
    },
  ] satisfies RoutineDay[],
}

/**
 * Which routine day is "today." Ideally this advances by completed workouts, not calendar
 * days, so it survives any schedule pattern (rotating or weekly) without special-casing —
 * that needs a real WorkoutLog table, which doesn't exist yet (Routine/workout logging is
 * still stub data). `currentCycleStep` is the interim, backend-free stand-in: a value
 * derived from the real date rather than a manually-advanced counter, so it's at least
 * deterministic and actually changes day to day. Replace with a real last-completed-day
 * lookup once workout logging has a backend.
 */
export function getCurrentDay(routine: { days: RoutineDay[] }, cycleStep: number): RoutineDay {
  return routine.days[cycleStep % routine.days.length]
}

export function currentCycleStep(): number {
  return Math.floor(Date.now() / 86_400_000) // days since epoch
}

export function describeSchedule(schedule: SchedulePattern): string {
  return schedule.mode === "weekly"
    ? `${schedule.daysPerWeek} days/week · ${schedule.pinnedWeekdays.join("/")}`
    : `${schedule.workDays} on / ${schedule.restDays} off`
}

/** Linear progression: bump the weight once last session's target reps were fully hit,
 * otherwise repeat it — the StrongLifts/Hevy-style default, not a configurable scheme. */
export function suggestNextWeight(re: RoutineExercise): number | null {
  if (re.targetWeightKg == null) return null
  if (!re.lastPerformance) return re.targetWeightKg
  const targetReps = parseInt(re.targetReps, 10) || 0
  const hitTarget = re.lastPerformance.reps >= targetReps
  return hitTarget ? Math.round((re.lastPerformance.weightKg + 2.5) * 10) / 10 : re.lastPerformance.weightKg
}

/** Which muscle groups a given day-label template is built around — drives the routine
 * wizard's auto-fill so picking "Push" seeds chest/shoulders/triceps work, not a random draw. */
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

/** Seeds a new day with exercises matching its muscle focus, filtered to what's actually
 * available (equipment-filtered pool) — mirrors what AI generation would produce, but runs
 * instantly since it's a stub heuristic rather than a real model call. */
export function autofillDayExercises(
  dayLabel: string,
  availableEquipment: Equipment[],
  count = 4,
): RoutineExercise[] {
  const focus = SPLIT_DAY_MUSCLE_FOCUS[dayLabel] ?? []
  const pool =
    focus.length > 0
      ? // Match on the exercise's primary muscle group only, not "any overlap" — several
        // exercises tag a secondary group (e.g. Pull-Up: back + arms) that would otherwise
        // leak a pulling movement into a Push day just because both mention "arms".
        EXERCISES.filter((ex) => focus.includes(ex.muscleGroups[0]) && ex.equipment.some((e) => availableEquipment.includes(e)))
      : EXERCISES.filter((ex) => ex.equipment.some((e) => availableEquipment.includes(e)))

  return pool.slice(0, count).map((ex) => ({
    exerciseId: ex.id,
    targetSets: 3,
    targetReps: "8-12",
    targetWeightKg: ex.equipment.includes("bodyweight") && ex.equipment.length === 1 ? null : 20,
  }))
}

/** Evenly spaces N training days across a 7-day week for a sensible weekly-schedule
 * default (e.g. 4 days → Mon/Wed/Thu/Sat) — a starting point the user can still retap. */
export function defaultWeekdaysFor(daysPerWeek: number): string[] {
  if (daysPerWeek >= 7) return WEEKDAYS
  const picked = new Set<string>()
  for (let i = 0; i < daysPerWeek; i++) {
    picked.add(WEEKDAYS[Math.round((i * 7) / daysPerWeek) % 7])
  }
  return WEEKDAYS.filter((d) => picked.has(d))
}

function dateOffset(daysAgo: number) {
  const d = new Date(2026, 7, 18)
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

// Weight/hydration/sleep/macro history are real now (see src/lib/api-client.ts) — these
// stub constants stayed only as long as those screens read from stub data.

export const HYDRATION_GOAL_ML = 3000
export const MACRO_TARGETS = { calories: 2400, protein: 180, carbs: 240, fat: 70 }

export const ADHERENCE_HISTORY = Array.from({ length: 12 }, (_, i) => {
  const weeksAgo = 11 - i
  return {
    weekLabel: `Wk ${i + 1}`,
    date: dateOffset(weeksAgo * 7),
    completionPct: Math.min(100, Math.round(62 + weeksAgo * -1.2 + Math.sin(i) * 12)),
  }
})

export const RECENT_SESSIONS = [
  { id: "s1", dayLabel: "Upper A", date: "2026-08-17", completionPct: 100, sets: 19, setsPlanned: 19 },
  { id: "s2", dayLabel: "Lower A", date: "2026-08-16", completionPct: 87, sets: 13, setsPlanned: 15 },
  { id: "s3", dayLabel: "Upper B", date: "2026-08-14", completionPct: 100, sets: 17, setsPlanned: 17 },
  { id: "s4", dayLabel: "Lower B", date: "2026-08-13", completionPct: 69, sets: 9, setsPlanned: 13 },
  { id: "s5", dayLabel: "Upper A", date: "2026-08-11", completionPct: 100, sets: 19, setsPlanned: 19 },
]

export const EQUIPMENT_PROFILE: { tags: Equipment[]; source: "ai_detected" | "manual" } = {
  tags: ["barbell", "dumbbell", "bench", "pull-up-bar", "cable-machine", "squat-rack"],
  source: "ai_detected",
}

export const AI_PROVIDERS = [
  { id: "anthropic", label: "Anthropic", models: ["claude-sonnet-5", "claude-opus-5"] },
  { id: "openai", label: "OpenAI", models: ["gpt-5.2", "gpt-5.2-mini"] },
  { id: "google", label: "Google", models: ["gemini-3-pro"] },
  { id: "local", label: "Local / Ollama-compatible", models: ["llama3.3", "qwen2.5"] },
] as const

export const SESSIONS_LIST = [
  { id: "sess-1", device: "iPhone 16 — Safari", lastActive: "Active now", current: true },
  { id: "sess-2", device: "Home server — Chrome", lastActive: "2 hours ago", current: false },
  { id: "sess-3", device: "iPad — Safari", lastActive: "3 days ago", current: false },
]

export function exerciseById(id: string) {
  return EXERCISES.find((e) => e.id === id)
}
