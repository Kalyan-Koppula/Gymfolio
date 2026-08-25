import { z } from "zod"

// Field names deliberately mirror apps/web/src/lib/stub-data.ts exactly (weightKg, not
// weight) so swapping the frontend from stub data to these responses is a data-source
// change, not a shape change.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")

export const BodyMetricEntrySchema = z.object({
  id: z.string(),
  date: isoDate,
  weightKg: z.number().positive(),
  measurements: z.record(z.string(), z.number()).optional(),
  updatedAt: z.number(),
})
export type BodyMetricEntry = z.infer<typeof BodyMetricEntrySchema>

export const CreateBodyMetricEntryInputSchema = z.object({
  date: isoDate,
  weightKg: z.number().positive(),
  measurements: z.record(z.string(), z.number()).optional(),
})
export type CreateBodyMetricEntryInput = z.infer<typeof CreateBodyMetricEntryInputSchema>

// One row per log — a quick-add tap is one entry, not a mutated running total. "Today's
// total" is a derived SUM(amountMl), computed server-side (see apps/api hydration route).
export const HydrationEntrySchema = z.object({
  id: z.string(),
  date: isoDate,
  amountMl: z.number().int().positive(),
  updatedAt: z.number(),
})
export type HydrationEntry = z.infer<typeof HydrationEntrySchema>

export const CreateHydrationEntryInputSchema = z.object({
  date: isoDate,
  amountMl: z.number().int().positive(),
})
export type CreateHydrationEntryInput = z.infer<typeof CreateHydrationEntryInputSchema>

export const HydrationTodayResponseSchema = z.object({
  date: isoDate,
  totalMl: z.number().int().nonnegative(),
  entries: z.array(HydrationEntrySchema),
})
export type HydrationTodayResponse = z.infer<typeof HydrationTodayResponseSchema>

const timeOfDay = z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM")

export const SleepEntrySchema = z.object({
  id: z.string(),
  date: isoDate,
  startTime: timeOfDay,
  endTime: timeOfDay,
  hours: z.number().nonnegative(),
  quality: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  updatedAt: z.number(),
})
export type SleepEntry = z.infer<typeof SleepEntrySchema>

export const CreateSleepEntryInputSchema = z.object({
  date: isoDate,
  startTime: timeOfDay,
  endTime: timeOfDay,
  quality: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
})
export type CreateSleepEntryInput = z.infer<typeof CreateSleepEntryInputSchema>

// Daily upsert — one row per date, not an append log (PUT semantics) — plain numeric
// totals, no per-meal breakdown.
export const MacroEntrySchema = z.object({
  date: isoDate,
  calories: z.number().int().nonnegative(),
  protein: z.number().int().nonnegative(),
  carbs: z.number().int().nonnegative(),
  fat: z.number().int().nonnegative(),
  updatedAt: z.number(),
})
export type MacroEntry = z.infer<typeof MacroEntrySchema>

export const UpsertMacroEntryInputSchema = z.object({
  date: isoDate,
  calories: z.number().int().nonnegative(),
  protein: z.number().int().nonnegative(),
  carbs: z.number().int().nonnegative(),
  fat: z.number().int().nonnegative(),
})
export type UpsertMacroEntryInput = z.infer<typeof UpsertMacroEntryInputSchema>
