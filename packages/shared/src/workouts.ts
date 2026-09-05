import { z } from "zod"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")

export const WorkoutStatusSchema = z.enum(["in_progress", "completed", "skipped"])
export type WorkoutStatus = z.infer<typeof WorkoutStatusSchema>

export const WorkoutLogSetSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  setIndex: z.number().int().nonnegative(),
  actualReps: z.number().int().nonnegative(),
  actualWeightKg: z.number().nonnegative(),
  updatedAt: z.number(),
})
export type WorkoutLogSet = z.infer<typeof WorkoutLogSetSchema>

export const WorkoutLogSchema = z.object({
  id: z.string(),
  date: isoDate,
  dayLabel: z.string(),
  dayIndex: z.number().int().nonnegative(),
  status: WorkoutStatusSchema,
  setsPlanned: z.number().int().nonnegative(),
  setsCompleted: z.number().int().nonnegative(),
  completionPct: z.number().int().min(0).max(100),
  startedAt: z.number(),
  completedAt: z.number().nullable(),
  updatedAt: z.number(),
  sets: z.array(WorkoutLogSetSchema).optional(),
})
export type WorkoutLog = z.infer<typeof WorkoutLogSchema>

export const StartWorkoutInputSchema = z.object({
  date: isoDate,
  dayLabel: z.string().min(1),
  dayIndex: z.number().int().nonnegative(),
  setsPlanned: z.number().int().positive(),
})
export type StartWorkoutInput = z.infer<typeof StartWorkoutInputSchema>

export const SkipWorkoutInputSchema = z.object({
  date: isoDate,
  dayLabel: z.string().min(1),
  dayIndex: z.number().int().nonnegative(),
})
export type SkipWorkoutInput = z.infer<typeof SkipWorkoutInputSchema>

export const LogWorkoutSetInputSchema = z.object({
  exerciseId: z.string().min(1),
  setIndex: z.number().int().nonnegative(),
  actualReps: z.number().int().nonnegative(),
  actualWeightKg: z.number().nonnegative(),
})
export type LogWorkoutSetInput = z.infer<typeof LogWorkoutSetInputSchema>

export const WorkoutSessionSummarySchema = z.object({
  id: z.string(),
  dayLabel: z.string(),
  date: isoDate,
  status: z.enum(["completed", "skipped"]),
  completionPct: z.number().int().min(0).max(100),
  sets: z.number().int().nonnegative(),
  setsPlanned: z.number().int().nonnegative(),
})
export type WorkoutSessionSummary = z.infer<typeof WorkoutSessionSummarySchema>

export const AdherenceWeekSchema = z.object({
  weekLabel: z.string(),
  date: isoDate, // week start (Monday)
  /** Planned training slots that resolved this week (completed + skipped). */
  sessionsPlanned: z.number().int().nonnegative(),
  sessionsCompleted: z.number().int().nonnegative(),
  sessionsSkipped: z.number().int().nonnegative(),
  /**
   * Adherence %: completed / (completed + skipped).
   * Skips count against adherence; weeks with no resolved sessions stay null (no-data).
   */
  completionPct: z.number().int().min(0).max(100).nullable(),
})
export type AdherenceWeek = z.infer<typeof AdherenceWeekSchema>

export const LastPerformanceSchema = z.object({
  exerciseId: z.string(),
  reps: z.number().int().nonnegative(),
  weightKg: z.number().nonnegative(),
  date: isoDate,
})
export type LastPerformance = z.infer<typeof LastPerformanceSchema>
