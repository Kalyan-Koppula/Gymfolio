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
  targetWeightKg: z.number().nullable(),
})
export type RoutineExercise = z.infer<typeof RoutineExerciseSchema>

export const RoutineDaySchema = z.object({
  id: z.string(),
  label: z.string(),
  exercises: z.array(RoutineExerciseSchema),
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
