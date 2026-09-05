import { z } from "zod"

export const SplitTypeSchema = z.enum(["full_body", "upper_lower", "push_pull_legs", "bro_split", "custom"])
export type SplitType = z.infer<typeof SplitTypeSchema>

export const SchedulePatternSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("weekly"), daysPerWeek: z.number().int().min(1).max(7), pinnedWeekdays: z.array(z.string()) }),
  z.object({ mode: z.literal("rotating"), workDays: z.number().int().positive(), restDays: z.number().int().positive() }),
])
export type SchedulePattern = z.infer<typeof SchedulePatternSchema>

export const RoutineExerciseSchema = z.object({
  exerciseId: z.string(),
  targetSets: z.number().int().positive(),
  targetReps: z.string(),
  /** Position within the day; omitted on older saves — backfilled from array index. */
  orderIndex: z.number().int().nonnegative().optional(),
})
export type RoutineExercise = z.infer<typeof RoutineExerciseSchema>

/** Backfill orderIndex from array position, then sort stably within a day. */
export function normalizeRoutineExercises(exercises: RoutineExercise[]): RoutineExercise[] {
  return exercises
    .map((e, i) => ({
      ...e,
      orderIndex: typeof e.orderIndex === "number" ? e.orderIndex : i,
    }))
    .slice()
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
}

export const DayTypeSchema = z.enum(["training", "rest"])
export type DayType = z.infer<typeof DayTypeSchema>

export const RoutineDaySchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(80),
  dayType: DayTypeSchema.default("training"),
  orderIndex: z.number().int().nonnegative(),
  exercises: z.array(RoutineExerciseSchema),
  /** Soft-delete timestamp — omitted/null means active. Recoverable while still on the routine. */
  archivedAt: z.number().nullable().optional(),
})
export type RoutineDay = z.infer<typeof RoutineDaySchema>

export const SaveRoutineInputSchema = z.object({
  name: z.string().min(1).max(120),
  splitType: SplitTypeSchema,
  schedule: SchedulePatternSchema,
  days: z.array(RoutineDaySchema),
})
export type SaveRoutineInput = z.infer<typeof SaveRoutineInputSchema>

export const RoutineSchema = SaveRoutineInputSchema.extend({ updatedAt: z.number() })
export type Routine = z.infer<typeof RoutineSchema>

/** Active (non-archived) days in stable order. */
export function activeRoutineDays(days: RoutineDay[]): RoutineDay[] {
  return days
    .filter((d) => d.archivedAt == null)
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
}
