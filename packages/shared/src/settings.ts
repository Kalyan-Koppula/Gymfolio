import { z } from "zod"

export const EquipmentSchema = z.enum([
  "barbell",
  "dumbbell",
  "bench",
  "pull-up-bar",
  "cable-machine",
  "kettlebell",
  "resistance-band",
  "bodyweight",
  "squat-rack",
])
export type Equipment = z.infer<typeof EquipmentSchema>

export const MacroTargetsSchema = z.object({
  calories: z.number().int().nonnegative(),
  protein: z.number().int().nonnegative(),
  carbs: z.number().int().nonnegative(),
  fat: z.number().int().nonnegative(),
})
export type MacroTargets = z.infer<typeof MacroTargetsSchema>

export const UserSettingsSchema = z.object({
  hydrationGoalMl: z.number().int().positive(),
  macroMode: z.enum(["computed", "manual"]),
  bodyweightKg: z.number().positive().nullable(),
  macroTargets: MacroTargetsSchema,
  equipment: z.array(EquipmentSchema),
  onboardingCompletedAt: z.number().nullable(),
})
export type UserSettings = z.infer<typeof UserSettingsSchema>

export const UpsertUserSettingsInputSchema = z.object({
  hydrationGoalMl: z.number().int().positive(),
  macroMode: z.enum(["computed", "manual"]),
  bodyweightKg: z.number().positive().nullable().optional(),
  macroTargets: MacroTargetsSchema,
  equipment: z.array(EquipmentSchema),
  // Stamps onboardingCompletedAt server-side on first use — set on the final onboarding save,
  // omitted on later edits from Settings so it never resets.
  completeOnboarding: z.boolean().optional(),
})
export type UpsertUserSettingsInput = z.infer<typeof UpsertUserSettingsInputSchema>
